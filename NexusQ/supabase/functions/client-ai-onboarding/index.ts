import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { User } from "npm:@supabase/supabase-js@2.94.0";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { generateStructuredResponse } from "../_shared/openai.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";
import { resolveTenantForUser } from "../_shared/tenant.ts";

type OnboardingRequest = {
  action?: "start" | "message" | "status";
  client_id?: string | null;
  client_key?: string | null;
  message?: string | null;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getAuthClient(request: Request) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
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
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
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

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as OnboardingRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

async function requireAdminOrOwner(serviceClient: ReturnType<typeof getServiceClient>, userId: string, clientId: string) {
  const { data, error } = await serviceClient
    .from("user_access")
    .select("role")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify workspace role: ${error.message}`);
  const role = pickString(data?.role)?.toLowerCase();
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only workspace owners and admins can manage AI onboarding.");
  }
}

async function ensureRows(serviceClient: ReturnType<typeof getServiceClient>, clientId: string) {
  await serviceClient.from("client_profiles").upsert({ client_id: clientId }, { onConflict: "client_id" });
  await serviceClient.from("ai_behavior_config").upsert({ client_id: clientId }, { onConflict: "client_id" });
}

async function getSession(serviceClient: ReturnType<typeof getServiceClient>, clientId: string) {
  const { data, error } = await serviceClient
    .from("client_onboarding_sessions")
    .select("id, status, current_question_key, collected_context, transcript")
    .eq("client_id", clientId)
    .in("status", ["open", "completed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load onboarding session: ${error.message}`);
  return asRecord(data);
}

async function startSession(serviceClient: ReturnType<typeof getServiceClient>, clientId: string, userId: string) {
  const { data, error } = await serviceClient
    .from("client_onboarding_sessions")
    .insert({
      client_id: clientId,
      started_by_user_id: userId,
      status: "open",
      current_question_key: "business_description",
      collected_context: {},
      transcript: [
        {
          role: "assistant",
          message: "What does your business do and what services or products do you sell?",
          at: new Date().toISOString(),
        },
      ],
    })
    .select("id, status, current_question_key, collected_context, transcript")
    .maybeSingle();

  if (error) throw new Error(`Failed to start onboarding session: ${error.message}`);
  return asRecord(data) ?? {};
}

