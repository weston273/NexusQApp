import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";

type DeleteLeadRequest = {
  lead_id?: string;
  client_id?: string | null;
};

type DeleteLeadResult = {
  lead_id: string;
  client_id: string;
  deleted_pipeline: number;
  deleted_messages: number;
  deleted_events: number;
  deleted_notifications: number;
  deleted_leads: number;
};

type LeadDeletionContext = {
  leadId: string;
  clientId: string;
  leadName: string | null;
  role: string | null;
};

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
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
    return (await request.json()) as DeleteLeadRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function resolveLeadDeletionContext(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  userId: string;
  leadId: string;
}) {
  const { serviceClient, userId, leadId } = params;

  const { data: lead, error: leadError } = await serviceClient
    .from("leads")
    .select("id, client_id, name")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    throw new Error(`Failed to resolve lead context: ${leadError.message}`);
  }
  if (!lead?.id || !lead.client_id) {
    throw new Error("Lead not found.");
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("user_access")
    .select("id, role")
    .eq("user_id", userId)
    .eq("client_id", lead.client_id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed to verify workspace access: ${membershipError.message}`);
  }
  if (!membership?.id) {
    throw new Error("You do not have access to this lead's workspace.");
  }

  return {
    leadId: String(lead.id),
    clientId: String(lead.client_id),
    leadName: pickString(lead.name),
    role: pickString(membership.role),
  } satisfies LeadDeletionContext;
}

function mapRpcError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("delete_lead_cascade") && lower.includes("does not exist")) {
    return "Lead delete support is missing in the database. Run the latest migrations first.";
  }
  return message;
}

function statusForError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("authorization") || lower.includes("unauthorized") || lower.includes("jwt")) return 401;
  if (lower.includes("do not have access") || lower.includes("only workspace owners and admins")) return 403;
  if (lower.includes("not found")) return 404;
  if (lower.includes("required") || lower.includes("invalid")) return 400;
  return 500;
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
    const requestedClientId = body.client_id ? String(body.client_id).trim() : null;

    if (!leadId || !isUuid(leadId)) {
      return jsonResponse({ ok: false, error: "lead_id is required and must be a UUID." }, 400);
    }
    if (requestedClientId && !isUuid(requestedClientId)) {
      return jsonResponse({ ok: false, error: "client_id must be a UUID when provided." }, 400);
    }

    const serviceClient = getServiceClient();
    const context = await resolveLeadDeletionContext({
      serviceClient,
      userId: user.id,
      leadId,
    });

    if (requestedClientId && requestedClientId !== context.clientId) {
      return jsonResponse({ ok: false, error: "lead_id and client_id do not refer to the same workspace." }, 400);
    }

    if (context.role !== "owner" && context.role !== "admin") {
      return jsonResponse({ ok: false, error: "Only workspace owners and admins can delete leads." }, 403);
    }

    const { data, error } = await serviceClient
      .rpc("delete_lead_cascade", {
        p_lead_id: context.leadId,
        p_client_id: context.clientId,
      })
      .single<DeleteLeadResult>();

    if (error) {
      throw new Error(mapRpcError(error.message));
    }
    if (!data?.lead_id || data.deleted_leads !== 1) {
      throw new Error("Lead delete did not complete successfully.");
    }

    return jsonResponse({
      ok: true,
      lead_id: data.lead_id,
      client_id: data.client_id,
      lead_name: context.leadName,
      deleted: {
        pipeline: data.deleted_pipeline ?? 0,
        messages: data.deleted_messages ?? 0,
        events: data.deleted_events ?? 0,
        notifications: data.deleted_notifications ?? 0,
        leads: data.deleted_leads ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected delete-lead error.";
    return jsonResponse({ ok: false, error: message }, statusForError(message));
  }
});
