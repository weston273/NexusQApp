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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ThemeMode = "light" | "dark";

type AppSettingsState = {
  operatorName: string;
  operatorEmail: string;
  timezone: string;
  autoRefresh: boolean;
  pushNotifications: boolean;
  auditTrail: boolean;
  theme: ThemeMode;
};

const SETTINGS_KEY = "nexusq.settings";

const defaultSettings: AppSettingsState = {
  operatorName: "Operator Alpha",
  operatorEmail: "operator@system.io",
  timezone: "Africa/Harare",
  autoRefresh: true,
  pushNotifications: true,
  auditTrail: true,
  theme: "light",
};

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

function loadSettings(): AppSettingsState {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        return { ...defaultSettings, theme: savedTheme };
      }
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettingsState>;
    const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
    const theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : parsed.theme === "dark" || parsed.theme === "light"
        ? parsed.theme
        : defaultSettings.theme;

    return {
      ...defaultSettings,
      ...parsed,
      theme,
    };
  } catch {
    return defaultSettings;
  }
}

const navCards = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Pipeline", icon: BarChart3, path: "/pipeline" },
  { label: "Lead Intake", icon: UserPlus, path: "/intake" },
  { label: "System Health", icon: Activity, path: "/health" },
  { label: "Settings", icon: Settings2, path: "/settings" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = React.useState<AppSettingsState>(() => loadSettings());

  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem("theme", settings.theme);
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure operator preferences, notifications, and system behavior.
          </p>
        </div>

        <Button size="sm" className="gap-2" onClick={saveSettings}>
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

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
              className="w-full justify-start gap-2"
              onClick={() => setSettings((prev) => ({ ...prev, theme: "light" }))}
            >
              <Sun className="h-4 w-4" />
              Light Theme
            </Button>
            <Button
              variant={settings.theme === "dark" ? "default" : "outline"}
              className="w-full justify-start gap-2"
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
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Auto Refresh Data</span>
              </div>
              <Switch
                checked={settings.autoRefresh}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoRefresh: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Security Audit Trail</span>
              </div>
              <Switch
                checked={settings.auditTrail}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, auditTrail: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Push Notifications</span>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, pushNotifications: checked }))}
              />
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
    </div>
  );
}
