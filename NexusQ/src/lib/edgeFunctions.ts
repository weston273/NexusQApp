import { ensureActiveAccessToken, signOutCurrentUser } from "@/lib/auth";
import { buildSupabaseFunctionUrl, getAppConfig } from "@/lib/config";

function isResponseContext(value: unknown): value is Response {
  return typeof Response !== "undefined" && value instanceof Response;
}

function getResponseContext(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown; response?: unknown }).context ?? (error as { response?: unknown }).response;
  return isResponseContext(context) ? context : null;
}

export async function parseFunctionError(error: unknown) {
  if (!error) return "An unexpected error occurred.";

  const response = getResponseContext(error);
  if (response) {
    const status = response.status;
    try {
      const payload = await response.clone().json();
      const bodyMessage = payload?.error || payload?.message || payload?.msg;
      if (typeof bodyMessage === "string" && bodyMessage.trim()) {
        const lower = bodyMessage.toLowerCase();
        if (lower.includes("session_not_found") || lower.includes("session") && lower.includes("does not exist")) {
          return "Your saved session is no longer recognized by Supabase. Please sign in again.";
        }
        return bodyMessage;
      }
    } catch {
      // Ignore JSON parsing issues and use fallback message.
    }

    if (status === 401) return "Unauthorized request. Please sign out and sign in again.";
    if (status === 403) return "Forbidden request. Your account does not have permission for this workspace.";
    if (status === 404) return "Requested Edge Function was not found. Confirm it is deployed.";
    if (status >= 500) return "Server error while processing the request.";
  }

  if (error instanceof Error) {
    const message = error.message;
    const lower = message.toLowerCase();
    if (lower.includes("session_not_found") || (lower.includes("session") && lower.includes("does not exist"))) {
      return "Your saved session is no longer recognized by Supabase. Please sign in again.";
    }
    if (lower.includes("invalid jwt") || lower.includes("jwt")) {
      return "Your session is invalid or expired. Please sign out and sign in again.";
    }
    if (lower.includes("failed to send a request to the edge function")) {
      return "Failed to reach the Edge Function. Check deployment, CORS, and network connectivity.";
    }
    return message;
  }
  return String(error);
}

async function ensureSignedInSession(forceRefresh = false) {
  return ensureActiveAccessToken({ forceRefresh, clearInvalidSession: true });
}

function isUnauthorizedFunctionError(error: unknown) {
  const response = getResponseContext(error);
  return response?.status === 401;
}

class EdgeFunctionHttpError extends Error {
  readonly response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.name = "EdgeFunctionHttpError";
    this.response = response;
  }
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

async function parseFunctionResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return null as T;
  }

  if (isJsonResponse(response)) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text as T;
}

async function invokeEdgeFunctionRequest<T>(name: string, body: Record<string, unknown>, token: string) {
  const { supabaseAnonKey } = getAppConfig();
  const response = await fetch(buildSupabaseFunctionUrl(name), {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Edge Function ${name} failed with HTTP ${response.status}.`;
    try {
      const payload = await parseFunctionResponse<Record<string, unknown>>(response.clone());
      const candidate =
        (payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload.error ?? payload.message)
          : null);
      if (typeof candidate === "string" && candidate.trim()) {
        message = candidate;
      }
    } catch {
      // Ignore parsing issues and use the HTTP fallback message.
    }

    throw new EdgeFunctionHttpError(message, response);
  }

  return parseFunctionResponse<T>(response);
}

export async function invokeAuthedFunction<T>(name: string, body: Record<string, unknown>) {
  let token = await ensureSignedInSession();
  try {
    return await invokeEdgeFunctionRequest<T>(name, body, token);
  } catch (error) {
    if (!isUnauthorizedFunctionError(error)) {
      throw new Error(await parseFunctionError(error));
    }

    token = await ensureSignedInSession(true);
    try {
      return await invokeEdgeFunctionRequest<T>(name, body, token);
    } catch (retryError) {
      if (isUnauthorizedFunctionError(retryError)) {
        await signOutCurrentUser();
      }
      throw new Error(await parseFunctionError(retryError));
    }
  }
}
