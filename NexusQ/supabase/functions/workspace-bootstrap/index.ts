import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { generateRawAccessKey, isAccessRole, normalizeAccessKey, normalizeIsoDateOrNull, sha256Hex } from "../_shared/access-key.ts";
import type { AccessRole } from "../_shared/access-key.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type WorkspaceBootstrapAction = "create_workspace" | "join_workspace";

type WorkspaceBootstrapRequest = {
  action?: WorkspaceBootstrapAction;
  workspace_name?: string;
  timezone?: string;
  access_key?: string;
  full_name?: string;
  generate_initial_key?: boolean;
  initial_key_role?: AccessRole;
  initial_key_label?: string | null;
  initial_key_expires_at?: string | null;
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

function parseFullName(user: User, explicitName?: string) {
  const candidate = explicitName?.trim();
  if (candidate) return candidate;

  const metadataFull = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  if (metadataFull) return metadataFull;

  const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  if (metadataName) return metadataName;

  return null;
}

function toSingleRecord<T>(value: T[] | T | null) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as WorkspaceBootstrapRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function createInitialKeyWithRetry(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  clientId: string;
  createdBy: string;
  role: AccessRole;
  label: string | null;
  expiresAt: string | null;
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
        is_active: true,
        expires_at: params.expiresAt,
        created_by: params.createdBy,
      })
      .select("id, role, expires_at")
      .single();

    if (!error) {
      return {
        raw_key: rawKey,
        role: data.role as AccessRole,
        expires_at: data.expires_at as string | null,
        key_id: data.id as string,
      };
    }

    if (error.code === "23505") continue;
    throw new Error(error.message);
  }

  throw new Error("Unable to generate a unique access key. Please retry.");
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
    const action = body.action;

    if (action !== "create_workspace" && action !== "join_workspace") {
      return jsonResponse({ ok: false, error: "action must be create_workspace or join_workspace." }, 400);
    }

    const serviceClient = getServiceClient();
    const fullName = parseFullName(user, body.full_name);
    const email = user.email ?? null;

    if (action === "create_workspace") {
      const workspaceName = String(body.workspace_name ?? "").trim();
      if (!workspaceName) {
        return jsonResponse({ ok: false, error: "workspace_name is required." }, 400);
      }

      const timezone = String(body.timezone ?? "UTC").trim() || "UTC";
      const { data, error } = await serviceClient.rpc("bootstrap_workspace_for_user", {
        p_user_id: user.id,
        p_email: email,
        p_full_name: fullName,
        p_workspace_name: workspaceName,
        p_timezone: timezone,
      });

      if (error) {
        const mergedError = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
        const lower = mergedError.toLowerCase();
        if (lower.includes("bootstrap_workspace_for_user")) {
          return jsonResponse(
            {
              ok: false,
              error: "Workspace bootstrap function is missing. Run the latest migration first.",
            },
            500
          );
        }
        return jsonResponse(
          {
            ok: false,
            error: mergedError || "Workspace bootstrap RPC failed.",
            code: error.code ?? null,
          },
          400
        );
      }

      const record = toSingleRecord(data) as { client_id?: string; role?: AccessRole } | null;
      if (!record?.client_id || !record.role) {
        return jsonResponse({ ok: false, error: "Workspace bootstrap returned no client context." }, 500);
      }

      let accessKey: {
        raw_key: string;
        role: AccessRole;
        expires_at: string | null;
        key_id: string;
      } | null = null;

      if (body.generate_initial_key === true) {
        const requestedRole = isAccessRole(body.initial_key_role) ? body.initial_key_role : "admin";
        const keyRole: AccessRole = requestedRole === "owner" ? "admin" : requestedRole;
        const keyLabel =
          typeof body.initial_key_label === "string" && body.initial_key_label.trim()
            ? body.initial_key_label.trim()
            : "Initial workspace key";
        const expiresAt = normalizeIsoDateOrNull(body.initial_key_expires_at);

        accessKey = await createInitialKeyWithRetry({
          serviceClient,
          clientId: record.client_id,
          createdBy: user.id,
          role: keyRole,
          label: keyLabel,
          expiresAt,
        });
      }

      return jsonResponse(
        {
          ok: true,
          action,
          client_id: record.client_id,
          role: record.role,
          access_key: accessKey,
        },
        201
      );
    }

    const rawKey = normalizeAccessKey(String(body.access_key ?? ""));
    if (!rawKey) {
      return jsonResponse({ ok: false, error: "access_key is required." }, 400);
    }

    const { data, error } = await serviceClient.rpc("join_workspace_with_access_key", {
      p_user_id: user.id,
      p_email: email,
      p_full_name: fullName,
      p_raw_key: rawKey,
    });

    if (error) {
      const message = [error.message, error.details, error.hint].filter(Boolean).join(" | ") || "Join workspace failed.";
      const lower = message.toLowerCase();
      if (lower.includes("join_workspace_with_access_key")) {
        return jsonResponse(
          {
            ok: false,
            error: "Join workspace function is missing. Run the latest migration first.",
          },
          500
        );
      }
      const status =
        lower.includes("invalid") || lower.includes("expired") || lower.includes("inactive") ? 400 : 500;
      return jsonResponse({ ok: false, error: message }, status);
    }

    const record = toSingleRecord(data) as { client_id?: string; role?: AccessRole } | null;
    if (!record?.client_id || !record.role) {
      return jsonResponse({ ok: false, error: "Join workspace returned no client context." }, 500);
    }

    return jsonResponse(
      {
        ok: true,
        action,
        client_id: record.client_id,
        role: record.role,
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 400;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
