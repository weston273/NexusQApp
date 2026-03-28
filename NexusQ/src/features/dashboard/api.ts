import { invokeAuthedFunction } from "@/lib/edgeFunctions";
import type { DashboardAiAnswer, DashboardAiBriefing, DashboardAiThreadItem } from "@/features/dashboard/types";

type DashboardAiResponse = {
  ok?: boolean;
  briefing?: {
    headline?: string;
    summary?: string;
    situation?: string;
    opportunities?: unknown[];
    risks?: unknown[];
    recommended_actions?: Array<{
      title?: string;
      detail?: string;
      action_path?: string;
      priority?: "high" | "medium" | "low";
    }>;
    suggested_questions?: unknown[];
  } | null;
  answer?: {
    answer?: string;
    confidence?: number;
    evidence?: unknown[];
    follow_ups?: unknown[];
    referenced_leads?: unknown[];
  } | null;
};

function pickStringArray(values: unknown[] | undefined) {
  return (Array.isArray(values) ? values : [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

export async function fetchDashboardAiBriefing(clientId: string): Promise<DashboardAiBriefing> {
  const payload = await invokeAuthedFunction<DashboardAiResponse | null>("dashboard-ai-briefing", {
    action: "briefing",
    client_id: clientId,
  });
  const briefing = payload?.briefing;
  if (!briefing?.headline || !briefing.summary || !briefing.situation) {
    throw new Error("Dashboard AI briefing returned an invalid response.");
  }

  return {
    headline: briefing.headline,
    summary: briefing.summary,
    situation: briefing.situation,
    opportunities: pickStringArray(briefing.opportunities),
    risks: pickStringArray(briefing.risks),
    recommendedActions: (Array.isArray(briefing.recommended_actions) ? briefing.recommended_actions : [])
      .map((item) => {
        if (!item?.title || !item.detail || !item.action_path) return null;
        return {
          title: item.title,
          detail: item.detail,
          actionPath: item.action_path,
          priority: item.priority === "high" || item.priority === "medium" ? item.priority : "low",
        };
      })
      .filter((item): item is DashboardAiBriefing["recommendedActions"][number] => Boolean(item)),
    suggestedQuestions: pickStringArray(briefing.suggested_questions),
  };
}

export async function askDashboardAiQuestion(args: {
  clientId: string;
  question: string;
  history: DashboardAiThreadItem[];
}) {
  const payload = await invokeAuthedFunction<DashboardAiResponse | null>("dashboard-ai-briefing", {
    action: "answer",
    client_id: args.clientId,
    question: args.question,
    history: args.history.slice(-6).map((item) => ({
      role: item.role,
      content: item.content,
    })),
  });
  const answer = payload?.answer;
  if (!answer?.answer || typeof answer.confidence !== "number") {
    throw new Error("Dashboard AI answer returned an invalid response.");
  }

  return {
    answer: answer.answer,
    confidence: Math.max(0, Math.min(100, Math.round(answer.confidence))),
    evidence: pickStringArray(answer.evidence),
    followUps: pickStringArray(answer.follow_ups),
    referencedLeads: pickStringArray(answer.referenced_leads),
  } satisfies DashboardAiAnswer;
}
