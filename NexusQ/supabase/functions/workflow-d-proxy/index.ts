import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type PipelineStage = "new" | "qualifying" | "quoted" | "booked";

type PipelineUpdateRequest = {
  lead_id?: string;
  status?: string;
  stage?: string;
  value?: number | string | null;
  client_id?: string | null;
};

type PersistenceSnapshot = {
  verified: boolean;
  pipeline_stage: string | null;
  lead_status: string | null;
};

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveWorkflowDUrl() {
  const candidates = [
    getOptionalEnv("WORKFLOW_D_URL"),
    getOptionalEnv("WORKFLOW_D_WEBHOOK_URL"),
    getOptionalEnv("WORKFLOW_D_FALLBACK_URL"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return candidate;
      }
    } catch {
      // Ignore malformed URL and continue to next candidate.
    }
  }

  throw new Error("No valid Workflow D URL configured.");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeStage(rawValue: unknown): PipelineStage {
  const value = String(rawValue ?? "").toLowerCase().trim();
  if (value === "new" || value.includes("new")) return "new";
  if (value === "qualifying" || value.includes("qualif") || value.includes("inspect")) return "qualifying";
  if (value === "quoted" || value.includes("quote")) return "quoted";
  if (value === "booked" || value.includes("book") || value.includes("won") || value.includes("deal")) return "booked";
  return "new";
}

function parseNumericOrNull(rawValue: unknown) {
  if (rawValue == null || rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function getAuthClient(request: Request) {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function getServiceClient() {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAuthenticatedUser(request: Request): Promise<User> {
  const token = extractBearerToken(request);
  if (!token) throw new Error("Missing Authorization header.");

  const authClient = getAuthClient(request);
  if (!authClient) throw new Error("Missing Authorization header.");

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error(error?.message || "Unauthorized request.");
  }
  return data.user;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as PipelineUpdateRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function resolveLeadContext(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  userId: string;
  leadId: string;
}) {
  const { serviceClient, userId, leadId } = params;
  const { data: lead, error: leadError } = await serviceClient
    .from("leads")
    .select("id, client_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) throw new Error(`Failed to resolve lead context: ${leadError.message}`);
  if (!lead?.id || !lead.client_id) {
    throw new Error("Lead not found.");
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("user_access")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", lead.client_id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) throw new Error(`Failed to verify workspace access: ${membershipError.message}`);
  if (!membership?.id) {
    throw new Error("You do not have access to this lead's workspace.");
  }

  return { clientId: lead.client_id };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPersistence(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  leadId: string;
  expectedStage: PipelineStage;
}): Promise<PersistenceSnapshot> {
  const { serviceClient, leadId, expectedStage } = params;
  let lastSnapshot: PersistenceSnapshot = {
    verified: false,
    pipeline_stage: null,
    lead_status: null,
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [{ data: pipelineRow, error: pipelineError }, { data: leadRow, error: leadError }] = await Promise.all([
      serviceClient
        .from("pipeline")
        .select("stage")
        .eq("lead_id", leadId)
        .maybeSingle(),
      serviceClient
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .maybeSingle(),
    ]);

    if (pipelineError) throw new Error(`Pipeline verification failed: ${pipelineError.message}`);
    if (leadError) throw new Error(`Lead verification failed: ${leadError.message}`);

    const pipelineStage = (pipelineRow?.stage as string | null) ?? null;
    const leadStatus = (leadRow?.status as string | null) ?? null;
    const verified = pipelineStage === expectedStage && leadStatus === expectedStage;

    lastSnapshot = {
      verified,
      pipeline_stage: pipelineStage,
      lead_status: leadStatus,
    };

    if (verified) {
      return lastSnapshot;
    }

    if (attempt < 3) {
      await sleep(250 * (attempt + 1));
    }
  }

  return lastSnapshot;
}

async function parseWorkflowPayload(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 240) };
  }
}

async function forwardWorkflowD(args: {
  workflowUrl: string;
  secret?: string | null;
  payload: Record<string, unknown>;
}) {
  const timeoutMs = 12000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (args.secret) {
        headers["x-nexusq-secret"] = args.secret;
      }

      const response = await fetch(args.workflowUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(args.payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < 1) {
        await sleep(300 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Workflow D network request failed.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = await parseJsonBody(request);

    const leadId = String(body.lead_id ?? "").trim();
    if (!leadId || !isUuid(leadId)) {
      return jsonResponse({ ok: false, error: "lead_id is required and must be a UUID." }, 400);
    }

    const stage = normalizeStage(body.status ?? body.stage);
    const value = parseNumericOrNull(body.value);
    const serviceClient = getServiceClient();
    const context = await resolveLeadContext({
      serviceClient,
      userId: user.id,
      leadId,
    });

    if (body.client_id && String(body.client_id).trim() !== context.clientId) {
      return jsonResponse(
        { ok: false, error: "client_id does not match the lead workspace context." },
        400
      );
    }

    const workflowUrl = resolveWorkflowDUrl();
    const workflowSecret = getOptionalEnv("NEXUSQ_PIPELINE_SECRET");
    const upstreamPayload = {
      lead_id: leadId,
      client_id: context.clientId,
      status: stage,
      stage,
      value,
    };

    const workflowResponse = await forwardWorkflowD({
      workflowUrl,
      secret: workflowSecret,
      payload: upstreamPayload,
    });

    const workflowPayload = await parseWorkflowPayload(workflowResponse);
    const workflowOk = workflowResponse.ok && workflowPayload?.ok !== false && workflowPayload?._error !== true;
    if (!workflowOk) {
      const workflowMessage =
        (typeof workflowPayload?.error === "string" && workflowPayload.error) ||
        (typeof workflowPayload?.message === "string" && workflowPayload.message) ||
        `Workflow D returned HTTP ${workflowResponse.status}`;
      return jsonResponse(
        {
          ok: false,
          error: workflowMessage,
          upstream_status: workflowResponse.status,
          upstream_payload: workflowPayload,
        },
        502
      );
    }

    const persisted = await verifyPersistence({
      serviceClient,
      leadId,
      expectedStage: stage,
    });

    if (!persisted.verified) {
      return jsonResponse(
        {
          ok: false,
          error: "Pipeline update was acknowledged but did not persist in database state.",
          lead_id: leadId,
          expected_stage: stage,
          persisted,
          upstream_payload: workflowPayload,
        },
        409
      );
    }

    return jsonResponse(
      {
        ok: true,
        lead_id: leadId,
        client_id: context.clientId,
        stage,
        value,
        persisted,
        upstream_payload: workflowPayload,
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("unauthorized") || lower.includes("authorization")
        ? 401
        : lower.includes("do not have access")
        ? 403
        : lower.includes("not found")
        ? 404
        : 400;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
