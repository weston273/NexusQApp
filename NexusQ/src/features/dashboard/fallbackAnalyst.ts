import { normalizeLeadStatus, normalizePipelineStage, type Lead, type LeadEvent, type PipelineRow } from "@/lib/leads";
import type { DailyKpiRecord } from "@/lib/types/domain";
import type {
  AttentionItem,
  DashboardAiAnswer,
  DashboardAiBriefing,
  IntelligencePlan,
  RecentActivityItem,
  TodaySnapshot,
} from "@/features/dashboard/types";

export type DashboardFallbackContext = {
  leads: Lead[];
  pipelineRows: PipelineRow[];
  events: LeadEvent[];
  kpis: DailyKpiRecord[];
  attentionItems: AttentionItem[];
  recentActivity: RecentActivityItem[];
  intelligence: IntelligencePlan;
  todaySnapshot: TodaySnapshot;
};

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ageHours(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.round((Date.now() - timestamp) / 3_600_000);
}

function getLeadName(lead: Lead) {
  return lead.name?.trim() || lead.phone?.trim() || lead.email?.trim() || "Unknown lead";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function bookedLeads(context: DashboardFallbackContext) {
  return context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "booked").slice(0, 4);
}

function quotedLeads(context: DashboardFallbackContext) {
  return context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "quoted").slice(0, 4);
}

function staleFollowUpLeads(context: DashboardFallbackContext) {
  return context.leads
    .filter((lead) => {
      const status = normalizeLeadStatus(lead.status);
      const hours = ageHours(lead.last_contacted_at ?? lead.created_at);
      return (status === "quoted" || status === "qualifying" || status === "new") && hours != null && hours >= 24;
    })
    .slice(0, 4);
}

export function isDashboardAiRateLimited(message: string | null | undefined) {
  const lower = String(message ?? "").toLowerCase();
  return (
    lower.includes("free-models-per-day") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("credits")
  );
}

export function buildDashboardFallbackBriefing(context: DashboardFallbackContext): DashboardAiBriefing {
  const totalLeads = context.leads.length;
  const newCount = context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "new").length;
  const qualifyingCount = context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "qualifying").length;
  const quotedCount = context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "quoted").length;
  const bookedCount = context.leads.filter((lead) => normalizeLeadStatus(lead.status) === "booked").length;
  const revenueLabel = formatUsd(context.todaySnapshot.revenue);
  const responseMinutes =
    typeof context.todaySnapshot.avgResponseMinutes === "number" && Number.isFinite(context.todaySnapshot.avgResponseMinutes)
      ? Math.round(context.todaySnapshot.avgResponseMinutes)
      : null;

  const headline = context.attentionItems[0]?.title ?? context.intelligence.headline;
  const opportunities = unique(
    [
      bookedCount > 0
        ? revenueLabel
          ? `${bookedCount} booked deal${bookedCount === 1 ? "" : "s"} are contributing toward ${revenueLabel} in tracked value.`
          : `${bookedCount} booked deal${bookedCount === 1 ? "" : "s"} are already moving through the workspace.`
        : "",
      quotedCount > 0 ? `${quotedCount} quoted opportunit${quotedCount === 1 ? "y is" : "ies are"} available to convert next.` : "",
      responseMinutes != null && responseMinutes <= 15 ? `Average response time is ${responseMinutes} minutes, which keeps lead momentum strong.` : "",
      context.intelligence.suggestion,
    ].filter(Boolean)
  ).slice(0, 3);

  const risks = unique(
    [
      ...context.attentionItems.map((item) => item.detail),
      responseMinutes != null && responseMinutes > 30
        ? `Average response time has stretched to ${responseMinutes} minutes and may start cooling inbound interest.`
        : "",
    ].filter(Boolean)
  ).slice(0, 3);

  const recommendedActions = unique(
    [
      ...context.attentionItems.map((item) => `${item.actionLabel}|${item.detail}|${item.actionPath}|${item.tone === "high" ? "high" : "medium"}`),
      `${context.intelligence.actionLabel}|${context.intelligence.suggestion}|${context.intelligence.actionPath}|${context.intelligence.priority}`,
    ]
  )
    .slice(0, 3)
    .map((value) => {
      const [title, detail, actionPath, priority] = value.split("|");
      return {
        title,
        detail,
        actionPath,
        priority: priority === "high" || priority === "medium" ? priority : "low",
      } satisfies DashboardAiBriefing["recommendedActions"][number];
    });

  return {
    headline,
    summary: `${totalLeads} total leads are active across ${newCount} new, ${qualifyingCount} qualifying, ${quotedCount} quoted, and ${bookedCount} booked.`,
    situation: `${context.todaySnapshot.sourceLabel} reports ${context.todaySnapshot.asOfLabel}. ${revenueLabel ? `Tracked value is ${revenueLabel}. ` : ""}${responseMinutes != null ? `Average response time is ${responseMinutes} minutes. ` : ""}NexusQ is using live dashboard signals while extended AI analysis is temporarily unavailable.`,
    opportunities: opportunities.length ? opportunities : ["NexusQ is monitoring the workspace and will keep surfacing the next best conversion opportunities."],
    risks: risks.length ? risks : ["No urgent blockers stand out from the current dashboard snapshot."],
    recommendedActions: recommendedActions.length
      ? recommendedActions
      : [
          {
            title: "Review pipeline",
            detail: "Scan live stages, follow-ups, and value gaps to keep opportunities moving.",
            actionPath: "/pipeline",
            priority: "medium",
          },
        ],
    suggestedQuestions: unique([
      "What changed today across leads and deals?",
      "Which leads need follow-up next?",
      "What deals were booked recently?",
      "Where is pipeline risk building?",
    ]).slice(0, 4),
  };
}

