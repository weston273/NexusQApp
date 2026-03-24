import { ensureActiveAccessToken } from "@/lib/auth";
import { buildSupabaseFunctionUrl, getAppConfig } from "@/lib/config";

export const PUSH_SERVICE_WORKER_PATH = "/push-sw.js";
export const PUSH_SUBSCRIPTION_CHANGE_MESSAGE = "nexusq:pushsubscriptionchange";

export type PushPermissionState = NotificationPermission | "unsupported";

export type PushSupportSnapshot = {
  supported: boolean;
  secureContext: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  notifications: boolean;
  vapidConfigured: boolean;
  reason: string | null;
};

export type PushSyncContext = {
  clientId: string;
  permission: PushPermissionState;
  endpoint: string | null;
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
  subscriptionJson: PushSubscriptionJSON | null;
  support: PushSupportSnapshot;
};

export type BuildPushSyncRequestBody = (context: PushSyncContext) => Record<string, unknown>;

export type PushSyncResult = {
  ok: boolean;
  skipped: boolean;
  status: number | null;
  data: unknown;
  requestBody: Record<string, unknown> | null;
};

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function getWindowContext() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  return { window, navigator };
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

async function parseEdgeResponse(response: Response) {
  if (response.status === 204) return null;
  if (isJsonResponse(response)) {
    return response.json();
  }
  return response.text();
}

