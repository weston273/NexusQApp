import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type HealthProxyBody = {
  client_id?: string | null;
};

const DEFAULT_WORKFLOW_E_STATUS_URL = "https://n8n-k7j4.onrender.com/webhook/pipeline-update";

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getAuthClient(request: Request) {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function getServiceClient() {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAuthenticatedUser(request: Request): Promise<User> {
  const token = extractBearerToken(request);
  if (!token) throw new Error("Missing Authorization header.");

  const authClient = getAuthClient(request);
  if (!authClient) throw new Error("Missing Authorization header.");

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error(error?.message || "Unauthorized request.");
  }
  return data.user;
}

function appendClientId(url: string, clientId: string | null) {
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

function resolveWorkflowEUrls() {
  const candidates = [
    getOptionalEnv("WORKFLOW_E_STATUS_URL"),
    getOptionalEnv("WORKFLOW_E_WEBHOOK_URL"),
    getOptionalEnv("WORKFLOW_E_STATUS_FALLBACK_URL"),
    DEFAULT_WORKFLOW_E_STATUS_URL,
  ];

  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!urls.includes(candidate)) urls.push(candidate);
    } catch {
      // Ignore malformed URL.
    }
  }

  if (!urls.length) {
    throw new Error("No valid Workflow E status URL configured.");
  }

  return urls;
}

async function parseRequestClientId(request: Request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("client_id") || "").trim();
    return raw || null;
  }
  try {
    const body = (await request.json()) as HealthProxyBody;
    const raw = typeof body.client_id === "string" ? body.client_id.trim() : "";
    return raw || null;
  } catch {
    return null;
  }
}

async function verifyWorkspaceAccess(params: {
  serviceClient: ReturnType<typeof getServiceClient>;
  userId: string;
  clientId: string | null;
}) {
  if (!params.clientId) return null;

  const { data, error } = await params.serviceClient
    .from("user_access")
    .select("id")
    .eq("user_id", params.userId)
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify workspace access: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("You do not have access to this workspace.");
  }

  return params.clientId;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const finalUrl = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      const response = await fetch(finalUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < 1) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Workflow E status request failed.");
}

async function parseUpstreamPayload(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: true, message: text.slice(0, 240) };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const serviceClient = getServiceClient();
    const clientId = await parseRequestClientId(request);
    await verifyWorkspaceAccess({ serviceClient, userId: user.id, clientId });

    const urls = resolveWorkflowEUrls();
    let lastError = "Workflow E status request failed.";

    for (const baseUrl of urls) {
      const url = appendClientId(baseUrl, clientId);
      try {
        const response = await fetchWithRetry(url);
        const upstreamPayload = await parseUpstreamPayload(response);
        const upstreamOk =
          response.ok && upstreamPayload?._error !== true && upstreamPayload?.ok !== false;
        if (upstreamOk) {
          return jsonResponse(
            {
              ...(upstreamPayload || {}),
              _proxy: {
                status: response.status,
                url: baseUrl,
              },
            },
            200
          );
        }

        const reason =
          (typeof upstreamPayload?.error === "string" && upstreamPayload.error) ||
          (typeof upstreamPayload?.message === "string" && upstreamPayload.message) ||
          `HTTP ${response.status}`;
        lastError = `Workflow E status request failed: ${reason}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = `Workflow E status request failed: ${message}`;
      }
    }

    return jsonResponse({ ok: false, error: lastError }, 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("unauthorized") || lower.includes("authorization")
        ? 401
        : lower.includes("do not have access")
        ? 403
        : 400;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
