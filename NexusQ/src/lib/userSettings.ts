export type LandingPage = "/" | "/pipeline" | "/intake" | "/health" | "/settings";
export type TimeRange = "7d" | "30d";

export type AppSettings = {
  operatorName: string;
  operatorEmail: string;
  timezone: string;
  autoRefresh: boolean;
  pushNotifications: boolean;
  auditTrail: boolean;
  theme: "light" | "dark";
  defaultLandingPage: LandingPage;
  refreshIntervalSec: number;
  dashboardRange: TimeRange;
};

export const SETTINGS_KEY = "nexusq.settings";
export const SETTINGS_CHANGED_EVENT = "nexusq-settings-changed";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  operatorName: "Operator Alpha",
  operatorEmail: "operator@system.io",
  timezone: "Africa/Harare",
  autoRefresh: true,
  pushNotifications: true,
  auditTrail: true,
  theme: "light",
  defaultLandingPage: "/",
  refreshIntervalSec: 15,
  dashboardRange: "7d",
};

function sanitizeInterval(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APP_SETTINGS.refreshIntervalSec;
  return Math.max(5, Math.min(120, Math.round(n)));
}

function sanitizeLandingPage(value: unknown): LandingPage {
  const v = String(value ?? "");
  if (v === "/" || v === "/pipeline" || v === "/intake" || v === "/health" || v === "/settings") {
    return v;
  }
  return DEFAULT_APP_SETTINGS.defaultLandingPage;
}

function sanitizeRange(value: unknown): TimeRange {
  return value === "30d" ? "30d" : "7d";
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        return { ...DEFAULT_APP_SETTINGS, theme: savedTheme };
      }
      return DEFAULT_APP_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const savedTheme = localStorage.getItem("theme");
    const theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : parsed.theme === "dark" || parsed.theme === "light"
        ? parsed.theme
        : DEFAULT_APP_SETTINGS.theme;

    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      theme,
      defaultLandingPage: sanitizeLandingPage(parsed.defaultLandingPage),
      refreshIntervalSec: sanitizeInterval(parsed.refreshIntervalSec),
      dashboardRange: sanitizeRange(parsed.dashboardRange),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem("theme", settings.theme);
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
}
