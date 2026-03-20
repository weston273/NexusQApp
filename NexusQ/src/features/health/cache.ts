import { readStoredJson, writeStoredJson } from "@/lib/persistence/storage";
import {
  HEALTH_LOG_STORAGE_KEY,
  HEALTH_SERVICE_STORAGE_KEY,
  type BrowserConnectionSnapshot,
  type EndpointProbe,
  type HealthLog,
  type HealthService,
  type NetworkSnapshot,
} from "@/features/health/types";
import { buildWorkflowServices, dedupeLogs, dedupeServices, endpointLabel } from "@/features/health/utils";

export function readBrowserConnectionSnapshot(): BrowserConnectionSnapshot {
  if (typeof navigator === "undefined") {
    return { online: false, effectiveType: null, downlinkMbps: null, rttMs: null };
  }

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    mozConnection?: { effectiveType?: string; downlink?: number; rtt?: number };
    webkitConnection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType ?? null,
    downlinkMbps: typeof connection?.downlink === "number" ? connection.downlink : null,
    rttMs: typeof connection?.rtt === "number" ? connection.rtt : null,
  };
}

export function createUnknownProbe(url: string, index: number): EndpointProbe {
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

export function createInitialNetworkSnapshot(urls: string[]): NetworkSnapshot {
  return {
    endpoints: urls.map((url, index) => createUnknownProbe(url, index)),
    activeEndpointUrl: null,
    browser: readBrowserConnectionSnapshot(),
    checkedAt: null,
  };
}

export function readStoredServices() {
  const parsed = readStoredJson<HealthService[]>(
    HEALTH_SERVICE_STORAGE_KEY,
    (value) => (Array.isArray(value) ? (value as HealthService[]) : null),
    []
  );
  return buildWorkflowServices(dedupeServices(parsed), []);
}

export function persistServices(services: HealthService[]) {
  writeStoredJson(HEALTH_SERVICE_STORAGE_KEY, services);
}

export function readStoredLogs() {
  const parsed = readStoredJson<HealthLog[]>(
    HEALTH_LOG_STORAGE_KEY,
    (value) => (Array.isArray(value) ? (value as HealthLog[]) : null),
    []
  );
  return dedupeLogs(parsed);
}

export function persistLogs(logs: HealthLog[]) {
  writeStoredJson(HEALTH_LOG_STORAGE_KEY, logs);
}
