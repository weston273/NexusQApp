import * as React from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { useLeads } from "@/hooks/useLeads";
import { parseFunctionError } from "@/lib/access";
import { getErrorMessage } from "@/lib/errors";
import {
  isPipelineStage,
  normalizePipelineStage,
  parseCurrencyInput,
  PIPELINE_STAGE_ORDER,
  type PipelineStage,
} from "@/lib/leads";
import { supabase } from "@/lib/supabase";
import type { PipelineActiveLead, PipelineStageFilter, UiLead } from "@/features/pipeline/types";
import {
  buildActiveEventSummary,
  buildColumns,
  buildLatestEventByLeadId,
  buildLeadSourceById,
  buildPipelineByLeadId,
  buildPipelineFlowData,
  buildRevenueData,
  buildStageCounts,
  buildStageDistributionData,
  buildUiLeads,
  DEFAULT_VISIBLE_LEADS,
  filterUiLeads,
} from "@/features/pipeline/utils";

async function callWorkflowD(args: { lead_id: string; status: PipelineStage; value?: number | null }) {
  const payload: Record<string, unknown> = {
    lead_id: args.lead_id,
    status: args.status,
    stage: args.status,
    value: args.value ?? null,
  };

  const { data, error } = await supabase.functions.invoke("workflow-d-proxy", {
    body: payload,
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }
  if (!data?.ok) {
    const message = typeof data?.error === "string" ? data.error : "Workflow D failed.";
    throw new Error(message);
  }

  return data;
}

export function usePipelineViewModel() {
  const { leads, events, pipelineRows, loading, error, lastLoadedAt, reload } = useLeads();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } })
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [activeLead, setActiveLead] = React.useState<PipelineActiveLead>(null);
  const [editStage, setEditStage] = React.useState<PipelineStage>("new");
  const [editValue, setEditValue] = React.useState("0");
  const [showAllLeads, setShowAllLeads] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<PipelineStageFilter>("all");
  const [stageOverrides, setStageOverrides] = React.useState<Record<string, PipelineStage>>({});
  const [activeDragLeadId, setActiveDragLeadId] = React.useState<string | null>(null);
  const dragOriginRef = React.useRef<Record<string, PipelineStage>>({});

  const pipelineByLeadId = React.useMemo(() => buildPipelineByLeadId(pipelineRows), [pipelineRows]);
  const leadSourceById = React.useMemo(() => buildLeadSourceById(leads), [leads]);
  const latestEventByLeadId = React.useMemo(() => buildLatestEventByLeadId(events), [events]);

  const uiLeads = React.useMemo(
    () =>
      buildUiLeads({
        leads,
        pipelineByLeadId,
        stageOverrides,
      }),
    [leads, pipelineByLeadId, stageOverrides]
  );

  const sortedLeadIdsByRecency = React.useMemo(
    () => [...uiLeads].sort((a, b) => b.createdAtMs - a.createdAtMs).map((lead) => lead.id),
    [uiLeads]
  );

  const filteredUiLeads = React.useMemo(
    () =>
      filterUiLeads({
        uiLeads,
        searchQuery,
        stageFilter,
        leadSourceById,
      }),
    [leadSourceById, searchQuery, stageFilter, uiLeads]
  );

  const visibleLeadIds = React.useMemo(() => {
    const filteredIds = new Set(filteredUiLeads.map((lead) => lead.id));
    const orderedFilteredIds = sortedLeadIdsByRecency.filter((leadId) => filteredIds.has(leadId));
    const ids = showAllLeads ? orderedFilteredIds : orderedFilteredIds.slice(0, DEFAULT_VISIBLE_LEADS);
    return new Set(ids);
  }, [filteredUiLeads, showAllLeads, sortedLeadIdsByRecency]);

  const visibleUiLeads = React.useMemo(
    () => filteredUiLeads.filter((lead) => visibleLeadIds.has(lead.id)),
    [filteredUiLeads, visibleLeadIds]
  );

  const hasMoreLeads = filteredUiLeads.length > DEFAULT_VISIBLE_LEADS;
  const hiddenLeadCount = Math.max(0, filteredUiLeads.length - DEFAULT_VISIBLE_LEADS);
  const hasFiltersActive = Boolean(searchQuery.trim()) || stageFilter !== "all";
  const noLeads = uiLeads.length === 0;
  const noResults = uiLeads.length > 0 && filteredUiLeads.length === 0;

  React.useEffect(() => {
    if (filteredUiLeads.length <= DEFAULT_VISIBLE_LEADS && showAllLeads) {
      setShowAllLeads(false);
    }
  }, [filteredUiLeads.length, showAllLeads]);

  const leadById = React.useMemo(() => {
    const map = new Map<string, UiLead>();
    for (const lead of uiLeads) {
      map.set(lead.id, lead);
    }
    return map;
  }, [uiLeads]);

  const activeLeadSource = React.useMemo(
    () => (activeLead ? leadSourceById.get(activeLead.id) ?? null : null),
    [activeLead, leadSourceById]
  );
  const activePipeline = React.useMemo(
    () => (activeLead ? pipelineByLeadId.get(activeLead.id) ?? null : null),
    [activeLead, pipelineByLeadId]
  );
  const activeLatestEvent = React.useMemo(
    () => (activeLead ? latestEventByLeadId.get(activeLead.id) ?? null : null),
    [activeLead, latestEventByLeadId]
  );
  const activeEventSummary = React.useMemo(
    () => buildActiveEventSummary(activeLatestEvent),
    [activeLatestEvent]
  );

  const stageCounts = React.useMemo(() => buildStageCounts(uiLeads), [uiLeads]);
  const stageDistributionData = React.useMemo(() => buildStageDistributionData(stageCounts), [stageCounts]);
  const revenueData = React.useMemo(() => buildRevenueData(pipelineRows), [pipelineRows]);
  const pipelineFlowData = React.useMemo(() => buildPipelineFlowData(stageCounts), [stageCounts]);
  const columns = React.useMemo(
    () =>
      buildColumns({
        visibleUiLeads,
        filteredUiLeads,
        showAllLeads,
      }),
    [filteredUiLeads, showAllLeads, visibleUiLeads]
  );

  const activeDragLead = React.useMemo(
    () => (activeDragLeadId ? leadById.get(activeDragLeadId) ?? null : null),
    [activeDragLeadId, leadById]
  );

  const openEdit = React.useCallback((lead: UiLead) => {
    setActiveLead({ id: lead.id, name: lead.name, stage: lead.stage, valueNum: lead.valueNum });
    setEditStage(lead.stage);
    setEditValue(String(Math.round(lead.valueNum || 0)));
    setDialogOpen(true);
  }, []);

  const openLeadById = React.useCallback(
    (leadId: string) => {
      const lead = leadById.get(leadId);
      if (!lead) return false;
      openEdit(lead);
      return true;
    },
    [leadById, openEdit]
  );

  const handleDialogOpenChange = React.useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveLead(null);
    }
  }, []);

  const resetFilters = React.useCallback(() => {
    setSearchQuery("");
    setStageFilter("all");
  }, []);

  const refresh = React.useCallback(() => {
    void reload();
  }, [reload]);

  const saveEdit = React.useCallback(async () => {
    if (!activeLead) return;

    const previousStage = activeLead.stage;
    const previousValue = activeLead.valueNum;
    const leadId = activeLead.id;
    const leadName = activeLead.name;

    try {
      setSaving(true);

      const valueNum = parseCurrencyInput(editValue);
      await callWorkflowD({
        lead_id: activeLead.id,
        status: editStage,
        value: valueNum,
      });

      toast.success("Pipeline updated", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await callWorkflowD({ lead_id: leadId, status: previousStage, value: previousValue });
              toast.success("Update reverted");
              await reload({ silent: true });
            } catch (undoError: unknown) {
              toast.error(getErrorMessage(undoError, "Failed to undo update"));
            }
          },
        },
      });

      setDialogOpen(false);
      await reload({ silent: true });
    } catch (saveError: unknown) {
      toast.error(getErrorMessage(saveError, `Failed to update ${leadName}`));
    } finally {
      setSaving(false);
    }
  }, [activeLead, editStage, editValue, reload]);

  const clearStageOverride = React.useCallback((leadId: string) => {
    setStageOverrides((previous) => {
      const nextState = { ...previous };
      delete nextState[leadId];
      return nextState;
    });
  }, []);

  const moveLeadStage = React.useCallback(
    async (lead: UiLead, direction: "prev" | "next") => {
      const index = PIPELINE_STAGE_ORDER.indexOf(lead.stage);
      const nextIndex = direction === "next" ? index + 1 : index - 1;
      if (nextIndex < 0 || nextIndex >= PIPELINE_STAGE_ORDER.length) return;

      const previousStage = lead.stage;
      const nextStage = PIPELINE_STAGE_ORDER[nextIndex];

      setStageOverrides((previous) => ({ ...previous, [lead.id]: nextStage }));

      try {
        await callWorkflowD({ lead_id: lead.id, status: nextStage, value: lead.valueNum });
        toast.success(`Moved to ${nextStage}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              setStageOverrides((previous) => ({ ...previous, [lead.id]: previousStage }));
              try {
                await callWorkflowD({ lead_id: lead.id, status: previousStage, value: lead.valueNum });
                toast.success("Stage reverted");
                await reload({ silent: true });
                clearStageOverride(lead.id);
              } catch (undoError: unknown) {
                toast.error(getErrorMessage(undoError, "Failed to undo move"));
              }
            },
          },
        });

        await reload({ silent: true });
        clearStageOverride(lead.id);
      } catch (moveError: unknown) {
        setStageOverrides((previous) => ({ ...previous, [lead.id]: previousStage }));
        toast.error(getErrorMessage(moveError, "Failed to move stage"));
      }
    },
    [clearStageOverride, reload]
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const leadId = event.active.data.current?.leadId as string | undefined;
    const fromStage = event.active.data.current?.fromStage as PipelineStage | undefined;
    if (!leadId || !fromStage) return;

    setActiveDragLeadId(leadId);
    dragOriginRef.current[leadId] = fromStage;
  }, []);

  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    const leadId = event.active?.data?.current?.leadId as string | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    if (!leadId || !overId || !isPipelineStage(overId)) return;

    setStageOverrides((previous) => {
      if (previous[leadId] === overId) return previous;
      return { ...previous, [leadId]: overId };
    });
  }, []);

  const handleDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      const leadId = event.active.data.current?.leadId as string | undefined;
      const overId = event.over?.id ? String(event.over.id) : "";
      setActiveDragLeadId(null);

      if (!leadId) return;

      const originalStage = dragOriginRef.current[leadId] ?? leadById.get(leadId)?.stage;
      const targetStage = overId && isPipelineStage(overId) ? normalizePipelineStage(overId) : originalStage;
      const lead = leadById.get(leadId);

      if (!lead || !originalStage || !targetStage) return;

      if (targetStage === originalStage) {
        clearStageOverride(leadId);
        delete dragOriginRef.current[leadId];
        return;
      }

      setStageOverrides((previous) => ({ ...previous, [lead.id]: targetStage }));

      try {
        await callWorkflowD({ lead_id: lead.id, status: targetStage, value: lead.valueNum });
        toast.success(`Moved ${lead.name} to ${targetStage}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              setStageOverrides((previous) => ({ ...previous, [lead.id]: originalStage }));
              try {
                await callWorkflowD({ lead_id: lead.id, status: originalStage, value: lead.valueNum });
                toast.success("Stage reverted");
                await reload({ silent: true });
                clearStageOverride(lead.id);
              } catch (undoError: unknown) {
                toast.error(getErrorMessage(undoError, "Failed to undo move"));
              }
            },
          },
        });

        await reload({ silent: true });
        clearStageOverride(lead.id);
      } catch (dragError: unknown) {
        setStageOverrides((previous) => ({ ...previous, [lead.id]: originalStage }));
        toast.error(getErrorMessage(dragError, "Failed to move stage"));
      } finally {
        delete dragOriginRef.current[leadId];
      }
    },
    [clearStageOverride, leadById, reload]
  );

  const handleDragCancel = React.useCallback(() => {
    if (!activeDragLeadId) return;
    clearStageOverride(activeDragLeadId);
    delete dragOriginRef.current[activeDragLeadId];
    setActiveDragLeadId(null);
  }, [activeDragLeadId, clearStageOverride]);

  return {
    loading,
    error,
    lastLoadedAt,
    refresh,
    reload,
    sensors,
    searchQuery,
    setSearchQuery,
    stageFilter,
    setStageFilter,
    resetFilters,
    hasFiltersActive,
    showAllLeads,
    setShowAllLeads,
    hasMoreLeads,
    hiddenLeadCount,
    filteredLeadCount: filteredUiLeads.length,
    visibleLeadCount: showAllLeads ? filteredUiLeads.length : Math.min(DEFAULT_VISIBLE_LEADS, filteredUiLeads.length),
    noLeads,
    noResults,
    columns,
    uiLeads,
    stageDistributionData,
    revenueData,
    pipelineFlowData,
    activeDragLead,
    activeLeadId: activeLead?.id ?? null,
    openEdit,
    openLeadById,
    moveLeadStage,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    dialogOpen,
    setDialogOpen: handleDialogOpenChange,
    saving,
    activeLead,
    activeLeadSource,
    activePipeline,
    activeEventSummary,
    editStage,
    setEditStage,
    editValue,
    setEditValue,
    parsedEditValue: parseCurrencyInput(editValue),
    saveEdit,
  };
}
