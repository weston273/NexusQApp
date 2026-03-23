import { AlertTriangle, Clock, DollarSign, MessageSquare, TrendingUp, Users } from "lucide-react";
import {
  formatDurationMinutes,
  getLeadDisplayName,
  getNestedString,
  isNonEmptyString,
  isSameDay,
  minutesBetween,
  normalizeLeadStatus,
  normalizePipelineStage,
  readStringCandidate,
  startOfDay,
  type Lead,
  type LeadEvent,
  type PipelineRow,
} from "@/lib/leads";
import type {
  ActivityDatum,
  DashboardStat,
  FunnelDatum,
  IntelligencePlan,
  LeadTrendDatum,
  PipelineSummaryDatum,
  RecentActivityItem,
  ResponseDatum,
  TodaySnapshot,
  AttentionItem,
} from "@/features/dashboard/types";

export function buildSystemIntelligence(args: {
  leads: Lead[];
  pipelineRows: PipelineRow[];
  events: LeadEvent[];
  conversion: number;
  avgResponseToday: number | null;
  newPipelineCount: number;
}): IntelligencePlan {
  const { leads, pipelineRows, events, conversion, avgResponseToday, newPipelineCount } = args;
  const now = Date.now();
  const inHours = (iso?: string | null) => {
    if (!iso) return null;
    const timestamp = new Date(iso).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return (now - timestamp) / 3_600_000;
  };

  const quotedAging = leads.filter((lead) => normalizeLeadStatus(lead.status) === "quoted" && (inHours(lead.created_at) ?? 0) > 72).length;
  const bookedLast7d = leads.filter((lead) => normalizeLeadStatus(lead.status) === "booked" && (inHours(lead.created_at) ?? 0) <= 24 * 7).length;
  const leads24h = leads.filter((lead) => (inHours(lead.created_at) ?? 0) <= 24).length;
  const leadsPrev24h = leads.filter((lead) => {
    const hours = inHours(lead.created_at) ?? 0;
    return hours > 24 && hours <= 48;
  }).length;
  const eventsLast6h = events.filter((event) => (inHours(event.created_at) ?? 0) <= 6).length;

  if (newPipelineCount >= 10) {
    return {
      headline: "High inbound volume detected",
      suggestion: "Run a structured triage pass now to prevent qualification delays and dropped intent.",
      actionLabel: "Triage Pipeline",
      actionPath: "/pipeline",
      priority: "high",
      confidence: 88,
      signals: [
        `${newPipelineCount} leads waiting in New stage`,
        `${leads24h} leads arrived in last 24h`,
        `${eventsLast6h} recent system events`,
      ],
    };
  }

  if (quotedAging >= 3) {
    return {
      headline: "Quote follow-ups are at risk",
      suggestion: "Prioritize stale quoted leads first and schedule same-day callbacks for top-value opportunities.",
      actionLabel: "Review Quoted Leads",
      actionPath: "/pipeline",
      priority: "high",
      confidence: 84,
      signals: [
        `${quotedAging} quoted leads older than 72 hours`,
        `${bookedLast7d} bookings closed in last 7 days`,
        "Follow-up momentum is the best conversion lever",
      ],
    };
  }

  if ((avgResponseToday ?? 0) > 45 || conversion < 18) {
    return {
      headline: "Conversion performance can be optimized",
      suggestion: "Tighten first-response SLAs and automate early-stage follow-ups for high-intent services.",
      actionLabel: "Tune Operations",
      actionPath: "/health",
      priority: "medium",
      confidence: 76,
      signals: [
        `Avg response: ${formatDurationMinutes(avgResponseToday)}`,
        `Conversion: ${conversion}%`,
        `Lead delta 24h: ${leads24h - leadsPrev24h >= 0 ? "+" : ""}${leads24h - leadsPrev24h}`,
      ],
    };
  }

  const stageRows = pipelineRows.length || leads.length;
  return {
    headline: "Pipeline is operating within baseline",
    suggestion: "Maintain cadence: keep lead intake quality high and review the board twice daily.",
    actionLabel: "Open Dashboard",
    actionPath: "/",
    priority: "low",
    confidence: 68,
    signals: [
      `${bookedLast7d} recent bookings`,
      `${stageRows} active pipeline records`,
      `${eventsLast6h} live activity events in last 6h`,
    ],
  };
}

