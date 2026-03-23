import * as React from "react";
import { useDailyKpis } from "@/hooks/useDailyKpis";
import { useLeads } from "@/hooks/useLeads";
import { normalizeLeadStatus, normalizePipelineStage } from "@/lib/leads";
import {
  buildActivityData,
  buildAttentionItems,
  buildAverageResponseToday,
  buildFunnelData,
  buildLeadTrend,
  buildPipelineSummary,
  buildPipelineValue,
  buildRecentActivity,
  buildResponseData,
  buildStats,
  buildSystemIntelligence,
  buildTodaySnapshot,
} from "@/features/dashboard/utils";

export function useDashboardViewModel() {
  const { leads, events, pipelineRows, loading, error, lastLoadedAt, reload } = useLeads();
  const { kpis } = useDailyKpis(7);

  const pipelineValue = React.useMemo(() => buildPipelineValue(pipelineRows), [pipelineRows]);
  const pipelineSummary = React.useMemo(() => buildPipelineSummary(leads, pipelineRows), [leads, pipelineRows]);
  const leadTrend = React.useMemo(() => buildLeadTrend(leads), [leads]);
  const funnelData = React.useMemo(() => buildFunnelData(leads), [leads]);
  const responseData = React.useMemo(() => buildResponseData(leads), [leads]);
  const activityData = React.useMemo(() => buildActivityData(events), [events]);
  const recentActivity = React.useMemo(() => buildRecentActivity(events, leads), [events, leads]);

  const leadsCaptured = leads.length;
  const bookedCount = React.useMemo(
    () => leads.filter((lead) => normalizeLeadStatus(lead.status) === "booked").length,
    [leads]
  );
  const quotedCount = React.useMemo(
    () => leads.filter((lead) => normalizeLeadStatus(lead.status) === "quoted").length,
    [leads]
  );
  const avgResponseToday = React.useMemo(() => buildAverageResponseToday(leads), [leads]);
  const conversion = leadsCaptured ? Math.round((bookedCount / leadsCaptured) * 100) : 0;
  const latestKpi = kpis[0] ?? null;
  const todaySnapshot = React.useMemo(
    () =>
      buildTodaySnapshot({
        latestKpi,
        leadsCaptured,
        bookedCount,
        quotedCount,
        pipelineValue,
        avgResponseToday,
        lastLoadedAt,
      }),
    [avgResponseToday, bookedCount, lastLoadedAt, latestKpi, leadsCaptured, pipelineValue, quotedCount]
  );
  const stats = React.useMemo(
    () =>
      buildStats({
        leadsCaptured,
        avgResponseToday,
        conversion,
        quotedCount,
    }),
    [avgResponseToday, conversion, leadsCaptured, quotedCount]
  );
  const attentionItems = React.useMemo(
    () =>
      buildAttentionItems({
        leads,
        pipelineRows,
        avgResponseToday,
      }),
    [avgResponseToday, leads, pipelineRows]
  );
  const newPipelineCount = React.useMemo(() => {
    if (!pipelineRows.length) {
      return leads.filter((lead) => normalizeLeadStatus(lead.status) === "new").length;
    }
    return pipelineRows.filter((row) => normalizePipelineStage(row.stage) === "new").length;
  }, [leads, pipelineRows]);
  const intelligence = React.useMemo(
    () =>
      buildSystemIntelligence({
        leads,
        pipelineRows,
        events,
        conversion,
        avgResponseToday,
        newPipelineCount,
      }),
    [avgResponseToday, conversion, events, leads, newPipelineCount, pipelineRows]
  );

  const refresh = React.useCallback(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    error,
    lastLoadedAt,
    refresh,
    leads,
    pipelineValue,
    pipelineSummary,
    leadTrend,
    funnelData,
    responseData,
    activityData,
    stats,
    attentionItems,
    recentActivity,
    intelligence,
    todaySnapshot,
  };
}
