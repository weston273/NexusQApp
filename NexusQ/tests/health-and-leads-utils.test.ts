import test from "node:test";
import assert from "node:assert/strict";
import {
  getEventSeverity,
  minutesBetween,
  normalizeLeadStatus,
  normalizePipelineStage,
} from "../src/lib/leads.ts";
import {
  freshnessPercent,
  inferWorkflowKey,
  mapAutomationHealthToServices,
  parseTimestampMs,
  staleSignalLabel,
  upsertWorkflowService,
} from "../src/features/health/utils.ts";
import { buildAttentionItems } from "../src/features/dashboard/utils.ts";

test("lead helpers normalize pipeline stages and event severity consistently", () => {
  assert.equal(normalizeLeadStatus("contacted"), "qualifying");
  assert.equal(normalizeLeadStatus("quote_sent"), "quoted");
  assert.equal(normalizeLeadStatus("won_deal"), "booked");
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
  assert.equal(services[0]?.name, "Health Monitoring");
});

test("workflow service upsert replaces an existing workflow snapshot without duplicating it", () => {
  const services = upsertWorkflowService(
    [
      {
        name: "Health Monitoring",
        status: "unknown",
        last_run_at: null,
        minutes_since: null,
        error: "No health signal received yet.",
      },
      {
        name: "First Response",
        status: "optimal",
        last_run_at: "2026-03-23T12:00:00.000Z",
        minutes_since: 0,
        error: null,
      },
    ],
    {
      name: "Health Monitoring",
      status: "optimal",
      last_run_at: "2026-03-23T12:01:00.000Z",
      minutes_since: 0,
      error: null,
    }
  );

  assert.equal(services.filter((service) => service.name === "Health Monitoring").length, 1);
  assert.equal(services.find((service) => service.name === "Health Monitoring")?.status, "optimal");
  assert.equal(services.find((service) => service.name === "First Response")?.status, "optimal");
});

test("dashboard attention items surface stale quotes and missing value gaps", () => {
  const items = buildAttentionItems({
    leads: [
      {
        id: "lead-1",
        client_id: "client-1",
        name: "Taylor",
        phone: null,
        email: null,
        source: "web",
        status: "quoted",
        score: null,
        created_at: new Date(Date.now() - 80 * 3_600_000).toISOString(),
        last_contacted_at: null,
        service: "plumbing",
        urgency: "standard",
        address: "123 Main",
      },
    ],
    pipelineRows: [
      {
        id: "pipe-1",
        client_id: "client-1",
        lead_id: "lead-1",
        stage: "quoted",
        value: 0,
        probability: 60,
        updated_at: new Date().toISOString(),
      },
    ],
    avgResponseToday: 42,
  });

  assert.equal(items.length, 3);
  assert.equal(items[0]?.title, "Quoted leads need follow-up");
  assert.equal(items[1]?.title, "Revenue values still missing");
  assert.equal(items[2]?.title, "Response time is slipping");
});
