export class InvalidSessionStateError extends Error {
  constructor(message = "Your saved session is no longer valid. Please sign in again.") {
    super(message);
    this.name = "InvalidSessionStateError";
  }
}

export class MissingSessionError extends Error {
  constructor(message = "You are not signed in. Please sign in again.") {
    super(message);
    this.name = "MissingSessionError";
  }
}

export function isSessionInvalidMessage(message: string | undefined | null) {
  const lower = String(message ?? "").toLowerCase();
  return (
    lower.includes("invalid jwt") ||
    lower.includes("jwt expired") ||
    lower.includes("refresh token") ||
    lower.includes("session expired") ||
    lower.includes("invalid refresh token") ||
    lower.includes("session_not_found") ||
    lower.includes("session not found") ||
    lower.includes("session from session_id claim")
  );
}

export function isInvalidSessionStateError(error: unknown): error is InvalidSessionStateError {
  return error instanceof InvalidSessionStateError;
}

export function isMissingSessionError(error: unknown): error is MissingSessionError {
  return error instanceof MissingSessionError;
}
