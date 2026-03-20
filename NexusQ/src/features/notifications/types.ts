export type NotificationSourceKind = "client_notifications" | "lead_events";

export type NotificationCenterItem = {
  id: string;
  title: string;
  body: string | null;
  severity: "high" | "medium" | "low";
  createdAt: string;
  leadId: string | null;
  actionPath: string;
  actionLabel: string;
  sourceKind: NotificationSourceKind;
  sourceLabel: string;
  eventType: string;
  read: boolean;
  readAt: string | null;
};

export type NotificationSection = {
  title: string;
  count: number;
  items: NotificationCenterItem[];
};
