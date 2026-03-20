import test from "node:test";
import assert from "node:assert/strict";
import { installMockBrowser } from "./helpers/mock-browser.ts";
import { STORAGE_KEYS } from "../src/lib/persistence/keys.ts";
import { readStoredJson, writeStoredJson } from "../src/lib/persistence/storage.ts";
import {
  clearNotificationReadState,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationReadState,
} from "../src/lib/persistence/notifications.ts";

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
