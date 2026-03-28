import { createClient } from "npm:@supabase/supabase-js@2.94.0";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.94.0";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { generateStructuredResponse, resolveLlmModel } from "../_shared/openai.ts";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/supabase-env.ts";

type DashboardAiAction = "briefing" | "answer";

type DashboardAiRequest = {
  action?: DashboardAiAction;
  client_id?: string | null;
  question?: string | null;
  history?: Array<{
    role?: string | null;
    content?: string | null;
  }> | null;
};

type QuestionTurn = {
  role: "user" | "assistant";
  content: string;
};

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  timezone: string | null;
  client_key: string | null;
  status: string | null;
};

type ClientProfileRow = {
  business_name: string | null;
  business_description: string | null;
  services_summary: string | null;
  ideal_customer: string | null;
  service_area: string | null;
  limitations: string | null;
  offers_summary: string | null;
  onboarding_status: string | null;
  onboarding_summary: string | null;
};

type AiBehaviorRow = {
  is_enabled: boolean | null;
  model: string | null;
  assistant_name: string | null;
  tone: string | null;
};

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  created_at: string | null;
  last_contacted_at: string | null;
  service: string | null;
  urgency: string | null;
  address: string | null;
};

type PipelineRow = {
  lead_id: string | null;
  stage: string | null;
  value: number | null;
  probability: number | null;
  updated_at: string | null;
};

type LeadEventRow = {
  lead_id: string | null;
  event_type: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string | null;
};

type MessageRow = {
  lead_id: string | null;
  direction: string | null;
  body: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string | null;
};

type DailyKpiRow = {
  day?: string | null;
  date?: string | null;
  leads_captured?: number | null;
  leads_count?: number | null;
  quoted_count?: number | null;
  quotes_sent?: number | null;
  booked_count?: number | null;
  booked_calls?: number | null;
  responses_sent?: number | null;
  wins?: number | null;
  losses?: number | null;
  revenue?: number | null;
  avg_response_minutes?: number | null;
  conversion_rate?: number | null;
};

type AutomationHealthRow = {
  workflow_name: string | null;
  status: string | null;
  last_run_at: string | null;
  error_message: string | null;
};

type DashboardBriefing = {
  headline: string;
  summary: string;
  situation: string;
  opportunities: string[];
  risks: string[];
  recommended_actions: Array<{
    title: string;
    detail: string;
    action_path: string;
    priority: "high" | "medium" | "low";
  }>;
  suggested_questions: string[];
};

type DashboardAnswer = {
  answer: string;
  confidence: number;
  evidence: string[];
  follow_ups: string[];
  referenced_leads: string[];
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

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function getAuthClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function getServiceClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
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
  const rawText = await request.text();
  if (!rawText.trim()) return {} as DashboardAiRequest;

  try {
    return JSON.parse(rawText) as DashboardAiRequest;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function normalizeStage(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "new" || normalized === "qualifying" || normalized === "quoted" || normalized === "booked") {
    return normalized;
  }
  if (normalized.includes("quote") || normalized.includes("sent")) return "quoted";
  if (normalized.includes("book") || normalized.includes("won") || normalized.includes("deal")) return "booked";
  if (normalized.includes("qualif") || normalized.includes("inspect") || normalized.includes("schedule")) {
    return "qualifying";
  }
  return "new";
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "new").toLowerCase().trim() || "new";
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function minutesBetween(a: string | null | undefined, b: string | null | undefined) {
  const from = parseTimestamp(a);
  const to = parseTimestamp(b);
  if (from == null || to == null || to < from) return null;
  return Math.round((to - from) / 60_000);
}

function compactText(value: string | null | undefined, maxLength = 240) {
  const text = pickString(value) ?? "";
  if (!text) return null;
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}

function getMessageBody(message: MessageRow) {
  const payload = asRecord(message.payload_json);
  const twilio = asRecord(payload?.twilio);
  return compactText(
    pickString(
      message.body,
      twilio?.body,
      payload?.body,
      payload?.message,
      payload?.text
    ),
    220
  );
}

function getMessageStatus(message: MessageRow) {
  const payload = asRecord(message.payload_json);
  const twilio = asRecord(payload?.twilio);
  return pickString(
    twilio?.status,
    payload?.status,
    payload?.message_status
  );
}

function getKpiDay(row: DailyKpiRow) {
  return pickString(row.day, row.date);
}

function getKpiLeadsCaptured(row: DailyKpiRow) {
  return pickNumber(row.leads_captured, row.leads_count);
}

function getKpiQuotedCount(row: DailyKpiRow) {
  return pickNumber(row.quoted_count, row.quotes_sent);
}

function getKpiBookedCount(row: DailyKpiRow) {
  return pickNumber(row.booked_count, row.booked_calls, row.wins);
}

function getKpiConversionRate(row: DailyKpiRow) {
  const explicit = pickNumber(row.conversion_rate);
  if (explicit != null) return explicit;
  const leads = getKpiLeadsCaptured(row);
  const booked = getKpiBookedCount(row);
  if (leads == null || booked == null || leads <= 0) return null;
  return Math.round((booked / leads) * 100);
}

function isSchemaMismatchError(message: string | null | undefined) {
  const lower = String(message ?? "").toLowerCase();
  return lower.includes("does not exist") || lower.includes("could not find") || lower.includes("column");
}

async function loadOptionalSingle<T>(
  query: PromiseLike<{ data: T | null; error: { message?: string | null } | null }>
) {
  const result = await query;
  if (result.error && isSchemaMismatchError(result.error.message)) {
    return { data: null as T | null, error: null };
  }
  return result;
}

async function loadOptionalList<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string | null } | null }>
) {
  const result = await query;
  if (result.error && isSchemaMismatchError(result.error.message)) {
    return { data: [] as T[], error: null };
  }
  return {
    data: Array.isArray(result.data) ? result.data : [],
    error: result.error,
  };
}

