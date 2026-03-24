import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";

type NotificationPreferencesAction = "get" | "update";

type NotificationPreferencesRequest = {
  action?: NotificationPreferencesAction;
  phone?: string | null;
  sms_alerts_enabled?: boolean;
  push_alerts_enabled?: boolean;
};

type NotificationPreferencesRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  sms_alerts_enabled: boolean;
  push_alerts_enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
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

function parseFullName(user: User) {
  const metadataFull = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  if (metadataFull) return metadataFull;

  const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  if (metadataName) return metadataName;

  return null;
}

async function parseJsonBody(request: Request) {
  const rawText = await request.text();
  if (!rawText.trim()) {
    return {} as NotificationPreferencesRequest;
  }

  try {
    return JSON.parse(rawText) as NotificationPreferencesRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function normalizeStoredPhone(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePhoneInput(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("phone must be a string or null.");
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[\s().-]+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("phone must be a valid E.164 number, for example +15551234567.");
  }

  return normalized;
}

function mapPreferences(record: Partial<NotificationPreferencesRecord> | null, user: User): NotificationPreferencesRecord {
  return {
    id: user.id,
    email: typeof record?.email === "string" ? record.email : user.email ?? null,
    full_name: typeof record?.full_name === "string" ? record.full_name : parseFullName(user),
    phone: normalizeStoredPhone(record?.phone),
    sms_alerts_enabled: record?.sms_alerts_enabled === true,
    push_alerts_enabled: record?.push_alerts_enabled !== false,
    created_at: typeof record?.created_at === "string" ? record.created_at : null,
    updated_at: typeof record?.updated_at === "string" ? record.updated_at : null,
  };
}

async function loadUserPreferences(serviceClient: ReturnType<typeof getServiceClient>, user: User) {
  const { data, error } = await serviceClient
    .from("user_profiles")
    .select("id, email, full_name, phone, sms_alerts_enabled, push_alerts_enabled, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load notification preferences: ${error.message}`);
  }

  return {
    raw: (data as Partial<NotificationPreferencesRecord> | null) ?? null,
    preferences: mapPreferences((data as Partial<NotificationPreferencesRecord> | null) ?? null, user),
  };
}

async function ensureUserProfile(serviceClient: ReturnType<typeof getServiceClient>, user: User) {
  const existing = await loadUserPreferences(serviceClient, user);
  if (existing.raw?.id) {
    return existing.preferences;
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await serviceClient
    .from("user_profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: parseFullName(user),
      phone: null,
      sms_alerts_enabled: false,
      push_alerts_enabled: true,
      updated_at: timestamp,
    })
    .select("id, email, full_name, phone, sms_alerts_enabled, push_alerts_enabled, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return (await loadUserPreferences(serviceClient, user)).preferences;
    }
    throw new Error(`Failed to initialize notification preferences: ${error.message}`);
  }

  return mapPreferences((data as Partial<NotificationPreferencesRecord> | null) ?? null, user);
}

function hasOwn(body: NotificationPreferencesRequest, key: keyof NotificationPreferencesRequest) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsResponse(request);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, request);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = await parseJsonBody(request);
    const action = body.action ?? "get";
    if (action !== "get" && action !== "update") {
      return jsonResponse({ ok: false, error: "action must be get or update." }, 400, request);
    }

    const serviceClient = getServiceClient();
    const current = await ensureUserProfile(serviceClient, user);

    if (action === "get") {
      return jsonResponse({ ok: true, preferences: current }, 200, request);
    }

    if (hasOwn(body, "sms_alerts_enabled") && typeof body.sms_alerts_enabled !== "boolean") {
      return jsonResponse({ ok: false, error: "sms_alerts_enabled must be a boolean." }, 400, request);
    }
    if (hasOwn(body, "push_alerts_enabled") && typeof body.push_alerts_enabled !== "boolean") {
      return jsonResponse({ ok: false, error: "push_alerts_enabled must be a boolean." }, 400, request);
    }

    const nextPhone = hasOwn(body, "phone") ? normalizePhoneInput(body.phone) : current.phone;
    const nextSmsAlertsEnabled = hasOwn(body, "sms_alerts_enabled")
      ? body.sms_alerts_enabled === true
      : current.sms_alerts_enabled;
    const nextPushAlertsEnabled = hasOwn(body, "push_alerts_enabled")
      ? body.push_alerts_enabled === true
      : current.push_alerts_enabled;

    if (nextSmsAlertsEnabled && !nextPhone) {
      return jsonResponse(
        { ok: false, error: "A phone number is required before enabling SMS alerts." },
        400,
        request
      );
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await serviceClient
      .from("user_profiles")
      .update({
        phone: nextPhone,
        sms_alerts_enabled: nextSmsAlertsEnabled,
        push_alerts_enabled: nextPushAlertsEnabled,
        updated_at: timestamp,
      })
      .eq("id", user.id)
      .select("id, email, full_name, phone, sms_alerts_enabled, push_alerts_enabled, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }

    return jsonResponse(
      {
        ok: true,
        preferences: mapPreferences((data as Partial<NotificationPreferencesRecord> | null) ?? null, user),
      },
      200,
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const status =
      message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authorization")
        ? 401
        : 400;
    return jsonResponse({ ok: false, error: message }, status, request);
  }
});
