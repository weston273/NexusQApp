import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getPersistedActiveClientId, setPersistedActiveClientId } from "@/lib/persistence/workspace";
import { canManageWorkspaceAccess } from "@/lib/permissions";
import { invokeAuthedFunction, parseFunctionError } from "@/lib/edgeFunctions";

export type AccessRole = "owner" | "admin" | "viewer";

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type UserAccessRow = {
  id: string;
  user_id: string;
  client_id: string;
  role: AccessRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
  client_key?: string | null;
};

export type ClientAccessKeyRow = {
  id: string;
  client_id: string;
  label: string | null;
  role: AccessRole;
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type WorkspaceBootstrapAction = "create_workspace" | "join_workspace";

export type WorkspaceBootstrapResult = {
  ok: true;
  action: WorkspaceBootstrapAction;
  client_id: string;
  role: AccessRole;
  access_key?: {
    raw_key: string;
    role: AccessRole;
    expires_at: string | null;
    key_id: string;
  } | null;
};

function roleWeight(role: AccessRole) {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  return 1;
}

export function isAccessAdminRole(role: AccessRole | null | undefined) {
  return canManageWorkspaceAccess(role);
}

export function getStoredActiveClientId() {
  return getPersistedActiveClientId();
}

export function setStoredActiveClientId(clientId: string | null) {
  setPersistedActiveClientId(clientId);
}

export function pickPrimaryAccessRow(rows: UserAccessRow[], preferredClientId?: string | null) {
  const activeRows = rows.filter((row) => row.is_active);
  if (!activeRows.length) return null;

  if (preferredClientId) {
    const matching = activeRows.find((row) => row.client_id === preferredClientId);
    if (matching) return matching;
  }

  return [...activeRows].sort((a, b) => {
    const roleDiff = roleWeight(b.role) - roleWeight(a.role);
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

export async function fetchCurrentUserProfile(userId: string) {
  return supabase
    .from("user_profiles")
    .select("id, email, full_name, phone, whatsapp, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle<UserProfile>();
}

export async function fetchCurrentUserAccessRows(userId: string) {
  const result = await supabase
    .from("user_access")
    .select("id, user_id, client_id, role, is_active, created_at, updated_at, clients(name, client_key)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!result.data) {
    return {
      ...result,
      data: result.data as UserAccessRow[] | null,
    };
  }

  const data = (result.data as Array<UserAccessRow & { clients?: unknown }>).map((row) => {
    const clientRecord = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const clientSummary =
      clientRecord && typeof clientRecord === "object" && !Array.isArray(clientRecord)
        ? (clientRecord as { name?: string | null; client_key?: string | null })
        : null;

    return {
      id: row.id,
      user_id: row.user_id,
      client_id: row.client_id,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client_name: clientSummary?.name ?? null,
      client_key: clientSummary?.client_key ?? null,
    } satisfies UserAccessRow;
  });

  return {
    ...result,
    data,
  };
}

export function parseAccessError(error: PostgrestError | Error | null | undefined) {
  if (!error) return "An unexpected error occurred.";
  const message = "message" in error ? String(error.message) : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("invalid access key") || lower.includes("invalid key")) {
    return "Invalid access key. Check the value and try again.";
  }
  if (lower.includes("expired")) return "This access key has expired.";
  if (lower.includes("inactive") || lower.includes("disabled")) return "This access key is inactive.";
  if (lower.includes("already linked") || lower.includes("already has access")) {
    return "Your account is already linked to this workspace.";
  }
  if (lower.includes("permission") || lower.includes("not have access")) {
    return "You do not have permission to perform this action.";
  }
  return message;
}

export function normalizeAccessKey(value: string) {
  return value.trim().toUpperCase();
}

export { parseFunctionError };

async function invokeWorkspaceBootstrap(payload: Record<string, unknown>): Promise<WorkspaceBootstrapResult> {
  const data = await invokeAuthedFunction<WorkspaceBootstrapResult | null>("workspace-bootstrap", payload);
  const result = data ?? null;
  if (!result?.ok || !result.client_id || !result.role) {
    throw new Error("Workspace bootstrap returned an invalid response.");
  }

  return result;
}

export async function createWorkspaceForCurrentUser(params: {
  workspaceName: string;
  timezone: string;
  generateInitialKey?: boolean;
  initialKeyRole?: AccessRole;
  initialKeyLabel?: string;
  initialKeyExpiresAt?: string | null;
}): Promise<WorkspaceBootstrapResult> {
  const workspaceName = params.workspaceName.trim();
  if (!workspaceName) {
    throw new Error("Workspace name is required.");
  }

  return invokeWorkspaceBootstrap({
    action: "create_workspace",
    workspace_name: workspaceName,
    timezone: params.timezone,
    generate_initial_key: params.generateInitialKey === true,
    initial_key_role: params.initialKeyRole ?? "admin",
    initial_key_label: params.initialKeyLabel?.trim() || null,
    initial_key_expires_at: params.initialKeyExpiresAt ?? null,
  });
}

export async function joinWorkspaceForCurrentUser(rawKey: string): Promise<WorkspaceBootstrapResult> {
  const normalized = normalizeAccessKey(rawKey);
  if (!normalized) {
    throw new Error("Access key is required.");
  }

  return invokeWorkspaceBootstrap({
    action: "join_workspace",
    access_key: normalized,
  });
}

export async function listClientAccessKeys(clientId: string) {
  return supabase
    .from("client_access_keys")
    .select("id, client_id, label, role, is_active, expires_at, created_by, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<ClientAccessKeyRow[]>();
}

export async function createClientAccessKey(params: {
  clientId: string;
  label?: string;
  role: AccessRole;
  isActive: boolean;
  expiresAt?: string | null;
  confirmOwnerKey?: boolean;
}) {
  const payload = await invokeAuthedFunction<{ raw_key?: string; key?: ClientAccessKeyRow }>("create-access-key", {
    client_id: params.clientId,
    label: params.label?.trim() || null,
    role: params.role,
    is_active: params.isActive,
    expires_at: params.expiresAt ?? null,
    confirm_owner_key: params.confirmOwnerKey ?? false,
  });
  if (!payload?.raw_key || !payload?.key) {
    throw new Error("Access key creation did not return a valid response.");
  }

  return { rawKey: payload.raw_key, record: payload.key };
}

export async function setClientAccessKeyActive(keyId: string, isActive: boolean) {
  const payload = await invokeAuthedFunction<{ key?: ClientAccessKeyRow }>("revoke-access-key", {
    key_id: keyId,
    is_active: isActive,
  });
  if (!payload?.key) {
    throw new Error("Access key update did not return a valid response.");
  }
  return payload.key;
}
