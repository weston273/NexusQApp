import * as React from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Save,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthProvider";
import { usePushSubscriptionSync } from "@/features/notifications/usePushSubscriptionSync";
import { invokeAuthedFunction } from "@/lib/edgeFunctions";
import { getErrorMessage } from "@/lib/errors";

type NotificationPreferences = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  smsAlertsEnabled: boolean;
  pushAlertsEnabled: boolean;
  updatedAt: string | null;
};

type NotificationPreferencesResponse = {
  ok?: boolean;
  preferences?: {
    email?: string | null;
    full_name?: string | null;
    phone?: string | null;
    sms_alerts_enabled?: boolean;
    push_alerts_enabled?: boolean;
    updated_at?: string | null;
  } | null;
  error?: string;
};

type DeliveryTone = "ready" | "attention" | "off" | "unsupported" | "loading";

type DeliveryStatus = {
  tone: DeliveryTone;
  label: string;
  detail: string;
};

type PreferenceDraft = {
  phone: string;
  smsAlertsEnabled: boolean;
  pushAlertsEnabled: boolean;
};

function mapPreferences(payload: NotificationPreferencesResponse["preferences"]): NotificationPreferences {
  return {
    email: typeof payload?.email === "string" ? payload.email : null,
    fullName: typeof payload?.full_name === "string" ? payload.full_name : null,
    phone: typeof payload?.phone === "string" ? payload.phone : null,
    smsAlertsEnabled: payload?.sms_alerts_enabled === true,
    pushAlertsEnabled: payload?.push_alerts_enabled !== false,
    updatedAt: typeof payload?.updated_at === "string" ? payload.updated_at : null,
  };
}

function buildDraft(preferences: NotificationPreferences): PreferenceDraft {
  return {
    phone: preferences.phone ?? "",
    smsAlertsEnabled: preferences.smsAlertsEnabled,
    pushAlertsEnabled: preferences.pushAlertsEnabled,
  };
}

function badgeVariantForTone(tone: DeliveryTone) {
  if (tone === "ready") return "default" as const;
  if (tone === "attention") return "destructive" as const;
  if (tone === "loading") return "secondary" as const;
  return "outline" as const;
}

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function describeSmsStatus(args: {
  loading: boolean;
  draft: PreferenceDraft;
}) {
  if (args.loading) {
    return {
      tone: "loading",
      label: "Checking SMS delivery",
      detail: "Loading your saved operator notification preferences.",
    } satisfies DeliveryStatus;
  }

  if (!args.draft.smsAlertsEnabled) {
    return {
      tone: "off",
      label: "SMS delivery off",
      detail: "Enable SMS alerts to send operator updates to your phone.",
    } satisfies DeliveryStatus;
  }

  if (!args.draft.phone.trim()) {
    return {
      tone: "attention",
      label: "Phone number required",
      detail: "Add an E.164 phone number before SMS delivery can be used.",
    } satisfies DeliveryStatus;
  }

  return {
    tone: "ready",
    label: "SMS delivery ready",
    detail: `Operator alerts will use ${args.draft.phone.trim()}.`,
  } satisfies DeliveryStatus;
}

