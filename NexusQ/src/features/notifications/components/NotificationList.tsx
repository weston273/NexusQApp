import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationCenterItem, NotificationSection } from "@/features/notifications/types";

function severityBadgeClass(severity: NotificationCenterItem["severity"]) {
  if (severity === "high") return "text-[9px] border-status-error/40 text-status-error";
  if (severity === "medium") return "text-[9px] border-status-warning/40 text-status-warning";
  return "text-[9px] border-status-info/40 text-status-info";
}

type NotificationListProps = {
  sections: NotificationSection[];
  notificationsEnabled: boolean;
  loading: boolean;
  unreadCount: number;
  sourceKind: "client_notifications" | "lead_events";
  sourceError: string | null;
  onNotificationOpen: (notification: NotificationCenterItem) => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onViewAll?: () => void;
  compact?: boolean;
};

export function NotificationList({
  sections,
  notificationsEnabled,
  loading,
  unreadCount,
  sourceKind,
  sourceError,
  onNotificationOpen,
  onMarkRead,
  onMarkAllRead,
  onViewAll,
  compact = false,
}: NotificationListProps) {
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {unreadCount} unread
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {sourceKind === "client_notifications" ? "Workspace source" : "Fallback source"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {sourceKind === "client_notifications"
              ? "Notifications are coming from client_notifications for this workspace."
              : "No workspace notifications found. Showing derived lead-event fallback."}
          </div>
          {sourceError ? <div className="text-xs text-status-warning">{sourceError}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onMarkAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
          {onViewAll ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onViewAll}>
              View full center
            </Button>
          ) : null}
        </div>
      </div>

      {!notificationsEnabled ? (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          In-app alert cues are off on this device. SMS and browser push delivery are configured separately.
        </div>
      ) : null}

      {itemCount ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{section.title}</div>
                <div className="text-[10px] text-muted-foreground">{section.count}</div>
              </div>

              {section.items.map((notification) => (
                <Card
                  key={notification.id}
                  className={`border transition-colors ${notification.read ? "bg-card" : "bg-primary/5 border-primary/20"}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => onNotificationOpen(notification)} className="flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold">{notification.title}</div>
                          <Badge variant="outline" className={severityBadgeClass(notification.severity)}>
                            {notification.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] uppercase">
                            {notification.sourceKind === "client_notifications" ? "workspace" : "fallback"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                          {notification.body || notification.sourceLabel}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{new Date(notification.createdAt).toLocaleString()}</span>
                          <span>&bull;</span>
                          <span>{notification.actionLabel}</span>
                        </div>
                      </button>

                      <div className="flex flex-col items-end gap-1">
                        {!notification.read ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => onMarkRead(notification.id)}
                          >
                            Mark read
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => onNotificationOpen(notification)}
                        >
                          Open
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Loading workspace notifications...
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Bell className="h-5 w-5 mx-auto mb-3 opacity-60" />
          <div className="font-medium text-foreground">No notifications yet</div>
          <div className="mt-1">
            {compact
              ? "Recent workspace updates and fallback activity will appear here."
              : "Workspace notifications and important lead activity will appear here as they arrive."}
          </div>
        </div>
      )}
    </div>
  );
}
