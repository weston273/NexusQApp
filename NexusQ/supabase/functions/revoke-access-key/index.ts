import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { canManageAccessKeys, isAccessRole } from "../_shared/access-key.ts";
import type { AccessRole } from "../_shared/access-key.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type RevokeAccessKeyRequest = {
  key_id?: string;
  is_active?: boolean;
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as RevokeAccessKeyRequest;

    const keyId = body.key_id?.trim();
    if (!keyId) {
      return jsonResponse({ error: "key_id is required." }, 400);
    }

    const targetActive = typeof body.is_active === "boolean" ? body.is_active : false;
    const serviceClient = getServiceClient();

    const { data: targetKey, error: keyError } = await serviceClient
      .from("client_access_keys")
      .select("id, client_id, role, is_active, label, expires_at, created_by, created_at")
      .eq("id", keyId)
      .maybeSingle();

    if (keyError) return jsonResponse({ error: keyError.message }, 500);
    if (!targetKey) return jsonResponse({ error: "Access key not found." }, 404);
    if (!isAccessRole(targetKey.role)) return jsonResponse({ error: "Access key role is invalid." }, 500);

    const { data: callerAccess, error: accessError } = await serviceClient
      .from("user_access")
      .select("role")
      .eq("user_id", user.id)
      .eq("client_id", targetKey.client_id)
      .eq("is_active", true)
      .maybeSingle();

    if (accessError) return jsonResponse({ error: accessError.message }, 500);
    if (!callerAccess?.role || !isAccessRole(callerAccess.role)) {
      return jsonResponse({ error: "You do not have access to manage keys for this workspace." }, 403);
    }

    const callerRole = callerAccess.role as AccessRole;
    if (!canManageAccessKeys(callerRole)) {
      return jsonResponse({ error: "Only owner/admin users can manage access keys." }, 403);
    }
    if (targetKey.role === "owner" && callerRole !== "owner") {
      return jsonResponse({ error: "Only owners can modify owner-level access keys." }, 403);
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("client_access_keys")
      .update({ is_active: targetActive })
      .eq("id", keyId)
      .select("id, client_id, label, role, is_active, expires_at, created_by, created_at")
      .single();

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ key: updated }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status =
      message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authorization")
        ? 401
        : 400;
    return jsonResponse({ error: message }, status);
  }
});
