import { withRetry } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import { buildSupabaseFunctionUrl, getAppConfig } from "@/lib/config";
import { listAutomationHealth } from "@/lib/services/health";
import {
  type EndpointProbe,
  type FetchHealthStatusResult,
  type HealthPayload,
} from "@/features/health/types";
import {
  buildFallbackHealthPayloadFromEmptyBody,
  dedupeServices,
  endpointLabel,
  mapAutomationHealthToServices,
  toHealthPayloadFromUnknown,
} from "@/features/health/utils";

const { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } = getAppConfig();
const WORKFLOW_E_PROXY_URL = buildSupabaseFunctionUrl("workflow-e-proxy");
export { SUPABASE_URL };
export const HEALTH_URLS = [WORKFLOW_E_PROXY_URL];

export class HealthFetchError extends Error {
  endpointProbes: EndpointProbe[];

  constructor(message: string, endpointProbes: EndpointProbe[]) {
    super(message);
    this.name = "HealthFetchError";
    this.endpointProbes = endpointProbes;
  }
}

async function parseHealthPayloadResponse(response: Response): Promise<HealthPayload> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return buildFallbackHealthPayloadFromEmptyBody();
  }

  const shouldParseJson =
    contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (shouldParseJson) {
    try {
      return toHealthPayloadFromUnknown(JSON.parse(trimmed));
    } catch (error: unknown) {
      throw new Error(`Invalid JSON payload: ${getErrorMessage(error, "parse failed")}`);
    }
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("ok") || lower.includes("healthy")) {
    const now = new Date().toISOString();
    return {
      ok: true,
      allOperational: false,
      services: [],
      logs: [
        {
          time: now,
          source: "Health Endpoint",
          event: `Text response received: ${trimmed.slice(0, 120)}`,
          status: "info",
        },
      ],
      generated_at: now,
    };
  }

  throw new Error(`Unexpected response format (content-type: ${contentType || "unknown"})`);
}

async function fetchWithTimeout(url: string, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;
    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${separator}t=${Date.now()}`;
    const headers: Record<string, string> = {};

    if (SUPABASE_ANON_KEY) {
      headers.apikey = SUPABASE_ANON_KEY;
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return await fetch(finalUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function appendClientIdQuery(url: string, clientId: string | null) {
  if (!clientId) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("client_id", clientId);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}client_id=${encodeURIComponent(clientId)}`;
  }
}

async function probeEndpoint(url: string, index: number) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await withRetry(() => fetchWithTimeout(url, 12000), { retries: 2, baseDelayMs: 400 });
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
  const urls = HEALTH_URLS.map((url) => appendClientIdQuery(url, clientId));
  const probes = await Promise.all(urls.map((url, index) => probeEndpoint(url, index)));
  const okResult = probes.find((entry) => entry.response?.ok);

  if (!okResult || !okResult.response) {
    const reasons = probes.map((entry) => `${entry.probe.label}: ${entry.probe.error ?? "Unreachable"}`);
    throw new HealthFetchError(
      `Health endpoint unreachable. ${reasons.join(" | ")}`,
      probes.map((entry) => entry.probe)
    );
  }

  let data: HealthPayload;
  try {
    data = await parseHealthPayloadResponse(okResult.response);
  } catch (error: unknown) {
    throw new HealthFetchError(
      `Health endpoint payload unreadable. ${getErrorMessage(error, "Invalid response format.")}`,
      probes.map((entry) => entry.probe)
    );
  }

  if (data.ok === false) {
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

export async function fetchAutomationHealthFallback(clientId: string | null) {
  if (!clientId) return [];
  const rows = await listAutomationHealth(clientId);
  return dedupeServices(mapAutomationHealthToServices(rows));
}
