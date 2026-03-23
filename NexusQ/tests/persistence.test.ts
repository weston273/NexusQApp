import test from "node:test";
import assert from "node:assert/strict";
import { installMockBrowser } from "./helpers/mock-browser.ts";
import { STORAGE_KEYS } from "../src/lib/persistence/keys.ts";
import { HEALTH_LOG_STORAGE_KEY, HEALTH_SERVICE_STORAGE_KEY } from "../src/features/health/types.ts";
import { readStoredJson, writeStoredJson } from "../src/lib/persistence/storage.ts";
import {
  clearNotificationReadState,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationReadState,
} from "../src/lib/persistence/notifications.ts";
import { clearSensitiveLocalState } from "../src/lib/persistence/sensitive.ts";

const browser = installMockBrowser();

test.after(() => {
  browser.cleanup();
});

test("storage helpers serialize safely and fall back on invalid JSON", () => {
  browser.reset();

  writeStoredJson("test.settings", { enabled: true, count: 2 });
  const parsed = readStoredJson(
    "test.settings",
    (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return value as { enabled: boolean; count: number };
    },
    { enabled: false, count: 0 }
  );

  assert.deepEqual(parsed, { enabled: true, count: 2 });

  browser.localStorage.setItem("test.settings", "{invalid-json");
  const fallback = readStoredJson("test.settings", () => null, { enabled: false, count: 0 });
  assert.deepEqual(fallback, { enabled: false, count: 0 });
});

test("notification read-state persists per workspace and can be reset", () => {
  browser.reset();

  markNotificationRead("client-a", "notif-1");
  let state = readNotificationReadState("client-a");
  assert.deepEqual(state.readIds, ["notif-1"]);
  assert.equal(state.lastReadAllAt, 0);

  markAllNotificationsRead("client-a");
  state = readNotificationReadState("client-a");
  assert.equal(state.readIds.includes("notif-1"), true);
  assert.equal(state.lastReadAllAt > 0, true);

  markNotificationRead("client-b", "notif-2");
  assert.deepEqual(readNotificationReadState("client-b").readIds, ["notif-2"]);

  clearNotificationReadState("client-a");
  assert.deepEqual(readNotificationReadState("client-a"), { lastReadAllAt: 0, readIds: [] });
  assert.deepEqual(readNotificationReadState("client-b").readIds, ["notif-2"]);

  clearNotificationReadState();
  assert.equal(browser.localStorage.getItem(STORAGE_KEYS.notificationReadState), null);
});

test("sensitive local state cleanup removes intake, health, and telemetry caches without touching notifications", () => {
  browser.reset();

  browser.localStorage.setItem(STORAGE_KEYS.intakeDraft, JSON.stringify({ step: "contact" }));
  browser.localStorage.setItem(STORAGE_KEYS.intakeAddresses, JSON.stringify(["123 Main St"]));
  browser.localStorage.setItem(HEALTH_LOG_STORAGE_KEY, JSON.stringify([{ event: "cached" }]));
  browser.localStorage.setItem(HEALTH_SERVICE_STORAGE_KEY, JSON.stringify([{ name: "Workflow E" }]));
  browser.localStorage.setItem(STORAGE_KEYS.telemetryEvents, JSON.stringify([{ type: "ui", message: "cached", at: "2026-03-23T10:00:00.000Z" }]));
  browser.localStorage.setItem(STORAGE_KEYS.notificationReadState, JSON.stringify({ "client-a": { lastReadAllAt: 1, readIds: ["notif-1"] } }));

  clearSensitiveLocalState();

  assert.equal(browser.localStorage.getItem(STORAGE_KEYS.intakeDraft), null);
  assert.equal(browser.localStorage.getItem(STORAGE_KEYS.intakeAddresses), null);
  assert.equal(browser.localStorage.getItem(HEALTH_LOG_STORAGE_KEY), null);
  assert.equal(browser.localStorage.getItem(HEALTH_SERVICE_STORAGE_KEY), null);
  assert.equal(browser.localStorage.getItem(STORAGE_KEYS.telemetryEvents), null);
  assert.notEqual(browser.localStorage.getItem(STORAGE_KEYS.notificationReadState), null);
});
