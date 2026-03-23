export type HealthServiceStatus = "optimal" | "stale" | "degraded" | "unknown";

export type HealthService = {
  name: string;
  status: HealthServiceStatus;
  last_run_at: string | null;
  minutes_since: number | null;
  error?: string | null;
};

export type HealthLogStatus = "success" | "warning" | "info";

export type HealthLog = {
  time: string | null;
  event: string;
  source: string;
  status: HealthLogStatus;
};

export type HealthPayload = {
  ok: boolean;
  allOperational: boolean;
  services: HealthService[];
  logs: HealthLog[];
  generated_at: string;
};

export type EndpointProbe = {
  label: string;
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
};

export type BrowserConnectionSnapshot = {
  online: boolean;
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
};

export type NetworkSnapshot = {
  endpoints: EndpointProbe[];
  activeEndpointUrl: string | null;
  browser: BrowserConnectionSnapshot;
  checkedAt: string | null;
};

export type SecurityCheck = {
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

export type SecuritySnapshot = {
  checks: SecurityCheck[];
  score: number;
  postureLabel: string;
  checkedAt: string;
};

export type FetchHealthStatusResult = {
  payload: HealthPayload;
  endpointProbes: EndpointProbe[];
  activeEndpointUrl: string | null;
};

export const WORKFLOW_KEYS = ["A", "B", "C", "D", "E"] as const;
export type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

export const NOMINAL_REFRESH_SEC = 45;
export const INCIDENT_REFRESH_SEC = 15;
export const HEALTHY_CYCLES_TO_RECOVER = 3;
export const FRESHNESS_STALE_BADGE_MINUTES = 20;

export const HEALTH_LOG_STORAGE_KEY = "nexusq-health-log-history-v1";
export const HEALTH_SERVICE_STORAGE_KEY = "nexusq-health-services-v1";
