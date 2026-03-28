import type { LucideIcon } from "lucide-react";

export type IntelligencePlan = {
  headline: string;
  suggestion: string;
  actionLabel: string;
  actionPath: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  signals: string[];
};

export type PipelineSummaryDatum = {
  name: string;
  value: number;
};

export type LeadTrendDatum = {
  day: string;
  leads: number;
};

export type FunnelDatum = {
  stage: string;
  value: number;
};

export type ResponseDatum = {
  period: string;
  time: number;
};

export type ActivityDatum = {
  name: string;
  value: number;
};

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

export type AttentionItem = {
  title: string;
  detail: string;
  countLabel: string;
  tone: "high" | "medium" | "low";
  actionLabel: string;
  actionPath: string;
  icon: LucideIcon;
};

export type RecentActivityItem = {
  id: string;
  user: string;
  action: string;
  time: string;
  status: string;
};

export type TodaySnapshot = {
  leadsCaptured: number | null;
  bookedCount: number | null;
  quotedCount: number | null;
  revenue: number | null;
  avgResponseMinutes: number | null;
  sourceLabel: string;
  asOfLabel: string;
};

export type DashboardAiRecommendedAction = {
  title: string;
  detail: string;
  actionPath: string;
  priority: "high" | "medium" | "low";
};

export type DashboardAiBriefing = {
  headline: string;
  summary: string;
  situation: string;
  opportunities: string[];
  risks: string[];
  recommendedActions: DashboardAiRecommendedAction[];
  suggestedQuestions: string[];
};

export type DashboardAiAnswer = {
  answer: string;
  confidence: number;
  evidence: string[];
  followUps: string[];
  referencedLeads: string[];
};

export type DashboardAiThreadItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  answer?: DashboardAiAnswer | null;
};
