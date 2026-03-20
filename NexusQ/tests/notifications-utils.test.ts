import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationSections,
  compareNotifications,
  mapFallbackNotifications,
  mapWorkspaceNotifications,
} from "../src/features/notifications/utils.ts";

test("workspace notifications map into actionable center items", () => {
  const items = mapWorkspaceNotifications(
    [
      {
        id: "notif-1",
        clientId: "client-a",
        title: "Pipeline stalled",
        body: "A quoted lead has been waiting too long.",
        severity: "high",
        createdAt: "2026-03-20T12:00:00.000Z",
        readAt: null,
        linkPath: null,
        leadId: "lead-123",
        source: "pipeline",
        status: null,
        type: "pipeline_alert",
        metadata: null,
      },
    ],
    () => false
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.actionPath, "/pipeline?lead=lead-123");
  assert.equal(items[0]?.sourceKind, "client_notifications");
  assert.equal(items[0]?.actionLabel, "Open lead workflow");
});

test("fallback notifications dedupe recent activity and preserve read grouping priority", () => {
  const items = mapFallbackNotifications(
    [
      {
        id: "evt-1",
        client_id: "client-a",
        lead_id: "lead-1",
        event_type: "status_changed",
        payload_json: null,
        created_at: "2026-03-20T08:00:00.000Z",
      },
      {
        id: "evt-2",
        client_id: "client-a",
        lead_id: "lead-1",
        event_type: "status_changed",
        payload_json: null,
        created_at: "2026-03-20T09:00:00.000Z",
      },
      {
        id: "evt-3",
        client_id: "client-a",
        lead_id: null,
        event_type: "lead_failed",
        payload_json: null,
        created_at: "2026-03-20T10:00:00.000Z",
      },
    ],
    (notificationId) => notificationId === "evt-3",
    5
  );

  assert.equal(items.length, 2);
  assert.equal(items[0]?.id, "evt-1");
  assert.equal(items[1]?.read, true);

  const sorted = [...items].sort(compareNotifications);
  assert.equal(sorted[0]?.read, false);

  const sections = buildNotificationSections(sorted);
  assert.equal(sections[0]?.title, "Unread");
  assert.equal(sections[0]?.count, 1);
  assert.equal(sections[1]?.title, "Read");
  assert.equal(sections[1]?.count, 1);
});
