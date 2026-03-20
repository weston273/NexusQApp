import { STORAGE_KEYS } from "@/lib/persistence/keys";
import { readStoredJson, removeStoredValue, writeStoredJson } from "@/lib/persistence/storage";

export type IntakeDraft<Step extends string, FormData> = {
  step: Step;
  formData: FormData;
  countryCode: string;
  phoneNational: string;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

export function loadRecentIntakeAddresses() {
  return readStoredJson<string[]>(STORAGE_KEYS.intakeAddresses, parseStringArray, []);
}

export function saveRecentIntakeAddresses(addresses: string[]) {
  writeStoredJson(STORAGE_KEYS.intakeAddresses, addresses.slice(0, 8));
}

export function loadIntakeDraft<Step extends string, FormData>(
  parser: (value: unknown) => IntakeDraft<Step, FormData> | null
) {
  return readStoredJson<IntakeDraft<Step, FormData> | null>(STORAGE_KEYS.intakeDraft, parser, null);
}

export function saveIntakeDraft<Step extends string, FormData>(draft: IntakeDraft<Step, FormData>) {
  writeStoredJson(STORAGE_KEYS.intakeDraft, draft);
}

export function clearIntakeDraft() {
  removeStoredValue(STORAGE_KEYS.intakeDraft);
}
