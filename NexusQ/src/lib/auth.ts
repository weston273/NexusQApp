import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getAppConfig } from "@/lib/config";

type AuthStateChangeListener = (event: AuthChangeEvent, session: Session | null) => void;

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
}) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: getOAuthRedirectUrl(),
      data: {
        full_name: params.fullName,
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
  return supabase.auth.getSession();
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
  return supabase.auth.signOut();
}

export function getUserDisplayName(user: User | null) {
  if (!user) return "";
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  if (user.email) return user.email;
  return user.id;
}
