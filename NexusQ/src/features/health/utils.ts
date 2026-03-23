import {
  Activity,
  Cpu,
  Database,
  Globe,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AppSettings } from "@/lib/userSettings";
import {
  asDomainRecord,
  pickNumber,
  pickString,
} from "@/lib/types/domain";
import type { AutomationHealthRecord } from "@/lib/types/domain";
import {
  FRESHNESS_STALE_BADGE_MINUTES,
  WORKFLOW_KEYS,
  type HealthLog,
  type HealthPayload,
  type HealthService,
  type NetworkSnapshot,
  type SecurityCheck,
  type SecuritySnapshot,
  type WorkflowKey,
} from "@/features/health/types";

export function normalizeWorkflowName(key: WorkflowKey) {
  return `Workflow ${key}`;
}

export function upsertWorkflowService(
  services: HealthService[],
  nextService: HealthService
) {
  const workflowKey = inferWorkflowKey(nextService.name);
  if (!workflowKey) return services;

  const filtered = services.filter((service) => inferWorkflowKey(service.name) !== workflowKey);
  return [...filtered, nextService];
}

export function inferWorkflowKey(serviceName: string): WorkflowKey | null {
  const normalized = serviceName.toLowerCase().trim();

  if (normalized.startsWith("a") || normalized.includes("workflow a") || normalized.includes("intake") || normalized.includes("normal")) {
    return "A";
  }
  if (normalized.startsWith("b") || normalized.includes("workflow b") || normalized.includes("speed") || normalized.includes("response")) {
    return "B";
  }
  if (normalized.startsWith("c") || normalized.includes("workflow c") || normalized.includes("follow")) {
    return "C";
  }
  if (normalized.startsWith("d") || normalized.includes("workflow d") || normalized.includes("pipeline") || normalized.includes("booking")) {
    return "D";
  }
  if (normalized.startsWith("e") || normalized.includes("workflow e") || normalized.includes("health")) {
    return "E";
  }

  return null;
}

export function createFallbackService(key: WorkflowKey): HealthService {
  return {
    name: normalizeWorkflowName(key),
    status: "unknown",
    last_run_at: null,
    minutes_since: null,
    error: "No health signal received yet.",
  };
}

export function statusBadgeVariant(status: HealthService["status"]) {
  if (status === "optimal") return "outline" as const;
  if (status === "stale") return "secondary" as const;
  if (status === "degraded") return "destructive" as const;
  return "secondary" as const;
}

