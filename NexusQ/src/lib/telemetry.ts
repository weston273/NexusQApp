type TelemetryEvent = {
  type: "error" | "ui";
  message: string;
  meta?: Record<string, unknown>;
  at: string;
};

const TELEMETRY_KEY = "nexusq.telemetry.events";

function readEvents(): TelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TelemetryEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: TelemetryEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events.slice(0, 200)));
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
