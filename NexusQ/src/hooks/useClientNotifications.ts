import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { listClientNotifications, subscribeToClientNotifications } from "@/lib/services/notifications";
import type { ClientNotificationRecord } from "@/lib/types/domain";

export function useClientNotifications(limit = 20) {
  const { clientId } = useAuth();
  const [notifications, setNotifications] = React.useState<ClientNotificationRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const refresh = React.useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!clientId) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      setLastLoadedAt(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const rows = await listClientNotifications(clientId, limit);
        if (cancelled) return;
        setNotifications(rows);
        setError(null);
        setLastLoadedAt(new Date());
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load workspace notifications."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const unsubscribe = subscribeToClientNotifications(clientId, () => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clientId, limit, refreshToken]);

  return {
    notifications,
    loading,
    error,
    lastLoadedAt,
    refresh,
  };
}