function describePushStatus(args: {
  loadingPreferences: boolean;
  draft: PreferenceDraft;
  clientId: string | null;
  loadingPush: boolean;
  syncing: boolean;
  supported: boolean;
  vapidConfigured: boolean;
  supportReason: string | null;
  permission: ReturnType<typeof usePushSubscriptionSync>["permission"];
  subscribed: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
}) {
  if (args.loadingPreferences || args.loadingPush) {
    return {
      tone: "loading",
      label: "Checking browser delivery",
      detail: "Inspecting this browser's permission and subscription state.",
    } satisfies DeliveryStatus;
  }

  if (!args.draft.pushAlertsEnabled) {
    return {
      tone: "off",
      label: "Push delivery off",
      detail: "Enable push alerts if operators should receive browser notifications.",
    } satisfies DeliveryStatus;
  }

  if (!args.clientId) {
    return {
      tone: "attention",
      label: "Workspace required",
      detail: "Select a workspace before syncing this browser subscription.",
    } satisfies DeliveryStatus;
  }

  if (!args.supported) {
    return {
      tone: "unsupported",
      label: "Browser push unavailable",
      detail: args.supportReason ?? "This browser cannot register a push subscription.",
    } satisfies DeliveryStatus;
  }

  if (!args.vapidConfigured) {
    return {
      tone: "attention",
      label: "VAPID key missing",
      detail: args.supportReason ?? "Add the frontend VAPID public key before enabling browser alerts here.",
    } satisfies DeliveryStatus;
  }

  if (args.permission === "denied") {
    return {
      tone: "attention",
      label: "Permission blocked",
      detail: "Browser notification permission is denied for this site.",
    } satisfies DeliveryStatus;
  }

  if (args.permission !== "granted") {
    return {
      tone: "attention",
      label: "Permission needed",
      detail: "Grant browser notification permission to deliver operator alerts here.",
    } satisfies DeliveryStatus;
  }

  if (args.error) {
    return {
      tone: "attention",
      label: "Subscription attention needed",
      detail: args.error,
    } satisfies DeliveryStatus;
  }

  if (!args.subscribed) {
    return {
      tone: "attention",
      label: "This browser is not subscribed",
      detail: "Create a browser subscription to receive operator alerts on this device.",
    } satisfies DeliveryStatus;
  }

  if (args.syncing) {
    return {
      tone: "loading",
      label: "Syncing browser delivery",
      detail: "Updating this device subscription for the active workspace.",
    } satisfies DeliveryStatus;
  }

  return {
    tone: "ready",
    label: "Browser delivery ready",
    detail: args.lastSyncedAt
      ? `This device is subscribed and was synced at ${args.lastSyncedAt.toLocaleTimeString()}.`
      : "This device is subscribed for operator push delivery.",
  } satisfies DeliveryStatus;
}

function useOperatorAlertPreferences() {
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = React.useState<PreferenceDraft>({
    phone: "",
    smsAlertsEnabled: false,
    pushAlertsEnabled: true,
  });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (mode: "initial" | "manual" = "manual") => {
    if (mode === "manual") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await invokeAuthedFunction<NotificationPreferencesResponse>("notification-preferences", {
        action: "get",
      });
      const nextPreferences = mapPreferences(response?.preferences ?? null);
      setPreferences(nextPreferences);
      setDraft(buildDraft(nextPreferences));
      setError(null);
      return nextPreferences;
    } catch (loadError) {
      const message = getErrorMessage(loadError, "Failed to load operator alert preferences.");
      setError(message);
      throw loadError;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh("initial").catch(() => {
      // The card surfaces the latest load error.
    });
  }, [refresh]);

  const save = React.useCallback(async () => {
    setSaving(true);
    try {
      const response = await invokeAuthedFunction<NotificationPreferencesResponse>("notification-preferences", {
        action: "update",
        phone: draft.phone.trim() || null,
        sms_alerts_enabled: draft.smsAlertsEnabled,
        push_alerts_enabled: draft.pushAlertsEnabled,
      });
      const nextPreferences = mapPreferences(response?.preferences ?? null);
      setPreferences(nextPreferences);
      setDraft(buildDraft(nextPreferences));
      setError(null);
      return nextPreferences;
    } finally {
      setSaving(false);
    }
  }, [draft.phone, draft.pushAlertsEnabled, draft.smsAlertsEnabled]);

  const dirty =
    draft.phone !== (preferences?.phone ?? "") ||
    draft.smsAlertsEnabled !== (preferences?.smsAlertsEnabled ?? false) ||
    draft.pushAlertsEnabled !== (preferences?.pushAlertsEnabled ?? true);

  return {
    preferences,
    draft,
    setDraft,
    loading,
    refreshing,
    saving,
    error,
    dirty,
    refresh,
    save,
  };
}

