import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getAppConfig } from "@/lib/config";
import { notifyAuthStateCleared } from "@/lib/auth-events";
import {
  InvalidSessionStateError,
  MissingSessionError,
  isInvalidSessionStateError,
  isMissingSessionError,
  isSessionInvalidMessage,
} from "@/lib/auth-errors";

type AuthStateChangeListener = (event: AuthChangeEvent, session: Session | null) => void;

function getSupabaseAuthStoragePrefixes() {
  try {
    const projectRef = new URL(getAppConfig().supabaseUrl).hostname.split(".")[0];
    return [`sb-${projectRef}-auth-token`];
  } catch {
    return [];
  }
}

function clearStorageByPrefixes(storage: Storage | undefined, prefixes: string[]) {
  if (!storage || !prefixes.length) return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}-`))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

export function clearPersistedAuthState() {
  if (typeof window === "undefined") return;
  const prefixes = getSupabaseAuthStoragePrefixes();
  clearStorageByPrefixes(window.localStorage, prefixes);
  clearStorageByPrefixes(window.sessionStorage, prefixes);
  notifyAuthStateCleared();
}

async function validateSession(session: Session) {
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error || !data.user) {
    if (isSessionInvalidMessage(error?.message)) {
      throw new InvalidSessionStateError();
    }
    throw error ?? new Error("Unable to validate current session.");
  }
  return session;
}

async function clearInvalidSessionState() {
  clearPersistedAuthState();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignore cleanup failures when the session is already broken.
  }
}

export { InvalidSessionStateError, MissingSessionError, isInvalidSessionStateError, isMissingSessionError };

export async function ensureLiveSession(
  session: Session | null,
  options?: { clearInvalidSession?: boolean }
) {
  if (!session) {
    throw new InvalidSessionStateError();
  }

  const clearInvalidSession = options?.clearInvalidSession !== false;
  try {
    return await validateSession(session);
  } catch (error) {
    const invalid = isInvalidSessionStateError(error) || (error instanceof Error && isSessionInvalidMessage(error.message));
    if (invalid) {
      if (clearInvalidSession) {
        await clearInvalidSessionState();
      }
      throw error instanceof InvalidSessionStateError ? error : new InvalidSessionStateError();
    }
    throw error;
  }
}

export async function ensureActiveSession(options?: { forceRefresh?: boolean; clearInvalidSession?: boolean }) {
  const forceRefresh = options?.forceRefresh === true;
  const clearInvalidSession = options?.clearInvalidSession !== false;

  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      if (clearInvalidSession && isSessionInvalidMessage(error?.message)) {
        await clearInvalidSessionState();
      }
      if (isSessionInvalidMessage(error?.message)) {
        throw new InvalidSessionStateError();
      }
      throw new MissingSessionError(error?.message || undefined);
    }

    try {
      return await ensureLiveSession(data.session, { clearInvalidSession });
    } catch (validationError) {
      throw validationError instanceof Error ? validationError : new Error("Your session is invalid.");
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to resolve session: ${error.message}`);
  }
  if (!data.session) {
    throw new MissingSessionError();
  }

  try {
    return await ensureLiveSession(data.session, { clearInvalidSession });
  } catch (validationError) {
    try {
      return await ensureActiveSession({ forceRefresh: true, clearInvalidSession });
    } catch (refreshError) {
      if (clearInvalidSession) {
        await clearInvalidSessionState();
      }
      throw refreshError instanceof Error ? refreshError : validationError;
    }
  }
}

export async function ensureActiveAccessToken(options?: { forceRefresh?: boolean; clearInvalidSession?: boolean }) {
  const session = await ensureActiveSession(options);
  return session.access_token;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildRedirectUrl(path: string, explicitValue?: string) {
  if (explicitValue) return explicitValue;

  if (typeof window === "undefined") return undefined;
  return `${stripTrailingSlash(window.location.origin)}${path}`;
}

export function getOAuthRedirectUrl() {
  return buildRedirectUrl("/auth/callback", getAppConfig().authRedirectUrl);
}

export function getPasswordResetRedirectUrl() {
  return buildRedirectUrl("/reset-password", getAppConfig().passwordResetRedirectUrl);
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: getOAuthRedirectUrl(),
      data: {
        full_name: params.fullName,
        phone: params.phone,
      },
    },
  });
}

export async function signInWithEmailPassword(params: { email: string; password: string }) {
  return supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
}

export async function signInWithGoogleOAuth() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getOAuthRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function getCurrentSession() {
  try {
    const session = await ensureActiveSession({ clearInvalidSession: true });
    return { data: { session }, error: null };
  } catch (error) {
    if (isMissingSessionError(error)) {
      return {
        data: { session: null },
        error: null,
      };
    }

    if (isInvalidSessionStateError(error) || (error instanceof Error && isSessionInvalidMessage(error.message))) {
      return {
        data: { session: null },
        error: new InvalidSessionStateError(),
      };
    }

    return {
      data: { session: null },
      error: error instanceof Error ? error : new Error("Unable to restore your session."),
    };
  }
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function exchangeOAuthCodeForSession(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}

export function subscribeToAuthChanges(listener: AuthStateChangeListener) {
  return supabase.auth.onAuthStateChange(listener);
}

export async function signOutCurrentUser() {
  try {
    return await supabase.auth.signOut();
  } finally {
    clearPersistedAuthState();
  }
}

export function getUserDisplayName(user: User | null) {
  if (!user) return "";
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  if (user.email) return user.email;
  return user.id;
}