function sanitizeHistory(value: DashboardAiRequest["history"]): QuestionTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const role = pickString(item?.role)?.toLowerCase();
      const content = pickString(item?.content);
      if (!content || (role !== "user" && role !== "assistant")) return null;
      return { role, content } as QuestionTurn;
    })
    .filter((item): item is QuestionTurn => Boolean(item))
    .slice(-6);
}

async function requireWorkspaceAccess(serviceClient: SupabaseClient, userId: string, clientId: string) {
  const { data, error } = await serviceClient
    .from("user_access")
    .select("role, is_active")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify workspace access: ${error.message}`);
  if (!data) throw new Error("Forbidden request. Your account does not have permission for this workspace.");

  return {
    role: pickString((data as Record<string, unknown>).role) ?? "viewer",
  };
}

async function loadDailyKpis(serviceClient: SupabaseClient, clientId: string) {
  const latestSchema = await serviceClient
    .from("daily_kpis")
    .select(
      "day, leads_captured, quoted_count, booked_count, revenue, avg_response_minutes, conversion_rate"
    )
    .eq("client_id", clientId)
    .order("day", { ascending: false })
    .limit(14);

  if (!latestSchema.error) {
    return {
      data: (Array.isArray(latestSchema.data) ? latestSchema.data : []) as DailyKpiRow[],
      error: null,
    };
  }

  const intermediateSchema = await serviceClient
    .from("daily_kpis")
    .select("date, leads_count, quotes_sent, booked_calls, revenue, avg_response_minutes, conversion_rate")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(14);

  if (!intermediateSchema.error) {
    return {
      data: (Array.isArray(intermediateSchema.data) ? intermediateSchema.data : []) as DailyKpiRow[],
      error: null,
    };
  }

  const legacySchema = await serviceClient
    .from("daily_kpis")
    .select("date, leads_count, responses_sent, booked_calls, quotes_sent, wins, losses")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(14);

  return {
    data: (Array.isArray(legacySchema.data) ? legacySchema.data : []) as DailyKpiRow[],
    error: legacySchema.error,
  };
}

async function loadWorkspaceContext(serviceClient: SupabaseClient, clientId: string) {
  const dailyKpisPromise = loadDailyKpis(serviceClient, clientId);
  const [
    { data: clientData, error: clientError },
    { data: profileData, error: profileError },
    { data: behaviorData, error: behaviorError },
    { data: leadsData, error: leadsError },
    { data: pipelineData, error: pipelineError },
    { data: eventsData, error: eventsError },
    { data: messagesData, error: messagesError },
    { data: kpisData, error: kpisError },
    { data: healthData, error: healthError },
  ] = await Promise.all([
    serviceClient
      .from("clients")
      .select("id, name, phone, timezone, client_key, status")
      .eq("id", clientId)
      .maybeSingle<ClientRow>(),
    loadOptionalSingle(
      serviceClient
      .from("client_profiles")
      .select(
        "business_name, business_description, services_summary, ideal_customer, service_area, limitations, offers_summary, onboarding_status, onboarding_summary"
      )
      .eq("client_id", clientId)
      .maybeSingle<ClientProfileRow>()
    ),
    loadOptionalSingle(
      serviceClient
      .from("ai_behavior_config")
      .select("is_enabled, model, assistant_name, tone")
      .eq("client_id", clientId)
      .maybeSingle<AiBehaviorRow>()
    ),
    serviceClient
      .from("leads")
      .select("id, name, phone, email, source, status, score, created_at, last_contacted_at, service, urgency, address")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(150),
    serviceClient
      .from("pipeline")
      .select("lead_id, stage, value, probability, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(500),
    serviceClient
      .from("lead_events")
      .select("lead_id, event_type, payload_json, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(80),
    serviceClient
      .from("messages")
      .select("lead_id, direction, body, payload_json, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(80),
    dailyKpisPromise,
    loadOptionalList(
      serviceClient
      .from("automation_health")
      .select("workflow_name, status, last_run_at, error_message")
      .eq("client_id", clientId)
      .order("last_run_at", { ascending: false, nullsFirst: false })
      .limit(20)
    ),
  ]);

  const firstError =
    clientError ??
    profileError ??
    behaviorError ??
    leadsError ??
    pipelineError ??
    eventsError ??
    messagesError ??
    kpisError ??
    healthError;
  if (firstError) throw new Error(`Failed to load dashboard AI context: ${firstError.message}`);

  const client = clientData ?? null;
  if (!client) throw new Error("Workspace not found.");

  const profile = profileData ?? null;
  const behavior = behaviorData ?? null;
  const leads = (Array.isArray(leadsData) ? leadsData : []) as LeadRow[];
  const pipeline = (Array.isArray(pipelineData) ? pipelineData : []) as PipelineRow[];
  const events = (Array.isArray(eventsData) ? eventsData : []) as LeadEventRow[];
  const messages = (Array.isArray(messagesData) ? messagesData : []) as MessageRow[];
  const kpis = (Array.isArray(kpisData) ? kpisData : []) as DailyKpiRow[];
  const health = (Array.isArray(healthData) ? healthData : []) as AutomationHealthRow[];

  const pipelineByLead = new Map<string, PipelineRow>();
  for (const row of pipeline) {
    const leadId = pickString(row.lead_id);
    if (!leadId || pipelineByLead.has(leadId)) continue;
    pipelineByLead.set(leadId, row);
  }

  const leadNameById = new Map<string, string>();
  for (const lead of leads) {
    leadNameById.set(lead.id, pickString(lead.name, lead.phone, lead.email) ?? "Unknown");
  }

  const totals = {
    leads: leads.length,
    new: 0,
    qualifying: 0,
    quoted: 0,
    booked: 0,
    staleQuoted: 0,
    uncontactedNew: 0,
    pipelineValue: 0,
    bookedValue: 0,
    quotedValue: 0,
    averageResponseMinutes: null as number | null,
  };

  const responseMinutes: number[] = [];
  const now = Date.now();
  const recentBookedDeals: Array<Record<string, unknown>> = [];
  const recentQuotedDeals: Array<Record<string, unknown>> = [];

  for (const lead of leads) {
    const pipelineRow = pipelineByLead.get(lead.id);
    const stage = normalizeStage(pipelineRow?.stage ?? lead.status);
    const value = pickNumber(pipelineRow?.value) ?? 0;
    const createdAt = parseTimestamp(lead.created_at);
    const ageHours = createdAt == null ? null : (now - createdAt) / 3_600_000;

    totals[stage as keyof typeof totals] += 1;
    totals.pipelineValue += value;
    if (stage === "booked") totals.bookedValue += value;
    if (stage === "quoted") totals.quotedValue += value;
    if (stage === "quoted" && ageHours != null && ageHours > 72) totals.staleQuoted += 1;
    if (stage === "new" && !lead.last_contacted_at && ageHours != null && ageHours > 4) totals.uncontactedNew += 1;

    const response = minutesBetween(lead.created_at, lead.last_contacted_at);
    if (response != null) responseMinutes.push(response);

    const summary = {
      lead_name: leadNameById.get(lead.id) ?? "Unknown",
      service: pickString(lead.service) ?? "Unknown service",
      stage,
      value,
      updated_at: pickString(pipelineRow?.updated_at, lead.last_contacted_at, lead.created_at),
    };
    if (stage === "booked" && recentBookedDeals.length < 6) recentBookedDeals.push(summary);
    if (stage === "quoted" && recentQuotedDeals.length < 6) recentQuotedDeals.push(summary);
  }

  totals.averageResponseMinutes = responseMinutes.length
    ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length)
    : pickNumber(kpis[0]?.avg_response_minutes);

  const recentConversations = (() => {
    const grouped = new Map<
      string,
      {
        lead_name: string;
        lead_stage: string;
        service: string | null;
        last_message_at: string | null;
        messages: Array<Record<string, unknown>>;
      }
    >();

    for (const message of messages) {
      const leadId = pickString(message.lead_id);
      if (!leadId) continue;
      const lead = leads.find((item) => item.id === leadId);
      const existing = grouped.get(leadId) ?? {
        lead_name: leadNameById.get(leadId) ?? "Unknown",
        lead_stage: normalizeStage(pipelineByLead.get(leadId)?.stage ?? lead?.status),
        service: pickString(lead?.service),
        last_message_at: pickString(message.created_at),
        messages: [],
      };

      if (existing.messages.length < 4) {
        existing.messages.push({
          direction: pickString(message.direction) ?? "unknown",
          body: getMessageBody(message),
          status: getMessageStatus(message),
          created_at: pickString(message.created_at),
        });
      }
      existing.last_message_at = existing.last_message_at ?? pickString(message.created_at);
      grouped.set(leadId, existing);
      if (grouped.size >= 8) {
        continue;
      }
    }

    return Array.from(grouped.values()).slice(0, 8);
  })();

  const recentEvents = events.slice(0, 12).map((event) => ({
    lead_name: event.lead_id ? leadNameById.get(event.lead_id) ?? "Unknown" : "Workspace",
    event_type: pickString(event.event_type) ?? "unknown",
    created_at: pickString(event.created_at),
    detail:
      compactText(
        pickString(
          asRecord(event.payload_json)?.body,
          asRecord(event.payload_json)?.message,
          asRecord(event.payload_json)?.reason,
          asRecord(event.payload_json)?.updated_stage,
          asRecord(event.payload_json)?.intent
        ),
        180
      ) ?? null,
  }));

  const healthSnapshot = health.slice(0, 8).map((row) => ({
    workflow_name: pickString(row.workflow_name) ?? "Unknown",
    status: pickString(row.status) ?? "unknown",
    last_run_at: pickString(row.last_run_at),
    error: compactText(row.error_message, 140),
  }));

  const recentKpis = kpis.slice(0, 7).map((row) => ({
    day: getKpiDay(row),
    leads_captured: getKpiLeadsCaptured(row),
    quoted_count: getKpiQuotedCount(row),
    booked_count: getKpiBookedCount(row),
    revenue: pickNumber(row.revenue),
    avg_response_minutes: pickNumber(row.avg_response_minutes),
    conversion_rate: getKpiConversionRate(row),
  }));

  return {
    model: resolveLlmModel(behavior?.model),
    workspace: {
      client_id: client.id,
      role_context: {
        ai_enabled: behavior?.is_enabled === true,
        assistant_name: pickString(behavior?.assistant_name) ?? "NexusQ Analyst",
        assistant_tone: pickString(behavior?.tone) ?? "operator-focused",
      },
      name: pickString(profile?.business_name, client.name) ?? "Workspace",
      timezone: pickString(client.timezone) ?? "UTC",
      sender_phone: pickString(client.phone),
      client_key: pickString(client.client_key),
      onboarding_status: pickString(profile?.onboarding_status) ?? "pending",
      description: compactText(profile?.business_description, 280),
      services_summary: compactText(profile?.services_summary, 280),
      service_area: pickString(profile?.service_area),
      offers_summary: compactText(profile?.offers_summary, 220),
      ideal_customer: compactText(profile?.ideal_customer, 220),
      limitations: compactText(profile?.limitations, 220),
      onboarding_summary: compactText(profile?.onboarding_summary, 220),
    },
    overview: {
      total_leads: totals.leads,
      stage_counts: {
        new: totals.new,
        qualifying: totals.qualifying,
        quoted: totals.quoted,
        booked: totals.booked,
      },
      stale_quoted_leads: totals.staleQuoted,
      uncontacted_new_leads: totals.uncontactedNew,
      pipeline_value: Math.round(totals.pipelineValue),
      booked_value: Math.round(totals.bookedValue),
      quoted_value: Math.round(totals.quotedValue),
      average_response_minutes: totals.averageResponseMinutes,
      latest_revenue: pickNumber(kpis[0]?.revenue),
      latest_conversion_rate: getKpiConversionRate(kpis[0] ?? {}),
    },
    recent_booked_deals: recentBookedDeals,
    recent_quoted_deals: recentQuotedDeals,
    recent_conversations: recentConversations,
    recent_events: recentEvents,
    daily_kpis: recentKpis,
    health_snapshot: healthSnapshot,
  };
}

const briefingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "situation",
    "opportunities",
    "risks",
    "recommended_actions",
    "suggested_questions",
  ],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    situation: { type: "string" },
    opportunities: {
      type: "array",
      items: { type: "string" },
    },
    risks: {
      type: "array",
      items: { type: "string" },
    },
    recommended_actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "action_path", "priority"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          action_path: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    suggested_questions: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "confidence", "evidence", "follow_ups", "referenced_leads"],
  properties: {
    answer: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    evidence: {
      type: "array",
      items: { type: "string" },
    },
    follow_ups: {
      type: "array",
      items: { type: "string" },
    },
    referenced_leads: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

function buildBriefingPrompt(accessRole: string) {
  return [
    "You are NexusQ's dashboard operations analyst for an active workspace.",
    "Use only the provided workspace data. Do not invent missing facts.",
    "Focus on what is happening operationally across leads, conversations, quotes, booked deals, response speed, and automation health.",
    "Mention trends, risks, and next moves in operator-friendly language.",
    "Recommended action paths must be one of: /pipeline, /health, /intake, /notifications, /settings, /.",
    `The signed-in user has workspace role: ${accessRole}.`,
  ].join("\n");
}

function buildAnswerPrompt(accessRole: string) {
  return [
    "You are NexusQ's workspace analyst answering questions about the active system state.",
    "Answer only from the provided workspace data and prior thread context.",
    "If the data does not contain enough evidence, say that clearly instead of guessing.",
    "You may answer questions about leads, conversations, follow-ups, quotes, booked deals, automation health, and recent system activity.",
    "Keep the answer clear and grounded in evidence.",
    `The signed-in user has workspace role: ${accessRole}.`,
  ].join("\n");
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
    const action = body.action ?? "briefing";
    if (action !== "briefing" && action !== "answer") {
      return jsonResponse({ ok: false, error: "action must be briefing or answer." }, 400, request);
    }

    const clientId = pickString(body.client_id);
    if (!clientId) {
      return jsonResponse({ ok: false, error: "client_id is required." }, 400, request);
    }

    const serviceClient = getServiceClient();
    const access = await requireWorkspaceAccess(serviceClient, user.id, clientId);
    const context = await loadWorkspaceContext(serviceClient, clientId);

    if (action === "briefing") {
      const briefing = await generateStructuredResponse<DashboardBriefing>({
        model: context.model,
        systemText: buildBriefingPrompt(access.role),
        userInput: {
          generated_at: new Date().toISOString(),
          workspace_context: context,
        },
        schemaName: "dashboard_briefing",
        schema: briefingSchema,
        maxOutputTokens: 900,
      });

      return jsonResponse(
        {
          ok: true,
          action,
          briefing,
          generated_at: new Date().toISOString(),
        },
        200,
        request
      );
    }

    const question = pickString(body.question);
    if (!question) {
      return jsonResponse({ ok: false, error: "question is required for answer action." }, 400, request);
    }

    const answer = await generateStructuredResponse<DashboardAnswer>({
      model: context.model,
      systemText: buildAnswerPrompt(access.role),
      userInput: {
        generated_at: new Date().toISOString(),
        operator_question: question,
        prior_thread: sanitizeHistory(body.history),
        workspace_context: context,
      },
      schemaName: "dashboard_question_answer",
      schema: answerSchema,
      maxOutputTokens: 900,
    });

    return jsonResponse(
      {
        ok: true,
        action,
        answer,
        generated_at: new Date().toISOString(),
      },
      200,
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("forbidden") ? 403 : lower.includes("unauthorized") || lower.includes("authorization") ? 401 : 400;
    return jsonResponse({ ok: false, error: message }, status, request);
  }
});