function ChannelStatusRow(props: {
  icon: React.ReactNode;
  title: string;
  status: DeliveryStatus;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-primary">{props.icon}</div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{props.title}</div>
            <div className="text-sm text-foreground">{props.status.label}</div>
            <div className="text-xs text-muted-foreground">{props.status.detail}</div>
          </div>
        </div>
        <Badge variant={badgeVariantForTone(props.status.tone)}>{props.status.tone === "ready" ? "Ready" : props.status.label}</Badge>
      </div>
    </div>
  );
}

export function OperatorAlertDeliveryIndicator() {
  const { clientId } = useAuth();
  const preferencesState = useOperatorAlertPreferences();
  const push = usePushSubscriptionSync({ autoRegister: true, autoSync: true, clientId });

  const smsStatus = describeSmsStatus({
    loading: preferencesState.loading,
    draft: preferencesState.draft,
  });
  const pushStatus = describePushStatus({
    loadingPreferences: preferencesState.loading,
    draft: preferencesState.draft,
    clientId,
    loadingPush: push.loading,
    syncing: push.syncing,
    supported: push.support.supported,
    vapidConfigured: push.support.vapidConfigured,
    supportReason: push.support.reason ?? null,
    permission: push.permission,
    subscribed: push.subscribed,
    error: push.error,
    lastSyncedAt: push.lastSyncedAt,
  });

  return (
    <Card className="border-none bg-muted/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Operator Delivery Status</CardTitle>
        <CardDescription>
          Readiness for browser and SMS delivery used by lead-created and stage-change alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <ChannelStatusRow
          icon={<BellRing className="h-4 w-4" />}
          title="Browser push"
          status={pushStatus}
        />
        <ChannelStatusRow
          icon={<MessageSquare className="h-4 w-4" />}
          title="SMS delivery"
          status={smsStatus}
        />
      </CardContent>
    </Card>
  );
}

