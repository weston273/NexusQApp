export const PIPELINE_STAGE_ORDER = ["new", "qualifying", "quoted", "booked"] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_ORDER)[number];

export const PIPELINE_STAGES: ReadonlyArray<{
  id: PipelineStage;
  title: string;
  color: string;
}> = [
  { id: "new", title: "New", color: "bg-blue-500" },
  { id: "qualifying", title: "Qualifying", color: "bg-amber-500" },
  { id: "quoted", title: "Quoted", color: "bg-purple-500" },
  { id: "booked", title: "Booked", color: "bg-emerald-500" },
];

export type Lead = {
  id: string;
  client_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
  last_contacted_at: string | null;
  service: string | null;
  urgency: string | null;
  address: string | null;
};

export type LeadEvent = {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  event_type: string;
  payload_json: Record<string, unknown> | null;
  created_at: string;
};

export type PipelineRow = {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  stage: string;
  value: number | null;
  probability: number | null;
  updated_at: string | null;
};

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readStringCandidate(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) return candidate.trim();
  }
  return null;
}

export function getNestedString(source: unknown, ...path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return isNonEmptyString(current) ? current.trim() : null;
}

export function normalizeLeadStatus(value?: string | null) {
  return (value ?? "new").toLowerCase().trim();
}

export function normalizePipelineStage(value?: string | null): PipelineStage {
  const normalized = normalizeLeadStatus(value);

  if (normalized === "new" || normalized === "qualifying" || normalized === "quoted" || normalized === "booked") {
    return normalized;
  }

  if (normalized.includes("inspect") || normalized.includes("qualif") || normalized.includes("schedule")) {
    return "qualifying";
  }
  if (normalized.includes("quote") || normalized.includes("quoted") || normalized.includes("sent")) {
    return "quoted";
  }
  if (normalized.includes("book") || normalized.includes("won") || normalized.includes("deal")) {
    return "booked";
  }

  return "new";
}

export function isPipelineStage(value: string): value is PipelineStage {
  return PIPELINE_STAGE_ORDER.includes(value as PipelineStage);
}

export function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function minutesBetween(aIso?: string | null, bIso?: string | null) {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = b - a;
  if (diff < 0) return null;
  return diff / 60000;
}

export function formatDurationMinutes(minutes: number | null) {
  if (minutes == null) return "-";
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

export function formatCompactCurrency(value: number | null | undefined) {
  const safeValue = Number(value ?? 0);
  const normalized = Number.isFinite(safeValue) ? safeValue : 0;
  try {
    return normalized.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(normalized));
  }
}

export function parseCurrencyInput(value: string) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString();
}

export function formatNullableText(value: unknown) {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text ? text : "-";
}

export function formatEventLabel(eventType: string) {
  return (eventType || "unknown").replace(/_/g, " ");
}

export function getEventSeverity(eventType: string): "high" | "medium" | "low" {
  const normalized = (eventType || "").toLowerCase();
  if (normalized.includes("failed") || normalized.includes("error")) return "high";
  if (normalized.includes("status") || normalized.includes("quoted") || normalized.includes("booked")) return "medium";
  return "low";
}

export function getLeadDisplayName(lead: Partial<Lead> & Record<string, unknown>, fallback = "Unknown") {
  return (
    readStringCandidate(
      lead.name,
      lead.full_name,
      lead.first_name,
      lead.phone
    ) ?? fallback
  );
}
