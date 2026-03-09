import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import {
  canManageAccessKeys,
  generateRawAccessKey,
  isAccessRole,
  normalizeAccessKey,
  normalizeIsoDateOrNull,
  sha256Hex,
} from "../_shared/access-key.ts";
import type { AccessRole } from "../_shared/access-key.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type CreateAccessKeyRequest = {
  client_id?: string;
  label?: string | null;
  role?: AccessRole;
  is_active?: boolean;
  expires_at?: string | null;
  confirm_owner_key?: boolean;
};

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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

function validateOwnerExpiry(expiresAtIso: string | null) {
  if (!expiresAtIso) return false;
  const expiresMs = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresMs)) return false;

  const now = Date.now();
  const maxOwnerLifetimeMs = now + 7 * 24 * 60 * 60 * 1000;
  return expiresMs > now && expiresMs <= maxOwnerLifetimeMs;
}

async function insertAccessKeyWithRetry(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  clientId: string;
  label: string | null;
  role: AccessRole;
  isActive: boolean;
  expiresAtIso: string | null;
  createdBy: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rawKey = normalizeAccessKey(generateRawAccessKey());
    const keyHash = await sha256Hex(rawKey);

    const { data, error } = await params.serviceClient
      .from("client_access_keys")
      .insert({
        client_id: params.clientId,
        key_hash: keyHash,
        label: params.label,
        role: params.role,
        is_active: params.isActive,
        expires_at: params.expiresAtIso,
        created_by: params.createdBy,
      })
      .select("id, client_id, label, role, is_active, expires_at, created_by, created_at")
      .single();

    if (!error) {
      return { rawKey, record: data };
    }
    if (error.code === "23505") continue;
    throw new Error(error.message);
  }
  throw new Error("Failed to generate a unique access key. Please retry.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as CreateAccessKeyRequest;

    const clientId = body.client_id?.trim();
    if (!clientId) {
      return jsonResponse({ error: "client_id is required." }, 400);
    }

    const targetRole: AccessRole = isAccessRole(body.role) ? body.role : "viewer";
    const isActive = typeof body.is_active === "boolean" ? body.is_active : true;
    const confirmOwnerKey = body.confirm_owner_key === true;
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
    const serviceClient = getServiceClient();

    const { data: callerAccess, error: callerAccessError } = await serviceClient
      .from("user_access")
      .select("role")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    if (callerAccessError) {
      return jsonResponse({ error: callerAccessError.message }, 500);
    }
    if (!callerAccess?.role || !isAccessRole(callerAccess.role)) {
      return jsonResponse({ error: "You do not have access to manage keys for this workspace." }, 403);
    }

    const callerRole = callerAccess.role;
    if (!canManageAccessKeys(callerRole)) {
      return jsonResponse({ error: "Only owner/admin users can create access keys." }, 403);
    }
    if (targetRole === "owner" && callerRole !== "owner") {
      return jsonResponse({ error: "Only current owners can create owner access keys." }, 403);
    }
    if (targetRole === "owner" && !confirmOwnerKey) {
      return jsonResponse({ error: "Owner key creation requires explicit confirmation." }, 400);
    }

    let expiresAtIso = normalizeIsoDateOrNull(body.expires_at);
    if (targetRole === "owner") {
      if (!expiresAtIso) {
        expiresAtIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      if (!validateOwnerExpiry(expiresAtIso)) {
        return jsonResponse(
          { error: "Owner keys must expire within 7 days and use a future expiry timestamp." },
          400
        );
      }
    }

    const created = await insertAccessKeyWithRetry({
      serviceClient,
      clientId,
      label,
      role: targetRole,
      isActive,
      expiresAtIso,
      createdBy: user.id,
    });

    return jsonResponse(
      {
        raw_key: created.rawKey,
        key: created.record,
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status =
      message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authorization")
        ? 401
        : 400;
    return jsonResponse({ error: message }, status);
  }
});
