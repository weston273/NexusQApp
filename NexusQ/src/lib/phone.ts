export function normalizeE164PhoneInput(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[\s().-]+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
