import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { listMessages, subscribeToLeadMessages } from "@/lib/services/messages";
import type { MessageRecord } from "@/lib/types/domain";

type UseLeadMessagesOptions = {
  limit?: number;
  enabled?: boolean;
};

export function useLeadMessages(leadId: string | null, options: UseLeadMessagesOptions = {}) {
  const { clientId } = useAuth();
  const { limit = 8, enabled = true } = options;
  const [messages, setMessages] = React.useState<MessageRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const refresh = React.useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!enabled || !clientId || !leadId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      setLastLoadedAt(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const nextMessages = await listMessages({ clientId, leadId, limit });
        if (cancelled) return;
        setMessages(nextMessages);
        setError(null);
        setLastLoadedAt(new Date());
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load recent messages."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const unsubscribe = subscribeToLeadMessages({
      clientId,
      leadId,
      onChange: () => {
        void load();
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clientId, enabled, leadId, limit, refreshToken]);

  return {
    messages,
    loading,
    error,
    lastLoadedAt,
    refresh,
  };
}
