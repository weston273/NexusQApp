import {
  formatCompactCurrency,
  formatDateTime,
  getLeadDisplayName,
  getNestedString,
  normalizePipelineStage,
  PIPELINE_STAGES,
  readStringCandidate,
  type Lead,
  type LeadEvent,
  type PipelineRow,
  type PipelineStage,
} from "@/lib/leads";
import type {
  PipelineChartPoint,
  PipelineColumnView,
  PipelineEventSummary,
  PipelineRevenuePoint,
  PipelineStageCountPoint,
  UiLead,
} from "@/features/pipeline/types";

export const DEFAULT_VISIBLE_LEADS = 10;

export function buildPipelineByLeadId(pipelineRows: PipelineRow[]) {
  const map = new Map<string, PipelineRow>();

  for (const row of pipelineRows) {
    if (!row.lead_id) continue;
    const previous = map.get(row.lead_id);
    if (!previous) {
      map.set(row.lead_id, row);
      continue;
    }

    const previousTime = new Date(previous.updated_at ?? 0).getTime();
    const nextTime = new Date(row.updated_at ?? 0).getTime();
    if (nextTime >= previousTime) {
      map.set(row.lead_id, row);
    }
  }

  return map;
}

export function buildLeadSourceById(leads: Lead[]) {
  return new Map(leads.map((lead) => [lead.id, lead]));
}

export function buildLatestEventByLeadId(events: LeadEvent[]) {
  const map = new Map<string, LeadEvent>();

  for (const event of events) {
    if (!event.lead_id || map.has(event.lead_id)) continue;
    map.set(event.lead_id, event);
  }

  return map;
}

export function buildUiLeads(args: {
  leads: Lead[];
  pipelineByLeadId: Map<string, PipelineRow>;
  stageOverrides: Record<string, PipelineStage>;
}) {
  const { leads, pipelineByLeadId, stageOverrides } = args;

  return leads.map<UiLead>((lead) => {
    const pipeline = pipelineByLeadId.get(lead.id);
    const stage = stageOverrides[lead.id] ?? normalizePipelineStage(pipeline?.stage ?? lead.status);
    const value = Number(pipeline?.value ?? 0);

    return {
      id: lead.id,
      name: getLeadDisplayName(lead, "Unknown"),
      company: lead.service ? String(lead.service).toUpperCase() : "SERVICE",
      valueNum: Number.isFinite(value) ? value : 0,
      value: `$${formatCompactCurrency(Number.isFinite(value) ? value : 0)}`,
      time: new Date(lead.created_at).toLocaleDateString(),
      stage,
      probability: pipeline?.probability ?? null,
      createdAtMs: new Date(lead.created_at ?? 0).getTime() || 0,
    };
  });
}

export function filterUiLeads(args: {
  uiLeads: UiLead[];
  searchQuery: string;
  stageFilter: PipelineStage | "all";
  leadSourceById: Map<string, Lead>;
}) {
  const { uiLeads, searchQuery, stageFilter, leadSourceById } = args;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  return uiLeads.filter((lead) => {
    if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
    if (!normalizedSearchQuery) return true;

    const sourceLead = leadSourceById.get(lead.id);
    const haystack = [
      lead.name,
      lead.company,
      sourceLead?.phone,
      sourceLead?.email,
      sourceLead?.service,
      sourceLead?.address,
      sourceLead?.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearchQuery);
  });
}

export function buildStageCounts(uiLeads: UiLead[]) {
  return {
    new: uiLeads.filter((lead) => lead.stage === "new").length,
    qualifying: uiLeads.filter((lead) => lead.stage === "qualifying").length,
    quoted: uiLeads.filter((lead) => lead.stage === "quoted").length,
    booked: uiLeads.filter((lead) => lead.stage === "booked").length,
  } satisfies Record<PipelineStage, number>;
}

export function buildStageDistributionData(stageCounts: Record<PipelineStage, number>) {
  return [
    { stage: "New", count: stageCounts.new },
    { stage: "Qualifying", count: stageCounts.qualifying },
    { stage: "Quoted", count: stageCounts.quoted },
    { stage: "Booked", count: stageCounts.booked },
  ] satisfies PipelineStageCountPoint[];
}

export function buildRevenueData(pipelineRows: PipelineRow[]) {
  const sums: Record<PipelineStage, number> = { new: 0, qualifying: 0, quoted: 0, booked: 0 };

  for (const row of pipelineRows) {
    const stage = normalizePipelineStage(row.stage);
    const value = Number(row.value ?? 0);
    sums[stage] += Number.isFinite(value) ? value : 0;
  }

  return [
    { stage: "New", revenue: Math.round(sums.new) },
    { stage: "Qualifying", revenue: Math.round(sums.qualifying) },
    { stage: "Quoted", revenue: Math.round(sums.quoted) },
    { stage: "Booked", revenue: Math.round(sums.booked) },
  ] satisfies PipelineRevenuePoint[];
}

export function buildPipelineFlowData(stageCounts: Record<PipelineStage, number>) {
  return [
    { stage: "New Leads", value: stageCounts.new },
    { stage: "Qualifying", value: stageCounts.qualifying },
    { stage: "Quoted", value: stageCounts.quoted },
    { stage: "Booked", value: stageCounts.booked },
  ] satisfies PipelineChartPoint[];
}

export function buildColumns(args: {
  visibleUiLeads: UiLead[];
  filteredUiLeads: UiLead[];
  showAllLeads: boolean;
}) {
  const { visibleUiLeads, filteredUiLeads, showAllLeads } = args;

  return PIPELINE_STAGES.map<PipelineColumnView>((stage) => {
    const leads = visibleUiLeads.filter((lead) => lead.stage === stage.id);
    const totalCount = filteredUiLeads.filter((lead) => lead.stage === stage.id).length;

    return {
      ...stage,
      leads,
      totalCount,
      visibleCountLabel: showAllLeads ? String(leads.length) : `${leads.length}/${totalCount}`,
    };
  });
}

export function buildActiveEventSummary(event: LeadEvent | null): PipelineEventSummary {
  if (!event) {
    return {
      type: "-",
      detail: "No recent activity available.",
      time: "-",
    };
  }

  const detailCandidate =
    readStringCandidate(
      getNestedString(event.payload_json, "message"),
      getNestedString(event.payload_json, "summary"),
      getNestedString(event.payload_json, "body"),
      getNestedString(event.payload_json, "note"),
      getNestedString(event.payload_json, "status"),
      getNestedString(event.payload_json, "stage")
    ) ?? "";

  return {
    type: String(event.event_type ?? "event").replace(/_/g, " "),
    detail: detailCandidate || "Event received with no additional text payload.",
    time: formatDateTime(event.created_at),
  };
}
