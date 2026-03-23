import { getAppConfig } from "@/lib/config";
import { invokeAuthedFunction, parseFunctionError } from "@/lib/edgeFunctions";

type WorkflowABody = Record<string, unknown> & {
  source: string;
  client_id?: string | null;
  client_key?: string | null;
};

type WorkflowASubmitResult = {
  ok: true;
  via: "proxy" | "webhook";
  upstreamUrl: string;
  upstreamStatus: number;
  upstreamPayload: Record<string, unknown>;
};

function getWorkflowAWebhookUrl() {
  if (!import.meta.env.DEV) return undefined;
  return getAppConfig().workflowADevFallbackUrl;
}

function isResponseContext(value: unknown): value is Response {
  return typeof Response !== "undefined" && value instanceof Response;
}

function getFunctionErrorContext(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  return isResponseContext(context) ? context : null;
}

function shouldFallbackToDirectWebhook(error: unknown) {
  const context = getFunctionErrorContext(error);
  if (context && [404, 502, 503, 504].includes(context.status)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to send a request to the edge function") ||
    lower.includes("failed to reach the edge function") ||
    lower.includes("requested function was not found") ||
    lower.includes("requested edge function was not found") ||
    lower.includes("edge function was not found") ||
    lower.includes("not_found") ||
    lower.includes("cors") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  );
}

async function parseWebhookResponse(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return {} as Record<string, unknown>;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      message: text.slice(0, 240),
    } satisfies Record<string, unknown>;
  }
}

async function submitViaProxy(payload: WorkflowABody): Promise<WorkflowASubmitResult> {
  const data = await invokeAuthedFunction<Record<string, unknown> | null>("workflow-a-proxy", payload);

  if (!data?.ok) {
    const message = typeof data?.error === "string" ? data.error : "Lead intake request failed.";
    throw new Error(message);
  }

  return {
    ok: true,
    via: "proxy",
    upstreamUrl: typeof data?.upstream_url === "string" ? data.upstream_url : "workflow-a-proxy",
    upstreamStatus: typeof data?.upstream_status === "number" ? data.upstream_status : 200,
    upstreamPayload:
      data?.upstream_payload && typeof data.upstream_payload === "object" && !Array.isArray(data.upstream_payload)
        ? (data.upstream_payload as Record<string, unknown>)
        : {},
  };
}

async function submitDirectToWebhook(payload: WorkflowABody, upstreamUrl: string): Promise<WorkflowASubmitResult> {
  const response = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const upstreamPayload = await parseWebhookResponse(response);
  const ok = response.ok && upstreamPayload._error !== true && upstreamPayload.ok !== false;

  if (!ok) {
    const reason =
      (typeof upstreamPayload.error === "string" && upstreamPayload.error) ||
      (typeof upstreamPayload.message === "string" && upstreamPayload.message) ||
      `HTTP ${response.status}`;
    throw new Error(`Workflow A webhook failed at ${upstreamUrl}: ${reason}`);
  }

  return {
    ok: true,
    via: "webhook",
    upstreamUrl,
    upstreamStatus: response.status,
    upstreamPayload,
  };
}

export async function submitLeadToWorkflowA(payload: WorkflowABody): Promise<WorkflowASubmitResult> {
  const directWebhookUrl = getWorkflowAWebhookUrl();
  try {
    return await submitViaProxy(payload);
  } catch (proxyError) {
    if (!shouldFallbackToDirectWebhook(proxyError) || !directWebhookUrl) {
      throw new Error(await parseFunctionError(proxyError));
    }

    console.warn("workflow-a-proxy unavailable in development, falling back to direct Workflow A webhook.", proxyError);

    try {
      return await submitDirectToWebhook(payload, directWebhookUrl);
    } catch (fallbackError) {
      const proxyMessage = await parseFunctionError(proxyError);
      const webhookMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Lead intake failed. Proxy error: ${proxyMessage}. Webhook error: ${webhookMessage}`);
    }
  }
}