export function statusLabel(status: HealthService["status"]) {
  if (status === "optimal") return "optimal";
  if (status === "stale") return "stale";
  if (status === "degraded") return "degraded";
  return "unknown";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function parseTimestampMs(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;

  let normalized = raw.replace(" ", "T");
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  normalized = normalized.replace(/\+00:00$/, "Z");

  const normalizedMs = Date.parse(normalized);
  if (Number.isFinite(normalizedMs)) return normalizedMs;

  return null;
}

export function freshnessPercent(minutesSince: number | null) {
  if (minutesSince == null) return 0;
  return clamp(100 - (minutesSince / 90) * 100, 0, 100);
}

export function normalizeServiceSnapshot(service: HealthService): HealthService {
  if (service.last_run_at || service.minutes_since == null) return service;
  return {
    ...service,
    last_run_at: new Date(Date.now() - service.minutes_since * 60_000).toISOString(),
  };
}

export function effectiveMinutesSince(service: HealthService) {
  if (service.last_run_at) {
    const timestamp = parseTimestampMs(service.last_run_at);
    if (timestamp != null && timestamp > 0) {
      return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
    }
  }
  return service.minutes_since;
}

export function staleSignalLabel(minutesSince: number | null, status: HealthService["status"]) {
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

export function staleSignalClasses(tone: "warning" | "danger") {
  return tone === "danger"
    ? "border-status-error/40 bg-status-error/15 text-status-error"
    : "border-status-warning/40 bg-status-warning/15 text-status-warning";
}

export function pickHealthIcon(serviceName: string): LucideIcon {
  const normalized = serviceName.toLowerCase().trim();

  if (normalized.startsWith("a") || normalized.includes("workflow a") || normalized.includes("intake") || normalized.includes("normal")) {
    return ShieldCheck;
  }
  if (normalized.startsWith("b") || normalized.includes("workflow b") || normalized.includes("speed") || normalized.includes("response")) {
    return Cpu;
  }
  if (normalized.startsWith("c") || normalized.includes("workflow c") || normalized.includes("follow")) {
    return Globe;
  }
  if (normalized.startsWith("d") || normalized.includes("workflow d") || normalized.includes("pipeline") || normalized.includes("booking")) {
    return Database;
  }
  if (normalized.startsWith("e") || normalized.includes("workflow e") || normalized.includes("health")) {
    return ShieldCheck;
  }

  return Activity;
}

export function endpointLabel(index: number) {
  return index === 0 ? "Primary Endpoint" : `Fallback Endpoint ${index}`;
}

function isHttpsUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function endpointDisplayName(label: string) {
  if (label === "Primary Endpoint") return "NexusQ Servers";
  if (label.startsWith("Fallback Endpoint")) return "NexusQ Backup Route";
  return "NexusQ Servers";
}

export function activeRouteDisplayName(snapshot: NetworkSnapshot) {
  if (!snapshot.activeEndpointUrl) return "No active endpoint";
  const match = snapshot.endpoints.find((endpoint) => endpoint.url === snapshot.activeEndpointUrl);
  if (match) return endpointDisplayName(match.label);
  return "NexusQ Servers";
}

export function hasIncidentStatus(services: HealthService[]) {
  return services.some((service) => service.status === "stale" || service.status === "degraded");
}

export function buildSecuritySnapshot(params: {
  appSettings: AppSettings;
  networkSnapshot: NetworkSnapshot;
  generatedAt: string | null;
  endpointUrls: string[];
}): SecuritySnapshot {
  const { appSettings, networkSnapshot, generatedAt, endpointUrls } = params;
  const isBrowser = typeof window !== "undefined";
  const isLocalhost = isBrowser
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    : false;
  const protocolHttps = isBrowser ? window.location.protocol === "https:" : false;
  const secureContext = isBrowser ? window.isSecureContext : false;
  const hasCspMeta = isBrowser ? !!document.querySelector('meta[http-equiv="Content-Security-Policy"]') : false;
  const endpointsEncrypted = endpointUrls.every((url) => isHttpsUrl(url));
  const reachableEndpoints = networkSnapshot.endpoints.filter((endpoint) => endpoint.ok).length;

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

export function buildFallbackHealthPayloadFromEmptyBody(): HealthPayload {
  const now = new Date().toISOString();
  return {
    ok: true,
    allOperational: false,
    services: [],
    logs: [
      {
        time: now,
        source: "Health Endpoint",
        event: "Endpoint returned an empty body. Using cached workflow snapshot.",
        status: "warning",
      },
    ],
    generated_at: now,
  };
}

export function normalizeHealthServiceStatus(value: unknown): HealthService["status"] {
  const lower = String(value ?? "").toLowerCase().trim();
  if (lower === "optimal" || lower === "ok" || lower === "healthy" || lower === "success") return "optimal";
  if (lower === "stale" || lower === "delayed") return "stale";
  if (lower === "degraded" || lower === "error" || lower === "failed" || lower === "fail") return "degraded";
  return "unknown";
}

export function normalizeHealthLogStatus(value: unknown): HealthLog["status"] {
  const lower = String(value ?? "").toLowerCase().trim();
  if (lower === "success" || lower === "ok") return "success";
  if (lower === "warning" || lower === "warn" || lower === "error" || lower === "failed") return "warning";
  return "info";
}

export function toHealthPayloadFromUnknown(input: unknown): HealthPayload {
  const root = asDomainRecord(input) ?? {};
  const candidate = asDomainRecord(root.data) ?? root;

  const services = Array.isArray(candidate.services)
    ? candidate.services.map((service) => {
        const serviceRecord = asDomainRecord(service) ?? {};
        const lastRunAt = pickString(serviceRecord.last_run_at, serviceRecord.lastRunAt);
        const minutesSince = pickNumber(serviceRecord.minutes_since, serviceRecord.minutesSince);

        return {
          name: pickString(serviceRecord.name) ?? "Unknown Workflow",
          status: normalizeHealthServiceStatus(serviceRecord.status),
          last_run_at: lastRunAt,
          minutes_since: minutesSince,
          error: pickString(serviceRecord.error, serviceRecord.error_message),
        } satisfies HealthService;
      })
    : [];

  const logs = Array.isArray(candidate.logs)
    ? candidate.logs.map((log) => {
        const logRecord = asDomainRecord(log) ?? {};
        return {
          time: pickString(logRecord.time, logRecord.created_at),
          event: pickString(logRecord.event, logRecord.message) ?? "Health event",
          source: pickString(logRecord.source, logRecord.workflow_name) ?? "Health Endpoint",
          status: normalizeHealthLogStatus(logRecord.status),
        } satisfies HealthLog;
      })
    : [];

  const hasRecognizableShape =
    services.length > 0 || logs.length > 0 || typeof candidate.allOperational === "boolean";
  const ok = typeof candidate.ok === "boolean" ? candidate.ok : hasRecognizableShape;

  return {
    ok,
    allOperational: typeof candidate.allOperational === "boolean" ? candidate.allOperational : false,
    services,
    logs,
    generated_at: pickString(candidate.generated_at) ?? new Date().toISOString(),
  };
}

export function mapAutomationHealthToServices(rows: AutomationHealthRecord[]) {
  return rows
    .map<HealthService | null>((row) => {
      const workflowKey = inferWorkflowKey(row.workflowName ?? "");
      if (!workflowKey) return null;

      const lastRunMs = parseTimestampMs(row.lastRunAt);
      const minutesSince =
        lastRunMs != null ? Math.max(0, Math.floor((Date.now() - lastRunMs) / 60_000)) : null;

      let status = normalizeHealthServiceStatus(row.status);
      if (status === "unknown" && minutesSince != null) {
        status = minutesSince <= 5 ? "optimal" : minutesSince <= FRESHNESS_STALE_BADGE_MINUTES ? "stale" : "degraded";
      }

      const derivedError =
        row.errorMessage ??
        (status === "degraded"
          ? `${normalizeWorkflowName(workflowKey)} reported a degraded status without an explicit error message.`
          : status === "stale"
          ? `${normalizeWorkflowName(workflowKey)} heartbeat is stale.`
          : null);

      const service: HealthService = {
        name: normalizeWorkflowName(workflowKey),
        status,
        last_run_at: row.lastRunAt,
        minutes_since: minutesSince,
        error: derivedError,
      };

      return service;
    })
    .filter((service): service is HealthService => Boolean(service));
}

export function dedupeServices(list: HealthService[]) {
  const map = new Map<string, HealthService>();

  for (const service of list) {
    if (!service.name) continue;
    const previous = map.get(service.name);
    if (!previous) {
      map.set(service.name, service);
      continue;
    }
    const previousTimestamp = parseTimestampMs(previous.last_run_at) ?? 0;
    const nextTimestamp = parseTimestampMs(service.last_run_at) ?? 0;
    map.set(service.name, nextTimestamp >= previousTimestamp ? service : previous);
  }

  return Array.from(map.values());
}

export function dedupeLogs(list: HealthLog[]) {
  const seen = new Set<string>();
  const output: HealthLog[] = [];

  for (const log of list) {
    const key = `${log.time ?? ""}|${log.source}|${log.event}|${log.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(log);
  }

  output.sort((a, b) => {
    const aTime = a.time ? new Date(a.time).getTime() : 0;
    const bTime = b.time ? new Date(b.time).getTime() : 0;
    return bTime - aTime;
  });

  return output;
}

export function buildWorkflowServices(list: HealthService[], previous: HealthService[]) {
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
    const previousService = byWorkflow.get(workflowKey);
    if (!previousService) {
      byWorkflow.set(workflowKey, { ...service, name: normalizeWorkflowName(workflowKey) });
      continue;
    }

    const previousTimestamp = parseTimestampMs(previousService.last_run_at) ?? 0;
    const nextTimestamp = parseTimestampMs(service.last_run_at) ?? 0;
    if (nextTimestamp >= previousTimestamp) {
      byWorkflow.set(workflowKey, { ...service, name: normalizeWorkflowName(workflowKey) });
    }
  }

  return WORKFLOW_KEYS.map((key) => byWorkflow.get(key) ?? previousByWorkflow.get(key) ?? createFallbackService(key));
}

export function buildStatusChangeLogs(previous: HealthService[], current: HealthService[]) {
  const previousMap = new Map<WorkflowKey, HealthService>();
  const currentMap = new Map<WorkflowKey, HealthService>();

  for (const service of previous) {
    const key = inferWorkflowKey(service.name);
    if (key) previousMap.set(key, service);
  }
  for (const service of current) {
    const key = inferWorkflowKey(service.name);
    if (key) currentMap.set(key, service);
  }

  const events: HealthLog[] = [];
  for (const key of WORKFLOW_KEYS) {
    const before = previousMap.get(key);
    const after = currentMap.get(key);
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

export function addSystemLog(message: string, status: HealthLog["status"] = "info"): HealthLog {
  return {
    time: new Date().toISOString(),
    source: "Health UI",
    event: message,
    status,
  };
}

export function securityStatusClasses(status: SecurityCheck["status"]) {
  if (status === "pass") return "bg-status-success/15 text-status-success border-status-success/30";
  if (status === "warning") return "bg-status-warning/15 text-status-warning border-status-warning/30";
  return "bg-status-error/15 text-status-error border-status-error/30";
}
