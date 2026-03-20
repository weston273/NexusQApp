import { STORAGE_KEYS } from "@/lib/persistence/keys";
import { readStoredJson, readStoredString, writeStoredJson, writeStoredString } from "@/lib/persistence/storage";

export type LandingPage = "/" | "/pipeline" | "/intake" | "/health" | "/notifications" | "/settings";

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
};

export const SETTINGS_KEY = STORAGE_KEYS.appSettings;
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
};

function sanitizeInterval(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APP_SETTINGS.refreshIntervalSec;
  return Math.max(5, Math.min(120, Math.round(n)));
}

function sanitizeLandingPage(value: unknown): LandingPage {
  const v = String(value ?? "");
  if (v === "/" || v === "/pipeline" || v === "/intake" || v === "/health" || v === "/notifications" || v === "/settings") {
    return v;
  }
  return DEFAULT_APP_SETTINGS.defaultLandingPage;
}

function parseStoredAppSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Partial<AppSettings>;
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;

  const parsed = readStoredJson<Partial<AppSettings> | null>(SETTINGS_KEY, parseStoredAppSettings, null);
  const savedTheme = readStoredString(STORAGE_KEYS.theme);

  if (!parsed) {
    if (savedTheme === "dark" || savedTheme === "light") {
      return { ...DEFAULT_APP_SETTINGS, theme: savedTheme };
    }
    return DEFAULT_APP_SETTINGS;
  }

  const theme =
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : parsed.theme === "dark" || parsed.theme === "light"
      ? parsed.theme
      : DEFAULT_APP_SETTINGS.theme;

  return {
    operatorName: typeof parsed.operatorName === "string" ? parsed.operatorName : DEFAULT_APP_SETTINGS.operatorName,
    operatorEmail: typeof parsed.operatorEmail === "string" ? parsed.operatorEmail : DEFAULT_APP_SETTINGS.operatorEmail,
    timezone: typeof parsed.timezone === "string" ? parsed.timezone : DEFAULT_APP_SETTINGS.timezone,
    autoRefresh: typeof parsed.autoRefresh === "boolean" ? parsed.autoRefresh : DEFAULT_APP_SETTINGS.autoRefresh,
    pushNotifications:
      typeof parsed.pushNotifications === "boolean" ? parsed.pushNotifications : DEFAULT_APP_SETTINGS.pushNotifications,
    auditTrail: typeof parsed.auditTrail === "boolean" ? parsed.auditTrail : DEFAULT_APP_SETTINGS.auditTrail,
    theme,
    defaultLandingPage: sanitizeLandingPage(parsed.defaultLandingPage),
    refreshIntervalSec: sanitizeInterval(parsed.refreshIntervalSec),
  };
}

export function saveAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;

  writeStoredJson(SETTINGS_KEY, settings);
  writeStoredString(STORAGE_KEYS.theme, settings.theme);
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
}
