import type { LeadEvent } from "@/lib/leads";
import { formatEventLabel, getEventSeverity } from "@/lib/leads";
import type { ClientNotificationRecord } from "@/lib/types/domain";
import type { NotificationCenterItem, NotificationSection } from "@/features/notifications/types";

function buildLeadActionPath(leadId: string | null) {
  return leadId ? `/pipeline?lead=${encodeURIComponent(leadId)}` : "/pipeline";
}

function buildActionPath(args: { linkPath?: string | null; leadId: string | null; fallbackPath?: string }) {
  const { linkPath = null, leadId, fallbackPath = "/health" } = args;
  if (linkPath) return linkPath;
  if (leadId) return buildLeadActionPath(leadId);
  return fallbackPath;
}

function buildActionLabel(actionPath: string) {
  if (actionPath.startsWith("/pipeline")) return "Open lead workflow";
  if (actionPath.startsWith("/health")) return "Open health";
  if (actionPath.startsWith("/settings")) return "Open settings";
  if (actionPath.startsWith("/notifications")) return "Open notifications";
  return "Open detail";
}

function severityWeight(value: NotificationCenterItem["severity"]) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

export function compareNotifications(a: NotificationCenterItem, b: NotificationCenterItem) {
  if (a.read !== b.read) return a.read ? 1 : -1;
  const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
  if (severityDiff !== 0) return severityDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function mapWorkspaceNotifications(
  notifications: ClientNotificationRecord[],
  isRead: (notificationId: string, createdAt: string, readAt: string | null) => boolean
) {
  return notifications.map<NotificationCenterItem>((notification) => {
    const actionPath = buildActionPath({
      linkPath: notification.linkPath,
      leadId: notification.leadId,
      fallbackPath: notification.type?.includes("health") ? "/health" : "/notifications",
    });

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      createdAt: notification.createdAt,
      leadId: notification.leadId,
      actionPath,
      actionLabel: buildActionLabel(actionPath),
      sourceKind: "client_notifications",
      sourceLabel: notification.source || "Workspace notification",
      eventType: notification.type ?? "notification",
      read: isRead(notification.id, notification.createdAt, notification.readAt),
      readAt: notification.readAt,
    };
  });
}

export function mapFallbackNotifications(
  events: LeadEvent[],
  isRead: (notificationId: string, createdAt: string, readAt: string | null) => boolean,
  limit: number
) {
  const seen = new Set<string>();
  const items: NotificationCenterItem[] = [];

  for (const event of events) {
    const key = `${event.event_type}|${event.lead_id ?? "na"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const actionPath = buildActionPath({ leadId: event.lead_id, fallbackPath: "/health" });
    items.push({
      id: event.id,
      title: formatEventLabel(event.event_type),
      body: event.lead_id ? `Lead #${event.lead_id.slice(0, 8)}` : "System activity event",
      severity: getEventSeverity(event.event_type),
      createdAt: event.created_at,
      leadId: event.lead_id,
      actionPath,
      actionLabel: buildActionLabel(actionPath),
      sourceKind: "lead_events",
      sourceLabel: "Derived activity fallback",
      eventType: event.event_type,
      read: isRead(event.id, event.created_at, null),
      readAt: null,
    });

    if (items.length >= limit) break;
  }

  return items;
}

export function buildNotificationSections(notifications: NotificationCenterItem[]) {
  const unread = notifications.filter((notification) => !notification.read);
  const read = notifications.filter((notification) => notification.read);
  const sections: NotificationSection[] = [];

  if (unread.length) {
    sections.push({ title: "Unread", count: unread.length, items: unread });
  }
  if (read.length) {
    sections.push({ title: "Read", count: read.length, items: read });
  }

  return sections;
}
