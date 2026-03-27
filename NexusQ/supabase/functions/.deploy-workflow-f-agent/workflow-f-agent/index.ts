import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.94.0";
import { buildCorsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { generateStructuredResponse } from "../_shared/openai.ts";
import { createOperatorAlert } from "../_shared/operator-alerts.ts";
import { applyPipelineStageUpdate, normalizeStage, parseNumericOrNull, type PipelineStage } from "../_shared/pipeline-update.ts";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";
import { resolveTwilioConfig, sendTwilioSms } from "../_shared/twilio.ts";

type InboundPayload = {
  from: string;
  to: string;
  body: string;
  messageSid: string | null;
  raw: Record<string, unknown>;
  isTwilioWebhook: boolean;
};

type LeadContext = {
  id: string;
  clientId: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  service: string | null;
  address: string | null;
  clientPhone: string | null;
  clientTimezone: string | null;
  clientName: string | null;
};

type ClientProfile = {
  businessName: string | null;
  businessDescription: string | null;
  servicesSummary: string | null;
  idealCustomer: string | null;
  serviceArea: string | null;
  limitations: string | null;
  offersSummary: string | null;
  onboardingStatus: string;
  onboardingSummary: string | null;
};

type PricingRow = {
  serviceCode: string | null;
  serviceName: string;
  packageName: string | null;
  currency: string;
  priceFrom: number | null;
  priceTo: number | null;
  unitLabel: string | null;
  description: string | null;
  pricingNotes: string | null;
};

type BusinessRule = {
  ruleType: string;
  ruleKey: string;
  ruleLabel: string | null;
  ruleText: string;
  priority: number;
  metadata: Record<string, unknown> | null;
};

type AiBehavior = {
  isEnabled: boolean;
  model: string;
  assistantName: string;
  tone: string;
  systemPrompt: string | null;
  fallbackMessage: string;
};

type AiSession = {
  memorySummary: string | null;
  lastDetectedIntent: string | null;
  lastStageApplied: string | null;
};

type StoredMessage = {
  direction: string | null;
  body: string | null;
  created_at: string | null;
};

type OnboardingSession = {
  id: string;
  status: string;
  currentQuestionKey: string | null;
};

type WorkflowFAiReply = {
  reply: string;
  intent: string;
  stage_candidate: "new" | "qualifying" | "quoted" | "booked" | null;
  confidence: number | null;
  price_value: number | null;
  pricing_shared: boolean;
  summary: string | null;
  reasoning: string | null;
  out_of_scope: boolean;
};

const STAGE_ORDER: PipelineStage[] = ["new", "qualifying", "quoted", "booked"];

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

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizePhone(value: unknown) {
  const raw = pickString(value);
  if (!raw) return null;

  let normalized = raw.replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  return normalized;
}

function getServiceClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function parseInboundPayload(request: Request): Promise<InboundPayload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const isTwilioWebhook = contentType.includes("application/x-www-form-urlencoded");

  if (isTwilioWebhook) {
    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    return {
      from: normalizePhone(raw.From ?? raw.from) ?? "",
      to: normalizePhone(raw.To ?? raw.to) ?? "",
      body: String(raw.Body ?? raw.body ?? raw.message ?? "").trim(),
      messageSid: pickString(raw.MessageSid, raw.SmsSid),
      raw,
      isTwilioWebhook,
    };
  }

  let raw: Record<string, unknown> = {};
  try {
    raw = asRecord(await request.json()) ?? {};
  } catch {
    raw = {};
  }

  return {
    from: normalizePhone(raw.from ?? raw.From) ?? "",
    to: normalizePhone(raw.to ?? raw.To) ?? "",
    body: String(raw.body ?? raw.Body ?? raw.message ?? "").trim(),
    messageSid: pickString(raw.message_sid, raw.MessageSid, raw.SmsSid),
    raw,
    isTwilioWebhook,
  };
}