export function buildPipelineValue(pipelineRows: PipelineRow[]) {
  return pipelineRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
}

export function buildPipelineSummary(leads: Lead[], pipelineRows: PipelineRow[]) {
  const counts = { new: 0, qualifying: 0, quoted: 0, booked: 0 };

  for (const row of pipelineRows) {
    counts[normalizePipelineStage(row.stage)] += 1;
  }

  const followUp = leads.filter((lead) => lead.last_contacted_at && normalizeLeadStatus(lead.status) !== "booked").length;

  return [
    { name: `New Lead: ${counts.new}`, value: counts.new },
    { name: `Inspections: ${counts.qualifying}`, value: counts.qualifying },
    { name: `Quotes Sent: ${counts.quoted}`, value: counts.quoted },
    { name: `Follow-Up: ${followUp}`, value: followUp },
    { name: `Won Deals: ${counts.booked}`, value: counts.booked },
  ] satisfies PipelineSummaryDatum[];
}

export function buildLeadTrend(leads: Lead[]) {
  const now = new Date();
  const days: Array<{ date: Date; label: string }> = [];

  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    days.push({
      date: startOfDay(day),
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
    });
  }

  const counts = new Map<string, number>();
  for (const day of days) {
    counts.set(day.date.toISOString(), 0);
  }

  for (const lead of leads) {
    const createdDay = startOfDay(new Date(lead.created_at)).toISOString();
    if (counts.has(createdDay)) {
      counts.set(createdDay, (counts.get(createdDay) ?? 0) + 1);
    }
  }

  return days.map((day) => ({ day: day.label, leads: counts.get(day.date.toISOString()) ?? 0 })) satisfies LeadTrendDatum[];
}

export function buildFunnelData(leads: Lead[]) {
  const total = leads.length;
  const qualifying = leads.filter((lead) => normalizeLeadStatus(lead.status) === "qualifying").length;
  const quoted = leads.filter((lead) => normalizeLeadStatus(lead.status) === "quoted").length;
  const booked = leads.filter((lead) => normalizeLeadStatus(lead.status) === "booked").length;

  return [
    { stage: "Leads", value: total },
    { stage: "Qualifying", value: qualifying },
    { stage: "Quoted", value: quoted },
    { stage: "Booked", value: booked },
  ] satisfies FunnelDatum[];
}

export function buildResponseData(leads: Lead[]) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const todayMinutes: number[] = [];
  const yesterdayMinutes: number[] = [];

  for (const lead of leads) {
    const minutes = minutesBetween(lead.created_at, lead.last_contacted_at);
    if (minutes == null) continue;

    const created = new Date(lead.created_at);
    if (isSameDay(created, today)) todayMinutes.push(minutes);
    if (isSameDay(created, yesterday)) yesterdayMinutes.push(minutes);
  }

  const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

  return [
    { period: "Yesterday", time: Number(average(yesterdayMinutes).toFixed(1)) },
    { period: "Today", time: Number(average(todayMinutes).toFixed(1)) },
  ] satisfies ResponseDatum[];
}