async function buildOnboardingTurn(args: {
  model: string;
  currentContext: Record<string, unknown>;
  transcript: unknown[];
  ownerMessage: string;
}) {
  return generateStructuredResponse<{
    assistant_message: string;
    current_question_key: string | null;
    onboarding_complete: boolean;
    summary: string | null;
    updates: {
      business_description?: string | null;
      services_summary?: string | null;
      ideal_customer?: string | null;
      service_area?: string | null;
      limitations?: string | null;
      offers_summary?: string | null;
      tone?: string | null;
    };
    pricing_items: Array<{
      service_name: string;
      service_code: string | null;
      package_name: string | null;
      currency: string | null;
      price_from: number | null;
      price_to: number | null;
      unit_label: string | null;
      description: string | null;
      pricing_notes: string | null;
    }>;
    rules: Array<{
      rule_type: string;
      rule_key: string;
      rule_label: string | null;
      rule_text: string;
      priority: number | null;
    }>;
  }>({
    model: args.model,
    schemaName: "client_ai_onboarding_turn",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        assistant_message: { type: "string" },
        current_question_key: { type: ["string", "null"] },
        onboarding_complete: { type: "boolean" },
        summary: { type: ["string", "null"] },
        updates: {
          type: "object",
          additionalProperties: false,
          properties: {
            business_description: { type: ["string", "null"] },
            services_summary: { type: ["string", "null"] },
            ideal_customer: { type: ["string", "null"] },
            service_area: { type: ["string", "null"] },
            limitations: { type: ["string", "null"] },
            offers_summary: { type: ["string", "null"] },
            tone: { type: ["string", "null"] },
          },
        },
        pricing_items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              service_name: { type: "string" },
              service_code: { type: ["string", "null"] },
              package_name: { type: ["string", "null"] },
              currency: { type: ["string", "null"] },
              price_from: { type: ["number", "null"] },
              price_to: { type: ["number", "null"] },
              unit_label: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              pricing_notes: { type: ["string", "null"] },
            },
            required: ["service_name", "service_code", "package_name", "currency", "price_from", "price_to", "unit_label", "description", "pricing_notes"],
          },
        },
        rules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              rule_type: { type: "string" },
              rule_key: { type: "string" },
              rule_label: { type: ["string", "null"] },
              rule_text: { type: "string" },
              priority: { type: ["number", "null"] },
            },
            required: ["rule_type", "rule_key", "rule_label", "rule_text", "priority"],
          },
        },
      },
      required: ["assistant_message", "current_question_key", "onboarding_complete", "summary", "updates", "pricing_items", "rules"],
    },
    systemText: [
      "You are an onboarding intelligence assistant for a business SMS sales agent.",
      "Your job is to ask one smart next question at a time and extract structured business context.",
      "Collect: business description, services, pricing, offers, ideal customer, service area, limitations, and tone.",
      "If something is missing, ask for it naturally.",
      "When the business context is sufficient to safely operate the AI sales agent, set onboarding_complete to true.",
    ].join("\n"),
    userInput: {
      current_context: args.currentContext,
      transcript: args.transcript,
      owner_message: args.ownerMessage,
    },
    maxOutputTokens: 500,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsResponse(request);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, request);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = await parseJsonBody(request);
    const serviceClient = getServiceClient();
    const tenant = await resolveTenantForUser({
      serviceClient,
      userId: user.id,
      tenant: {
        clientId: body.client_id,
        clientKey: body.client_key,
      },
    });

    await requireAdminOrOwner(serviceClient, user.id, tenant.clientId);
    await ensureRows(serviceClient, tenant.clientId);

    const { data: behaviorRow } = await serviceClient
      .from("ai_behavior_config")
      .select("model")
      .eq("client_id", tenant.clientId)
      .maybeSingle();

    const model = pickString(behaviorRow?.model) ?? "gpt-4.1-mini";
    const action = body.action ?? "status";

    if (action === "status") {
      const session = await getSession(serviceClient, tenant.clientId);
      return jsonResponse({ ok: true, session }, 200, request);
    }

    const session = (await getSession(serviceClient, tenant.clientId)) ?? (await startSession(serviceClient, tenant.clientId, user.id));

    if (action === "start") {
      return jsonResponse({ ok: true, session }, 200, request);
    }

    const ownerMessage = pickString(body.message);
    if (!ownerMessage) {
      return jsonResponse({ ok: false, error: "message is required for onboarding conversation." }, 400, request);
    }

    const collectedContext = asRecord(session.collected_context) ?? {};
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    const aiTurn = await buildOnboardingTurn({
      model,
      currentContext: collectedContext,
      transcript,
      ownerMessage,
    });

    const nextContext = {
      ...collectedContext,
      ...Object.fromEntries(
        Object.entries(aiTurn.updates ?? {}).filter(([, value]) => typeof value === "string" && value.trim())
      ),
      summary: aiTurn.summary ?? collectedContext.summary ?? null,
    };

    const nextTranscript = [
      ...transcript,
      { role: "user", message: ownerMessage, at: new Date().toISOString() },
      { role: "assistant", message: aiTurn.assistant_message, at: new Date().toISOString() },
    ];

    await serviceClient
      .from("client_onboarding_sessions")
      .update({
        status: aiTurn.onboarding_complete ? "completed" : "open",
        current_question_key: aiTurn.current_question_key,
        collected_context: nextContext,
        transcript: nextTranscript,
        completed_at: aiTurn.onboarding_complete ? new Date().toISOString() : null,
      })
      .eq("id", session.id);

    await serviceClient
      .from("client_profiles")
      .upsert({
        client_id: tenant.clientId,
        business_name: tenant.clientName,
        business_description: pickString(aiTurn.updates?.business_description, nextContext.business_description),
        services_summary: pickString(aiTurn.updates?.services_summary, nextContext.services_summary),
        ideal_customer: pickString(aiTurn.updates?.ideal_customer, nextContext.ideal_customer),
        service_area: pickString(aiTurn.updates?.service_area, nextContext.service_area),
        limitations: pickString(aiTurn.updates?.limitations, nextContext.limitations),
        offers_summary: pickString(aiTurn.updates?.offers_summary, nextContext.offers_summary),
        onboarding_status: aiTurn.onboarding_complete ? "completed" : "in_progress",
        onboarding_summary: aiTurn.summary ?? null,
      }, { onConflict: "client_id" });

    await serviceClient
      .from("ai_behavior_config")
      .upsert({
        client_id: tenant.clientId,
        tone: pickString(aiTurn.updates?.tone) ?? "friendly",
        is_enabled: aiTurn.onboarding_complete,
      }, { onConflict: "client_id" });

    if (Array.isArray(aiTurn.pricing_items) && aiTurn.pricing_items.length) {
      await serviceClient.from("pricing_models").delete().eq("client_id", tenant.clientId);
      await serviceClient.from("pricing_models").insert(
        aiTurn.pricing_items.map((item) => ({
          client_id: tenant.clientId,
          service_name: item.service_name,
          service_code: item.service_code,
          package_name: item.package_name,
          currency: item.currency ?? "USD",
          price_from: item.price_from,
          price_to: item.price_to,
          unit_label: item.unit_label,
          description: item.description,
          pricing_notes: item.pricing_notes,
        }))
      );
    }

    if (Array.isArray(aiTurn.rules) && aiTurn.rules.length) {
      await serviceClient.from("business_rules").delete().eq("client_id", tenant.clientId);
      await serviceClient.from("business_rules").insert(
        aiTurn.rules.map((rule) => ({
          client_id: tenant.clientId,
          rule_type: rule.rule_type,
          rule_key: rule.rule_key,
          rule_label: rule.rule_label,
          rule_text: rule.rule_text,
          priority: rule.priority ?? 100,
        }))
      );
    }

    return jsonResponse(
      {
        ok: true,
        assistant_message: aiTurn.assistant_message,
        onboarding_complete: aiTurn.onboarding_complete,
        current_question_key: aiTurn.current_question_key,
      },
      200,
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onboarding error.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("unauthorized") || lower.includes("authorization")
        ? 401
        : lower.includes("do not have access")
        ? 403
        : 400;
    return jsonResponse({ ok: false, error: message }, status, request);
  }
});