export function OperatorAlertDeliveryCard() {
  const { clientId } = useAuth();
  const preferencesState = useOperatorAlertPreferences();
  const push = usePushSubscriptionSync({ autoRegister: true, autoSync: true, clientId });

  const smsStatus = describeSmsStatus({
    loading: preferencesState.loading,
    draft: preferencesState.draft,
  });
  const pushStatus = describePushStatus({
    loadingPreferences: preferencesState.loading,
    draft: preferencesState.draft,
    clientId,
    loadingPush: push.loading,
    syncing: push.syncing,
    supported: push.support.supported,
    vapidConfigured: push.support.vapidConfigured,
    supportReason: push.support.reason ?? null,
    permission: push.permission,
    subscribed: push.subscribed,
    error: push.error,
    lastSyncedAt: push.lastSyncedAt,
  });

  const handleSave = React.useCallback(async () => {
    try {
      await preferencesState.save();
      toast.success("Operator delivery preferences saved.");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to save operator delivery preferences."));
    }
  }, [preferencesState]);

  const handleRefresh = React.useCallback(async () => {
    try {
      await Promise.all([
        preferencesState.refresh(),
        push.refresh({ preserveError: true }),
      ]);
      toast.success("Operator delivery status refreshed.");
    } catch (refreshError) {
      toast.error(getErrorMessage(refreshError, "Failed to refresh operator delivery status."));
    }
  }, [preferencesState, push]);

  const enableBrowserAlerts = React.useCallback(async () => {
    try {
      await push.subscribe();
      toast.success("This browser is ready for operator push alerts.");
    } catch (subscribeError) {
      toast.error(getErrorMessage(subscribeError, "Failed to enable browser alerts."));
    }
  }, [push]);

  const removeBrowserAlerts = React.useCallback(async () => {
    try {
      await push.unsubscribe();
      toast.success("Browser push subscription removed for this workspace.");
    } catch (unsubscribeError) {
      toast.error(getErrorMessage(unsubscribeError, "Failed to remove browser alerts."));
    }
  }, [push]);

  const syncBrowserAlerts = React.useCallback(async () => {
    try {
      await push.sync();
      toast.success("Browser subscription synced.");
    } catch (syncError) {
      toast.error(getErrorMessage(syncError, "Failed to sync browser subscription."));
    }
  }, [push]);

  return (
    <Card className="border-none bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">Operator Alert Delivery</CardTitle>
        <CardDescription>
          Configure how NexusQ reaches operators when Workflow A captures a lead and Workflow D persists a stage change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {preferencesState.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Preferences unavailable</AlertTitle>
            <AlertDescription>{preferencesState.error}</AlertDescription>
          </Alert>
        ) : null}

        {!clientId ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No active workspace</AlertTitle>
            <AlertDescription>
              Browser push subscriptions are stored per workspace. Link or select a workspace before syncing this device.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <ChannelStatusRow
            icon={<BellRing className="h-4 w-4" />}
            title="Browser push"
            status={pushStatus}
          />
          <ChannelStatusRow
            icon={<MessageSquare className="h-4 w-4" />}
            title="SMS delivery"
            status={smsStatus}
          />
        </div>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operator-alert-phone">SMS phone number</Label>
              <Input
                id="operator-alert-phone"
                type="tel"
                placeholder="+15551234567"
                value={preferencesState.draft.phone}
                onChange={(event) =>
                  preferencesState.setDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Use E.164 format so SMS delivery can be routed without further normalization.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <Label htmlFor="sms-alerts-enabled" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>SMS operator alerts</span>
                </Label>
                <Switch
                  id="sms-alerts-enabled"
                  checked={preferencesState.draft.smsAlertsEnabled}
                  onCheckedChange={(checked) =>
                    preferencesState.setDraft((current) => ({
                      ...current,
                      smsAlertsEnabled: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <Label htmlFor="push-alerts-enabled" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <BellRing className="h-4 w-4 text-primary" />
                  <span>Browser push operator alerts</span>
                </Label>
                <Switch
                  id="push-alerts-enabled"
                  checked={preferencesState.draft.pushAlertsEnabled}
                  onCheckedChange={(checked) =>
                    preferencesState.setDraft((current) => ({
                      ...current,
                      pushAlertsEnabled: checked,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-2"
                onClick={handleSave}
                disabled={!preferencesState.dirty || preferencesState.saving}
              >
                {preferencesState.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Delivery Preferences
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleRefresh()}
                disabled={preferencesState.refreshing || preferencesState.loading || push.loading || push.syncing}
              >
                {preferencesState.refreshing || push.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh Status
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Last saved: {formatTimestamp(preferencesState.preferences?.updatedAt ?? null) ?? "Not saved yet"}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border bg-background p-4">
            <div>
              <div className="text-sm font-semibold">This browser</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Browser delivery requires both operator preference enablement and a synced device subscription.
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Permission</span>
                <Badge variant={badgeVariantForTone(push.permission === "granted" ? "ready" : "attention")}>
                  {push.permission}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Subscription</span>
                <Badge variant={badgeVariantForTone(push.subscribed ? "ready" : "attention")}>
                  {push.subscribed ? "active" : "inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Last sync</span>
                <span className="text-xs">{push.lastSyncedAt ? push.lastSyncedAt.toLocaleTimeString() : "Not yet"}</span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {!push.subscribed ? (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void enableBrowserAlerts()}
                  disabled={!push.canSubscribe || push.loading || push.syncing || !preferencesState.draft.pushAlertsEnabled}
                >
                  {push.loading || push.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {push.permission === "granted" ? "Subscribe This Browser" : "Enable Browser Alerts"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void removeBrowserAlerts()}
                  disabled={push.loading || push.syncing}
                >
                  {push.loading || push.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                  Remove Browser Alerts
                </Button>
              )}

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void syncBrowserAlerts()}
                disabled={!push.canSync || !push.subscribed || push.syncing}
              >
                {push.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Sync Device
              </Button>
            </div>

            {push.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {push.error}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
