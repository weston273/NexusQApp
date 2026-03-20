import { STORAGE_KEYS } from "@/lib/persistence/keys";
import { readStoredString, removeStoredValue, writeStoredString } from "@/lib/persistence/storage";

export function getPersistedActiveClientId() {
  return readStoredString(STORAGE_KEYS.activeClientId);
}

export function setPersistedActiveClientId(clientId: string | null) {
  if (clientId) {
    writeStoredString(STORAGE_KEYS.activeClientId, clientId);
    return;
  }

  removeStoredValue(STORAGE_KEYS.activeClientId);
}
