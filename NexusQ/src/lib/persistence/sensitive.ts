import { clearStoredHealthState } from "@/features/health/cache";
import { clearRecentIntakeAddresses, clearIntakeDraft } from "@/lib/persistence/intake";
import { clearTelemetryEvents } from "@/lib/telemetry";

export function clearSensitiveLocalState() {
  clearIntakeDraft();
  clearRecentIntakeAddresses();
  clearStoredHealthState();
  clearTelemetryEvents();
}