async function findLeadContext(serviceClient: SupabaseClient, inbound: InboundPayload): Promise<LeadContext | null> {
  const { data, error } = await serviceClient
    .from("leads")
    .select("id, client_id, name, phone, status, service, address, clients!inner(name, phone, timezone)")
    .eq("phone", inbound.from)
    .eq("clients.phone", inbound.to)
    .order("last_contacted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to match inbound lead: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return null;

  const row = asRecord(rows[0]);
  const client = asRecord(row?.clients);
  const id = pickString(row?.id);
  const clientId = pickString(row?.client_id);
  if (!id || !clientId) return null;

  return {
    id,
    clientId,
    name: pickString(row?.name),
    phone: pickString(row?.phone),
    status: pickString(row?.status),
    service: pickString(row?.service),
    address: pickString(row?.address),
    clientPhone: pickString(client?.phone),
    clientTimezone: pickString(client?.timezone),
    clientName: pickString(client?.name),
  };
}

async function ensureBusinessContextRows(serviceClient: SupabaseClient, lead: LeadContext) {
  await serviceClient
    .from("client_profiles")
    .upsert(
      {
        client_id: lead.clientId,
        business_name: lead.clientName,
      },
      { onConflict: "client_id" }
    );

  await serviceClient
    .from("ai_behavior_config")
    .upsert(
      {
        client_id: lead.clientId,
      },
      { onConflict: "client_id" }
    );
}

async function loadClientProfile(serviceClient: SupabaseClient, clientId: string): Promise<ClientProfile | null> {
  const { data, error } = await serviceClient
    .from("client_profiles")
    .select("business_name, business_description, services_summary, ideal_customer, service_area, limitations, offers_summary, onboarding_status, onboarding_summary")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load client profile: ${error.message}`);
  const row = asRecord(data);
  if (!row) return null;

  return {
    businessName: pickString(row.business_name),
    businessDescription: pickString(row.business_description),
    servicesSummary: pickString(row.services_summary),
    idealCustomer: pickString(row.ideal_customer),
    serviceArea: pickString(row.service_area),
    limitations: pickString(row.limitations),
    offersSummary: pickString(row.offers_summary),
    onboardingStatus: pickString(row.onboarding_status) ?? "pending",
    onboardingSummary: pickString(row.onboarding_summary),
  };
}

async function loadBehaviorConfig(serviceClient: SupabaseClient, clientId: string): Promise<AiBehavior | null> {
  const { data, error } = await serviceClient
    .from("ai_behavior_config")
    .select("is_enabled, model, assistant_name, tone, system_prompt, fallback_message")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load AI behavior config: ${error.message}`);
  const row = asRecord(data);
  if (!row) return null;

  return {
    isEnabled: row.is_enabled === true,
    model: pickString(row.model) ?? "gpt-4.1-mini",
    assistantName: pickString(row.assistant_name) ?? "NexusQ Assistant",
    tone: pickString(row.tone) ?? "friendly",
    systemPrompt: pickString(row.system_prompt),
    fallbackMessage:
      pickString(row.fallback_message) ??
      "Thanks for reaching out. Our team will follow up shortly.",
  };
}

async function loadPricing(serviceClient: SupabaseClient, clientId: string): Promise<PricingRow[]> {
  const { data, error } = await serviceClient
    .from("pricing_models")
    .select("service_code, service_name, package_name, currency, price_from, price_to, unit_label, description, pricing_notes")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("service_name", { ascending: true });

  if (error) throw new Error(`Failed to load pricing models: ${error.message}`);

  return (Array.isArray(data) ? data : []).map((row) => {
    const record = asRecord(row) ?? {};
    return {
      serviceCode: pickString(record.service_code),
      serviceName: pickString(record.service_name) ?? "Service",
      packageName: pickString(record.package_name),
      currency: pickString(record.currency) ?? "USD",
      priceFrom: parseNumericOrNull(record.price_from),
      priceTo: parseNumericOrNull(record.price_to),
      unitLabel: pickString(record.unit_label),
      description: pickString(record.description),
      pricingNotes: pickString(record.pricing_notes),
    };
  });
}

