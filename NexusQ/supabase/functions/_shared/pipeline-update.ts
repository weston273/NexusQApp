import type { SupabaseClient } from "npm:@supabase/supabase-js@2.94.0";
import { createOperatorAlert } from "./operator-alerts.ts";

export type PipelineStage = "new" | "qualifying" | "quoted" | "booked";

type PersistenceSnapshot = {
  verified: boolean;
  pipeline_stage: string | null;
  pipeline_value: number | null;
  lead_status: string | null;
};

type LeadSnapshot = {
  id: string;
  clientId: string;
  name: string | null;
  service: string | null;
  address: string | null;
  source: string | null;
  status: string | null;
};

type DirectPersistenceResult = {
  warnings: string[];
};

type PipelineUpdateResult = {
  ok: true;
  lead_id: string;
  client_id: string;
  stage: PipelineStage;
  value: number | null;
  persisted: PersistenceSnapshot;
  upstream_payload: Record<string, unknown>;
  fallback_applied: boolean;
  fallback_warnings: string[];
  operator_alert: Awaited<ReturnType<typeof createOperatorAlert>> | null;
  operator_alert_error: string | null;
  warning: string | null;
};

const DEFAULT_WORKFLOW_D_URL = "https://n8n-k7j4.onrender.com/webhook/pipeline-update";

function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeWorkflowDUrl(candidate: string) {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return [];

    const urls: string[] = [parsed.toString()];
    const canonical = new URL(parsed.toString());
    canonical.pathname = "/webhook/pipeline-update";

    const canonicalUrl = canonical.toString();
    if (!urls.includes(canonicalUrl)) {
      urls.push(canonicalUrl);
    }

    return urls;
  } catch {
    return [];
  }
}

function resolveWorkflowDUrls() {
  const candidates = [
    getOptionalEnv("WORKFLOW_D_URL"),
    getOptionalEnv("WORKFLOW_D_WEBHOOK_URL"),
    getOptionalEnv("WORKFLOW_D_FALLBACK_URL"),
    DEFAULT_WORKFLOW_D_URL,
  ];

  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const resolved of normalizeWorkflowDUrl(candidate)) {
      if (!urls.includes(resolved)) {
        urls.push(resolved);
      }
    }
  }

  if (!urls.length) {
    throw new Error("No valid Workflow D URL configured.");
  }

  return urls;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeStage(rawValue: unknown): PipelineStage {
  const value = String(rawValue ?? "").toLowerCase().trim();
  if (value === "new" || value.includes("new")) return "new";
  if (value === "qualifying" || value.includes("qualif") || value.includes("inspect")) return "qualifying";
  if (value === "quoted" || value.includes("quote")) return "quoted";
  if (value === "booked" || value.includes("book") || value.includes("won") || value.includes("deal")) return "booked";
  return "new";
}

