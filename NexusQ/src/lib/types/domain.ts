export type DomainRecord = Record<string, unknown>;

export type NotificationSeverity = "high" | "medium" | "low";

export type ClientNotificationRecord = {
  id: string;
  clientId: string | null;
  title: string;
  body: string | null;
  severity: NotificationSeverity;
  createdAt: string;
  readAt: string | null;
  linkPath: string | null;
  leadId: string | null;
  source: string | null;
  status: string | null;
  type: string | null;
  metadata: DomainRecord | null;
};

export type MessageDirection = "inbound" | "outbound" | "system" | "unknown";

export type MessageRecord = {
  id: string;
  clientId: string | null;
  leadId: string | null;
  direction: MessageDirection;
  channel: string | null;
  provider: string | null;
  providerMessageId: string | null;
  status: string | null;
  body: string | null;
  createdAt: string;
  metadata: DomainRecord | null;
};

export type DailyKpiRecord = {
  id: string;
  clientId: string | null;
  day: string;
  leadsCaptured: number | null;
  quotedCount: number | null;
  bookedCount: number | null;
  revenue: number | null;
  avgResponseMinutes: number | null;
  conversionRate: number | null;
  payload: DomainRecord | null;
  updatedAt: string | null;
};

export type AutomationHealthRecord = {
  id: string;
  clientId: string | null;
  workflowName: string | null;
  lastRunAt: string | null;
  status: string | null;
  errorMessage: string | null;
  updatedAt: string | null;
  raw: DomainRecord;
};

export function asDomainRecord(value: unknown): DomainRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DomainRecord;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function pickString(...values: unknown[]) {
  for (const value of values) {
    if (isNonEmptyString(value)) return value.trim();
  }
  return null;
}

export function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function pickBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (lowered === "true") return true;
      if (lowered === "false") return false;
    }
  }
  return null;
}

export function pickObject(...values: unknown[]) {
  for (const value of values) {
    const record = asDomainRecord(value);
    if (record) return record;
  }
  return null;
}

export function pickTimestamp(...values: unknown[]) {
  const value = pickString(...values);
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
}

export function normalizeNotificationSeverity(value: unknown): NotificationSeverity {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "high" || normalized === "critical" || normalized === "error" || normalized === "urgent") {
    return "high";
  }
  if (
    normalized === "medium" ||
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "important"
  ) {
    return "medium";
  }
  return "low";
}

export function normalizeMessageDirection(value: unknown): MessageDirection {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "inbound" || normalized === "incoming" || normalized === "received") return "inbound";
  if (normalized === "outbound" || normalized === "outgoing" || normalized === "sent") return "outbound";
  if (normalized === "system" || normalized === "internal") return "system";
  return "unknown";
}
