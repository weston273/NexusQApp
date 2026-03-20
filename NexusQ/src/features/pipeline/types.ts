import type { Lead, LeadEvent, PipelineRow, PipelineStage } from "@/lib/leads";

export type UiLead = {
  id: string;
  name: string;
  company: string;
  valueNum: number;
  value: string;
  time: string;
  stage: PipelineStage;
  probability: number | null;
  createdAtMs: number;
};

export type PipelineStageFilter = PipelineStage | "all";

export type PipelineChartPoint = {
  stage: string;
  value: number;
};

export type PipelineRevenuePoint = {
  stage: string;
  revenue: number;
};

export type PipelineStageCountPoint = {
  stage: string;
  count: number;
};

export type PipelineActiveLead = {
  id: string;
  name: string;
  stage: PipelineStage;
  valueNum: number;
} | null;

export type PipelineEventSummary = {
  type: string;
  detail: string;
  time: string;
};

export type PipelineColumnView = {
  id: PipelineStage;
  title: string;
  color: string;
  leads: UiLead[];
  totalCount: number;
  visibleCountLabel: string;
};

export type PipelineViewSources = {
  leads: Lead[];
  events: LeadEvent[];
  pipelineRows: PipelineRow[];
};
