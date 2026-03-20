type Parser<T> = (value: unknown) => T | null;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readStoredString(key: string) {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredString(key: string, value: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore persistence failures and let runtime state continue.
  }
}

export function removeStoredValue(key: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore persistence failures and let runtime state continue.
  }
}

export function readStoredJson<T>(key: string, parser: Parser<T>, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = parser(JSON.parse(raw));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore persistence failures and let runtime state continue.
  }
}
