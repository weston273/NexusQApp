const configuredOrigins = String(Deno.env.get("NEXUSQ_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const defaultAllowedHeaders = "authorization, x-client-info, apikey, content-type";
const defaultAllowedMethods = "GET, POST, OPTIONS";

function resolveAllowedOrigin(request?: Request) {
  const requestOrigin = request?.headers.get("Origin")?.trim();
  if (!configuredOrigins.length) {
    return requestOrigin || "*";
  }
  if (!requestOrigin) {
    return configuredOrigins[0];
  }
  return configuredOrigins.includes(requestOrigin) ? requestOrigin : configuredOrigins[0];
}

export function buildCorsHeaders(request?: Request) {
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(request),
    Vary: "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
    "Access-Control-Allow-Headers":
      request?.headers.get("Access-Control-Request-Headers")?.trim() || defaultAllowedHeaders,
    "Access-Control-Allow-Methods": defaultAllowedMethods,
    "Access-Control-Max-Age": "86400",
  };
}

export const corsHeaders = buildCorsHeaders();

export function corsResponse(request?: Request) {
  return new Response("ok", {
    status: 200,
    headers: buildCorsHeaders(request),
  });
}

export function jsonResponse(body: Record<string, unknown>, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}