export function buildDashboardFallbackAnswer(
  context: DashboardFallbackContext,
  question: string
): DashboardAiAnswer {
  const lower = question.toLowerCase();
  const evidence: string[] = [];
  const referencedLeads: string[] = [];
  const revenueLabel = formatUsd(context.todaySnapshot.revenue);
  const quoted = quotedLeads(context);
  const booked = bookedLeads(context);
  const stalled = staleFollowUpLeads(context);

  if (lower.includes("book") || lower.includes("deal") || lower.includes("revenue")) {
    for (const lead of booked) {
      const name = getLeadName(lead);
      referencedLeads.push(name);
      evidence.push(`${name} is currently marked as booked${lead.service ? ` for ${lead.service}` : ""}.`);
    }

    return {
      answer:
        booked.length > 0
          ? `${booked.length} booked deal${booked.length === 1 ? "" : "s"} are visible from current dashboard records${revenueLabel ? `, with ${revenueLabel} in tracked value` : ""}.`
          : "No booked deals are visible in the current dashboard snapshot yet.",
      confidence: booked.length > 0 ? 82 : 68,
      evidence: evidence.slice(0, 4),
      followUps: ["Which quoted deals are closest to closing?", "Which booked deals still need next-step follow-up?"],
      referencedLeads: unique(referencedLeads).slice(0, 4),
    };
  }

  if (lower.includes("quote") || lower.includes("pipeline") || lower.includes("close")) {
    for (const lead of quoted) {
      const name = getLeadName(lead);
      referencedLeads.push(name);
      evidence.push(`${name} is in a quoted stage${lead.service ? ` for ${lead.service}` : ""}.`);
    }
    for (const item of context.attentionItems.slice(0, 2)) {
      evidence.push(item.detail);
    }

    return {
      answer:
        quoted.length > 0
          ? `${quoted.length} quoted opportunit${quoted.length === 1 ? "y is" : "ies are"} active in the current dashboard snapshot, and the attention queue should show which ones need follow-up first.`
          : "There are no active quoted opportunities showing in the current dashboard snapshot.",
      confidence: quoted.length > 0 ? 80 : 66,
      evidence: unique(evidence).slice(0, 4),
      followUps: ["Which quoted leads are going stale?", "Where are revenue values still missing?"],
      referencedLeads: unique(referencedLeads).slice(0, 4),
    };
  }

  if (lower.includes("conversation") || lower.includes("message") || lower.includes("text") || lower.includes("follow-up") || lower.includes("stalled")) {
    for (const lead of stalled) {
      const name = getLeadName(lead);
      referencedLeads.push(name);
      const hours = ageHours(lead.last_contacted_at ?? lead.created_at);
      evidence.push(
        `${name} is ${normalizeLeadStatus(lead.status)} and has been waiting about ${hours ?? "?"} hours since the latest tracked contact signal.`
      );
    }
    if (!stalled.length) {
      evidence.push("Current fallback analysis is based on lead status and last-contact timestamps, not full message transcripts.");
    }

    return {
      answer: stalled.length
        ? `${stalled.length} lead${stalled.length === 1 ? "" : "s"} show signs of needing follow-up based on their stage and last-contact timing.`
        : "No clearly stalled follow-up stands out from the current dashboard timestamps alone, although full conversation analysis is limited while live AI quota is exhausted.",
      confidence: stalled.length ? 72 : 58,
      evidence: unique(evidence).slice(0, 4),
      followUps: ["Which leads are still waiting in New stage?", "Which quoted deals should be called back today?"],
      referencedLeads: unique(referencedLeads).slice(0, 4),
    };
  }

  if (lower.includes("today") || lower.includes("changed") || lower.includes("recent")) {
    for (const item of context.recentActivity.slice(0, 4)) {
      evidence.push(`${item.user} had activity recorded as ${item.action} at ${item.time}.`);
    }

    return {
      answer: `Recent workspace activity shows ${context.recentActivity.length} notable updates in the latest dashboard snapshot, with ${context.todaySnapshot.leadsCaptured ?? context.leads.length} total captured leads currently in view.`,
      confidence: context.recentActivity.length ? 78 : 64,
      evidence: evidence.slice(0, 4),
      followUps: ["What deals were booked recently?", "Which leads need attention next?"],
      referencedLeads: [],
    };
  }

  if (lower.includes("system") || lower.includes("health") || lower.includes("workflow")) {
    for (const item of context.attentionItems.slice(0, 3)) {
      evidence.push(item.detail);
    }
    evidence.push(context.intelligence.suggestion);

    return {
      answer: `System focus is currently ${context.intelligence.headline.toLowerCase()}, with NexusQ highlighting the highest-priority operational actions from live dashboard signals.`,
      confidence: 76,
      evidence: unique(evidence).slice(0, 4),
      followUps: ["What should we prioritize first?", "Which part of the pipeline is at risk?"],
      referencedLeads: [],
    };
  }

  const pipelineValue =
    context.pipelineRows.reduce((sum, row) => {
      if (normalizePipelineStage(row.stage) === "quoted" || normalizePipelineStage(row.stage) === "booked") {
        return sum + (Number(row.value) || 0);
      }
      return sum;
    }, 0) || null;

  return {
    answer: `${context.leads.length} leads are active in the workspace right now${pipelineValue ? `, with ${formatUsd(pipelineValue)} tied to quoted and booked pipeline` : ""}. ${context.intelligence.suggestion}`,
    confidence: 74,
    evidence: unique([
      ...context.attentionItems.map((item) => item.detail),
      context.intelligence.headline,
      context.todaySnapshot.asOfLabel,
    ]).slice(0, 4),
    followUps: ["What changed today?", "Which leads need follow-up next?"],
    referencedLeads: [],
  };
}
