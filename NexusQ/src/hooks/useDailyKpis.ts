import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { listDailyKpis } from "@/lib/services/kpis";
import type { DailyKpiRecord } from "@/lib/types/domain";

export function useDailyKpis(limit = 14) {
  const { clientId } = useAuth();
  const [kpis, setKpis] = React.useState<DailyKpiRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const refresh = React.useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!clientId) {
      setKpis([]);
      setError(null);
      setLoading(false);
      setLastLoadedAt(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const rows = await listDailyKpis(clientId, limit);
        if (cancelled) return;
        setKpis(rows);
        setError(null);
        setLastLoadedAt(new Date());
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load KPI snapshots."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [clientId, limit, refreshToken]);

  return {
    kpis,
    loading,
    error,
    lastLoadedAt,
    refresh,
  };
}
