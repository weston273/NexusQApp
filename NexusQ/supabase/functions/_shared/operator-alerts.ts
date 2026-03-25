import type { SupabaseClient } from "npm:@supabase/supabase-js@2.94.0";
import webpush from "npm:web-push@3.6.7";
import { serializeStoredPushSubscriptionRow } from "./push-subscription.ts";

type AlertSeverity = "high" | "medium" | "low";
type DeliveryState = "delivered" | "limited" | "disabled" | "skipped";

type OperatorAlertInput = {
  serviceClient: SupabaseClient;
  clientId: string;
  type: string;
  title: string;
  body: string;
  severity?: AlertSeverity;
  leadId?: string | null;
  linkPath?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

type OperatorPreference = {
  userId: string;
  role: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  smsAlertsEnabled: boolean;
  pushAlertsEnabled: boolean;
};

type NotificationSubscriptionRow = {
  userId: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
};

type ChannelSummary = {
  state: DeliveryState;
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
  detail: string;
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type OperatorAlertResult = {
  notificationId: string | null;
  overallState: DeliveryState;
  sms: ChannelSummary;
  push: ChannelSummary;
};

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
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeOperatorPhone(value: unknown) {
  const raw = pickString(value);
  if (!raw) return null;

  const normalized = raw.replace(/[\s().-]+/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function pickAuthUserMetadataPhone(record: Record<string, unknown> | null) {
  return normalizeOperatorPhone(asRecord(record?.user_metadata)?.phone) ?? normalizeOperatorPhone(record?.phone);
}

async function loadAuthOperatorFallbacks(serviceClient: SupabaseClient, userIds: string[]) {
  const fallbacks = new Map<
    string,
    {
      email: string | null;
      fullName: string | null;
      phone: string | null;
    }
  >();

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data, error } = await serviceClient.auth.admin.getUserById(userId);
        if (error || !data.user) {
          console.warn("operator-alerts auth fallback unavailable", {
            user_id: userId,
            message: error?.message ?? "User not found.",
          });
          return;
        }

        fallbacks.set(userId, {
          email: pickString(data.user.email),
          fullName: pickString(data.user.user_metadata?.full_name, data.user.user_metadata?.name),
          phone: pickAuthUserMetadataPhone(asRecord(data.user as unknown)),
        });
      } catch (error) {
        console.warn("operator-alerts auth fallback failed", {
          user_id: userId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  return fallbacks;
}

function canReceiveOperatorSms(role: string | null) {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

function mapNotificationTableError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("client_notifications") && lower.includes("does not exist")) {
    return "client_notifications table is missing.";
  }
  return message;
}

function mapSubscriptionTableError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("notification_subscriptions") && lower.includes("does not exist")) {
    return "notification_subscriptions table is missing.";
  }
  return message;
}

function buildNotificationInsertCandidates(args: {
  clientId: string;
  type: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  leadId: string | null;
  linkPath: string | null;
  source: string;
  status: DeliveryState;
  payload: Record<string, unknown>;
  createdAt: string;
}) {
  const base = {
    client_id: args.clientId,
    type: args.type,
    source: args.source,
    lead_id: args.leadId,
    created_at: args.createdAt,
    status: args.status,
  };

  const modernPayload = args.linkPath
    ? {
        ...base,
        title: args.title,
        body: args.body,
        severity: args.severity,
        link_path: args.linkPath,
        metadata: args.payload,
      }
    : {
        ...base,
        title: args.title,
        body: args.body,
        severity: args.severity,
        metadata: args.payload,
      };

  const legacyMessagePayload = args.linkPath
    ? {
        ...base,
        title: args.title,
        message: args.body,
        severity: args.severity,
        target_path: args.linkPath,
        payload_json: args.payload,
      }
    : {
        ...base,
        title: args.title,
        message: args.body,
        severity: args.severity,
        payload_json: args.payload,
      };

  const subjectPayload = args.linkPath
    ? {
        ...base,
        subject: args.title,
        message: args.body,
        level: args.severity,
        path: args.linkPath,
        payload_json: args.payload,
      }
    : {
        ...base,
        subject: args.title,
        message: args.body,
        level: args.severity,
        payload_json: args.payload,
      };

  const summaryPayload = args.linkPath
    ? {
        ...base,
        subject: args.title,
        summary: args.body,
        path: args.linkPath,
        data: args.payload,
      }
    : {
        ...base,
        subject: args.title,
        summary: args.body,
        data: args.payload,
      };

  const minimalMessagePayload = args.linkPath
    ? {
        client_id: args.clientId,
        type: args.type,
        message: args.body,
        lead_id: args.leadId,
        created_at: args.createdAt,
        path: args.linkPath,
      }
    : {
        client_id: args.clientId,
        type: args.type,
        message: args.body,
        lead_id: args.leadId,
        created_at: args.createdAt,
      };

  const minimalTitlePayload = args.linkPath
    ? {
        client_id: args.clientId,
        title: args.title,
        type: args.type,
        lead_id: args.leadId,
        created_at: args.createdAt,
        path: args.linkPath,
      }
    : {
        client_id: args.clientId,
        title: args.title,
        type: args.type,
        lead_id: args.leadId,
        created_at: args.createdAt,
      };

  // Older workspaces may only support title/message style rows with no
  // status/source/path columns. Keep a compact fallback so operator alerts
  // still persist in-app even before the table is modernized.
  const compactTitleMessagePayloadWithPayloadJson = {
    client_id: args.clientId,
    title: args.title,
    type: args.type,
    message: args.body,
    lead_id: args.leadId,
    created_at: args.createdAt,
    payload_json: args.payload,
  };

  const compactTitleMessagePayload = {
    client_id: args.clientId,
    title: args.title,
    type: args.type,
    message: args.body,
    lead_id: args.leadId,
    created_at: args.createdAt,
  };

  return [
    modernPayload,
    legacyMessagePayload,
    subjectPayload,
    summaryPayload,
    compactTitleMessagePayloadWithPayloadJson,
    compactTitleMessagePayload,
    minimalTitlePayload,
    minimalMessagePayload,
  ];
}

async function insertClientNotification(args: {
  serviceClient: SupabaseClient;
  clientId: string;
  type: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  leadId: string | null;
  linkPath: string | null;
  source: string;
  status: DeliveryState;
  payload: Record<string, unknown>;
}) {
  const createdAt = new Date().toISOString();
  const candidates = buildNotificationInsertCandidates({
    ...args,
    createdAt,
  });
  let lastError: string | null = null;

  for (const candidate of candidates) {
    const { data, error } = await args.serviceClient
      .from("client_notifications")
      .insert(candidate)
      .select("id")
      .maybeSingle();

    if (!error) {
      const record = asRecord(data);
      return pickString(record?.id) ?? null;
    }

    lastError = mapNotificationTableError(error.message);
  }

  throw new Error(lastError ?? "Failed to insert client notification.");
}

async function loadOperatorPreferences(serviceClient: SupabaseClient, clientId: string) {
  const { data: accessRows, error: accessError } = await serviceClient
    .from("user_access")
    .select("user_id, role")
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (accessError) {
    throw new Error(`Failed to load operator access: ${accessError.message}`);
  }

  const accessList = Array.isArray(accessRows)
    ? accessRows
        .map((row) => {
          const record = asRecord(row);
          return {
            userId: pickString(record?.user_id),
            role: pickString(record?.role),
          };
        })
        .filter((row): row is { userId: string; role: string | null } => Boolean(row.userId))
    : [];

  if (!accessList.length) return [];

  const userIds = Array.from(new Set(accessList.map((row) => row.userId)));
  const { data: profileRows, error: profileError } = await serviceClient
    .from("user_profiles")
    .select("id, email, full_name, phone, sms_alerts_enabled, push_alerts_enabled")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`Failed to load operator notification preferences: ${profileError.message}`);
  }

  const profiles = new Map<string, Record<string, unknown>>();
  for (const row of Array.isArray(profileRows) ? profileRows : []) {
    const record = asRecord(row);
    const id = pickString(record?.id);
    if (!id) continue;
    profiles.set(id, record ?? {});
  }

  const authFallbackIds = userIds.filter((userId) => {
    const profile = profiles.get(userId);
    return !normalizeOperatorPhone(profile?.phone);
  });
  const authFallbacks = authFallbackIds.length
    ? await loadAuthOperatorFallbacks(serviceClient, authFallbackIds)
    : new Map<string, { email: string | null; fullName: string | null; phone: string | null }>();

  return accessList.map<OperatorPreference>((access) => {
    const profile = profiles.get(access.userId) ?? null;
    const authFallback = authFallbacks.get(access.userId) ?? null;
    return {
      userId: access.userId,
      role: access.role,
      email: pickString(profile?.email, authFallback?.email),
      fullName: pickString(profile?.full_name, authFallback?.fullName),
      phone: normalizeOperatorPhone(profile?.phone) ?? authFallback?.phone,
      smsAlertsEnabled: profile?.sms_alerts_enabled === true,
      pushAlertsEnabled: profile?.push_alerts_enabled !== false,
    };
  });
}

