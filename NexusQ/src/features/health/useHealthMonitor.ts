import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";
import { fetchAutomationHealthFallback, fetchHealthStatus, HEALTH_URLS, HealthFetchError, SUPABASE_URL } from "@/features/health/api";
import {
  createInitialNetworkSnapshot,
  persistLogs,
  persistServices,
  readBrowserConnectionSnapshot,
  readStoredLogs,
  readStoredServices,
} from "@/features/health/cache";
import {
  HEALTHY_CYCLES_TO_RECOVER,
  INCIDENT_REFRESH_SEC,
  NOMINAL_REFRESH_SEC,
  WORKFLOW_KEYS,
  type HealthLog,
  type HealthPayload,
  type HealthService,
  type NetworkSnapshot,
} from "@/features/health/types";
import {
  addSystemLog,
  buildSecuritySnapshot,
  buildStatusChangeLogs,
  buildWorkflowServices,
  createFallbackService,
  dedupeLogs,
  dedupeServices,
  hasIncidentStatus,
} from "@/features/health/utils";

export function useHealthMonitor() {
  const { clientId } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [payload, setPayload] = React.useState<HealthPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null);
  const [appSettings, setAppSettings] = React.useState(() => loadAppSettings());
  const [serviceSnapshot, setServiceSnapshot] = React.useState<HealthService[]>(() => readStoredServices());
  const [logHistory, setLogHistory] = React.useState<HealthLog[]>(() => readStoredLogs());
  const [networkSnapshot, setNetworkSnapshot] = React.useState<NetworkSnapshot>(() =>
    createInitialNetworkSnapshot(HEALTH_URLS)
  );
  const nominalRefreshSec = Math.max(NOMINAL_REFRESH_SEC, appSettings.refreshIntervalSec);
  const [adaptiveIntervalSec, setAdaptiveIntervalSec] = React.useState<number>(nominalRefreshSec);
  const [nextRefreshAt, setNextRefreshAt] = React.useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = React.useState<number | null>(null);
  const [refreshCycleToken, setRefreshCycleToken] = React.useState(0);
  const previousServicesRef = React.useRef<HealthService[]>(serviceSnapshot);
  const healthyCyclesRef = React.useRef(0);
  const adaptiveIntervalRef = React.useRef<number>(nominalRefreshSec);
  const nominalRefreshSecRef = React.useRef(nominalRefreshSec);

  React.useEffect(() => {
    nominalRefreshSecRef.current = nominalRefreshSec;
  }, [nominalRefreshSec]);

  React.useEffect(() => {
    const nextNominalRefreshSec = nominalRefreshSecRef.current;
    previousServicesRef.current = [];
    healthyCyclesRef.current = 0;
    adaptiveIntervalRef.current = nextNominalRefreshSec;
    setAdaptiveIntervalSec(nextNominalRefreshSec);
    setPayload(null);
    setError(null);
    setLastRefreshAt(null);
    setLogHistory(readStoredLogs());
    setServiceSnapshot(readStoredServices());
    setNetworkSnapshot(createInitialNetworkSnapshot(HEALTH_URLS));
  }, [clientId]);

  React.useEffect(() => {
    if (adaptiveIntervalRef.current !== INCIDENT_REFRESH_SEC) {
      adaptiveIntervalRef.current = nominalRefreshSec;
      setAdaptiveIntervalSec(nominalRefreshSec);
    }
  }, [nominalRefreshSec]);

  React.useEffect(() => {
    if (!previousServicesRef.current.length && serviceSnapshot.length) {
      previousServicesRef.current = serviceSnapshot;
    }
  }, [serviceSnapshot]);

  const appendLogs = React.useCallback((entries: HealthLog[]) => {
    if (!entries.length) return;
    setLogHistory((previous) => {
      const merged = dedupeLogs([...entries, ...previous]);
      persistLogs(merged);
      return merged;
    });
  }, []);

  const run = React.useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchHealthStatus(clientId);
      let baseServices = dedupeServices(result.payload.services ?? []);
      const supplementalLogs: HealthLog[] = [];

      if (!baseServices.length && clientId) {
        try {
          const fallbackServices = await fetchAutomationHealthFallback(clientId);
          if (fallbackServices.length) {
            baseServices = fallbackServices;
            supplementalLogs.push(
              addSystemLog("Workflow E proxy returned no service payload. Loaded fallback snapshot from automation_health.", "warning")
            );
          }
        } catch (fallbackError: unknown) {
          supplementalLogs.push(
            addSystemLog(
              `Workflow fallback query failed: ${getErrorMessage(fallbackError, "Unknown error")}`,
              "warning"
            )
          );
        }
      }

      const incomingServices = buildWorkflowServices(baseServices, previousServicesRef.current);
      const remoteLogs = dedupeLogs(result.payload.logs ?? []);
      const statusChangeLogs = buildStatusChangeLogs(previousServicesRef.current, incomingServices);
      const hasIncident = hasIncidentStatus(incomingServices);
      const modeLogs: HealthLog[] = [];

      if (hasIncident) {
        healthyCyclesRef.current = 0;
        if (adaptiveIntervalRef.current !== INCIDENT_REFRESH_SEC) {
          adaptiveIntervalRef.current = INCIDENT_REFRESH_SEC;
          setAdaptiveIntervalSec(INCIDENT_REFRESH_SEC);
          modeLogs.push(addSystemLog(`Incident detected. Auto-refresh increased to every ${INCIDENT_REFRESH_SEC}s.`, "warning"));
        }
      } else if (adaptiveIntervalRef.current === INCIDENT_REFRESH_SEC) {
        healthyCyclesRef.current += 1;
        if (healthyCyclesRef.current >= HEALTHY_CYCLES_TO_RECOVER) {
          healthyCyclesRef.current = 0;
          adaptiveIntervalRef.current = nominalRefreshSec;
          setAdaptiveIntervalSec(nominalRefreshSec);
          modeLogs.push(addSystemLog(`Health stabilized. Auto-refresh returned to ${nominalRefreshSec}s.`, "info"));
        }
      } else {
        healthyCyclesRef.current = 0;
        if (adaptiveIntervalRef.current !== nominalRefreshSec) {
          adaptiveIntervalRef.current = nominalRefreshSec;
          setAdaptiveIntervalSec(nominalRefreshSec);
        }
      }

      appendLogs([
        ...remoteLogs,
        ...supplementalLogs,
        ...statusChangeLogs,
        ...modeLogs,
        addSystemLog("Health refresh completed.", "success"),
      ]);

      setPayload({
        ...result.payload,
        services: incomingServices,
        logs: remoteLogs,
      });
      setServiceSnapshot(incomingServices);
      persistServices(incomingServices);
      previousServicesRef.current = incomingServices;
      setNetworkSnapshot({
        endpoints: result.endpointProbes,
        activeEndpointUrl: result.activeEndpointUrl,
        browser: readBrowserConnectionSnapshot(),
        checkedAt: new Date().toISOString(),
      });
      setError(null);
      setLastRefreshAt(new Date());
    } catch (runError: unknown) {
      const errorMessage = getErrorMessage(runError, "Failed to fetch health");
      setError(errorMessage);

      if (runError instanceof HealthFetchError) {
        setNetworkSnapshot({
          endpoints: runError.endpointProbes,
          activeEndpointUrl: null,
          browser: readBrowserConnectionSnapshot(),
          checkedAt: new Date().toISOString(),
        });
      } else {
        setNetworkSnapshot((previous) => ({
          ...previous,
          browser: readBrowserConnectionSnapshot(),
          checkedAt: new Date().toISOString(),
        }));
      }

      if (clientId) {
        try {
          const fallbackServices = await fetchAutomationHealthFallback(clientId);
          if (fallbackServices.length) {
            const fallbackSnapshot = buildWorkflowServices(fallbackServices, previousServicesRef.current);
            setPayload(null);
            setServiceSnapshot(fallbackSnapshot);
            persistServices(fallbackSnapshot);
            previousServicesRef.current = fallbackSnapshot;
            appendLogs([
              addSystemLog(`Health refresh failed: ${errorMessage}`, "warning"),
              addSystemLog("Loaded automation_health fallback after probe failure.", "warning"),
            ]);
            setLastRefreshAt(new Date());
            return;
          }
        } catch (fallbackError: unknown) {
          appendLogs([
            addSystemLog(`Health refresh failed: ${errorMessage}`, "warning"),
            addSystemLog(
              `Fallback recovery failed: ${getErrorMessage(fallbackError, "Unknown error")}`,
              "warning"
            ),
          ]);
          return;
        }
      }

      appendLogs([addSystemLog(`Health refresh failed: ${errorMessage}`, "warning")]);
    } finally {
      setLoading(false);
    }
  }, [appendLogs, clientId, nominalRefreshSec]);

  const requestRefresh = React.useCallback(() => {
    setRefreshCycleToken((previous) => previous + 1);
  }, []);

  React.useEffect(() => {
    const onSettingsChanged = () => setAppSettings(loadAppSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
  }, []);

  React.useEffect(() => {
    const updateConnection = () => {
      setNetworkSnapshot((previous) => ({ ...previous, browser: readBrowserConnectionSnapshot() }));
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    const nav = navigator as Navigator & {
      connection?: EventTarget;
      mozConnection?: EventTarget;
      webkitConnection?: EventTarget;
    };
    const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    connection?.addEventListener?.("change", updateConnection as EventListener);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      connection?.removeEventListener?.("change", updateConnection as EventListener);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (seconds: number) => {
      if (!mounted || !appSettings.autoRefresh) return;
      const nextAt = Date.now() + seconds * 1000;
      setNextRefreshAt(nextAt);
      timer = setTimeout(() => {
        void tick();
      }, seconds * 1000);
    };

    const tick = async () => {
      if (!mounted) return;
      await run();
      if (!mounted || !appSettings.autoRefresh) return;
      scheduleNext(adaptiveIntervalRef.current);
    };

    if (appSettings.autoRefresh) {
      void tick();
    } else {
      setNextRefreshAt(null);
      setSecondsUntilRefresh(null);
      void run();
    }

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [appSettings.autoRefresh, refreshCycleToken, run]);

  React.useEffect(() => {
    if (!appSettings.autoRefresh || nextRefreshAt == null) {
      setSecondsUntilRefresh(null);
      return;
    }

    const updateCountdown = () => {
      setSecondsUntilRefresh(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [appSettings.autoRefresh, nextRefreshAt]);

  const services = payload?.services?.length
    ? payload.services
    : serviceSnapshot.length
    ? serviceSnapshot
    : WORKFLOW_KEYS.map((key) => createFallbackService(key));
  const logs = logHistory;
  const headlineOk = payload?.allOperational ?? false;
  const incidentMode = adaptiveIntervalSec === INCIDENT_REFRESH_SEC;
  const securitySnapshot = React.useMemo(
    () =>
      buildSecuritySnapshot({
        appSettings,
        networkSnapshot,
        generatedAt: payload?.generated_at ?? null,
        endpointUrls: HEALTH_URLS.concat(SUPABASE_URL ? [SUPABASE_URL] : []),
      }),
    [appSettings, networkSnapshot, payload?.generated_at]
  );

  return {
    loading,
    error,
    lastRefreshAt,
    services,
    logs,
    networkSnapshot,
    securitySnapshot,
    appSettings,
    adaptiveIntervalSec,
    secondsUntilRefresh,
    headlineOk,
    incidentMode,
    requestRefresh,
    showInitialLoading: loading && !payload && !serviceSnapshot.length,
  };
}
