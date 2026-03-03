import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Cpu,
  Globe,
  Database,
  Activity,
  Server,
  Wifi,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  RefreshCcw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAppSettings, SETTINGS_CHANGED_EVENT, type AppSettings } from "@/lib/userSettings";
import { withRetry } from "@/lib/network";
import { PageHeader } from "@/components/ui/page-header";

type HealthService = {
  name: string;
  status: "optimal" | "stale" | "degraded" | "unknown";
  last_run_at: string | null;
  minutes_since: number | null;
  error?: string | null;
};

type HealthLog = {
  time: string | null;
  event: string;
  source: string;
  status: "success" | "warning" | "info";
};

type HealthPayload = {
  ok: boolean;
  allOperational: boolean;
  services: HealthService[];
  logs: HealthLog[];
  generated_at: string;
};

type EndpointProbe = {
  label: string;
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
};

type BrowserConnectionSnapshot = {
  online: boolean;
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
};

type NetworkSnapshot = {
  endpoints: EndpointProbe[];
  activeEndpointUrl: string | null;
  browser: BrowserConnectionSnapshot;
  checkedAt: string | null;
};

type SecurityCheck = {
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

type SecuritySnapshot = {
  checks: SecurityCheck[];
  score: number;
  postureLabel: string;
  checkedAt: string;
};

type FetchHealthStatusResult = {
  payload: HealthPayload;
  endpointProbes: EndpointProbe[];
  activeEndpointUrl: string | null;
};

type FreshnessPoint = {
  at: string;
  value: number;
  minutesSince: number | null;
};

type FreshnessTimeline = Record<WorkflowKey, FreshnessPoint[]>;

const HEALTH_URLS = [
  "https://n8n-k7j4.onrender.com/webhook/health-status",
  "https://n8n-k7j4.onrender.com/webhook-test/health-status",
];

const NOMINAL_REFRESH_SEC = 45;
const INCIDENT_REFRESH_SEC = 15;
const HEALTHY_CYCLES_TO_RECOVER = 3;
const FRESHNESS_STALE_BADGE_MINUTES = 20;
const FRESHNESS_TREND_WINDOW_MINUTES = 60;
const FRESHNESS_TREND_MAX_POINTS = 240;
const SPARKLINE_WIDTH = 180;
const SPARKLINE_HEIGHT = 28;
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "");

const HEALTH_LOG_STORAGE_KEY = "nexusq-health-log-history-v1";
const HEALTH_SERVICE_STORAGE_KEY = "nexusq-health-services-v1";
const HEALTH_FRESHNESS_STORAGE_KEY = "nexusq-health-freshness-v1";
const WORKFLOW_KEYS = ["A", "B", "C", "D"] as const;
type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

function normalizeWorkflowName(key: WorkflowKey) {
  return `Workflow ${key}`;
}

function inferWorkflowKey(serviceName: string): WorkflowKey | null {
  const n = (serviceName || "").toLowerCase().trim();

  if (n.startsWith("a") || n.includes("workflow a") || n.includes("intake") || n.includes("normal")) return "A";
  if (n.startsWith("b") || n.includes("workflow b") || n.includes("speed") || n.includes("response")) return "B";
  if (n.startsWith("c") || n.includes("workflow c") || n.includes("follow")) return "C";
  if (n.startsWith("d") || n.includes("workflow d") || n.includes("pipeline") || n.includes("booking")) return "D";

  return null;
}

function createFallbackService(key: WorkflowKey): HealthService {
  return {
    name: normalizeWorkflowName(key),
    status: "unknown",
    last_run_at: null,
    minutes_since: null,
    error: "No health signal received yet.",
  };
}

function statusBadgeVariant(s: HealthService["status"]) {
  if (s === "optimal") return "outline";
  if (s === "stale") return "secondary";
  if (s === "degraded") return "destructive";
  return "secondary";
}

