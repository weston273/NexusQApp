import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { getAppConfig } from "@/lib/config";
import {
  PUSH_SUBSCRIPTION_CHANGE_MESSAGE,
  buildDefaultPushSyncRequestBody,
  createBrowserPushSubscription,
  getCurrentPushSubscription,
  getPushPermissionState,
  getPushSupportSnapshot,
  registerPushServiceWorker,
  requestBrowserPushPermission,
  syncPushSubscription,
  unsubscribeBrowserPushSubscription,
  type BuildPushSyncRequestBody,
  type PushPermissionState,
  type PushSupportSnapshot,
  type PushSyncResult,
} from "@/features/notifications/push-runtime";

export type UsePushSubscriptionSyncOptions = {
  autoRegister?: boolean;
  autoSync?: boolean;
  clientId?: string | null;
  vapidPublicKey?: string | null;
  functionName?: string;
  buildRequestBody?: BuildPushSyncRequestBody;
};

type RefreshOptions = {
  preserveError?: boolean;
};

async function getExistingRegistration() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return null;
  }

  return navigator.serviceWorker.getRegistration("/");
}

export function usePushSubscriptionSync(options: UsePushSubscriptionSyncOptions = {}) {
  const { clientId: authClientId } = useAuth();
  const clientId = options.clientId ?? authClientId;
  const autoRegister = options.autoRegister !== false;
  const autoSync = options.autoSync === true;
  const vapidPublicKey = options.vapidPublicKey ?? getAppConfig().pushVapidPublicKey ?? null;

  const [support, setSupport] = React.useState<PushSupportSnapshot>(() => getPushSupportSnapshot(vapidPublicKey));
  const [permission, setPermission] = React.useState<PushPermissionState>(() => getPushPermissionState());
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = React.useState<PushSubscription | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null);
  const [lastSyncResult, setLastSyncResult] = React.useState<PushSyncResult | null>(null);
  const autoSyncKeyRef = React.useRef<string>("");

  const refresh = React.useCallback(
    async (refreshOptions: RefreshOptions = {}) => {
      const nextSupport = getPushSupportSnapshot(vapidPublicKey);
      const nextPermission = getPushPermissionState();
      setSupport(nextSupport);
      setPermission(nextPermission);

      if (!nextSupport.supported) {
        setRegistration(null);
        setSubscription(null);
        setLoading(false);
        if (!refreshOptions.preserveError) {
          setError(nextSupport.reason);
        }
        return {
          registration: null,
          permission: nextPermission,
          subscription: null,
          support: nextSupport,
        };
      }

      setLoading(true);
      try {
        const nextRegistration = autoRegister ? await registerPushServiceWorker() : await getExistingRegistration();
        const nextSubscription = await getCurrentPushSubscription(nextRegistration);
        setRegistration(nextRegistration);
        setSubscription(nextSubscription);
        if (!refreshOptions.preserveError) {
          setError(null);
        }
        return {
          registration: nextRegistration,
          permission: nextPermission,
          subscription: nextSubscription,
          support: nextSupport,
        };
      } catch (refreshError) {
        const message = getErrorMessage(refreshError, "Failed to initialize browser push.");
        setRegistration(null);
        setSubscription(null);
        setError(message);
        return {
          registration: null,
          permission: nextPermission,
          subscription: null,
          support: nextSupport,
        };
      } finally {
        setLoading(false);
      }
    },
    [autoRegister, vapidPublicKey]
  );

  const sync = React.useCallback(
    async (overrides?: {
      endpoint?: string | null;
      subscription?: PushSubscription | null;
      registration?: ServiceWorkerRegistration | null;
    }) => {
      setSyncing(true);
      try {
        const result = await syncPushSubscription({
          clientId,
          permission,
          endpoint: overrides?.endpoint ?? null,
          registration: overrides?.registration ?? registration,
          subscription: overrides?.subscription ?? subscription,
          functionName: options.functionName,
          buildRequestBody: options.buildRequestBody ?? buildDefaultPushSyncRequestBody,
        });
        setLastSyncResult(result);
        if (!result.skipped) {
          setLastSyncedAt(new Date());
        }
        setError(null);
        return result;
      } catch (syncError) {
        const message = getErrorMessage(syncError, "Failed to sync browser push subscription.");
        setError(message);
        throw syncError;
      } finally {
        setSyncing(false);
      }
    },
    [clientId, options.buildRequestBody, options.functionName, permission, registration, subscription]
  );

  const requestPermission = React.useCallback(async () => {
    const nextPermission = await requestBrowserPushPermission();
    setPermission(nextPermission);
    await refresh({ preserveError: true });
    return nextPermission;
  }, [refresh]);

  const subscribe = React.useCallback(async () => {
    const currentPermission = getPushPermissionState();
    let grantedPermission = currentPermission;

    if (currentPermission !== "granted") {
      grantedPermission = await requestPermission();
    }

    if (grantedPermission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    const nextRegistration = registration ?? (await registerPushServiceWorker());
    const nextSubscription = await createBrowserPushSubscription({
      registration: nextRegistration,
      vapidPublicKey,
    });

    setPermission(grantedPermission);
    setRegistration(nextRegistration);
    setSubscription(nextSubscription);
    setError(null);

    if (autoSync) {
      await sync({
        registration: nextRegistration,
        subscription: nextSubscription,
      });
    }

    return nextSubscription;
  }, [autoSync, registration, requestPermission, sync, vapidPublicKey]);

  const unsubscribe = React.useCallback(async () => {
    const nextRegistration = registration ?? (await getExistingRegistration());
    const existingSubscription = await getCurrentPushSubscription(nextRegistration);
    const existingEndpoint = existingSubscription?.endpoint ?? existingSubscription?.toJSON().endpoint ?? null;

    await unsubscribeBrowserPushSubscription(nextRegistration);
    setRegistration(nextRegistration);
    setSubscription(null);
    setPermission(getPushPermissionState());
    setError(null);

    if (autoSync && existingEndpoint) {
      await sync({
        endpoint: existingEndpoint,
        registration: nextRegistration,
        subscription: null,
      });
    }
  }, [autoSync, registration, sync]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleRefresh = () => {
      void refresh({ preserveError: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    const handleWorkerMessage = (event: MessageEvent) => {
      const type =
        event.data && typeof event.data === "object" && !Array.isArray(event.data)
          ? (event.data as { type?: unknown }).type
          : null;
      if (type === PUSH_SUBSCRIPTION_CHANGE_MESSAGE) {
        handleRefresh();
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!autoSync || loading || syncing || !support.supported) return;

    const subscriptionKey = subscription?.endpoint ?? "none";
    const nextKey = `${clientId ?? "no-client"}|${permission}|${subscriptionKey}`;
    if (nextKey === autoSyncKeyRef.current) return;

    autoSyncKeyRef.current = nextKey;
    void sync().catch(() => {
      // Preserve hook state; caller surfaces the latest error message.
    });
  }, [autoSync, clientId, loading, permission, subscription, support.supported, sync, syncing]);

  const subscriptionJson = React.useMemo(() => subscription?.toJSON() ?? null, [subscription]);
  const canPrompt = support.supported && permission === "default";
  const canSubscribe = support.supported && permission !== "denied" && Boolean(vapidPublicKey?.trim());
  const canSync = support.supported && Boolean(clientId) && Boolean(subscriptionJson?.endpoint);

  return {
    support,
    permission,
    registration,
    subscription,
    subscriptionJson,
    subscribed: Boolean(subscriptionJson?.endpoint),
    loading,
    syncing,
    error,
    lastSyncedAt,
    lastSyncResult,
    canPrompt,
    canSubscribe,
    canSync,
    refresh,
    requestPermission,
    subscribe,
    unsubscribe,
    sync,
  };
}
