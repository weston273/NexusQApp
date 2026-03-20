import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { useClientNotifications } from "@/hooks/useClientNotifications";
import { useLeads } from "@/hooks/useLeads";
import {
  markAllClientNotificationsRead,
  markClientNotificationRead,
} from "@/lib/services/notifications";
import {
  NOTIFICATION_READ_STATE_CHANGED_EVENT,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationReadState,
  type NotificationReadState,
} from "@/lib/persistence/notifications";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";
import {
  buildNotificationSections,
  compareNotifications,
  mapFallbackNotifications,
  mapWorkspaceNotifications,
} from "@/features/notifications/utils";

export function useNotificationCenter(limit = 24) {
  const { clientId } = useAuth();
  const { events } = useLeads();
  const { notifications: workspaceNotifications, loading, error, lastLoadedAt, refresh } = useClientNotifications(limit);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(() => loadAppSettings().pushNotifications);
  const [readState, setReadState] = React.useState<NotificationReadState>(() => readNotificationReadState(clientId));

  React.useEffect(() => {
    setReadState(readNotificationReadState(clientId));
  }, [clientId]);

  React.useEffect(() => {
    const syncReadState = () => setReadState(readNotificationReadState(clientId));
    window.addEventListener(NOTIFICATION_READ_STATE_CHANGED_EVENT, syncReadState as EventListener);
    return () => window.removeEventListener(NOTIFICATION_READ_STATE_CHANGED_EVENT, syncReadState as EventListener);
  }, [clientId]);

  React.useEffect(() => {
    const onSettingsChanged = () => setNotificationsEnabled(loadAppSettings().pushNotifications);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
  }, []);

  const isRead = React.useCallback(
    (notificationId: string, createdAt: string, remoteReadAt: string | null) => {
      if (remoteReadAt) return true;
      const timestamp = new Date(createdAt).getTime();
      return (
        readState.readIds.includes(notificationId) ||
        (Number.isFinite(timestamp) && timestamp <= readState.lastReadAllAt)
      );
    },
    [readState]
  );

  const items = React.useMemo(() => {
    const nextItems = workspaceNotifications.length
      ? mapWorkspaceNotifications(workspaceNotifications, isRead)
      : mapFallbackNotifications(events, isRead, limit);

    return [...nextItems].sort(compareNotifications).slice(0, limit);
  }, [events, isRead, limit, workspaceNotifications]);

  const sections = React.useMemo(() => buildNotificationSections(items), [items]);
  const unreadCount = React.useMemo(() => items.filter((item) => !item.read).length, [items]);
  const sourceKind: "client_notifications" | "lead_events" = workspaceNotifications.length
    ? "client_notifications"
    : "lead_events";

  const handleMarkRead = React.useCallback(
    (notificationId: string) => {
      markNotificationRead(clientId, notificationId);
      setReadState(readNotificationReadState(clientId));
      if (sourceKind === "client_notifications") {
        void markClientNotificationRead(notificationId)
          .then(() => refresh())
          .catch(() => {
            // Keep local read-state even if the remote workspace row could not be updated.
          });
      }
    },
    [clientId, refresh, sourceKind]
  );

  const handleMarkAllRead = React.useCallback(() => {
    markAllNotificationsRead(clientId);
    setReadState(readNotificationReadState(clientId));
    if (sourceKind === "client_notifications" && clientId) {
      void markAllClientNotificationsRead(clientId)
        .then(() => refresh())
        .catch(() => {
          // Keep local read-state even if the remote workspace rows could not be updated.
        });
    }
  }, [clientId, refresh, sourceKind]);

  return {
    notificationsEnabled,
    notifications: items,
    sections,
    unreadCount,
    hasUnread: unreadCount > 0,
    sourceKind,
    sourceError: error,
    loading,
    lastLoadedAt,
    refresh,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
  };
}
