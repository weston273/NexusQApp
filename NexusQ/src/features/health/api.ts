import { buildSupabaseFunctionUrl, getAppConfig } from "@/lib/config";
import { invokeAuthedFunction } from "@/lib/edgeFunctions";
import { getErrorMessage } from "@/lib/errors";
import { listAutomationHealth } from "@/lib/services/health";
import {
  type EndpointProbe,
  type FetchHealthStatusResult,
  type HealthPayload,
} from "@/features/health/types";
import {
  buildFallbackHealthPayloadFromEmptyBody,
  endpointLabel,
  mapAutomationHealthToServices,
  toHealthPayloadFromUnknown,
  dedupeServices,
} from "@/features/health/utils";

const { supabaseUrl: SUPABASE_URL } = getAppConfig();
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

function createProbe(args: {
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
}): EndpointProbe {
  return {
    label: endpointLabel(0),
    url: args.url,
    ok: args.ok,
    statusCode: args.statusCode,
    latencyMs: args.latencyMs,
    checkedAt: args.checkedAt,
    error: args.error,
  };
}

function normalizeHealthPayload(rawPayload: Record<string, unknown> | null): HealthPayload {
  if (!rawPayload) {
    return buildFallbackHealthPayloadFromEmptyBody();
  }

  const payload = toHealthPayloadFromUnknown(rawPayload);
  if (payload.ok === false) {
    throw new Error("Workflow E proxy returned an error payload.");
  }

  return payload;
}

export async function fetchHealthStatus(clientId: string | null): Promise<FetchHealthStatusResult> {
  if (!clientId) {
    throw new HealthFetchError("Active workspace client_id is required before fetching health status.", []);
  }

  const checkedAt = new Date().toISOString();
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const rawPayload = await invokeAuthedFunction<Record<string, unknown> | null>("workflow-e-proxy", {
      client_id: clientId,
    });
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));
    const payload = normalizeHealthPayload(rawPayload);
    const probe = createProbe({
      url: WORKFLOW_E_PROXY_URL,
      ok: true,
      statusCode: 200,
      latencyMs,
      checkedAt,
      error: null,
    });

    return {
      payload,
      endpointProbes: [probe],
      activeEndpointUrl: WORKFLOW_E_PROXY_URL,
    };
  } catch (error: unknown) {
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(endedAt - startedAt));
    const message = getErrorMessage(error, "Failed to fetch health");
    const probe = createProbe({
      url: WORKFLOW_E_PROXY_URL,
      ok: false,
      statusCode: null,
      latencyMs,
      checkedAt,
      error: message,
    });

    throw new HealthFetchError(`Workflow E proxy unavailable. ${message}`, [probe]);
  }
}

export async function fetchAutomationHealthFallback(clientId: string | null) {
  if (!clientId) return [];
  const rows = await listAutomationHealth(clientId);
  return dedupeServices(mapAutomationHealthToServices(rows));
}
