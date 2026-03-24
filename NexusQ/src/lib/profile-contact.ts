import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { invokeAuthedFunction } from "@/lib/edgeFunctions";
import { normalizeE164PhoneInput } from "@/lib/phone";

const PENDING_SIGNUP_PHONE_KEY = "nexusq.pending-signup-phone";
const PENDING_SIGNUP_PHONE_MAX_AGE_MS = 30 * 60 * 1000;

type PendingSignupPhonePayload = {
  phone?: unknown;
  createdAt?: unknown;
};

type NotificationPreferencesPayload = {
  preferences?: {
    id?: unknown;
    email?: unknown;
    full_name?: unknown;
    phone?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  } | null;
};

export type SyncedOperatorProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toMetadataRecord(user: User | null | undefined) {
  if (!user?.user_metadata || typeof user.user_metadata !== "object" || Array.isArray(user.user_metadata)) {
    return {};
  }
  return user.user_metadata as Record<string, unknown>;
}

export function readUserMetadataPhone(user: User | null | undefined) {
  return normalizeE164PhoneInput(pickString(toMetadataRecord(user).phone) ?? "");
}

export function storePendingSignupPhone(phone: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeE164PhoneInput(phone);
  if (!normalized) return;
  const payload = {
    phone: normalized,
    createdAt: Date.now(),
  } satisfies PendingSignupPhonePayload;
  window.sessionStorage.setItem(PENDING_SIGNUP_PHONE_KEY, JSON.stringify(payload));
}

export function readPendingSignupPhone() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PENDING_SIGNUP_PHONE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingSignupPhonePayload;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : Number.NaN;
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_SIGNUP_PHONE_MAX_AGE_MS) {
      return null;
    }
    return normalizeE164PhoneInput(pickString(parsed.phone) ?? "");
  } catch {
    return normalizeE164PhoneInput(raw);
  }
}

export function consumePendingSignupPhone() {
  if (typeof window === "undefined") return null;
  const raw = readPendingSignupPhone();
  window.sessionStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
  return raw;
}

export function clearPendingSignupPhone() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
}

export async function persistCurrentUserPhone(phone: string, currentUser?: User | null): Promise<SyncedOperatorProfile> {
  const normalized = normalizeE164PhoneInput(phone);
  if (!normalized) {
    throw new Error("Phone number must be a valid E.164 number, for example +15551234567.");
  }

  const activeUser =
    currentUser ??
    (await supabase.auth.getUser()).data.user ??
    null;

  if (!activeUser) {
    throw new Error("No authenticated user is available to update the operator phone number.");
  }

  const existingMetadata: Record<string, unknown> = toMetadataRecord(activeUser);
  const nextMetadata: Record<string, unknown> = {
    ...existingMetadata,
    phone: normalized,
  };

  const { data: updatedUserData, error: updateUserError } = await supabase.auth.updateUser({
    data: nextMetadata,
  });

  if (updateUserError) {
    throw new Error(updateUserError.message);
  }

  const payload = await invokeAuthedFunction<NotificationPreferencesPayload | null>("notification-preferences", {
    action: "update",
    phone: normalized,
  });

  const record = payload?.preferences ?? null;
  const id = pickString(record?.id) ?? activeUser.id;

  return {
    id,
    email: pickString(record?.email) ?? updatedUserData.user?.email ?? activeUser.email ?? null,
    fullName: pickString(record?.full_name) ?? pickString(existingMetadata.full_name) ?? pickString(existingMetadata.name),
    phone: normalizeE164PhoneInput(pickString(record?.phone) ?? normalized) ?? normalized,
    createdAt: pickString(record?.created_at),
    updatedAt: pickString(record?.updated_at),
  } satisfies SyncedOperatorProfile;
}