async function loadBusinessRules(serviceClient: SupabaseClient, clientId: string): Promise<BusinessRule[]> {
  const { data, error } = await serviceClient
    .from("business_rules")
    .select("rule_type, rule_key, rule_label, rule_text, priority, metadata")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) throw new Error(`Failed to load business rules: ${error.message}`);

  return (Array.isArray(data) ? data : []).map((row) => {
    const record = asRecord(row) ?? {};
    return {
      ruleType: pickString(record.rule_type) ?? "constraint",
      ruleKey: pickString(record.rule_key) ?? "rule",
      ruleLabel: pickString(record.rule_label),
      ruleText: pickString(record.rule_text) ?? "",
      priority: pickNumber(record.priority) ?? 100,
      metadata: asRecord(record.metadata),
    };
  });
}

async function loadSession(serviceClient: SupabaseClient, leadId: string): Promise<AiSession | null> {
  const { data, error } = await serviceClient
    .from("lead_ai_sessions")
    .select("memory_summary, last_detected_intent, last_stage_applied")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load AI session: ${error.message}`);
  const row = asRecord(data);
  if (!row) return null;

  return {
    memorySummary: pickString(row.memory_summary),
    lastDetectedIntent: pickString(row.last_detected_intent),
    lastStageApplied: pickString(row.last_stage_applied),
  };
}

async function loadRecentMessages(serviceClient: SupabaseClient, clientId: string, leadId: string) {
  const { data, error } = await serviceClient
    .from("messages")
    .select("direction, body, created_at")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw new Error(`Failed to load recent messages: ${error.message}`);

  return (Array.isArray(data) ? data : [])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .reverse()
    .map((row) => ({
      direction: pickString(row.direction),
      body: pickString(row.body),
      created_at: pickString(row.created_at),
    } satisfies StoredMessage));
}

async function getPipelineSnapshot(serviceClient: SupabaseClient, leadId: string) {
  const { data, error } = await serviceClient
    .from("pipeline")
    .select("stage, value")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load pipeline snapshot: ${error.message}`);
  const row = asRecord(data);

  return {
    stage: normalizeStage(row?.stage),
    value: parseNumericOrNull(row?.value),
  };
}