function statusLabel(s: HealthService["status"]) {
  if (s === "optimal") return "optimal";
  if (s === "stale") return "stale";
  if (s === "degraded") return "degraded";
  return "unknown";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function freshnessPercent(minutesSince: number | null) {
  if (minutesSince == null) return 0;
  return clamp(100 - (minutesSince / 90) * 100, 0, 100);
}

function normalizeServiceSnapshot(service: HealthService): HealthService {
  if (service.last_run_at || service.minutes_since == null) return service;
  return {
    ...service,
    // Use reported minutes_since as a synthetic timestamp so freshness can decay over time.
    last_run_at: new Date(Date.now() - service.minutes_since * 60_000).toISOString(),
  };
}

function effectiveMinutesSince(service: HealthService) {
  if (service.last_run_at) {
    const ts = new Date(service.last_run_at).getTime();
    if (Number.isFinite(ts) && ts > 0) {
      return Math.max(0, Math.floor((Date.now() - ts) / 60_000));
    }
  }
  return service.minutes_since;
}

function createEmptyFreshnessTimeline(): FreshnessTimeline {
  return { A: [], B: [], C: [], D: [] };
}

function trimFreshnessPoints(points: FreshnessPoint[], nowIso: string) {
  const nowTs = new Date(nowIso).getTime();
  const cutoff = nowTs - FRESHNESS_TREND_WINDOW_MINUTES * 60_000;
  return points
    .filter((point) => {
      const ts = new Date(point.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .slice(-FRESHNESS_TREND_MAX_POINTS);
}

function appendFreshnessPoints(timeline: FreshnessTimeline, services: HealthService[], nowIso: string): FreshnessTimeline {
  const next: FreshnessTimeline = {
    A: [...timeline.A],
    B: [...timeline.B],
    C: [...timeline.C],
    D: [...timeline.D],
  };

  const byWorkflow = new Map<WorkflowKey, HealthService>();
  for (const service of services) {
    const key = inferWorkflowKey(service.name);
    if (key) byWorkflow.set(key, service);
  }

  for (const key of WORKFLOW_KEYS) {
    const service = byWorkflow.get(key);
    if (!service) continue;
    const minutes = effectiveMinutesSince(service);
    const point: FreshnessPoint = {
      at: nowIso,
      value: freshnessPercent(minutes),
      minutesSince: minutes,
    };
    next[key] = trimFreshnessPoints([...next[key], point], nowIso);
  }

  return next;
}

function buildSparklinePolyline(points: FreshnessPoint[]) {
  if (!points.length) return "";
  const samples = points.length === 1 ? [points[0], points[0]] : points;
  const count = samples.length - 1;
  return samples
    .map((point, index) => {
      const x = count === 0 ? 0 : (index / count) * SPARKLINE_WIDTH;
      const normalized = clamp(point.value, 0, 100);
      const y = SPARKLINE_HEIGHT - (normalized / 100) * SPARKLINE_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function staleSignalLabel(minutesSince: number | null, status: HealthService["status"]) {
  if (minutesSince == null) return null;
  if (status === "degraded" && minutesSince >= 5) {
    return { label: `Delayed ${minutesSince}m`, tone: "danger" as const };
  }
  if (minutesSince >= 60) {
    return { label: `Idle ${minutesSince}m`, tone: "danger" as const };
  }
  if (minutesSince >= FRESHNESS_STALE_BADGE_MINUTES) {
    return { label: `Stale ${minutesSince}m`, tone: "warning" as const };
  }
  return null;
}

function staleSignalClasses(tone: "warning" | "danger") {
  return tone === "danger"
    ? "border-status-error/40 bg-status-error/15 text-status-error"
    : "border-status-warning/40 bg-status-warning/15 text-status-warning";
}

function pickIcon(serviceName: string) {
  const n = (serviceName || "").toLowerCase().trim();

  if (n.startsWith("a") || n.includes("workflow a") || n.includes("intake") || n.includes("normal")) return ShieldCheck;
  if (n.startsWith("b") || n.includes("workflow b") || n.includes("speed") || n.includes("response")) return Cpu;
  if (n.startsWith("c") || n.includes("workflow c") || n.includes("follow")) return Globe;
  if (n.startsWith("d") || n.includes("workflow d") || n.includes("pipeline") || n.includes("booking")) return Database;

  return Activity;
}

function endpointLabel(index: number) {
  return index === 0 ? "Primary Endpoint" : `Fallback Endpoint ${index}`;
}

function readBrowserConnectionSnapshot(): BrowserConnectionSnapshot {
  if (typeof navigator === "undefined") {
    return { online: false, effectiveType: null, downlinkMbps: null, rttMs: null };
  }

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    mozConnection?: { effectiveType?: string; downlink?: number; rtt?: number };
    webkitConnection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

  return {
    online: navigator.onLine,
    effectiveType: conn?.effectiveType ?? null,
    downlinkMbps: typeof conn?.downlink === "number" ? conn.downlink : null,
    rttMs: typeof conn?.rtt === "number" ? conn.rtt : null,
  };
}

function createUnknownProbe(url: string, index: number): EndpointProbe {
  return {
    label: endpointLabel(index),
    url,
    ok: false,
    statusCode: null,
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    error: "Awaiting first probe",
  };
}

function createInitialNetworkSnapshot(): NetworkSnapshot {
  return {
    endpoints: HEALTH_URLS.map((url, index) => createUnknownProbe(url, index)),
    activeEndpointUrl: null,
    browser: readBrowserConnectionSnapshot(),
    checkedAt: null,
  };
}

function isHttpsUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function hasIncidentStatus(services: HealthService[]) {
  return services.some((service) => service.status === "stale" || service.status === "degraded");
}

function buildSecuritySnapshot(params: {
  appSettings: AppSettings;
  networkSnapshot: NetworkSnapshot;
  generatedAt: string | null;
}): SecuritySnapshot {
  const { appSettings, networkSnapshot, generatedAt } = params;
  const isBrowser = typeof window !== "undefined";
  const isLocalhost = isBrowser
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    : false;
  const protocolHttps = isBrowser ? window.location.protocol === "https:" : false;
  const secureContext = isBrowser ? window.isSecureContext : false;
  const hasCspMeta = isBrowser ? !!document.querySelector('meta[http-equiv="Content-Security-Policy"]') : false;

  const endpointUrls = HEALTH_URLS.concat(SUPABASE_URL ? [SUPABASE_URL] : []);
  const endpointsEncrypted = endpointUrls.every((url) => isHttpsUrl(url));
  const reachableEndpoints = networkSnapshot.endpoints.filter((ep) => ep.ok).length;

  const checks: SecurityCheck[] = [
    {
      label: "Application Transport",
      status: protocolHttps ? "pass" : isLocalhost ? "warning" : "fail",
      detail: protocolHttps
        ? "App is served over HTTPS."
        : isLocalhost
        ? "HTTP localhost is acceptable for local development only."
        : "App is not on HTTPS.",
    },
    {
      label: "Secure Browser Context",
      status: secureContext ? "pass" : isLocalhost ? "warning" : "fail",
      detail: secureContext
        ? "Secure context APIs are available."
        : isLocalhost
        ? "Secure context disabled on local HTTP."
        : "Secure context is unavailable.",
    },
    {
      label: "Data Endpoint Encryption",
      status: endpointsEncrypted ? "pass" : "fail",
      detail: endpointsEncrypted
        ? "Health and data endpoints use HTTPS."
        : "One or more configured endpoints are not HTTPS.",
    },
    {
      label: "Audit Trail Setting",
      status: appSettings.auditTrail ? "pass" : "warning",
      detail: appSettings.auditTrail
        ? "Client telemetry audit trail is enabled."
        : "Audit trail is disabled in operator settings.",
    },
    {
      label: "Content Security Policy Visibility",
      status: hasCspMeta ? "pass" : "warning",
      detail: hasCspMeta
        ? "CSP meta tag detected in document."
        : "No CSP meta tag detected (header-level CSP may still exist).",
    },
    {
      label: "Network Reachability",
      status: reachableEndpoints > 0 && networkSnapshot.browser.online ? "pass" : "warning",
      detail:
        reachableEndpoints > 0 && networkSnapshot.browser.online
          ? `${reachableEndpoints}/${networkSnapshot.endpoints.length} health endpoints reachable.`
          : "No healthy endpoint currently reachable from this client.",
    },
  ];

  const score =
    Math.round(
      (checks.reduce((sum, check) => sum + (check.status === "pass" ? 100 : check.status === "warning" ? 60 : 0), 0) /
        checks.length) *
        10
    ) / 10;
  const postureLabel = score >= 85 ? "Hardened" : score >= 65 ? "Monitor" : "At Risk";

  return {
    checks,
    score,
    postureLabel,
    checkedAt: generatedAt ?? networkSnapshot.checkedAt ?? new Date().toISOString(),
  };
}

class HealthFetchError extends Error {
  endpointProbes: EndpointProbe[];

  constructor(message: string, endpointProbes: EndpointProbe[]) {
    super(message);
    this.name = "HealthFetchError";
    this.endpointProbes = endpointProbes;
  }
}

async function fetchWithTimeout(url: string, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);

  try {
    const bust = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${bust}t=${Date.now()}`;

    const res = await fetch(finalUrl, {
      method: "GET",
      signal: ctrl.signal,
      mode: "cors",
      cache: "no-store",
    });

    return res;
  } finally {
    clearTimeout(t);
  }
}

async function probeEndpoint(url: string, index: number) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await withRetry(() => fetchWithTimeout(url, 12000), { retries: 2, baseDelayMs: 400 });
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));

    const probe: EndpointProbe = {
      label: endpointLabel(index),
      url,
      ok: response.ok,
      statusCode: response.status,
      latencyMs,
      checkedAt,
      error: response.ok ? null : `HTTP ${response.status}`,
    };

    return { response, probe };
  } catch (error: any) {
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));
    const probe: EndpointProbe = {
      label: endpointLabel(index),
      url,
      ok: false,
      statusCode: null,
      latencyMs,
      checkedAt,
      error: String(error?.message || error || "Request failed"),
    };
    return { response: null as Response | null, probe };
  }
}

async function fetchHealthStatus(): Promise<FetchHealthStatusResult> {
  const probes = await Promise.all(HEALTH_URLS.map((url, index) => probeEndpoint(url, index)));
  const okResult = probes.find((entry) => entry.response?.ok);

  if (!okResult || !okResult.response) {
    const reasons = probes.map((entry) => `${entry.probe.url}: ${entry.probe.error ?? "Unreachable"}`);
    throw new HealthFetchError(`Health endpoint unreachable. ${reasons.join(" | ")}`, probes.map((entry) => entry.probe));
  }

  const data = (await okResult.response.json()) as HealthPayload;
  if (!data?.ok) {
    throw new HealthFetchError("Health endpoint returned ok=false", probes.map((entry) => entry.probe));
  }

  return {
    payload: {
      ok: true,
      allOperational: !!data.allOperational,
      services: Array.isArray(data.services) ? data.services : [],
      logs: Array.isArray(data.logs) ? data.logs : [],
      generated_at: data.generated_at || new Date().toISOString(),
    },
    endpointProbes: probes.map((entry) => entry.probe),
    activeEndpointUrl: okResult.probe.url,
  };
}

function dedupeServices(list: HealthService[]) {
  const map = new Map<string, HealthService>();

  for (const s of list) {
    if (!s?.name) continue;
    const prev = map.get(s.name);
    if (!prev) {
      map.set(s.name, s);
      continue;
    }
    const a = prev.last_run_at ? new Date(prev.last_run_at).getTime() : 0;
    const b = s.last_run_at ? new Date(s.last_run_at).getTime() : 0;
    map.set(s.name, b >= a ? s : prev);
  }

  return Array.from(map.values());
}

function dedupeLogs(list: HealthLog[]) {
  const seen = new Set<string>();
  const out: HealthLog[] = [];

  for (const l of list) {
    const key = `${l.time ?? ""}|${l.source ?? ""}|${l.event ?? ""}|${l.status ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }

  out.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });

  return out;
}

function buildWorkflowServices(list: HealthService[], previous: HealthService[]) {
  const byWorkflow = new Map<WorkflowKey, HealthService>();
  const previousByWorkflow = new Map<WorkflowKey, HealthService>();

  for (const service of previous) {
    const key = inferWorkflowKey(service.name);
    if (!key) continue;
    previousByWorkflow.set(key, normalizeServiceSnapshot({ ...service, name: normalizeWorkflowName(key) }));
  }

  for (const rawService of list) {
    const service = normalizeServiceSnapshot(rawService);
    const workflowKey = inferWorkflowKey(service.name);
    if (!workflowKey) continue;
    const prev = byWorkflow.get(workflowKey);
    if (!prev) {
      byWorkflow.set(workflowKey, { ...service, name: normalizeWorkflowName(workflowKey) });
      continue;
    }
    const prevTs = prev.last_run_at ? new Date(prev.last_run_at).getTime() : 0;
    const nextTs = service.last_run_at ? new Date(service.last_run_at).getTime() : 0;
    if (nextTs >= prevTs) {
      byWorkflow.set(workflowKey, { ...service, name: normalizeWorkflowName(workflowKey) });
    }
  }

  return WORKFLOW_KEYS.map((key) => byWorkflow.get(key) ?? previousByWorkflow.get(key) ?? createFallbackService(key));
}

function readStoredServices() {
  if (typeof window === "undefined") return [] as HealthService[];
  try {
    const raw = localStorage.getItem(HEALTH_SERVICE_STORAGE_KEY);
    if (!raw) return [] as HealthService[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as HealthService[];
    return buildWorkflowServices(dedupeServices(parsed as HealthService[]), []);
  } catch {
    return [] as HealthService[];
  }
}

function persistServices(services: HealthService[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HEALTH_SERVICE_STORAGE_KEY, JSON.stringify(services));
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

function readStoredFreshnessTimeline() {
  if (typeof window === "undefined") return createEmptyFreshnessTimeline();

  const empty = createEmptyFreshnessTimeline();
  try {
    const raw = localStorage.getItem(HEALTH_FRESHNESS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Record<WorkflowKey, FreshnessPoint[]>>;
    const nowIso = new Date().toISOString();
    for (const key of WORKFLOW_KEYS) {
      const values = parsed?.[key];
      if (!Array.isArray(values)) continue;
      const normalized = values
        .filter((value) => value && typeof value.at === "string")
        .map((value) => ({
          at: value.at,
          value: clamp(Number(value.value ?? 0), 0, 100),
          minutesSince: typeof value.minutesSince === "number" ? Math.max(0, Math.round(value.minutesSince)) : null,
        }));
      empty[key] = trimFreshnessPoints(normalized, nowIso);
    }
    return empty;
  } catch {
    return empty;
  }
}

function persistFreshnessTimeline(timeline: FreshnessTimeline) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HEALTH_FRESHNESS_STORAGE_KEY, JSON.stringify(timeline));
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

function readStoredLogs() {
  if (typeof window === "undefined") return [] as HealthLog[];
  try {
    const raw = localStorage.getItem(HEALTH_LOG_STORAGE_KEY);
    if (!raw) return [] as HealthLog[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as HealthLog[];
    return dedupeLogs(parsed as HealthLog[]);
  } catch {
    return [] as HealthLog[];
  }
}

function persistLogs(logs: HealthLog[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HEALTH_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Ignore storage failures (quota/private mode) and keep runtime state.
  }
}

function buildStatusChangeLogs(previous: HealthService[], current: HealthService[]) {
  const prevMap = new Map<WorkflowKey, HealthService>();
  const currMap = new Map<WorkflowKey, HealthService>();

  for (const service of previous) {
    const key = inferWorkflowKey(service.name);
    if (key) prevMap.set(key, service);
  }
  for (const service of current) {
    const key = inferWorkflowKey(service.name);
    if (key) currMap.set(key, service);
  }

  const events: HealthLog[] = [];
  for (const key of WORKFLOW_KEYS) {
    const before = prevMap.get(key);
    const after = currMap.get(key);
    if (!before || !after) continue;
    if (before.status === after.status) continue;
    events.push({
      time: new Date().toISOString(),
      source: normalizeWorkflowName(key),
      event: `Status changed: ${statusLabel(before.status)} -> ${statusLabel(after.status)}`,
      status: after.status === "degraded" || after.status === "stale" ? "warning" : "info",
    });
  }

  return events;
}

function addSystemLog(message: string, status: HealthLog["status"] = "info"): HealthLog {
  return {
    time: new Date().toISOString(),
    source: "Health UI",
    event: message,
    status,
  };
}

function securityStatusClasses(status: SecurityCheck["status"]) {
  if (status === "pass") return "bg-status-success/15 text-status-success border-status-success/30";
  if (status === "warning") return "bg-status-warning/15 text-status-warning border-status-warning/30";
  return "bg-status-error/15 text-status-error border-status-error/30";
}

export function Health() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [payload, setPayload] = React.useState<HealthPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null);
  const [appSettings, setAppSettings] = React.useState(() => loadAppSettings());
  const [serviceSnapshot, setServiceSnapshot] = React.useState<HealthService[]>(() => readStoredServices());
  const [freshnessTimeline, setFreshnessTimeline] = React.useState<FreshnessTimeline>(() => readStoredFreshnessTimeline());
  const [logHistory, setLogHistory] = React.useState<HealthLog[]>(() => readStoredLogs());
  const [networkSnapshot, setNetworkSnapshot] = React.useState<NetworkSnapshot>(() => createInitialNetworkSnapshot());
  const [, setMinuteTick] = React.useState(0);
  const nominalRefreshSec = Math.max(NOMINAL_REFRESH_SEC, appSettings.refreshIntervalSec);
  const [adaptiveIntervalSec, setAdaptiveIntervalSec] = React.useState<number>(nominalRefreshSec);
  const [nextRefreshAt, setNextRefreshAt] = React.useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = React.useState<number | null>(null);
  const [refreshCycleToken, setRefreshCycleToken] = React.useState(0);
  const previousServicesRef = React.useRef<HealthService[]>(serviceSnapshot);
  const healthyCyclesRef = React.useRef(0);
  const adaptiveIntervalRef = React.useRef<number>(nominalRefreshSec);

  React.useEffect(() => {
    if (adaptiveIntervalRef.current !== INCIDENT_REFRESH_SEC) {
      adaptiveIntervalRef.current = nominalRefreshSec;
      setAdaptiveIntervalSec(nominalRefreshSec);
    }
  }, [nominalRefreshSec]);

  React.useEffect(() => {
    const t = setInterval(() => {
      setMinuteTick((prev) => prev + 1);
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!previousServicesRef.current.length && serviceSnapshot.length) {
      previousServicesRef.current = serviceSnapshot;
    }
  }, [serviceSnapshot]);

  React.useEffect(() => {
    if (!serviceSnapshot.length) return;
    const hasAnyTrend = WORKFLOW_KEYS.some((key) => freshnessTimeline[key].length > 0);
    if (hasAnyTrend) return;

    const nowIso = new Date().toISOString();
    const seeded = appendFreshnessPoints(createEmptyFreshnessTimeline(), serviceSnapshot, nowIso);
    setFreshnessTimeline(seeded);
    persistFreshnessTimeline(seeded);
  }, [freshnessTimeline, serviceSnapshot]);

  const appendLogs = React.useCallback((entries: HealthLog[]) => {
    if (!entries.length) return;
    setLogHistory((prev) => {
      const merged = dedupeLogs([...entries, ...prev]);
      persistLogs(merged);
      return merged;
    });
  }, []);

  const run = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchHealthStatus();
      const incomingServices = buildWorkflowServices(
        dedupeServices(result.payload.services ?? []),
        previousServicesRef.current
      );
      const remoteLogs = dedupeLogs(result.payload.logs ?? []);
      const statusChangeLogs = buildStatusChangeLogs(previousServicesRef.current, incomingServices);
      const hasIncident = hasIncidentStatus(incomingServices);
      const modeLogs: HealthLog[] = [];

      if (hasIncident) {
        healthyCyclesRef.current = 0;
        if (adaptiveIntervalRef.current !== INCIDENT_REFRESH_SEC) {
          adaptiveIntervalRef.current = INCIDENT_REFRESH_SEC;
          setAdaptiveIntervalSec(INCIDENT_REFRESH_SEC);
          modeLogs.push(addSystemLog(`Incident detected. Auto-refresh increased to every ${INCIDENT_REFRESH_SEC}s.`, "warning"));
        }
      } else if (adaptiveIntervalRef.current === INCIDENT_REFRESH_SEC) {
        healthyCyclesRef.current += 1;
        if (healthyCyclesRef.current >= HEALTHY_CYCLES_TO_RECOVER) {
          healthyCyclesRef.current = 0;
          adaptiveIntervalRef.current = nominalRefreshSec;
          setAdaptiveIntervalSec(nominalRefreshSec);
          modeLogs.push(addSystemLog(`Health stabilized. Auto-refresh returned to ${nominalRefreshSec}s.`, "info"));
        }
      } else {
        healthyCyclesRef.current = 0;
        if (adaptiveIntervalRef.current !== nominalRefreshSec) {
          adaptiveIntervalRef.current = nominalRefreshSec;
          setAdaptiveIntervalSec(nominalRefreshSec);
        }
      }

      appendLogs([...remoteLogs, ...statusChangeLogs, ...modeLogs, addSystemLog("Health refresh completed.", "success")]);

      setPayload({
        ...result.payload,
        services: incomingServices,
        logs: remoteLogs,
      });
      setServiceSnapshot(incomingServices);
      persistServices(incomingServices);
      const nowIso = new Date().toISOString();
      setFreshnessTimeline((prev) => {
        const next = appendFreshnessPoints(prev, incomingServices, nowIso);
        persistFreshnessTimeline(next);
        return next;
      });
      previousServicesRef.current = incomingServices;
      setNetworkSnapshot({
        endpoints: result.endpointProbes,
        activeEndpointUrl: result.activeEndpointUrl,
        browser: readBrowserConnectionSnapshot(),
        checkedAt: new Date().toISOString(),
      });
      setErr(null);
      setLastRefreshAt(new Date());
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch health");
      if (e instanceof HealthFetchError) {
        setNetworkSnapshot({
          endpoints: e.endpointProbes,
          activeEndpointUrl: null,
          browser: readBrowserConnectionSnapshot(),
          checkedAt: new Date().toISOString(),
        });
      } else {
        setNetworkSnapshot((prev) => ({
          ...prev,
          browser: readBrowserConnectionSnapshot(),
          checkedAt: new Date().toISOString(),
        }));
      }
      appendLogs([addSystemLog(`Health refresh failed: ${e?.message || "Unknown error"}`, "warning")]);
    } finally {
      setLoading(false);
    }
  }, [appendLogs, nominalRefreshSec]);

  const requestRefresh = React.useCallback(() => {
    setRefreshCycleToken((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    const onSettingsChanged = () => setAppSettings(loadAppSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
  }, []);

  React.useEffect(() => {
    const updateConnection = () => {
      setNetworkSnapshot((prev) => ({ ...prev, browser: readBrowserConnectionSnapshot() }));
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    const nav = navigator as Navigator & {
      connection?: EventTarget;
      mozConnection?: EventTarget;
      webkitConnection?: EventTarget;
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    conn?.addEventListener?.("change", updateConnection as EventListener);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      conn?.removeEventListener?.("change", updateConnection as EventListener);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (seconds: number) => {
      if (!mounted || !appSettings.autoRefresh) return;
      const nextAt = Date.now() + seconds * 1000;
      setNextRefreshAt(nextAt);
      timer = setTimeout(() => {
        void tick();
      }, seconds * 1000);
    };

    const tick = async () => {
      if (!mounted) return;
      await run();
      if (!mounted || !appSettings.autoRefresh) return;
      scheduleNext(adaptiveIntervalRef.current);
    };

    if (appSettings.autoRefresh) {
      void tick();
    } else {
      setNextRefreshAt(null);
      setSecondsUntilRefresh(null);
      void run();
    }

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [appSettings.autoRefresh, run, refreshCycleToken]);

  React.useEffect(() => {
    if (!appSettings.autoRefresh || nextRefreshAt == null) {
      setSecondsUntilRefresh(null);
      return;
    }

    const updateCountdown = () => {
      setSecondsUntilRefresh(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    };

    updateCountdown();
    const t = setInterval(updateCountdown, 1000);
    return () => clearInterval(t);
  }, [appSettings.autoRefresh, nextRefreshAt]);

  const services = payload?.services?.length
    ? payload.services
    : serviceSnapshot.length
    ? serviceSnapshot
    : WORKFLOW_KEYS.map((key) => createFallbackService(key));
  const logs = logHistory;
  const headlineOk = payload?.allOperational ?? false;
  const incidentMode = adaptiveIntervalSec === INCIDENT_REFRESH_SEC;
  const securitySnapshot = React.useMemo(
    () =>
      buildSecuritySnapshot({
        appSettings,
        networkSnapshot,
        generatedAt: payload?.generated_at ?? null,
      }),
    [appSettings, networkSnapshot, payload?.generated_at]
  );

  if (loading && !payload && !serviceSnapshot.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-56" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <PageHeader
          title="System Health"
          description="Operational status of Nexus Q automation layers (live from Workflow E)."
          lastUpdatedLabel={`Last updated: ${lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : "Not yet synced"}`}
        />
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={requestRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          {appSettings.autoRefresh ? (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                incidentMode
                  ? "bg-status-warning/10 text-status-warning border-status-warning/20"
                  : "bg-status-info/10 text-status-info border-status-info/20"
              }`}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {incidentMode ? "Rapid Monitor" : "Auto Refresh"} {adaptiveIntervalSec}s
                {secondsUntilRefresh != null ? ` | ${secondsUntilRefresh}s` : ""}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30 text-muted-foreground">
              <span className="text-[10px] font-bold uppercase tracking-wider">Auto Refresh Off</span>
            </div>
          )}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
              headlineOk
                ? "bg-status-success/10 text-status-success border-status-success/20"
                : "bg-status-warning/10 text-status-warning border-status-warning/20"
            }`}
          >
            {headlineOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="text-xs font-bold uppercase tracking-wider">
              {loading ? "Checking..." : headlineOk ? "All Systems Nominal" : "Attention Needed"}
            </span>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border p-4 text-sm">
          <div className="text-red-500 font-bold">Health API Error</div>
          <div className="text-muted-foreground mt-1">{err}</div>
          <button className="mt-3 underline text-sm" onClick={requestRefresh}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = pickIcon(service.name);
          const minutesSince = effectiveMinutesSince(service);
          const freshness = freshnessPercent(minutesSince);
          const workflowKey = inferWorkflowKey(service.name);
          const trendSeed = workflowKey ? freshnessTimeline[workflowKey] ?? [] : [];
          const trendNowIso = new Date().toISOString();
          const trendPoints = trimFreshnessPoints(
            [...trendSeed, { at: trendNowIso, value: freshness, minutesSince }],
            trendNowIso
          );
          const trendPolyline = buildSparklinePolyline(trendPoints);
          const staleSignal = staleSignalLabel(minutesSince, service.status);

          return (
            <Card
              key={service.name}
              className={`border-none ${
                service.status === "optimal"
                  ? "card-surface-c"
                  : service.status === "stale"
                  ? "card-surface-d"
                  : service.status === "degraded"
                  ? "card-surface-b"
                  : "card-surface-a"
              }`}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={statusBadgeVariant(service.status)} className="text-[9px] font-bold uppercase">
                      {statusLabel(service.status)}
                    </Badge>
                    {staleSignal ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${staleSignalClasses(staleSignal.tone)}`}
                      >
                        {staleSignal.label}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold">{service.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    Last run: {minutesSince == null ? "-" : `${minutesSince}m ago`}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="opacity-60 uppercase">Freshness</span>
                    <span>{minutesSince == null ? "-" : `${Math.round(freshness)}%`}</span>
                  </div>
                  <Progress value={freshness} className="h-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="opacity-60 uppercase">60m Trend</span>
                    <span className="opacity-60">{trendPoints.length} pts</span>
                  </div>
                  <div className="h-8 rounded-md border bg-background/60 px-1 py-1">
                    <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} className="h-full w-full" preserveAspectRatio="none">
                      <polyline
                        points={trendPolyline}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {service.error ? <div className="text-[10px] text-status-warning leading-snug">{service.error}</div> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">Real-time Activity Log</CardTitle>
            <CardDescription>
              Full retained event history from Workflow E and Health UI ({logs.length} entries).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 font-mono text-xs max-h-[34rem] overflow-y-auto pr-1">
              {logs.map((log, i) => (
                <div
                  key={`${log.time ?? "na"}-${log.source}-${i}`}
                  className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0"
                >
                  <span className="text-muted-foreground/60 w-44 flex-shrink-0">
                    {log.time ? new Date(log.time).toLocaleString() : "-"}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    {log.status === "success" ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-status-success" />
                    ) : log.status === "warning" ? (
                      <AlertTriangle className="h-3 w-3 text-status-warning" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-status-info" />
                    )}
                    <span>{log.event}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background border"
                  >
                    {log.source}
                  </Badge>
                </div>
              ))}

              {!logs.length && <div className="text-sm text-muted-foreground">No logs yet.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Network Map</CardTitle>
              <CardDescription>Live health endpoint probes, latency, and browser connectivity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5" />
                    Client Link
                  </div>
                  <div
                    className={`mt-1 text-xs font-bold ${
                      networkSnapshot.browser.online ? "text-status-success" : "text-status-error"
                    }`}
                  >
                    {networkSnapshot.browser.online ? "Online" : "Offline"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {networkSnapshot.browser.effectiveType ? `${networkSnapshot.browser.effectiveType.toUpperCase()} | ` : ""}
                    {networkSnapshot.browser.downlinkMbps != null ? `${networkSnapshot.browser.downlinkMbps.toFixed(1)} Mbps` : "Downlink -"}
                  </div>
                </div>
                <div className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    Active Route
                  </div>
                  <div className="mt-1 text-xs font-bold">
                    {networkSnapshot.activeEndpointUrl ? hostFromUrl(networkSnapshot.activeEndpointUrl) : "No active endpoint"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Last probe: {networkSnapshot.checkedAt ? new Date(networkSnapshot.checkedAt).toLocaleTimeString() : "-"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {networkSnapshot.endpoints.map((endpoint) => (
                  <div key={endpoint.url} className="rounded-xl border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold">{endpoint.label}</div>
                      <Badge
                        variant={endpoint.ok ? "outline" : "destructive"}
                        className="text-[9px] font-bold uppercase tracking-widest"
                      >
                        {endpoint.ok ? "Reachable" : "Unavailable"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{hostFromUrl(endpoint.url)}</span>
                      <span>{endpoint.latencyMs != null ? `${endpoint.latencyMs} ms` : "-"}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {endpoint.error ?? (endpoint.statusCode != null ? `HTTP ${endpoint.statusCode}` : "Probe pending")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none card-surface-c">
            <CardHeader>
              <CardTitle className="text-lg">Security & Compliance</CardTitle>
              <CardDescription>Runtime checks from this client session.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>{securitySnapshot.postureLabel}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  Score {securitySnapshot.score}%
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span>Runtime Posture</span>
                  <span>{securitySnapshot.score}%</span>
                </div>
                <Progress value={securitySnapshot.score} className="h-1.5" />
              </div>

              <div className="space-y-2">
                {securitySnapshot.checks.map((check) => (
                  <div key={check.label} className="rounded-xl border bg-background/70 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{check.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${securityStatusClasses(check.status)}`}>
                        {check.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Client-side verification only. Formal SOC2/GDPR certification requires independent audit evidence.
              </p>

              <div className="flex items-center justify-between text-[10px] font-bold border-t border-border pt-4">
                <span className="opacity-60 uppercase tracking-wider">Last Check</span>
                <span>{new Date(securitySnapshot.checkedAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
