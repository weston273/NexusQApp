import { z } from "zod";

const OPTIONAL_HTTP_URL = z
  .string()
  .trim()
  .url("must be a valid absolute URL")
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "must start with http:// or https://",
  });

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authRedirectUrl?: string;
  passwordResetRedirectUrl?: string;
  workflowADevFallbackUrl?: string;
};

export type AppConfigIssue = {
  key: string;
  message: string;
};

export class AppConfigError extends Error {
  readonly issues: AppConfigIssue[];

  constructor(issues: AppConfigIssue[]) {
    super(buildAppConfigErrorMessage(issues));
    this.name = "AppConfigError";
    this.issues = issues;
  }
}

const PLACEHOLDER_VALUES = new Map<string, string[]>([
  ["VITE_SUPABASE_URL", ["https://your-project-ref.supabase.co"]],
  ["VITE_SUPABASE_ANON_KEY", ["your-anon-key"]],
]);

function buildAppConfigErrorMessage(issues: AppConfigIssue[]) {
  if (!issues.length) {
    return "NexusQ configuration is invalid.";
  }

  return [
    "NexusQ configuration is invalid.",
    ...issues.map((issue) => `${issue.key}: ${issue.message}`),
  ].join(" ");
}

function readEnvValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getDefaultEnvSource() {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AUTH_REDIRECT_URL: import.meta.env.VITE_AUTH_REDIRECT_URL,
    VITE_PASSWORD_RESET_REDIRECT_URL: import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL,
    VITE_WORKFLOW_A_DEV_FALLBACK_URL: import.meta.env.VITE_WORKFLOW_A_DEV_FALLBACK_URL,
  } satisfies Partial<Record<string, unknown>>;
}

function validateOptionalUrl(key: string, value: string | undefined, issues: AppConfigIssue[]) {
  if (!value) return undefined;
  const result = OPTIONAL_HTTP_URL.safeParse(value);
  if (result.success) return result.data;
  issues.push({
    key,
    message: result.error.issues[0]?.message ?? "must be a valid absolute URL",
  });
  return undefined;
}

function validatePlaceholderValue(key: string, value: string | undefined, issues: AppConfigIssue[]) {
  if (!value) return;
  const placeholders = PLACEHOLDER_VALUES.get(key) ?? [];
  if (placeholders.includes(value)) {
    issues.push({
      key,
      message: "must be replaced with a real project value, not the example placeholder",
    });
  }
}

export function readAppConfig(env?: Partial<Record<string, unknown>>) {
  const source = env ?? getDefaultEnvSource();
  const issues: AppConfigIssue[] = [];
  const supabaseUrlValue = readEnvValue(source.VITE_SUPABASE_URL);
  const supabaseAnonKey = readEnvValue(source.VITE_SUPABASE_ANON_KEY);
  const authRedirectUrlValue = readEnvValue(source.VITE_AUTH_REDIRECT_URL);
  const passwordResetRedirectUrlValue = readEnvValue(source.VITE_PASSWORD_RESET_REDIRECT_URL);
  const workflowADevFallbackUrlValue = readEnvValue(source.VITE_WORKFLOW_A_DEV_FALLBACK_URL);

  let supabaseUrl = "";
  if (!supabaseUrlValue) {
    issues.push({
      key: "VITE_SUPABASE_URL",
      message: "is required",
    });
  } else {
    const parsed = OPTIONAL_HTTP_URL.safeParse(supabaseUrlValue);
    if (!parsed.success) {
      issues.push({
        key: "VITE_SUPABASE_URL",
        message: parsed.error.issues[0]?.message ?? "must be a valid absolute URL",
      });
    } else {
      supabaseUrl = parsed.data.replace(/\/+$/, "");
    }
  }

  if (!supabaseAnonKey) {
    issues.push({
      key: "VITE_SUPABASE_ANON_KEY",
      message: "is required",
    });
  }

  validatePlaceholderValue("VITE_SUPABASE_URL", supabaseUrlValue, issues);
  validatePlaceholderValue("VITE_SUPABASE_ANON_KEY", supabaseAnonKey, issues);

  const authRedirectUrl = validateOptionalUrl("VITE_AUTH_REDIRECT_URL", authRedirectUrlValue, issues);
  const passwordResetRedirectUrl = validateOptionalUrl(
    "VITE_PASSWORD_RESET_REDIRECT_URL",
    passwordResetRedirectUrlValue,
    issues
  );
  const workflowADevFallbackUrl = validateOptionalUrl(
    "VITE_WORKFLOW_A_DEV_FALLBACK_URL",
    workflowADevFallbackUrlValue,
    issues
  );

  if (issues.length) {
    return {
      ok: false as const,
      error: new AppConfigError(issues),
    };
  }

  return {
    ok: true as const,
    data: {
      supabaseUrl,
      supabaseAnonKey: supabaseAnonKey!,
      authRedirectUrl,
      passwordResetRedirectUrl,
      workflowADevFallbackUrl,
    } satisfies AppConfig,
  };
}

export function getAppConfig(env?: Partial<Record<string, unknown>>) {
  const result = readAppConfig(env);
  if (!result.ok) {
    throw result.error;
  }
  return result.data;
}

export function buildSupabaseFunctionUrl(functionName: string, env?: Partial<Record<string, unknown>>) {
  const { supabaseUrl } = getAppConfig(env);
  return `${supabaseUrl}/functions/v1/${functionName.replace(/^\/+/, "")}`;
}

export function isAppConfigError(error: unknown): error is AppConfigError {
  return error instanceof AppConfigError;
}
