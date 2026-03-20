import { Filter, Plus, Settings } from "lucide-react";
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActionEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PipelineBoard } from "@/features/pipeline/components/PipelineBoard";
import { PipelineEditDialog } from "@/features/pipeline/components/PipelineEditDialog";
import { PipelineFiltersBar } from "@/features/pipeline/components/PipelineFiltersBar";
import { PipelineResultsBar } from "@/features/pipeline/components/PipelineResultsBar";
import { PipelineStatsBar } from "@/features/pipeline/components/PipelineStatsBar";
import { usePipelineViewModel } from "@/features/pipeline/usePipelineViewModel";

export function Pipeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewModel = usePipelineViewModel();
  const leadParam = searchParams.get("lead");
  const {
    loading,
    error,
    activeLeadId,
    dialogOpen,
    openLeadById,
    openEdit,
    setDialogOpen,
  } = viewModel;

  React.useEffect(() => {
    if (!leadParam || loading || Boolean(error)) return;
    if (activeLeadId === leadParam && dialogOpen) return;
    openLeadById(leadParam);
  }, [activeLeadId, dialogOpen, error, leadParam, loading, openLeadById]);

  const handleOpenEdit = React.useCallback(
    (lead: Parameters<typeof openEdit>[0]) => {
      openEdit(lead);
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("lead", lead.id);
        return next;
      }, { replace: true });
    },
    [openEdit, setSearchParams]
  );

  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open && searchParams.has("lead")) {
        const next = new URLSearchParams(searchParams);
        next.delete("lead");
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setDialogOpen, setSearchParams]
  );

  if (loading) {
    return <PageLoadingState title="Loading pipeline board" description="Fetching stage distribution, values, and board state." />;
  }

  if (error) {
    return <PageErrorState title="Pipeline data unavailable" message={error} onRetry={viewModel.refresh} />;
  }

  return (
    <>
      <div className="space-y-8 pb-8">
        <PageHeader
          title="Pipeline Operations"
          description="Revenue flow and lead progression across all stages."
          lastUpdatedLabel={`Last updated: ${viewModel.lastLoadedAt ? viewModel.lastLoadedAt.toLocaleTimeString() : "Not yet synced"}`}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={viewModel.refresh}>
                <Filter className="h-4 w-4" />
                Refresh
              </Button>
              <Button size="sm" className="h-10 gap-2" onClick={() => navigate("/intake")}>
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </>
          }
        />

        <PipelineStatsBar
          stageDistributionData={viewModel.stageDistributionData}
          revenueData={viewModel.revenueData}
          pipelineFlowData={viewModel.pipelineFlowData}
        />

        <PipelineFiltersBar
          searchQuery={viewModel.searchQuery}
          onSearchQueryChange={viewModel.setSearchQuery}
          stageFilter={viewModel.stageFilter}
          onStageFilterChange={viewModel.setStageFilter}
          filteredLeadCount={viewModel.filteredLeadCount}
          hasFiltersActive={viewModel.hasFiltersActive}
          onResetFilters={viewModel.resetFilters}
        />

        {viewModel.noLeads ? (
          <ActionEmptyState
            title="No leads in pipeline"
            description="Create a lead to start workflow progression and stage analytics."
            primaryActionLabel="Add Lead"
            onPrimaryAction={() => navigate("/intake")}
            secondaryActionLabel="Refresh Pipeline"
            onSecondaryAction={viewModel.refresh}
          />
        ) : null}

        {viewModel.noResults ? (
          <Card className="border-none bg-muted/10">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="text-lg font-semibold">No leads match the current filters.</div>
              <div className="text-sm text-muted-foreground">
                Try a broader search or clear the stage filter to bring more leads back into view.
              </div>
              <Button variant="outline" onClick={viewModel.resetFilters}>
                Reset filters
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {viewModel.hasMoreLeads ? (
          <PipelineResultsBar
            visibleLeadCount={viewModel.visibleLeadCount}
            filteredLeadCount={viewModel.filteredLeadCount}
            hiddenLeadCount={viewModel.hiddenLeadCount}
            showAllLeads={viewModel.showAllLeads}
            onToggleShowAll={() => viewModel.setShowAllLeads((previous) => !previous)}
          />
        ) : null}

        <PipelineBoard
          sensors={viewModel.sensors}
          columns={viewModel.columns}
          activeDragLead={viewModel.activeDragLead}
          onDragStart={viewModel.handleDragStart}
          onDragOver={viewModel.handleDragOver}
          onDragEnd={viewModel.handleDragEnd}
          onDragCancel={viewModel.handleDragCancel}
          onOpenEdit={handleOpenEdit}
          onMovePrev={(lead) => {
            void viewModel.moveLeadStage(lead, "prev");
          }}
          onMoveNext={(lead) => {
            void viewModel.moveLeadStage(lead, "next");
          }}
          onAddLead={() => navigate("/intake")}
        />
      </div>

      <PipelineEditDialog
        open={viewModel.dialogOpen}
        onOpenChange={handleDialogOpenChange}
        saving={viewModel.saving}
        activeLead={viewModel.activeLead}
        activeLeadSource={viewModel.activeLeadSource}
        activePipeline={viewModel.activePipeline}
        activeEventSummary={viewModel.activeEventSummary}
        editStage={viewModel.editStage}
        onEditStageChange={viewModel.setEditStage}
        editValue={viewModel.editValue}
        onEditValueChange={viewModel.setEditValue}
        parsedEditValue={viewModel.parsedEditValue}
        onSave={() => {
          void viewModel.saveEdit();
        }}
      />
    </>
  );
}
