import test from "node:test";
import assert from "node:assert/strict";
import {
  getEventSeverity,
  minutesBetween,
  normalizePipelineStage,
} from "../src/lib/leads.ts";
import {
  freshnessPercent,
  inferWorkflowKey,
  mapAutomationHealthToServices,
  parseTimestampMs,
  staleSignalLabel,
} from "../src/features/health/utils.ts";

test("lead helpers normalize pipeline stages and event severity consistently", () => {
  assert.equal(normalizePipelineStage("inspection_scheduled"), "qualifying");
  assert.equal(normalizePipelineStage("quote_sent"), "quoted");
  assert.equal(normalizePipelineStage("won_deal"), "booked");
  assert.equal(normalizePipelineStage("something-unknown"), "new");

  assert.equal(getEventSeverity("lead_failed"), "high");
  assert.equal(getEventSeverity("status_changed"), "medium");
  assert.equal(getEventSeverity("note_added"), "low");
});

test("lead timing helper rejects invalid or reversed timestamps", () => {
  assert.equal(minutesBetween("2026-03-20T10:00:00.000Z", "2026-03-20T10:30:00.000Z"), 30);
  assert.equal(minutesBetween("2026-03-20T10:30:00.000Z", "2026-03-20T10:00:00.000Z"), null);
  assert.equal(minutesBetween("invalid", "2026-03-20T10:00:00.000Z"), null);
});

test("health helpers parse workflow signals and clamp freshness values", () => {
  assert.equal(inferWorkflowKey("Workflow A - Intake"), "A");
  assert.equal(inferWorkflowKey("pipeline sync"), "D");
  assert.equal(inferWorkflowKey("Workflow E health"), "E");
  assert.equal(inferWorkflowKey("mystery service"), null);

  const parsedTimestamp = parseTimestampMs("2026-03-20 10:15:00+02");
  assert.equal(typeof parsedTimestamp, "number");
  assert.equal(Number.isFinite(parsedTimestamp), true);

  assert.equal(freshnessPercent(null), 0);
  assert.equal(freshnessPercent(0), 100);
  assert.equal(freshnessPercent(120), 0);

  assert.deepEqual(staleSignalLabel(8, "degraded"), { label: "Delayed 8m", tone: "danger" });
  assert.deepEqual(staleSignalLabel(20, "stale"), { label: "Stale 20m", tone: "warning" });
  assert.equal(staleSignalLabel(2, "optimal"), null);
});

test("automation health mapping derives a useful fallback error for degraded rows", () => {
  const services = mapAutomationHealthToServices([
    {
      id: "row-1",
      clientId: "client-1",
      workflowName: "Workflow E",
      lastRunAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      status: "degraded",
      errorMessage: null,
      updatedAt: new Date().toISOString(),
      raw: {},
    },
  ]);

  assert.equal(services.length, 1);
  assert.equal(services[0]?.status, "degraded");
  assert.match(services[0]?.error ?? "", /degraded status/i);
});