async function insertMessage(serviceClient: SupabaseClient, args: {
  clientId: string;
  leadId: string;
  direction: "inbound" | "outbound";
  body: string;
  providerMessageId?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const payload =
    args.status || args.metadata
      ? {
          ...(args.metadata ?? {}),
          ...(args.status ? { message_status: args.status } : {}),
        }
      : null;

  const { error } = await serviceClient.from("messages").insert({
    client_id: args.clientId,
    lead_id: args.leadId,
    direction: args.direction,
    channel: "sms",
    provider: "twilio",
    provider_message_id: args.providerMessageId ?? null,
    body: args.body,
    payload_json: payload,
  });

  if (error) throw new Error(`Failed to insert message: ${error.message}`);
}

async function insertLeadEvent(serviceClient: SupabaseClient, args: {
  clientId: string;
  leadId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const { error } = await serviceClient.from("lead_events").insert({
    client_id: args.clientId,
    lead_id: args.leadId,
    event_type: args.eventType,
    payload_json: args.payload,
  });

  if (error) throw new Error(`Failed to insert lead event ${args.eventType}: ${error.message}`);
}

async function upsertSession(serviceClient: SupabaseClient, args: {
  clientId: string;
  leadId: string;
  phone: string | null;
  memorySummary: string | null;
  lastDetectedIntent: string | null;
  lastStageApplied: string | null;
}) {
  const { error } = await serviceClient
    .from("lead_ai_sessions")
    .upsert(
      {
        client_id: args.clientId,
        lead_id: args.leadId,
        phone: args.phone,
        memory_summary: args.memorySummary,
        last_detected_intent: args.lastDetectedIntent,
        last_stage_applied: args.lastStageApplied,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "lead_id" }
    );

  if (error) throw new Error(`Failed to upsert AI session: ${error.message}`);
}

async function getOpenOnboardingSession(serviceClient: SupabaseClient, clientId: string): Promise<OnboardingSession | null> {
  const { data, error } = await serviceClient
    .from("client_onboarding_sessions")
    .select("id, status, current_question_key")
    .eq("client_id", clientId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load onboarding session: ${error.message}`);
  const row = asRecord(data);
  if (!row) return null;

  return {
    id: pickString(row.id) ?? "",
    status: pickString(row.status) ?? "open",
    currentQuestionKey: pickString(row.current_question_key),
  };
}

async function ensureOnboardingSession(serviceClient: SupabaseClient, clientId: string) {
  const existing = await getOpenOnboardingSession(serviceClient, clientId);
  if (existing?.id) return existing;

  const { data, error } = await serviceClient
    .from("client_onboarding_sessions")
    .insert({
      client_id: clientId,
      status: "open",
      current_question_key: "business_description",
      transcript: [
        {
          role: "assistant",
          message: "What does your business do and what services or products do you sell?",
          at: new Date().toISOString(),
        },
      ],
    })
    .select("id, status, current_question_key")
    .maybeSingle();

  if (error) throw new Error(`Failed to create onboarding session: ${error.message}`);
  const row = asRecord(data);
  return {
    id: pickString(row?.id) ?? "",
    status: pickString(row?.status) ?? "open",
    currentQuestionKey: pickString(row?.current_question_key),
  } satisfies OnboardingSession;
}

function businessContextComplete(profile: ClientProfile | null, pricing: PricingRow[], behavior: AiBehavior | null) {
  return Boolean(
    profile &&
      profile.onboardingStatus === "completed" &&
      profile.businessDescription &&
      (profile.servicesSummary || pricing.length > 0) &&
      behavior &&
      behavior.isEnabled
  );
}

async function triggerOnboardingFlow(serviceClient: SupabaseClient, lead: LeadContext) {
  const session = await ensureOnboardingSession(serviceClient, lead.clientId);

  await createOperatorAlert({
    serviceClient,
    clientId: lead.clientId,
    type: "ai_onboarding_required",
    title: "AI onboarding needed",
    body: "Workflow F needs business context before it can safely negotiate with leads. Complete the AI onboarding flow for this workspace.",
    severity: "high",
    leadId: lead.id,
    linkPath: "/settings",
    source: "workflow-f-agent",
    metadata: {
      workflow: "F",
      onboarding_session_id: session.id,
      client_id: lead.clientId,
    },
  });

  return session;
}

function buildPricingContext(pricing: PricingRow[], service: string | null) {
  if (!pricing.length) return [];
  const normalizedService = String(service ?? "").toLowerCase().trim();

  const filtered = pricing.filter((row) => {
    if (!normalizedService) return true;
    return (
      String(row.serviceCode ?? "").toLowerCase() === normalizedService ||
      row.serviceName.toLowerCase().includes(normalizedService)
    );
  });

  return (filtered.length ? filtered : pricing).map((row) => ({
    service_code: row.serviceCode,
    service_name: row.serviceName,
    package_name: row.packageName,
    currency: row.currency,
    price_from: row.priceFrom,
    price_to: row.priceTo,
    unit_label: row.unitLabel,
    description: row.description,
    pricing_notes: row.pricingNotes,
  }));
}

async function generateAiReply(args: {
  behavior: AiBehavior;
  lead: LeadContext;
  profile: ClientProfile;
  pricing: PricingRow[];
  rules: BusinessRule[];
  pipeline: { stage: PipelineStage; value: number | null };
  session: AiSession | null;
  recentMessages: StoredMessage[];
  inboundBody: string;
}) {
  const result = await generateStructuredResponse<WorkflowFAiReply>({
    model: args.behavior.model,
    schemaName: "workflow_f_agent_reply",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reply: { type: "string" },
        intent: { type: "string" },
        stage_candidate: { type: ["string", "null"], enum: ["new", "qualifying", "quoted", "booked", null] },
        confidence: { type: ["number", "null"] },
        price_value: { type: ["number", "null"] },
        pricing_shared: { type: "boolean" },
        summary: { type: ["string", "null"] },
        reasoning: { type: ["string", "null"] },
        out_of_scope: { type: "boolean" },
      },
      required: ["reply", "intent", "stage_candidate", "confidence", "price_value", "pricing_shared", "summary", "reasoning", "out_of_scope"],
    },
    systemText: [
      `You are ${args.behavior.assistantName}, a production SMS sales assistant for a home-service business.`,
      `Tone: ${args.behavior.tone}.`,
      "Be concise, natural, warm, and human in SMS.",
      "You must stay strictly within the supplied business context, pricing, services, offers, and rules.",
      "Never invent discounts, deals, timelines, coverage areas, inventory, capacity, or promises.",
      "If a lead asks for something outside the allowed business scope, politely redirect and set out_of_scope to true.",
      "Move stage to qualifying when real interest is shown.",
      "Move stage to quoted when pricing or estimate discussion is materially happening.",
      "Move stage to booked only when there is clear confirmation or commitment.",
      "If no stage movement is justified, use null.",
      "Only set pricing_shared to true if you actually referenced allowed pricing or estimate information from the provided pricing context.",
      args.behavior.systemPrompt ?? "",
    ].filter(Boolean).join("\n"),
    userInput: {
      lead: {
        lead_id: args.lead.id,
        name: args.lead.name,
        phone: args.lead.phone,
        service: args.lead.service,
        address: args.lead.address,
        current_stage: args.pipeline.stage,
        current_value: args.pipeline.value,
      },
      business_profile: {
        business_name: args.profile.businessName,
        business_description: args.profile.businessDescription,
        services_summary: args.profile.servicesSummary,
        ideal_customer: args.profile.idealCustomer,
        service_area: args.profile.serviceArea,
        limitations: args.profile.limitations,
        offers_summary: args.profile.offersSummary,
        onboarding_summary: args.profile.onboardingSummary,
      },
      pricing: buildPricingContext(args.pricing, args.lead.service),
      business_rules: args.rules.map((rule) => ({
        type: rule.ruleType,
        key: rule.ruleKey,
        label: rule.ruleLabel,
        text: rule.ruleText,
        priority: rule.priority,
        metadata: rule.metadata,
      })),
      session: {
        memory_summary: args.session?.memorySummary,
        last_detected_intent: args.session?.lastDetectedIntent,
        last_stage_applied: args.session?.lastStageApplied,
      },
      recent_messages: args.recentMessages,
      inbound_message: args.inboundBody,
    },
    maxOutputTokens: 400,
  });

  return {
    ...result,
    stage_candidate: result.stage_candidate ? normalizeStage(result.stage_candidate) : null,
    confidence: parseNumericOrNull(result.confidence),
    price_value: parseNumericOrNull(result.price_value),
  };
}

function shouldAdvanceStage(currentStage: PipelineStage, candidateStage: PipelineStage | null) {
  if (!candidateStage) return false;
  return STAGE_ORDER.indexOf(candidateStage) > STAGE_ORDER.indexOf(currentStage);
}

async function sendFallbackReply(args: {
  serviceClient: SupabaseClient;
  lead: LeadContext | null;
  inbound: InboundPayload;
  message: string;
  reason: string;
}) {
  const twilio = resolveTwilioConfig();
  if (!twilio || !args.inbound.from || !args.inbound.to) return null;

  const sms = await sendTwilioSms({
    accountSid: twilio.accountSid,
    authToken: twilio.authToken,
    from: args.inbound.to,
    to: args.inbound.from,
    body: args.message,
  });

  if (args.lead) {
    await insertMessage(args.serviceClient, {
      clientId: args.lead.clientId,
      leadId: args.lead.id,
      direction: "outbound",
      body: args.message,
      providerMessageId: pickString(sms.sid),
      status: "sent",
      metadata: {
        source: "workflow-f-agent-fallback",
        reason: args.reason,
      },
    });

    await insertLeadEvent(args.serviceClient, {
      clientId: args.lead.clientId,
      leadId: args.lead.id,
      eventType: "ai_message_sent",
      payload: {
        source: "workflow-f-agent",
        fallback: true,
        reason: args.reason,
        body: args.message,
      },
    });
  }

  return sms;
}

function twilioWebhookResponse(request: Request) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: {
      ...buildCorsHeaders(request),
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsResponse(request);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, request);
  }

  const inbound = await parseInboundPayload(request);
  const serviceClient = getServiceClient();

  try {
    if (!inbound.from || !inbound.to || !inbound.body) {
      return jsonResponse({ ok: false, error: "from, to, and body are required." }, 400, request);
    }

    const lead = await findLeadContext(serviceClient, inbound);
    if (!lead) {
      await sendFallbackReply({
        serviceClient,
        lead: null,
        inbound,
        message: "Thanks for your message. Our team will follow up shortly.",
        reason: "lead_not_matched",
      });
      return inbound.isTwilioWebhook
        ? twilioWebhookResponse(request)
        : jsonResponse({ ok: true, matched: false }, 200, request);
    }

    await ensureBusinessContextRows(serviceClient, lead);

    await insertMessage(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      direction: "inbound",
      body: inbound.body,
      providerMessageId: inbound.messageSid,
      status: "received",
      metadata: {
        source: "workflow-f-agent",
        from: inbound.from,
        to: inbound.to,
        raw: inbound.raw,
      },
    });

    await insertLeadEvent(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      eventType: "reply_received",
      payload: {
        source: "workflow-f-agent",
        from: inbound.from,
        to: inbound.to,
        message: inbound.body,
        provider_message_id: inbound.messageSid,
      },
    });

    const [profile, behavior, pricing, rules, session, recentMessages, pipeline] = await Promise.all([
      loadClientProfile(serviceClient, lead.clientId),
      loadBehaviorConfig(serviceClient, lead.clientId),
      loadPricing(serviceClient, lead.clientId),
      loadBusinessRules(serviceClient, lead.clientId),
      loadSession(serviceClient, lead.id),
      loadRecentMessages(serviceClient, lead.clientId, lead.id),
      getPipelineSnapshot(serviceClient, lead.id),
    ]);

    const fallbackMessage =
      behavior?.fallbackMessage ??
      "Thanks for your message. Our team will follow up shortly.";

    if (!profile || !behavior || !businessContextComplete(profile, pricing, behavior)) {
      const onboardingSession = await triggerOnboardingFlow(serviceClient, lead);
      await insertLeadEvent(serviceClient, {
        clientId: lead.clientId,
        leadId: lead.id,
        eventType: "onboarding_required",
        payload: {
          source: "workflow-f-agent",
          onboarding_session_id: onboardingSession.id,
        },
      });

      await sendFallbackReply({
        serviceClient,
        lead,
        inbound,
        message: fallbackMessage,
        reason: "business_context_incomplete",
      });

      return inbound.isTwilioWebhook
        ? twilioWebhookResponse(request)
        : jsonResponse({ ok: true, onboarding_required: true, fallback: true }, 200, request);
    }

    let aiReply: Awaited<ReturnType<typeof generateAiReply>>;
    try {
      aiReply = await generateAiReply({
        behavior,
        lead,
        profile,
        pricing,
        rules,
        pipeline,
        session,
        recentMessages,
        inboundBody: inbound.body,
      });
    } catch (aiError) {
      const reason = aiError instanceof Error ? aiError.message : "AI request failed.";
      await sendFallbackReply({
        serviceClient,
        lead,
        inbound,
        message: fallbackMessage,
        reason,
      });
      return inbound.isTwilioWebhook
        ? twilioWebhookResponse(request)
        : jsonResponse({ ok: true, fallback: true, reason }, 200, request);
    }

    const twilio = resolveTwilioConfig();
    if (!twilio || !lead.clientPhone) {
      throw new Error("Twilio credentials or client sender phone are not configured.");
    }

    const outbound = await sendTwilioSms({
      accountSid: twilio.accountSid,
      authToken: twilio.authToken,
      from: lead.clientPhone,
      to: inbound.from,
      body: aiReply.reply,
    });

    await insertMessage(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      direction: "outbound",
      body: aiReply.reply,
      providerMessageId: pickString(outbound.sid),
      status: "sent",
      metadata: {
        source: "workflow-f-agent",
        intent: aiReply.intent,
        stage_candidate: aiReply.stage_candidate,
        confidence: aiReply.confidence,
        price_value: aiReply.price_value,
        pricing_shared: aiReply.pricing_shared,
        out_of_scope: aiReply.out_of_scope,
      },
    });

    await insertLeadEvent(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      eventType: "ai_message_sent",
      payload: {
        source: "workflow-f-agent",
        body: aiReply.reply,
        provider_message_id: pickString(outbound.sid),
        intent: aiReply.intent,
        stage_candidate: aiReply.stage_candidate,
        confidence: aiReply.confidence,
        out_of_scope: aiReply.out_of_scope,
      },
    });

    await insertLeadEvent(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      eventType: "intent_detected",
      payload: {
        source: "workflow-f-agent",
        intent: aiReply.intent,
        stage_candidate: aiReply.stage_candidate,
        confidence: aiReply.confidence,
        reasoning: aiReply.reasoning,
      },
    });

    if (aiReply.pricing_shared || aiReply.price_value != null || aiReply.stage_candidate === "quoted") {
      await insertLeadEvent(serviceClient, {
        clientId: lead.clientId,
        leadId: lead.id,
        eventType: "pricing_shared",
        payload: {
          source: "workflow-f-agent",
          price_value: aiReply.price_value,
          confidence: aiReply.confidence,
          pricing_shared: aiReply.pricing_shared,
        },
      });
    }

    let stageUpdate: Awaited<ReturnType<typeof applyPipelineStageUpdate>> | null = null;
    if (shouldAdvanceStage(pipeline.stage, aiReply.stage_candidate)) {
      stageUpdate = await applyPipelineStageUpdate({
        serviceClient,
        clientId: lead.clientId,
        leadId: lead.id,
        stageInput: aiReply.stage_candidate,
        valueInput: aiReply.price_value ?? pipeline.value,
        source: "workflow-f-agent",
      });

      await insertLeadEvent(serviceClient, {
        clientId: lead.clientId,
        leadId: lead.id,
        eventType: "stage_updated",
        payload: {
          source: "workflow-f-agent",
          previous_stage: pipeline.stage,
          updated_stage: stageUpdate.stage,
          confidence: aiReply.confidence,
          intent: aiReply.intent,
          price_value: stageUpdate.value,
        },
      });
    }

    await upsertSession(serviceClient, {
      clientId: lead.clientId,
      leadId: lead.id,
      phone: lead.phone,
      memorySummary: aiReply.summary,
      lastDetectedIntent: aiReply.intent,
      lastStageApplied: stageUpdate?.stage ?? session?.lastStageApplied ?? null,
    });

    return inbound.isTwilioWebhook
      ? twilioWebhookResponse(request)
      : jsonResponse(
          {
            ok: true,
            lead_id: lead.id,
            client_id: lead.clientId,
            ai_reply: aiReply.reply,
            intent: aiReply.intent,
            stage_update: stageUpdate,
          },
          200,
          request
        );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected AI SMS agent failure.";
    try {
      await sendFallbackReply({
        serviceClient,
        lead: null,
        inbound,
        message: "Thanks for your message. Our team will follow up shortly.",
        reason,
      });
    } catch {
      // Ignore fallback errors during terminal failure.
    }

    return inbound.isTwilioWebhook
      ? twilioWebhookResponse(request)
      : jsonResponse({ ok: false, error: reason }, 500, request);
  }
});
