import {
  clearPersistedTelemetryEvents,
  readPersistedTelemetryEvents,
  writePersistedTelemetryEvents,
} from "@/lib/persistence/telemetry";

type TelemetryEvent = {
  type: "error" | "ui";
  message: string;
  meta?: Record<string, unknown>;
  at: string;
};

function readEvents(): TelemetryEvent[] {
  return readPersistedTelemetryEvents();
}

function writeEvents(events: TelemetryEvent[]) {
  writePersistedTelemetryEvents(events);
}

export function trackTelemetry(event: Omit<TelemetryEvent, "at">) {
  const full: TelemetryEvent = { ...event, at: new Date().toISOString() };
  const events = [full, ...readEvents()];
  writeEvents(events);
  if (event.type === "error") {
    // Keep console visibility for operator debugging.
    console.error("[Telemetry]", full);
  }
}

export function getTelemetryEvents() {
  return readEvents();
}

export function clearTelemetryEvents() {
  clearPersistedTelemetryEvents();
}
