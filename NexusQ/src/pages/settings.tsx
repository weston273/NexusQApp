import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Globe,
  LayoutDashboard,
  Moon,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  UserPlus,
  Activity,
  BarChart3,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { ActionEmptyState } from "@/components/ui/data-state";
import { loadAppSettings, saveAppSettings } from "@/lib/userSettings";
import type { AppSettings } from "@/lib/userSettings";
import { getTelemetryEvents } from "@/lib/telemetry";
import { useAuth } from "@/context/AuthProvider";
import { WorkspaceAccessKeys } from "@/pages/settings/WorkspaceAccessKeys";

const navCards = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Pipeline", icon: BarChart3, path: "/pipeline" },
  { label: "Lead Intake", icon: UserPlus, path: "/intake" },
  { label: "System Health", icon: Activity, path: "/health" },
  { label: "Settings", icon: Settings2, path: "/settings" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { clientId, role, loading, sessionReady, profileReady, accessReady, user, authError } = useAuth();
  const [settings, setSettings] = React.useState<AppSettings>(() => loadAppSettings());
  const [telemetry, setTelemetry] = React.useState(() => getTelemetryEvents().slice(0, 8));

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const saveSettings = () => {
    saveAppSettings(settings);
    toast.success("Settings saved");
    setTelemetry(getTelemetryEvents().slice(0, 8));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure operator preferences, notifications, and system behavior."
        actions={
          <Button size="sm" className="h-10 gap-2" onClick={saveSettings}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-none bg-muted/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Operator Profile</CardTitle>
            <CardDescription>Details displayed across the command center.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operator-name">Display Name</Label>
              <Input
                id="operator-name"
                value={settings.operatorName}
                onChange={(e) => setSettings((prev) => ({ ...prev, operatorName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operator-email">Email</Label>
              <Input
                id="operator-email"
                type="email"
                value={settings.operatorEmail}
                onChange={(e) => setSettings((prev) => ({ ...prev, operatorEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="landing-page">Default Landing Page</Label>
              <select
                id="landing-page"
                value={settings.defaultLandingPage}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, defaultLandingPage: e.target.value as AppSettings["defaultLandingPage"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="/">Dashboard</option>
                <option value="/pipeline">Pipeline</option>
                <option value="/intake">Lead Intake</option>
                <option value="/health">System Health</option>
                <option value="/settings">Settings</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Use the same global app theme.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={settings.theme === "light" ? "default" : "outline"}
              className="h-10 w-full justify-start gap-2"
              onClick={() => setSettings((prev) => ({ ...prev, theme: "light" }))}
            >
              <Sun className="h-4 w-4" />
              Light Theme
            </Button>
            <Button
              variant={settings.theme === "dark" ? "default" : "outline"}
              className="h-10 w-full justify-start gap-2"
              onClick={() => setSettings((prev) => ({ ...prev, theme: "dark" }))}
            >
              <Moon className="h-4 w-4" />
              Dark Theme
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Automation</CardTitle>
            <CardDescription>Control background operational behaviors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <Label htmlFor="auto-refresh" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Globe className="h-4 w-4 text-primary" />
                <span>Auto Refresh Data</span>
              </Label>
              <Switch
                id="auto-refresh"
                checked={settings.autoRefresh}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoRefresh: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <Label htmlFor="audit-trail" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Security Audit Trail</span>
              </Label>
              <Switch
                id="audit-trail"
                checked={settings.auditTrail}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, auditTrail: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <Label htmlFor="push-notifications" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Bell className="h-4 w-4 text-primary" />
                <span>Push Notifications</span>
              </Label>
              <Switch
                id="push-notifications"
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, pushNotifications: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Refresh Interval (sec)</span>
              </div>
              <Input
                value={String(settings.refreshIntervalSec)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSettings((prev) => ({
                    ...prev,
                    refreshIntervalSec: Number.isFinite(n) ? Math.max(5, Math.min(120, Math.round(n))) : prev.refreshIntervalSec,
                  }));
                }}
                className="h-8 w-20 text-right"
                inputMode="numeric"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Dashboard Time Range</span>
              </div>
              <select
                value={settings.dashboardRange}
                onChange={(e) => setSettings((prev) => ({ ...prev, dashboardRange: e.target.value as "7d" | "30d" }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Navigation</CardTitle>
            <CardDescription>Linked access to every app module.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {navCards.map((item) => (
              <Button
                key={item.path}
                variant="outline"
                className="h-12 justify-start gap-2"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {clientId ? (
        <WorkspaceAccessKeys
          clientId={clientId}
          role={role}
          accessLoading={loading}
          sessionReady={sessionReady}
          profileReady={profileReady}
          accessReady={accessReady}
          userId={user?.id ?? null}
          authError={authError}
        />
      ) : null}

      <Card className="border-none bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Diagnostics</CardTitle>
          <CardDescription>Recent client-side telemetry events for troubleshooting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {telemetry.length ? (
            telemetry.map((event, idx) => (
              <div key={`${event.at}-${idx}`} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase">{event.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(event.at).toLocaleString()}</span>
                </div>
                <p className="text-xs mt-1 text-muted-foreground">{event.message}</p>
              </div>
            ))
          ) : (
            <ActionEmptyState
              title="No diagnostics captured yet"
              description="Run normal app actions and save settings to populate this troubleshooting feed."
              primaryActionLabel="Save Settings"
              onPrimaryAction={saveSettings}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
