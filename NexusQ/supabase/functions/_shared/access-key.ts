export type AccessRole = "owner" | "admin" | "viewer";

const ALLOWED_ROLES = new Set<AccessRole>(["owner", "admin", "viewer"]);

export function isAccessRole(value: unknown): value is AccessRole {
  return typeof value === "string" && ALLOWED_ROLES.has(value as AccessRole);
}

export function generateRawAccessKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const groups = [hex.slice(0, 8), hex.slice(8, 16), hex.slice(16, 24), hex.slice(24, 32), hex.slice(32, 40), hex.slice(40, 48)];
  return normalizeAccessKey(`NQ-${groups.join("-")}`);
}

export function normalizeAccessKey(rawValue: string) {
  return rawValue.trim().toUpperCase();
}

export async function sha256Hex(rawValue: string) {
  const bytes = new TextEncoder().encode(rawValue);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeIsoDateOrNull(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function canManageAccessKeys(callerRole: AccessRole) {
  return callerRole === "owner" || callerRole === "admin";
}