export function buildActivityData(events: LeadEvent[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    const key = event.event_type ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  if (!sorted.length) {
    return [
      { name: "lead created", value: 0 },
      { name: "status changed", value: 0 },
      { name: "call logged", value: 0 },
    ] satisfies ActivityDatum[];
  }

  return sorted.map(([name, value]) => ({
    name: (name ?? "unknown").replace(/_/g, " "),
    value,
  })) satisfies ActivityDatum[];
}

function buildLeadNameById(leads: Lead[]) {
  const map = new Map<string, string>();
  for (const lead of leads) {
    map.set(lead.id, getLeadDisplayName(lead, "Unknown"));
  }
  return map;
}

export function buildRecentActivity(events: LeadEvent[], leads: Lead[]) {
  const actionMap: Record<string, string> = {
    lead_created: "Requested Service",
    status_changed: "Status Updated",
    call_logged: "Call Logged",
    note_added: "Note Added",
    first_response_sent: "Instant Response Sent",
  };
  const leadNameById = buildLeadNameById(leads);

  const getNameFromEvent = (event: LeadEvent) => {
    const candidates = [
      getNestedString(event.payload_json, "name"),
      getNestedString(event.payload_json, "full_name"),
      getNestedString(event.payload_json, "lead_snapshot", "name"),
      getNestedString(event.payload_json, "lead_snapshot", "full_name"),
      getNestedString(event.payload_json, "lead", "name"),
      getNestedString(event.payload_json, "lead", "full_name"),
      getNestedString(event.payload_json, "raw", "name"),
    ];

    for (const candidate of candidates) {
      if (isNonEmptyString(candidate)) return candidate.trim();
    }

    const leadId = readStringCandidate(
      event.lead_id,
      getNestedString(event.payload_json, "lead_id"),
      getNestedString(event.payload_json, "lead", "id"),
      getNestedString(event.payload_json, "lead_snapshot", "id")
    );

    if (leadId && leadNameById.has(leadId)) {
      const value = leadNameById.get(leadId);
      if (isNonEmptyString(value)) return value;
    }

    const phone = readStringCandidate(
      getNestedString(event.payload_json, "phone"),
      getNestedString(event.payload_json, "raw", "phone"),
      getNestedString(event.payload_json, "raw", "phone_raw")
    );

    if (isNonEmptyString(phone)) return phone.trim();

    return "Unknown";
  };

  return events.slice(0, 4).map((event) => ({
    id: event.id,
    user: getNameFromEvent(event),
    action: actionMap[event.event_type] ?? (event.event_type ?? "unknown").replace(/_/g, " "),
    time: new Date(event.created_at).toLocaleString(),
    status: readStringCandidate(getNestedString(event.payload_json, "status"), "New") ?? "New",
  })) satisfies RecentActivityItem[];
}

export function buildAverageResponseToday(leads: Lead[]) {
  const today = new Date();
  const minutes: number[] = [];

  for (const lead of leads) {
    const created = new Date(lead.created_at);
    if (!isSameDay(created, today)) continue;
    const responseMinutes = minutesBetween(lead.created_at, lead.last_contacted_at);
    if (responseMinutes != null) {
      minutes.push(responseMinutes);
    }
  }

  if (!minutes.length) return null;
  return minutes.reduce((sum, value) => sum + value, 0) / minutes.length;
}

export function buildStats(args: {
  leadsCaptured: number;
  avgResponseToday: number | null;
  conversion: number;
  quotedCount: number;
}) {
  const { leadsCaptured, avgResponseToday, conversion, quotedCount } = args;

  return [
    { label: "Leads Captured", value: String(leadsCaptured), change: "", icon: Users },
    { label: "Avg. Response", value: formatDurationMinutes(avgResponseToday), change: "", icon: Clock },
    { label: "Conversion", value: `${conversion}%`, change: "", icon: TrendingUp },
    { label: "Open Intents", value: String(Math.max(0, quotedCount)), change: "", icon: MessageSquare },
  ] satisfies DashboardStat[];
}

export function buildAttentionItems(args: {
  leads: Lead[];
  pipelineRows: PipelineRow[];
  avgResponseToday: number | null;
}) {
  const { leads, pipelineRows, avgResponseToday } = args;
  const now = Date.now();
  const inHours = (iso?: string | null) => {
    if (!iso) return null;
    const timestamp = new Date(iso).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return (now - timestamp) / 3_600_000;
  };

  const staleQuoted = leads.filter(
    (lead) => normalizeLeadStatus(lead.status) === "quoted" && (inHours(lead.created_at) ?? 0) > 72
  ).length;
  const missingValue = pipelineRows.filter((row) => {
    const stage = normalizePipelineStage(row.stage);
    const value = Number(row.value ?? 0);
    return (stage === "quoted" || stage === "booked") && (!Number.isFinite(value) || value <= 0);
  }).length;
  const newBacklog = leads.filter(
    (lead) => normalizeLeadStatus(lead.status) === "new" && (inHours(lead.created_at) ?? 0) > 4
  ).length;
  const slowResponse = (avgResponseToday ?? 0) > 30;

  const items: AttentionItem[] = [];

  if (staleQuoted > 0) {
    items.push({
      title: "Quoted leads need follow-up",
      detail: "Quoted opportunities are aging out and need a callback or close decision.",
      countLabel: `${staleQuoted} stale quote${staleQuoted === 1 ? "" : "s"}`,
      tone: "high",
      actionLabel: "Review quoted leads",
      actionPath: "/pipeline",
      icon: AlertTriangle,
    });
  }

  if (missingValue > 0) {
    items.push({
      title: "Revenue values still missing",
      detail: "Quoted and booked records should carry a USD value so forecasts stay trustworthy.",
      countLabel: `${missingValue} value gap${missingValue === 1 ? "" : "s"}`,
      tone: "high",
      actionLabel: "Open pipeline",
      actionPath: "/pipeline",
      icon: DollarSign,
    });
  }

  if (newBacklog > 0) {
    items.push({
      title: "New leads are stacking up",
      detail: "Fresh leads are waiting in the opening stage and may need qualification or scheduling.",
      countLabel: `${newBacklog} waiting`,
      tone: "medium",
      actionLabel: "Triage new leads",
      actionPath: "/pipeline",
      icon: Users,
    });
  }

  if (slowResponse) {
    items.push({
      title: "Response time is slipping",
      detail: "Same-day follow-up speed is one of the fastest conversion levers in the workspace.",
      countLabel: formatDurationMinutes(avgResponseToday),
      tone: "medium",
      actionLabel: "Check automation health",
      actionPath: "/health",
      icon: Clock,
    });
  }

  if (!items.length) {
    items.push({
      title: "No urgent blockers detected",
      detail: "The board looks healthy right now. Keep reviewing quotes, intake quality, and automation freshness.",
      countLabel: "Operating baseline",
      tone: "low",
      actionLabel: "Open dashboard",
      actionPath: "/",
      icon: TrendingUp,
    });
  }

  return items.slice(0, 3) satisfies AttentionItem[];
}

export function buildTodaySnapshot(args: {
  latestKpi: {
    day: string;
    leadsCaptured: number | null;
    bookedCount: number | null;
    quotedCount: number | null;
    revenue: number | null;
    avgResponseMinutes: number | null;
  } | null;
  leadsCaptured: number;
  bookedCount: number;
  quotedCount: number;
  pipelineValue: number;
  avgResponseToday: number | null;
  lastLoadedAt: Date | null;
}) {
  const { latestKpi, leadsCaptured, bookedCount, quotedCount, pipelineValue, avgResponseToday, lastLoadedAt } = args;

  return {
    leadsCaptured: latestKpi?.leadsCaptured ?? leadsCaptured,
    bookedCount: latestKpi?.bookedCount ?? bookedCount,
    quotedCount: latestKpi?.quotedCount ?? quotedCount,
    revenue: latestKpi?.revenue ?? pipelineValue,
    avgResponseMinutes: latestKpi?.avgResponseMinutes ?? avgResponseToday,
    sourceLabel: latestKpi ? "Daily KPI snapshot" : "Live derived metrics",
    asOfLabel: latestKpi
      ? `As of ${new Date(latestKpi.day).toLocaleDateString()}`
      : `Live at ${lastLoadedAt ? lastLoadedAt.toLocaleTimeString() : "latest sync"}`,
  } satisfies TodaySnapshot;
}