async function loadNotificationSubscriptions(serviceClient: SupabaseClient, clientId: string, userIds: string[]) {
  if (!userIds.length) return [] as NotificationSubscriptionRow[];

  const { data, error } = await serviceClient
    .from("notification_subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .in("user_id", userIds);

  if (error) {
    throw new Error(mapSubscriptionTableError(error.message));
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => serializeStoredPushSubscriptionRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof serializeStoredPushSubscriptionRow>> => Boolean(row))
    .map((row) => ({
      userId: row.userId ?? "",
      endpoint: row.endpoint,
      subscription: row.subscriptionJson,
    }))
    .filter((row): row is NotificationSubscriptionRow => Boolean(row.userId && row.endpoint));
}

function resolveTwilioConfig() {
  const accountSid =
    getOptionalEnv("TWILIO_ACCOUNT_SID") ?? getOptionalEnv("NEXUSQ_TWILIO_ACCOUNT_SID");
  const authToken =
    getOptionalEnv("TWILIO_AUTH_TOKEN") ?? getOptionalEnv("NEXUSQ_TWILIO_AUTH_TOKEN");
  const fromNumber =
    getOptionalEnv("TWILIO_FROM_NUMBER") ?? getOptionalEnv("NEXUSQ_TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber } satisfies TwilioConfig;
}

function resolveWebPushConfig() {
  const publicKey =
    getOptionalEnv("WEB_PUSH_VAPID_PUBLIC_KEY") ?? getOptionalEnv("NEXUSQ_WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey =
    getOptionalEnv("WEB_PUSH_VAPID_PRIVATE_KEY") ?? getOptionalEnv("NEXUSQ_WEB_PUSH_VAPID_PRIVATE_KEY");
  const subject =
    getOptionalEnv("WEB_PUSH_VAPID_SUBJECT") ??
    getOptionalEnv("NEXUSQ_WEB_PUSH_VAPID_SUBJECT") ??
    "mailto:alerts@nexusq.local";

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject } satisfies WebPushConfig;
}

function makeSummary(args: {
  state: DeliveryState;
  attempted?: number;
  delivered?: number;
  failed?: number;
  skipped?: number;
  detail: string;
}) {
  return {
    state: args.state,
    attempted: args.attempted ?? 0,
    delivered: args.delivered ?? 0,
    failed: args.failed ?? 0,
    skipped: args.skipped ?? 0,
    detail: args.detail,
  } satisfies ChannelSummary;
}

function summarizeAttempts(args: {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
  emptyDetail: string;
}) {
  if (!args.attempted) {
    return makeSummary({
      state: "skipped",
      detail: args.emptyDetail,
    });
  }

  if (args.delivered === args.attempted) {
    return makeSummary({
      state: "delivered",
      attempted: args.attempted,
      delivered: args.delivered,
      failed: args.failed,
      skipped: args.skipped,
      detail: `${args.delivered}/${args.attempted} deliveries succeeded.`,
    });
  }

  return makeSummary({
    state: "limited",
    attempted: args.attempted,
    delivered: args.delivered,
    failed: args.failed,
    skipped: args.skipped,
    detail:
      args.delivered > 0
        ? `${args.delivered}/${args.attempted} deliveries succeeded.`
        : `All ${args.attempted} delivery attempts failed.`,
  });
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function buildSmsBody(args: {
  title: string;
  body: string;
  linkPath: string | null;
}) {
  const lines = [
    "NexusQ alert",
    args.title,
    args.body,
    args.linkPath ? `Open: ${args.linkPath}` : "Open NexusQ to review.",
  ].filter(Boolean);

  return truncateText(lines.join("\n"), 320);
}

async function deliverSms(args: {
  config: TwilioConfig;
  phone: string;
  title: string;
  body: string;
  linkPath: string | null;
}) {
  const form = new URLSearchParams({
    To: args.phone,
    From: args.config.fromNumber,
    Body: buildSmsBody(args),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(args.config.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${args.config.accountSid}:${args.config.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!response.ok) {
    const text = (await response.text()).trim();
    throw new Error(text || `Twilio SMS failed with HTTP ${response.status}.`);
  }
}

async function deliverPush(args: {
  config: WebPushConfig;
  subscriptions: NotificationSubscriptionRow[];
  title: string;
  body: string;
  severity: AlertSeverity;
  linkPath: string | null;
  leadId: string | null;
  clientId: string;
  type: string;
}) {
  webpush.setVapidDetails(args.config.subject, args.config.publicKey, args.config.privateKey);

  let delivered = 0;
  let failed = 0;

  for (const subscription of args.subscriptions) {
    try {
      await webpush.sendNotification(
        subscription.subscription,
        JSON.stringify({
          title: args.title,
          body: args.body,
          tag: args.type,
          renotify: args.severity === "high",
          requireInteraction: args.severity === "high",
          url: args.linkPath ?? "/notifications",
          data: {
            url: args.linkPath ?? "/notifications",
            lead_id: args.leadId,
            client_id: args.clientId,
            type: args.type,
          },
        }),
        {
          TTL: 60,
          urgency: args.severity === "high" ? "high" : "normal",
        }
      );
      delivered += 1;
    } catch (error) {
      failed += 1;
      console.error("operator-alerts push delivery failed", {
        client_id: args.clientId,
        endpoint: subscription.endpoint,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    delivered,
    attempted: args.subscriptions.length,
    failed,
    skipped: Math.max(0, args.subscriptions.length - delivered - failed),
  };
}

function resolveOverallState(sms: ChannelSummary, push: ChannelSummary): DeliveryState {
  if (sms.state === "delivered" || push.state === "delivered") return "delivered";
  if (sms.state === "limited" || push.state === "limited") return "limited";
  if (sms.state === "skipped" || push.state === "skipped") return "skipped";
  return "disabled";
}

export async function createOperatorAlert(input: OperatorAlertInput): Promise<OperatorAlertResult> {
  const severity = input.severity ?? "medium";
  const source = pickString(input.source) ?? "operator-alerts";
  const operators = await loadOperatorPreferences(input.serviceClient, input.clientId);

  const twilioConfig = resolveTwilioConfig();
  const webPushConfig = resolveWebPushConfig();

  const smsOptedIn = operators.filter((operator) => canReceiveOperatorSms(operator.role) && operator.smsAlertsEnabled);
  const smsTargets = severity === "low" ? [] : smsOptedIn.filter((operator) => Boolean(operator.phone));

  let sms: ChannelSummary;
  if (!twilioConfig) {
    sms = makeSummary({
      state: "disabled",
      detail: "SMS alerts are not configured server-side yet.",
    });
  } else if (severity === "low") {
    sms = makeSummary({
      state: "skipped",
      detail: "Low-severity workspace alerts stay in-app and on browser push only.",
    });
  } else if (!smsOptedIn.length) {
    sms = makeSummary({
      state: "skipped",
      detail: "No owner/admin operator has SMS alerts enabled.",
    });
  } else if (!smsTargets.length) {
    sms = makeSummary({
      state: "skipped",
      detail: "SMS alerts are enabled, but no valid operator phone number is saved.",
    });
  } else {
    let delivered = 0;
    let failed = 0;

    for (const operator of smsTargets) {
      try {
        await deliverSms({
          config: twilioConfig,
          phone: operator.phone ?? "",
          title: input.title,
          body: input.body,
          linkPath: input.linkPath ?? null,
        });
        delivered += 1;
      } catch (error) {
        failed += 1;
        console.error("operator-alerts sms delivery failed", {
          client_id: input.clientId,
          user_id: operator.userId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    sms = summarizeAttempts({
      attempted: smsTargets.length,
      delivered,
      failed,
      skipped: 0,
      emptyDetail: "No SMS delivery target was available.",
    });
  }

  const pushUsers = operators.filter((operator) => operator.pushAlertsEnabled);

  let push: ChannelSummary;
  if (!webPushConfig) {
    push = makeSummary({
      state: "disabled",
      detail: "Browser push is not configured server-side yet.",
    });
  } else if (!pushUsers.length) {
    push = makeSummary({
      state: "skipped",
      detail: "No active operator has browser push enabled for their account.",
    });
  } else {
    try {
      const subscriptions = await loadNotificationSubscriptions(
        input.serviceClient,
        input.clientId,
        pushUsers.map((operator) => operator.userId)
      );

      if (!subscriptions.length) {
        push = makeSummary({
          state: "skipped",
          detail: "No active device subscription is registered for this workspace yet.",
        });
      } else {
        const pushResult = await deliverPush({
          config: webPushConfig,
          subscriptions,
          title: input.title,
          body: input.body,
          severity,
          linkPath: input.linkPath ?? null,
          leadId: input.leadId ?? null,
          clientId: input.clientId,
          type: input.type,
        });

        push = summarizeAttempts({
          attempted: pushResult.attempted,
          delivered: pushResult.delivered,
          failed: pushResult.failed,
          skipped: pushResult.skipped,
          emptyDetail: "No browser push subscription was available.",
        });
      }
    } catch (error) {
      push = makeSummary({
        state: "limited",
        attempted: pushUsers.length,
        failed: pushUsers.length,
        detail: error instanceof Error ? error.message : "Browser push delivery failed.",
      });
    }
  }

  const overallState = resolveOverallState(sms, push);
  const notificationPayload = {
    ...(input.metadata ?? {}),
    delivery: {
      overall_state: overallState,
      sms,
      push,
    },
  };

  let notificationId: string | null = null;
  try {
    notificationId = await insertClientNotification({
      serviceClient: input.serviceClient,
      clientId: input.clientId,
      type: input.type,
      title: input.title,
      body: input.body,
      severity,
      leadId: input.leadId ?? null,
      linkPath: input.linkPath ?? null,
      source,
      status: overallState,
      payload: notificationPayload,
    });
  } catch (error) {
    console.error("operator-alerts notification persistence failed", {
      client_id: input.clientId,
      type: input.type,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    notificationId,
    overallState,
    sms,
    push,
  };
}
