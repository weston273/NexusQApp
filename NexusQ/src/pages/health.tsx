import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { PageErrorState, PageLoadingState } from "@/components/ui/data-state";
import { HealthActivityLogCard } from "@/features/health/components/HealthActivityLogCard";
import { HealthNetworkCard } from "@/features/health/components/HealthNetworkCard";
import { HealthSecurityCard } from "@/features/health/components/HealthSecurityCard";
import { HealthServiceGrid } from "@/features/health/components/HealthServiceGrid";
import { HealthToolbar } from "@/features/health/components/HealthToolbar";
import { useHealthMonitor } from "@/features/health/useHealthMonitor";

export function Health() {
  const navigate = useNavigate();
  const {
    adaptiveIntervalSec,
    appSettings,
    error,
    headlineOk,
    incidentMode,
    lastRefreshAt,
    loading,
    logs,
    networkSnapshot,
    requestRefresh,
    secondsUntilRefresh,
    securitySnapshot,
    services,
    showInitialLoading,
  } = useHealthMonitor();

  if (showInitialLoading) {
    return <PageLoadingState title="Loading system health" description="Probing workflow endpoints and runtime diagnostics." cardCount={4} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <PageHeader
          title="System Health"
          description="Operational status of Nexus Q automation layers (live from Workflow E health-ping reachability and automation snapshots)."
          lastUpdatedLabel={`Last updated: ${lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : "Not yet synced"}`}
        />
        <HealthToolbar
          autoRefresh={appSettings.autoRefresh}
          loading={loading}
          headlineOk={headlineOk}
          incidentMode={incidentMode}
          adaptiveIntervalSec={adaptiveIntervalSec}
          secondsUntilRefresh={secondsUntilRefresh}
          onRefresh={requestRefresh}
          onOpenSettings={() => navigate("/settings")}
        />
      </div>

      {error ? <PageErrorState title="Health endpoint unavailable" message={error} onRetry={requestRefresh} /> : null}

      <HealthServiceGrid services={services} />

      <div className="grid gap-6 lg:grid-cols-3">
        <HealthActivityLogCard
          logs={logs}
          onRefresh={requestRefresh}
          onOpenSettings={() => navigate("/settings")}
        />

        <div className="space-y-6">
          <HealthNetworkCard networkSnapshot={networkSnapshot} />
          <HealthSecurityCard securitySnapshot={securitySnapshot} />
        </div>
      </div>
    </div>
  );
}
