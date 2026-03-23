import { withRetry } from "@/lib/network";
import { getErrorMessage } from "@/lib/errors";
import { getAppConfig } from "@/lib/config";
import { listAutomationHealth } from "@/lib/services/health";
import { asDomainRecord, pickString } from "@/lib/types/domain";
import {
  type EndpointProbe,
  type FetchHealthStatusResult,
  type HealthPayload,
} from "@/features/health/types";
import {
  dedupeServices,
  endpointLabel,
  mapAutomationHealthToServices,
  toHealthPayloadFromUnknown,
} from "@/features/health/utils";

const { supabaseUrl: SUPABASE_URL } = getAppConfig();
const DEFAULT_WORKFLOW_E_HEALTH_URL = "https://n8n-k7j4.onrender.com/webhook/health-ping";
const WORKFLOW_E_HEALTH_URL = String(import.meta.env.VITE_WORKFLOW_E_HEALTH_URL ?? "").trim();
const WORKFLOW_E_HEALTH_FALLBACK_URL = String(import.meta.env.VITE_WORKFLOW_E_HEALTH_FALLBACK_URL ?? "").trim();
const WORKFLOW_E_PROBE_NAME = "Workflow E";
export { SUPABASE_URL };

function normalizeHealthEndpointUrl(value: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export const HEALTH_URLS = [WORKFLOW_E_HEALTH_URL || DEFAULT_WORKFLOW_E_HEALTH_URL, WORKFLOW_E_HEALTH_FALLBACK_URL]
  .map((url) => normalizeHealthEndpointUrl(url))
  .filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);

function debugHealth(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  console.info("[health]", message, meta ?? "");
}

export class HealthFetchError extends Error {
  endpointProbes: EndpointProbe[];

  constructor(message: string, endpointProbes: EndpointProbe[]) {
    super(message);
    this.name = "HealthFetchError";
    this.endpointProbes = endpointProbes;
  }
}

function buildWorkflowEReachabilityPayload(response: Response, rawText: string): HealthPayload {
  const now = new Date().toISOString();
  const summary = rawText
    ? rawText.replace(/\s+/g, " ").trim().slice(0, 180)
    : "Workflow E health-ping returned no structured payload.";

  return {
    ok: true,
    allOperational: false,
    services: [],
    logs: [
      {
        time: now,
        source: "Workflow E Probe",
        event: `Workflow E health-ping responded with HTTP ${response.status}. ${summary} Using automation_health for service detail.`,
        status: "info",
      },
    ],
    generated_at: now,
  };
}

async function parseHealthPayloadResponse(response: Response): Promise<HealthPayload> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const rawText = await response.text();
  const trimmed = rawText.trim();

  debugHealth("Probe response received", {
    status: response.status,
    ok: response.ok,
    contentType,
    snippet: trimmed.slice(0, 180),
  });

  if (!response.ok) {
    throw new Error(`Workflow E health-ping failed with HTTP ${response.status}. ${trimmed.slice(0, 180)}`.trim());
  }

  if (!trimmed) {
    return buildWorkflowEReachabilityPayload(response, "");
  }

  const shouldParseJson =
    contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (shouldParseJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch (error: unknown) {
      throw new Error(`Invalid JSON payload: ${getErrorMessage(error, "parse failed")}`);
    }

    const record = asDomainRecord(parsed);
    const explicitError =
      record?._error === true ||
      record?.ok === false ||
      typeof pickString(record?.error, record?.message) === "string";

    if (explicitError) {
      throw new Error(pickString(record?.error, record?.message) ?? "Workflow E health-ping returned an error payload.");
    }

    const payload = toHealthPayloadFromUnknown(parsed);
    const hasStructuredHealthShape =
      payload.services.length > 0 ||
      payload.logs.length > 0 ||
      typeof record?.allOperational === "boolean" ||
      typeof record?.ok === "boolean";

    if (!hasStructuredHealthShape) {
      return buildWorkflowEReachabilityPayload(response, trimmed);
    }

    return payload;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("ok") || lower.includes("healthy") || lower.includes("pong")) {
    return buildWorkflowEReachabilityPayload(response, trimmed);
  }

  throw new Error(`Unexpected response format (content-type: ${contentType || "unknown"})`);
}

async function fetchWithTimeout(url: string, clientId: string | null, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${separator}t=${Date.now()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
    };
    const body = JSON.stringify({
      workflow_name: WORKFLOW_E_PROBE_NAME,
      client_id: clientId,
      checked_at: new Date().toISOString(),
    });

    return await fetch(finalUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function probeEndpoint(url: string, index: number, clientId: string | null) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await withRetry(() => fetchWithTimeout(url, clientId, 12000), { retries: 2, baseDelayMs: 400 });
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));

    return {
      response,
      probe: {
        label: endpointLabel(index),
        url,
        ok: response.ok,
        statusCode: response.status,
        latencyMs,
        checkedAt,
        error: response.ok ? null : `HTTP ${response.status}`,
      } satisfies EndpointProbe,
    };
  } catch (error: unknown) {
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));
    return {
      response: null as Response | null,
      probe: {
        label: endpointLabel(index),
        url,
        ok: false,
        statusCode: null,
        latencyMs,
        checkedAt,
        error: getErrorMessage(error, "Request failed"),
      } satisfies EndpointProbe,
    };
  }
}

export async function fetchHealthStatus(clientId: string | null): Promise<FetchHealthStatusResult> {
  if (!clientId) {
    throw new HealthFetchError("Active workspace client_id is required before fetching health status.", []);
  }

  if (!HEALTH_URLS.length) {
    throw new HealthFetchError("Workflow E health URL is not configured. Set VITE_WORKFLOW_E_HEALTH_URL.", []);
  }

  const probes = await Promise.all(HEALTH_URLS.map((url, index) => probeEndpoint(url, index, clientId)));
  const okResults = probes.filter((entry) => entry.response?.ok);

  if (!okResults.length) {
    const reasons = probes.map((entry) => `${entry.probe.label}: ${entry.probe.error ?? "Unreachable"}`);
    throw new HealthFetchError(
      `Workflow E health-ping unreachable. ${reasons.join(" | ")}`,
      probes.map((entry) => entry.probe)
    );
  }

  const payloadErrors: string[] = [];

  for (const okResult of okResults) {
    try {
      const data = await parseHealthPayloadResponse(okResult.response!);

      if (data.ok === false) {
        payloadErrors.push(`${okResult.probe.label}: ok=false`);
        continue;
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
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Invalid response format.");
      payloadErrors.push(`${okResult.probe.label}: ${message}`);
      debugHealth("Probe payload rejected", {
        url: okResult.probe.url,
        error: message,
      });
    }
  }

  throw new HealthFetchError(
    `Workflow E health-ping payload unreadable. ${payloadErrors.join(" | ") || "No usable response payload."}`,
    probes.map((entry) => entry.probe)
  );
}

export async function fetchAutomationHealthFallback(clientId: string | null) {
  if (!clientId) return [];
  const rows = await listAutomationHealth(clientId);
  return dedupeServices(mapAutomationHealthToServices(rows));
}
