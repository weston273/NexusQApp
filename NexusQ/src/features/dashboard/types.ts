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