export function parseNumericOrNull(rawValue: unknown) {
  if (rawValue == null || rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function probabilityForStage(stage: PipelineStage) {
  if (stage === "qualifying") return 35;
  if (stage === "quoted") return 60;
  if (stage === "booked") return 100;
  return 10;
}

function eventTypeForStage(stage: PipelineStage) {
  if (stage === "quoted") return "quote_sent";
  if (stage === "booked") return "booking_created";
  return "status_changed";
}

function valuesMatch(actualValue: number | null, expectedValue: number | null) {
  if (expectedValue == null) return true;
  if (actualValue == null) return false;
  return Math.abs(actualValue - expectedValue) < 0.0001;
}

function severityForStage(stage: PipelineStage) {
  if (stage === "booked") return "high" as const;
  if (stage === "quoted") return "medium" as const;
  return "low" as const;
}

function titleForStage(stage: PipelineStage) {
  if (stage === "quoted") return "Quote sent";
  if (stage === "booked") return "Lead booked";
  if (stage === "qualifying") return "Lead moved to qualifying";
  return "Lead stage updated";
}

function stageLabel(stage: PipelineStage) {
  if (stage === "quoted") return "Quoted";
  if (stage === "booked") return "Booked";
  if (stage === "qualifying") return "Qualifying";
  return "New";
}

function formatValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function loadLeadSnapshot(params: {
  serviceClient: SupabaseClient;
  clientId: string;
  leadId: string;
}): Promise<LeadSnapshot | null> {
  const { data, error } = await params.serviceClient
    .from("leads")
    .select("id, client_id, name, service, address, source, status")
    .eq("id", params.leadId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lead snapshot: ${error.message}`);
  }

  const record = asRecord(data);
  const id = pickString(record?.id);
  const clientId = pickString(record?.client_id);
  if (!id || !clientId) return null;

  return {
    id,
    clientId,
    name: pickString(record?.name),
    service: pickString(record?.service),
    address: pickString(record?.address),
    source: pickString(record?.source),
    status: pickString(record?.status),
  };
}

function buildStageAlertBody(args: {
  lead: LeadSnapshot | null;
  stage: PipelineStage;
  value: number | null;
}) {
  const formattedValue = formatValue(args.value);
  const fragments: string[] = [];
  const stageSummary = `moved to ${stageLabel(args.stage)}.`;

  if (args.lead?.name) {
    fragments.push(`${args.lead.name} ${stageSummary}`);
  } else {
    fragments.push(`A lead ${stageSummary}`);
  }

  if (args.lead?.service) {
    fragments.push(`Service: ${args.lead.service}.`);
  }

  if (formattedValue) {
    fragments.push(`Value: ${formattedValue}.`);
  }

  if (args.lead?.address) {
    fragments.push(`Address: ${args.lead.address}.`);
  }

  return fragments.join(" ");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPersistence(params: {
  serviceClient: SupabaseClient;
  leadId: string;
  expectedStage: PipelineStage;
  expectedValue: number | null;
}): Promise<PersistenceSnapshot> {
  const { serviceClient, leadId, expectedStage, expectedValue } = params;
  let lastSnapshot: PersistenceSnapshot = {
    verified: false,
    pipeline_stage: null,
    pipeline_value: null,
    lead_status: null,
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [{ data: pipelineRow, error: pipelineError }, { data: leadRow, error: leadError }] = await Promise.all([
      serviceClient
        .from("pipeline")
        .select("stage, value")
        .eq("lead_id", leadId)
        .maybeSingle(),
      serviceClient
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .maybeSingle(),
    ]);

    if (pipelineError) throw new Error(`Pipeline verification failed: ${pipelineError.message}`);
    if (leadError) throw new Error(`Lead verification failed: ${leadError.message}`);

    const pipelineStage = (pipelineRow?.stage as string | null) ?? null;
    const pipelineValue = parseNumericOrNull(pipelineRow?.value);
    const leadStatus = (leadRow?.status as string | null) ?? null;
    const verified =
      pipelineStage === expectedStage &&
      leadStatus === expectedStage &&
      valuesMatch(pipelineValue, expectedValue);

    lastSnapshot = {
      verified,
      pipeline_stage: pipelineStage,
      pipeline_value: pipelineValue,
      lead_status: leadStatus,
    };

    if (verified) {
      return lastSnapshot;
    }

    if (attempt < 3) {
      await sleep(250 * (attempt + 1));
    }
  }

  return lastSnapshot;
}

async function applyDirectPersistenceFallback(params: {
  serviceClient: SupabaseClient;
  leadId: string;
  clientId: string;
  stage: PipelineStage;
  value: number | null;
  source: string;
}): Promise<DirectPersistenceResult> {
  const { serviceClient, leadId, clientId, stage, value, source } = params;
  const warnings: string[] = [];
  const timestamp = new Date().toISOString();
  const probability = probabilityForStage(stage);

  const { data: pipelineRow, error: pipelineLookupError } = await serviceClient
    .from("pipeline")
    .select("id")
    .eq("lead_id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (pipelineLookupError) {
    throw new Error(`Fallback pipeline lookup failed: ${pipelineLookupError.message}`);
  }

  if (pipelineRow?.id) {
    const { error: pipelineUpdateError } = await serviceClient
      .from("pipeline")
      .update({
        stage,
        value,
        probability,
        updated_at: timestamp,
      })
      .eq("id", pipelineRow.id)
      .eq("client_id", clientId);

    if (pipelineUpdateError) {
      throw new Error(`Fallback pipeline update failed: ${pipelineUpdateError.message}`);
    }
  } else {
    const { error: pipelineInsertError } = await serviceClient
      .from("pipeline")
      .insert({
        lead_id: leadId,
        client_id: clientId,
        stage,
        value,
        probability,
        updated_at: timestamp,
      });

    if (pipelineInsertError) {
      throw new Error(`Fallback pipeline insert failed: ${pipelineInsertError.message}`);
    }
  }

  const { error: leadUpdateError } = await serviceClient
    .from("leads")
    .update({ status: stage })
    .eq("id", leadId)
    .eq("client_id", clientId);

  if (leadUpdateError) {
    throw new Error(`Fallback lead status update failed: ${leadUpdateError.message}`);
  }

  const { error: eventInsertError } = await serviceClient.from("lead_events").insert({
    client_id: clientId,
    lead_id: leadId,
    event_type: eventTypeForStage(stage),
    payload_json: {
      client_id: clientId,
      lead_id: leadId,
      stage,
      status: stage,
      value,
      source,
      applied_at: timestamp,
    },
  });

  if (eventInsertError) {
    warnings.push(`Fallback event insert failed: ${eventInsertError.message}`);
  }

  const { error: healthUpsertError } = await serviceClient
    .from("automation_health")
    .upsert(
      {
        client_id: clientId,
        workflow_name: "D",
        status: "optimal",
        last_run_at: timestamp,
        error_message: null,
      },
      { onConflict: "client_id,workflow_name" }
    );

  if (healthUpsertError) {
    warnings.push(`Fallback health sync failed: ${healthUpsertError.message}`);
  }

  return { warnings };
}

async function parseWorkflowPayload(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 240) };
  }
}

async function forwardWorkflowD(args: {
  workflowUrl: string;
  secret?: string | null;
  payload: Record<string, unknown>;
}) {
  const timeoutMs = 12000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (args.secret) {
        headers["x-nexusq-secret"] = args.secret;
      }

      const response = await fetch(args.workflowUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(args.payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < 1) {
        await sleep(300 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Workflow D network request failed.");
}

export async function applyPipelineStageUpdate(args: {
  serviceClient: SupabaseClient;
  clientId: string;
  leadId: string;
  stageInput: unknown;
  valueInput?: unknown;
  source: string;
  operatorAlertSource?: string;
}) {
  const stage = normalizeStage(args.stageInput);
  const value = parseNumericOrNull(args.valueInput);
  const workflowUrls = resolveWorkflowDUrls();
  const workflowSecret = getOptionalEnv("NEXUSQ_PIPELINE_SECRET");
  const upstreamPayload = {
    lead_id: args.leadId,
    client_id: args.clientId,
    status: stage,
    stage,
    value,
  };

  let workflowResponse: Response | null = null;
  let workflowPayload: Record<string, unknown> = {};
  let lastWorkflowError = "Workflow D request failed.";

  for (const workflowUrl of workflowUrls) {
    try {
      const response = await forwardWorkflowD({
        workflowUrl,
        secret: workflowSecret,
        payload: upstreamPayload,
      });
      const payload = await parseWorkflowPayload(response);
      const workflowOk = response.ok && payload?.ok !== false && payload?._error !== true;

      if (workflowOk) {
        workflowResponse = response;
        workflowPayload = payload;
        break;
      }

      const workflowMessage =
        (typeof payload?.error === "string" && payload.error) ||
        (typeof payload?.message === "string" && payload.message) ||
        `Workflow D returned HTTP ${response.status}`;
      workflowPayload = payload;
      lastWorkflowError = workflowMessage;
    } catch (workflowError) {
      lastWorkflowError =
        workflowError instanceof Error ? workflowError.message : "Workflow D network request failed.";
    }
  }

  let persisted = await verifyPersistence({
    serviceClient: args.serviceClient,
    leadId: args.leadId,
    expectedStage: stage,
    expectedValue: value,
  });

  let fallbackApplied = false;
  let fallbackWarnings: string[] = [];

  if (!workflowResponse || !persisted.verified) {
    fallbackApplied = true;
    const fallbackResult = await applyDirectPersistenceFallback({
      serviceClient: args.serviceClient,
      leadId: args.leadId,
      clientId: args.clientId,
      stage,
      value,
      source: `${args.source}-fallback`,
    });
    fallbackWarnings = fallbackResult.warnings;
    persisted = await verifyPersistence({
      serviceClient: args.serviceClient,
      leadId: args.leadId,
      expectedStage: stage,
      expectedValue: value,
    });
  }

  if (!persisted.verified) {
    throw new Error(
      workflowResponse
        ? "Pipeline update was acknowledged but did not persist in database state."
        : lastWorkflowError
    );
  }

  let operatorAlert: Awaited<ReturnType<typeof createOperatorAlert>> | null = null;
  let operatorAlertError: string | null = null;
  let leadSnapshot: LeadSnapshot | null = null;

  try {
    leadSnapshot = await loadLeadSnapshot({
      serviceClient: args.serviceClient,
      clientId: args.clientId,
      leadId: args.leadId,
    });
  } catch (snapshotError) {
    console.warn(`${args.source} lead snapshot unavailable`, {
      client_id: args.clientId,
      lead_id: args.leadId,
      message: snapshotError instanceof Error ? snapshotError.message : "Failed to load lead snapshot.",
    });
  }

  try {
    operatorAlert = await createOperatorAlert({
      serviceClient: args.serviceClient,
      clientId: args.clientId,
      type: "pipeline_stage_changed",
      title: titleForStage(stage),
      body: buildStageAlertBody({
        lead: leadSnapshot,
        stage,
        value,
      }),
      severity: severityForStage(stage),
      leadId: args.leadId,
      linkPath: `/pipeline?lead=${encodeURIComponent(args.leadId)}`,
      source: args.operatorAlertSource ?? args.source,
      metadata: {
        workflow: "D",
        stage,
        value,
        initiated_by: args.source,
        fallback_applied: fallbackApplied,
        persisted,
      },
    });
  } catch (alertError) {
    operatorAlertError =
      alertError instanceof Error ? alertError.message : "Operator alert delivery failed.";
    console.error(`${args.source} operator alert failed`, {
      client_id: args.clientId,
      lead_id: args.leadId,
      stage,
      message: operatorAlertError,
    });
  }

  return {
    ok: true,
    lead_id: args.leadId,
    client_id: args.clientId,
    stage,
    value,
    persisted,
    upstream_payload: workflowPayload,
    fallback_applied: fallbackApplied,
    fallback_warnings: fallbackWarnings,
    operator_alert: operatorAlert,
    operator_alert_error: operatorAlertError,
    warning:
      fallbackApplied && workflowResponse
        ? "Workflow D upstream did not persist the update. Applied direct server-side fallback."
        : !workflowResponse
        ? lastWorkflowError
        : null,
  } satisfies PipelineUpdateResult;
}
