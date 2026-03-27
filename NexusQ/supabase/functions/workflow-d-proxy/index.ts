import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";
import { applyPipelineStageUpdate, isUuid } from "../_shared/pipeline-update.ts";

type PipelineUpdateRequest = {
  lead_id?: string;
  status?: string;
  stage?: string;
  value?: number | string | null;
  client_id?: string | null;
};

function getAuthClient(request: Request) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
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
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
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

    const result = await applyPipelineStageUpdate({
      serviceClient,
      clientId: context.clientId,
      leadId,
      stageInput: body.status ?? body.stage,
      valueInput: body.value,
      source: "workflow-d-proxy",
    });

    return jsonResponse(result, 200);
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