async function postNotificationSubscription(
  body: Record<string, unknown>,
  token: string,
  functionName: string
) {
  const { supabaseAnonKey } = getAppConfig();
  const response = await fetch(buildSupabaseFunctionUrl(functionName), {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseEdgeResponse(response.clone());
  return {
    response,
    data,
  };
}

function buildSyncStatus(permission: PushPermissionState, subscription: PushSubscriptionJSON | null) {
  if (subscription?.endpoint) return "subscribed";
  if (permission === "denied") return "denied";
  if (permission === "granted") return "unsubscribed";
  if (permission === "default") return "prompt";
  return "unsupported";
}

export function buildDefaultPushSyncRequestBody(context: PushSyncContext) {
  const endpoint = context.endpoint ?? context.subscriptionJson?.endpoint ?? null;

  return {
    action: context.subscriptionJson?.endpoint ? "register" : "delete",
    client_id: context.clientId,
    status: buildSyncStatus(context.permission, context.subscriptionJson),
    permission: context.permission,
    subscription: context.subscriptionJson,
    endpoint,
    service_worker_scope: context.registration?.scope ?? null,
    source: "browser_push",
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    synced_at: new Date().toISOString(),
  };
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function getPushSupportSnapshot(vapidPublicKey?: string | null): PushSupportSnapshot {
  const context = getWindowContext();
  const secureContext = Boolean(context?.window.isSecureContext);
  const serviceWorker = Boolean(context?.navigator.serviceWorker);
  const pushManager = Boolean(context?.window && "PushManager" in context.window);
  const notifications = typeof Notification !== "undefined";
  const vapidConfigured = Boolean(vapidPublicKey?.trim());
  const supported = secureContext && serviceWorker && pushManager && notifications;

  let reason: string | null = null;
  if (!secureContext) {
    reason = "Browser push requires a secure context (HTTPS or localhost).";
  } else if (!serviceWorker) {
    reason = "This browser does not support service workers.";
  } else if (!pushManager) {
    reason = "This browser does not support the Push API.";
  } else if (!notifications) {
    reason = "This browser does not support the Notifications API.";
  } else if (!vapidConfigured) {
    reason = "Browser push is available, but the VAPID public key is missing from frontend config.";
  }

  return {
    supported,
    secureContext,
    serviceWorker,
    pushManager,
    notifications,
    vapidConfigured,
    reason,
  };
}

export async function registerPushServiceWorker(path = PUSH_SERVICE_WORKER_PATH) {
  const context = getWindowContext();
  if (!context?.window.isSecureContext || !context.navigator.serviceWorker) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = context.navigator.serviceWorker
      .register(path, { scope: "/" })
      .then(() => context.navigator.serviceWorker.ready)
      .catch((error) => {
        serviceWorkerRegistrationPromise = null;
        throw error;
      });
  }

  return serviceWorkerRegistrationPromise;
}

export async function getCurrentPushSubscription(registration?: ServiceWorkerRegistration | null) {
  const resolvedRegistration = registration ?? (await registerPushServiceWorker());
  if (!resolvedRegistration) return null;
  return resolvedRegistration.pushManager.getSubscription();
}

export function decodeVapidPublicKey(value: string) {
  const normalized = value.trim();
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export async function requestBrowserPushPermission() {
  if (typeof Notification === "undefined") {
    throw new Error("Notifications are not supported in this browser.");
  }

  return Notification.requestPermission();
}

export async function createBrowserPushSubscription(args: {
  registration?: ServiceWorkerRegistration | null;
  vapidPublicKey?: string | null;
}) {
  const permission = getPushPermissionState();
  if (permission !== "granted") {
    throw new Error("Notification permission must be granted before subscribing.");
  }

  const vapidPublicKey = args.vapidPublicKey?.trim();
  if (!vapidPublicKey) {
    throw new Error("VAPID public key is not configured.");
  }

  const registration = args.registration ?? (await registerPushServiceWorker());
  if (!registration) {
    throw new Error("Push service worker is not available.");
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
  });
}

export async function unsubscribeBrowserPushSubscription(registration?: ServiceWorkerRegistration | null) {
  const existing = await getCurrentPushSubscription(registration);
  if (!existing) return false;
  return existing.unsubscribe();
}

export async function syncPushSubscription(args: {
  clientId: string | null;
  permission: PushPermissionState;
  endpoint?: string | null;
  registration?: ServiceWorkerRegistration | null;
  subscription?: PushSubscription | null;
  functionName?: string;
  buildRequestBody?: BuildPushSyncRequestBody;
  forceRefreshToken?: boolean;
}) {
  if (!args.clientId) {
    return {
      ok: false,
      skipped: true,
      status: null,
      data: { message: "No active workspace client_id is available for push sync." },
      requestBody: null,
    } satisfies PushSyncResult;
  }

  const support = getPushSupportSnapshot(getAppConfig().pushVapidPublicKey);
  const registration = args.registration ?? (await registerPushServiceWorker());
  const subscription = args.subscription ?? (await getCurrentPushSubscription(registration));
  const subscriptionJson = subscription?.toJSON() ?? null;
  const endpoint = args.endpoint ?? subscriptionJson?.endpoint ?? null;

  if (!subscriptionJson?.endpoint && !endpoint) {
    return {
      ok: false,
      skipped: true,
      status: null,
      data: { message: "No browser push endpoint is available to sync." },
      requestBody: null,
    } satisfies PushSyncResult;
  }

  const context: PushSyncContext = {
    clientId: args.clientId,
    permission: args.permission,
    endpoint,
    registration,
    subscription,
    subscriptionJson,
    support,
  };

  const requestBody = (args.buildRequestBody ?? buildDefaultPushSyncRequestBody)(context);
  const functionName = args.functionName?.trim() || "notification-subscriptions";

  let token = await ensureActiveAccessToken({
    forceRefresh: args.forceRefreshToken,
    clearInvalidSession: true,
  });
  let syncResponse = await postNotificationSubscription(requestBody, token, functionName);

  if (syncResponse.response.status === 401) {
    token = await ensureActiveAccessToken({
      forceRefresh: true,
      clearInvalidSession: true,
    });
    syncResponse = await postNotificationSubscription(requestBody, token, functionName);
  }

  if (!syncResponse.response.ok) {
    const message =
      typeof syncResponse.data === "object" &&
      syncResponse.data &&
      !Array.isArray(syncResponse.data) &&
      typeof (syncResponse.data as { error?: unknown; message?: unknown }).error === "string"
        ? (syncResponse.data as { error: string }).error
        : typeof syncResponse.data === "object" &&
          syncResponse.data &&
          !Array.isArray(syncResponse.data) &&
          typeof (syncResponse.data as { message?: unknown }).message === "string"
        ? (syncResponse.data as { message: string }).message
        : `notification-subscriptions failed with HTTP ${syncResponse.response.status}.`;
    throw new Error(message);
  }

  return {
    ok: true,
    skipped: false,
    status: syncResponse.response.status,
    data: syncResponse.data,
    requestBody,
  } satisfies PushSyncResult;
}
