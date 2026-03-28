import { ArrowRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ActionEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardActivityCard } from "@/features/dashboard/components/DashboardActivityCard";
import { DashboardAiAnalystPanel } from "@/features/dashboard/components/DashboardAiAnalystPanel";
import { DashboardAttentionPanel } from "@/features/dashboard/components/DashboardAttentionPanel";
import { DashboardHero } from "@/features/dashboard/components/DashboardHero";
import { DashboardMetricsSection } from "@/features/dashboard/components/DashboardMetricsSection";
import { DashboardOverviewSection } from "@/features/dashboard/components/DashboardOverviewSection";
import { DashboardPipelineSummary } from "@/features/dashboard/components/DashboardPipelineSummary";
import { useDashboardAiAnalyst } from "@/features/dashboard/useDashboardAiAnalyst";
import { useDashboardViewModel } from "@/features/dashboard/useDashboardViewModel";

export function Dashboard() {
  const navigate = useNavigate();
  const viewModel = useDashboardViewModel();
  const analyst = useDashboardAiAnalyst();

  const handleRefresh = () => {
    viewModel.refresh();
    void analyst.refresh();
  };

  if (viewModel.loading) {
    return <PageLoadingState title="Loading dashboard" description="Syncing pipeline, lead volume, and intelligence data." />;
  }

  if (viewModel.error) {
    return <PageErrorState title="Dashboard data unavailable" message={viewModel.error} onRetry={viewModel.refresh} />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Command Center"
        description="Real-time revenue operations and system health."
        lastUpdatedLabel={`Last updated: ${viewModel.lastLoadedAt ? viewModel.lastLoadedAt.toLocaleTimeString() : "Not yet synced"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="gap-2 h-10" aria-label="Open settings">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/intake")} className="gap-2 h-10" aria-label="Add a new lead">
              Add Lead <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-10" onClick={handleRefresh} aria-label="Refresh dashboard data">
              Refresh
            </Button>
          </>
        }
      />

      {!viewModel.leads.length ? (
        <ActionEmptyState
          title="No leads yet"
          description="Add your first lead to unlock real-time trends, conversions, and automation insights."
          primaryActionLabel="Add First Lead"
          onPrimaryAction={() => navigate("/intake")}
          secondaryActionLabel="Refresh Data"
          onSecondaryAction={viewModel.refresh}
        />
      ) : null}

      <DashboardHero
        intelligence={viewModel.intelligence}
        todaySnapshot={viewModel.todaySnapshot}
        onPrimaryAction={() => navigate(viewModel.intelligence.actionPath)}
      />

      <DashboardAiAnalystPanel
        briefing={analyst.briefing}
        thread={analyst.thread}
        loading={analyst.loading}
        asking={analyst.asking}
        error={analyst.error}
        lastLoadedAt={analyst.lastLoadedAt}
        onRefresh={analyst.refresh}
        onAskQuestion={analyst.askQuestion}
      />

      <DashboardAttentionPanel items={viewModel.attentionItems} />

      <DashboardPipelineSummary
        data={viewModel.pipelineSummary}
        totalValue={viewModel.pipelineValue}
        onViewPipeline={() => navigate("/pipeline")}
      />

      <DashboardOverviewSection leadTrend={viewModel.leadTrend} stats={viewModel.stats} />

      <DashboardMetricsSection
        funnelData={viewModel.funnelData}
        responseData={viewModel.responseData}
        activityData={viewModel.activityData}
      />

      <div className="grid gap-6">
        <DashboardActivityCard
          recentActivity={viewModel.recentActivity}
          onViewAll={() => navigate("/pipeline")}
          onAddLead={() => navigate("/intake")}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
}
