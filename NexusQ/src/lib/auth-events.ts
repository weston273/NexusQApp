const AUTH_STATE_CLEARED_EVENT = "nexusq:auth-state-cleared";

export function notifyAuthStateCleared() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STATE_CLEARED_EVENT));
}

export function subscribeToAuthStateCleared(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_STATE_CLEARED_EVENT, listener);
  return () => window.removeEventListener(AUTH_STATE_CLEARED_EVENT, listener);
}
