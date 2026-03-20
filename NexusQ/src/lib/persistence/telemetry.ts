import { STORAGE_KEYS } from "@/lib/persistence/keys";
import { readStoredJson, removeStoredValue, writeStoredJson } from "@/lib/persistence/storage";

export type PersistedTelemetryEvent = {
  type: "error" | "ui";
  message: string;
  meta?: Record<string, unknown>;
  at: string;
};

function parseTelemetryEvents(value: unknown) {
  if (!Array.isArray(value)) return null;

  return value
    .filter((item): item is PersistedTelemetryEvent => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      return (
        (record.type === "error" || record.type === "ui") &&
        typeof record.message === "string" &&
        typeof record.at === "string"
      );
    })
    .slice(0, 200);
}

export function readPersistedTelemetryEvents() {
  return readStoredJson<PersistedTelemetryEvent[]>(STORAGE_KEYS.telemetryEvents, parseTelemetryEvents, []);
}

export function writePersistedTelemetryEvents(events: PersistedTelemetryEvent[]) {
  writeStoredJson(STORAGE_KEYS.telemetryEvents, events.slice(0, 200));
}

export function clearPersistedTelemetryEvents() {
  removeStoredValue(STORAGE_KEYS.telemetryEvents);
}
