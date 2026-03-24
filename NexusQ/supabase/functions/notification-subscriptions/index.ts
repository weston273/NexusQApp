import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.94.0";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  normalizePushSubscriptionEndpoint,
  normalizePushSubscriptionPayload,
  serializeStoredPushSubscriptionRow,
  type NormalizedPushSubscription,
} from "../_shared/push-subscription.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";
import { resolveTenantForUser } from "../_shared/tenant.ts";

type NotificationSubscriptionAction = "inspect" | "register" | "delete";

type NotificationSubscriptionsRequest = {
  action?: NotificationSubscriptionAction;
  client_id?: string | null;
  client_key?: string | null;
  endpoint?: string | null;
  subscription?: unknown;
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
    return (await request.json()) as NotificationSubscriptionsRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function mapNotificationSubscriptionError(message: string) {
  const lower = message.toLowerCase();
  if (
    (lower.includes("relation") || lower.includes("table")) &&
    lower.includes("notification_subscriptions") &&
    lower.includes("does not exist")
  ) {
    return "notification_subscriptions table is missing. Apply the push-subscription migration first.";
  }
  if (
    lower.includes("notification_subscriptions") &&
    lower.includes("subscription_json") &&
    lower.includes("does not exist")
  ) {
    return "notification_subscriptions.subscription_json is missing. Align the migration with the push-subscription function contract.";
  }
  return message;
}

function normalizeAction(value: unknown): NotificationSubscriptionAction {
  const action = String(value ?? "").trim().toLowerCase();
  if (action === "inspect" || action === "register" || action === "delete") return action;
  throw new Error("action must be one of: inspect, register, delete.");
}

function resolveEndpointFromRequest(body: NotificationSubscriptionsRequest) {
  const directEndpoint = normalizePushSubscriptionEndpoint(body.endpoint);
  if (directEndpoint) return directEndpoint;
  if (body.subscription == null) return null;
  return normalizePushSubscriptionPayload(body.subscription).endpoint;
}

async function listMatchingSubscriptions(params: {
  serviceClient: SupabaseClient;
  clientId: string;
  userId: string;
  endpoint: string;
}) {
  const { data, error } = await params.serviceClient
    .from("notification_subscriptions")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("user_id", params.userId)
    .eq("endpoint", params.endpoint)
    .limit(10);

  if (error) {
    throw new Error(mapNotificationSubscriptionError(error.message));
  }

  return Array.isArray(data) ? data : [];
}

async function inspectSubscription(params: {
  serviceClient: SupabaseClient;
  clientId: string;
  userId: string;
  endpoint: string;
}) {
  const rows = await listMatchingSubscriptions(params);
  return serializeStoredPushSubscriptionRow(rows[0] ?? null);
}

async function registerSubscription(params: {
  serviceClient: SupabaseClient;
  clientId: string;
  userId: string;
  subscription: NormalizedPushSubscription;
  userAgent: string | null;
}) {
  const timestamp = new Date().toISOString();
  const existingRows = await listMatchingSubscriptions({
    serviceClient: params.serviceClient,
    clientId: params.clientId,
    userId: params.userId,
    endpoint: params.subscription.endpoint,
  });

  if (existingRows.length) {
    const { error } = await params.serviceClient
      .from("notification_subscriptions")
      .update({
        subscription_json: params.subscription.subscriptionJson,
        user_agent: params.userAgent,
        updated_at: timestamp,
      })
      .eq("client_id", params.clientId)
      .eq("user_id", params.userId)
      .eq("endpoint", params.subscription.endpoint);

    if (error) {
      throw new Error(mapNotificationSubscriptionError(error.message));
    }
  } else {
    const { error } = await params.serviceClient
      .from("notification_subscriptions")
      .insert({
        client_id: params.clientId,
        user_id: params.userId,
        endpoint: params.subscription.endpoint,
        subscription_json: params.subscription.subscriptionJson,
        user_agent: params.userAgent,
        created_at: timestamp,
        updated_at: timestamp,
      });

    if (error) {
      throw new Error(mapNotificationSubscriptionError(error.message));
    }
  }

  return inspectSubscription({
    serviceClient: params.serviceClient,
    clientId: params.clientId,
    userId: params.userId,
    endpoint: params.subscription.endpoint,
  });
}

async function deleteSubscription(params: {
  serviceClient: SupabaseClient;
  clientId: string;
  userId: string;
  endpoint: string;
}) {
  const existingRows = await listMatchingSubscriptions(params);
  if (!existingRows.length) {
    return { deleted: false, deletedCount: 0 };
  }

  const { error } = await params.serviceClient
    .from("notification_subscriptions")
    .delete()
    .eq("client_id", params.clientId)
    .eq("user_id", params.userId)
    .eq("endpoint", params.endpoint);

  if (error) {
    throw new Error(mapNotificationSubscriptionError(error.message));
  }

  return {
    deleted: true,
    deletedCount: existingRows.length,
  };
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
    const action = normalizeAction(body.action);
    const serviceClient = getServiceClient();
    const tenant = await resolveTenantForUser({
      serviceClient,
      userId: user.id,
      tenant: {
        clientId: body.client_id,
        clientKey: body.client_key,
      },
    });

    if (action === "register") {
      const subscription = normalizePushSubscriptionPayload(body.subscription);
      const stored = await registerSubscription({
        serviceClient,
        clientId: tenant.clientId,
        userId: user.id,
        subscription,
        userAgent: request.headers.get("User-Agent")?.trim() || null,
      });

      return jsonResponse(
        {
          ok: true,
          action,
          client_id: tenant.clientId,
          client_key: tenant.clientKey,
          subscription: stored,
        },
        200,
        request
      );
    }

    const endpoint = resolveEndpointFromRequest(body);
    if (!endpoint) {
      return jsonResponse(
        { ok: false, error: "endpoint or subscription is required for this action." },
        400,
        request
      );
    }

    if (action === "inspect") {
      const stored = await inspectSubscription({
        serviceClient,
        clientId: tenant.clientId,
        userId: user.id,
        endpoint,
      });

      return jsonResponse(
        {
          ok: true,
          action,
          client_id: tenant.clientId,
          client_key: tenant.clientKey,
          subscription: stored,
        },
        200,
        request
      );
    }

    const deleted = await deleteSubscription({
      serviceClient,
      clientId: tenant.clientId,
      userId: user.id,
      endpoint,
    });

    return jsonResponse(
      {
        ok: true,
        action,
        client_id: tenant.clientId,
        client_key: tenant.clientKey,
        endpoint,
        deleted: deleted.deleted,
        deleted_count: deleted.deletedCount,
      },
      200,
      request
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

    return jsonResponse({ ok: false, error: message }, status, request);
  }
});
