type RecordValue = Record<string, unknown>;

export type BrowserPushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type BrowserPushSubscriptionJson = {
  endpoint: string;
  expirationTime: number | null;
  keys: BrowserPushSubscriptionKeys;
};

export type NormalizedPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: BrowserPushSubscriptionKeys;
  subscriptionJson: BrowserPushSubscriptionJson;
};

export type StoredPushSubscription = {
  id: string | null;
  clientId: string | null;
  userId: string | null;
  endpoint: string;
  expirationTime: number | null;
  keys: BrowserPushSubscriptionKeys;
  subscriptionJson: BrowserPushSubscriptionJson;
  userAgent: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function asRecord(value: unknown): RecordValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordValue;
}

function pickString(record: RecordValue | null, ...keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeExpirationTime(value: unknown) {
  if (value == null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function normalizePushSubscriptionEndpoint(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Push subscription endpoint must be a valid absolute URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Push subscription endpoint must use https.");
  }

  return parsed.toString();
}

export function normalizePushSubscriptionPayload(value: unknown): NormalizedPushSubscription {
  const record = asRecord(value);
  if (!record) {
    throw new Error("subscription must be an object.");
  }

  const endpoint = normalizePushSubscriptionEndpoint(record.endpoint);
  if (!endpoint) {
    throw new Error("subscription.endpoint is required.");
  }

  const keysRecord = asRecord(record.keys);
  const p256dh = pickString(keysRecord, "p256dh");
  const auth = pickString(keysRecord, "auth");

  if (!p256dh) {
    throw new Error("subscription.keys.p256dh is required.");
  }
  if (!auth) {
    throw new Error("subscription.keys.auth is required.");
  }

  const expirationTime = normalizeExpirationTime(record.expirationTime);
  const keys = { p256dh, auth } satisfies BrowserPushSubscriptionKeys;
  const subscriptionJson = {
    endpoint,
    expirationTime,
    keys,
  } satisfies BrowserPushSubscriptionJson;

  return {
    endpoint,
    expirationTime,
    keys,
    subscriptionJson,
  };
}

function buildNormalizedSubscriptionFromRecord(record: RecordValue | null) {
  if (!record) return null;

  const nestedSubscription = asRecord(record.subscription_json) ?? asRecord(record.subscription);
  if (nestedSubscription) {
    try {
      return normalizePushSubscriptionPayload(nestedSubscription);
    } catch {
      // Fall through to direct column extraction.
    }
  }

  const endpoint = normalizePushSubscriptionEndpoint(
    pickString(record, "endpoint")
  );
  if (!endpoint) return null;

  const keysSource = asRecord(record.keys);
  const p256dh =
    pickString(keysSource, "p256dh") ??
    pickString(record, "p256dh_key", "p256dh", "public_key");
  const auth =
    pickString(keysSource, "auth") ??
    pickString(record, "auth_key", "auth");

  if (!p256dh || !auth) return null;

  const expirationTime =
    normalizeExpirationTime(record.expirationTime) ??
    normalizeExpirationTime(record.expiration_time);

  return {
    endpoint,
    expirationTime,
    keys: { p256dh, auth },
    subscriptionJson: {
      endpoint,
      expirationTime,
      keys: { p256dh, auth },
    },
  } satisfies NormalizedPushSubscription;
}

export function serializeStoredPushSubscriptionRow(value: unknown): StoredPushSubscription | null {
  const record = asRecord(value);
  const normalized = buildNormalizedSubscriptionFromRecord(record);
  if (!record || !normalized) return null;

  return {
    id: pickString(record, "id"),
    clientId: pickString(record, "client_id", "clientId"),
    userId: pickString(record, "user_id", "userId"),
    endpoint: normalized.endpoint,
    expirationTime: normalized.expirationTime,
    keys: normalized.keys,
    subscriptionJson: normalized.subscriptionJson,
    userAgent: pickString(record, "user_agent", "userAgent"),
    createdAt: pickString(record, "created_at", "createdAt"),
    updatedAt: pickString(record, "updated_at", "updatedAt"),
  } satisfies StoredPushSubscription;
}
