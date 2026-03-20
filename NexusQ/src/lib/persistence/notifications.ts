import { STORAGE_KEYS } from "@/lib/persistence/keys";
import { readStoredJson, removeStoredValue, writeStoredJson } from "@/lib/persistence/storage";

export type NotificationReadState = {
  lastReadAllAt: number;
  readIds: string[];
};

export const NOTIFICATION_READ_STATE_CHANGED_EVENT = "nexusq-notifications-read-state-changed";

type NotificationReadMap = Record<string, NotificationReadState>;

const DEFAULT_READ_STATE: NotificationReadState = {
  lastReadAllAt: 0,
  readIds: [],
};

function parseReadState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const lastReadAllAt = Number(record.lastReadAllAt ?? 0);
  const readIds = Array.isArray(record.readIds)
    ? record.readIds.filter((item): item is string => typeof item === "string").slice(0, 500)
    : [];

  return {
    lastReadAllAt: Number.isFinite(lastReadAllAt) ? lastReadAllAt : 0,
    readIds,
  } satisfies NotificationReadState;
}

function parseReadMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const output: NotificationReadMap = {};

  for (const [clientId, state] of Object.entries(record)) {
    const parsed = parseReadState(state);
    if (parsed) {
      output[clientId] = parsed;
    }
  }

  return output;
}

function readReadMap() {
  return readStoredJson<NotificationReadMap>(STORAGE_KEYS.notificationReadState, parseReadMap, {});
}

function writeReadMap(value: NotificationReadMap) {
  writeStoredJson(STORAGE_KEYS.notificationReadState, value);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_STATE_CHANGED_EVENT, { detail: value }));
  }
}

export function readNotificationReadState(clientId: string | null) {
  if (!clientId) return DEFAULT_READ_STATE;
  return readReadMap()[clientId] ?? DEFAULT_READ_STATE;
}

export function markNotificationRead(clientId: string | null, notificationId: string) {
  if (!clientId || !notificationId) return;
  const map = readReadMap();
  const previous = map[clientId] ?? DEFAULT_READ_STATE;
  const next = {
    ...previous,
    readIds: Array.from(new Set([notificationId, ...previous.readIds])).slice(0, 500),
  } satisfies NotificationReadState;
  writeReadMap({ ...map, [clientId]: next });
}

export function markAllNotificationsRead(clientId: string | null) {
  if (!clientId) return;
  const map = readReadMap();
  const previous = map[clientId] ?? DEFAULT_READ_STATE;
  writeReadMap({
    ...map,
    [clientId]: {
      lastReadAllAt: Date.now(),
      readIds: previous.readIds.slice(0, 500),
    },
  });
}

export function isNotificationRead(args: {
  clientId: string | null;
  notificationId: string;
  createdAt: string;
  remoteReadAt?: string | null;
}) {
  const { clientId, notificationId, createdAt, remoteReadAt = null } = args;
  if (remoteReadAt) return true;

  const state = readNotificationReadState(clientId);
  if (state.readIds.includes(notificationId)) return true;

  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= state.lastReadAllAt;
}

export function clearNotificationReadState(clientId: string | null = null) {
  if (!clientId) {
    removeStoredValue(STORAGE_KEYS.notificationReadState);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_STATE_CHANGED_EVENT, { detail: null }));
    }
    return;
  }

  const map = readReadMap();
  if (!(clientId in map)) return;
  const nextMap = { ...map };
  delete nextMap[clientId];
  if (Object.keys(nextMap).length === 0) {
    removeStoredValue(STORAGE_KEYS.notificationReadState);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_STATE_CHANGED_EVENT, { detail: null }));
    }
    return;
  }
  writeReadMap(nextMap);
}
