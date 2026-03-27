import type { SupabaseClient } from "npm:@supabase/supabase-js@2.94.0";

export type TenantReference = {
  clientId?: string | null;
  clientKey?: string | null;
};

export type ResolvedTenant = {
  clientId: string;
  clientKey: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientTimezone: string | null;
};

function normalizeUuid(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function normalizeClientKey(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return raw || null;
}

function mapClientLookupError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("client_key") && lower.includes("does not exist")) {
    return "client_key support is missing in the database. Run the latest migrations first.";
  }
  return message;
}

async function fetchClientById(serviceClient: SupabaseClient, clientId: string) {
  const { data, error } = await serviceClient
    .from("clients")
    .select("id, client_key, name, phone, timezone, status")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client ${clientId}: ${mapClientLookupError(error.message)}`);
  }

  return data;
}

async function fetchClientByKey(serviceClient: SupabaseClient, clientKey: string) {
  const { data, error } = await serviceClient
    .from("clients")
    .select("id, client_key, name, phone, timezone, status")
    .eq("client_key", clientKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client by client_key: ${mapClientLookupError(error.message)}`);
  }

  return data;
}

async function verifyActiveWorkspaceAccess(serviceClient: SupabaseClient, userId: string, clientId: string) {
  const { data, error } = await serviceClient
    .from("user_access")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify workspace access: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("You do not have access to this workspace.");
  }
}

export async function resolveTenantForUser(params: {
  serviceClient: SupabaseClient;
  userId: string;
  tenant: TenantReference;
  requireActiveClient?: boolean;
}) {
  const { serviceClient, userId } = params;
  const clientId = normalizeUuid(params.tenant.clientId);
  const clientKey = normalizeClientKey(params.tenant.clientKey);
  const requireActiveClient = params.requireActiveClient !== false;

  if (!clientId && !clientKey) {
    throw new Error("Either client_id or client_key is required.");
  }

  const byId = clientId ? await fetchClientById(serviceClient, clientId) : null;
  const byKey = clientKey ? await fetchClientByKey(serviceClient, clientKey) : null;

  if (clientId && !byId?.id) {
    throw new Error("No client matched the provided client_id.");
  }
  if (clientKey && !byKey?.id) {
    throw new Error("No client matched the provided client_key.");
  }

  if (byId?.id && byKey?.id && byId.id !== byKey.id) {
    throw new Error("client_id and client_key do not refer to the same workspace.");
  }

  const client = byId ?? byKey;
  if (!client?.id) {
    throw new Error("Unable to resolve tenant context.");
  }

  if (requireActiveClient && String(client.status ?? "").toLowerCase() !== "active") {
    throw new Error("The resolved workspace is not active.");
  }

  await verifyActiveWorkspaceAccess(serviceClient, userId, client.id);

  return {
    clientId: String(client.id),
    clientKey: typeof client.client_key === "string" && client.client_key.trim() ? client.client_key.trim().toLowerCase() : null,
    clientName: typeof client.name === "string" && client.name.trim() ? client.name.trim() : null,
    clientPhone: typeof client.phone === "string" && client.phone.trim() ? client.phone.trim() : null,
    clientTimezone: typeof client.timezone === "string" && client.timezone.trim() ? client.timezone.trim() : null,
  } satisfies ResolvedTenant;
}
