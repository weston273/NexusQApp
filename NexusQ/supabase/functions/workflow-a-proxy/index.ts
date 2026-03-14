import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type IntakeRequest = Record<string, unknown> & {
  source?: string;
  client_id?: string | null;
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
    return (await request.json()) as IntakeRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function verifyWorkspaceAccess(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  userId: string;
  clientId: string | null;
}) {
  if (!params.clientId) return null;

  const { data, error } = await params.serviceClient
    .from("user_access")
    .select("id")
    .eq("user_id", params.userId)
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify workspace access: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("You do not have access to this workspace.");
  }

  return params.clientId;
}

function resolveWorkflowAUrls() {
  const candidates = [
    getOptionalEnv("WORKFLOW_A_URL"),
    getOptionalEnv("WORKFLOW_A_WEBHOOK_URL"),
    getOptionalEnv("WORKFLOW_A_FALLBACK_URL"),
  ];

  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!urls.includes(candidate)) urls.push(candidate);
    } catch {
      // Ignore malformed URLs.
    }
  }

  if (!urls.length) {
    throw new Error("No valid Workflow A URL configured.");
  }

  return urls;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function forwardRequest(params: {
  url: string;
  payload: Record<string, unknown>;
  secret: string | null;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (params.secret) {
        headers["x-nexusq-secret"] = params.secret;
      }

      const response = await fetch(params.url, {
        method: "POST",
        headers,
        body: JSON.stringify(params.payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < 1) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Workflow A request failed.");
}

async function parseUpstreamPayload(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 240) };
  }
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
    const source = String(body.source ?? "").trim();
    if (!source) {
      return jsonResponse({ ok: false, error: "source is required." }, 400);
    }

    const serviceClient = getServiceClient();
    const clientIdRaw = typeof body.client_id === "string" ? body.client_id.trim() : "";
    const clientId = clientIdRaw || null;
    await verifyWorkspaceAccess({ serviceClient, userId: user.id, clientId });

    const payload: Record<string, unknown> = {
      ...body,
      client_id: clientId,
    };

    const urls = resolveWorkflowAUrls();
    const secret = getOptionalEnv("NEXUSQ_WORKFLOW_A_SECRET");
    let lastError = "Workflow A request failed.";

    for (const url of urls) {
      try {
        const response = await forwardRequest({ url, payload, secret });
        const upstreamPayload = await parseUpstreamPayload(response);
        const upstreamOk =
          response.ok && upstreamPayload?._error !== true && upstreamPayload?.ok !== false;

        if (upstreamOk) {
          return jsonResponse(
            {
              ok: true,
              upstream_url: url,
              upstream_status: response.status,
              upstream_payload: upstreamPayload,
            },
            200
          );
        }

        const reason =
          (typeof upstreamPayload?.error === "string" && upstreamPayload.error) ||
          (typeof upstreamPayload?.message === "string" && upstreamPayload.message) ||
          `HTTP ${response.status}`;
        lastError = `Workflow A failed at ${url}: ${reason}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = `Workflow A failed at ${url}: ${message}`;
      }
    }

    return jsonResponse({ ok: false, error: lastError }, 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("unauthorized") || lower.includes("authorization")
        ? 401
        : lower.includes("do not have access")
        ? 403
        : 400;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
