import * as React from "react";
import { useNavigate } from "react-router-dom";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import { useNotificationCenterContext } from "@/features/notifications/NotificationCenterProvider";
import type { NotificationCenterItem } from "@/features/notifications/types";

type NotificationCenterPanelProps = {
  compact?: boolean;
  showViewAll?: boolean;
  onAfterNavigate?: () => void;
};

export function NotificationCenterPanel({
  compact = false,
  showViewAll = false,
  onAfterNavigate,
}: NotificationCenterPanelProps) {
  const navigate = useNavigate();
  const {
    sections,
    notificationsEnabled,
    loading,
    unreadCount,
    sourceKind,
    sourceError,
    markRead,
    markAllRead,
  } = useNotificationCenterContext();

  const handleNotificationOpen = React.useCallback(
    (notification: NotificationCenterItem) => {
      markRead(notification.id);
      navigate(notification.actionPath);
      onAfterNavigate?.();
    },
    [markRead, navigate, onAfterNavigate]
  );

  const handleViewAll = React.useCallback(() => {
    navigate("/notifications");
    onAfterNavigate?.();
  }, [navigate, onAfterNavigate]);

  return (
    <NotificationList
      sections={sections}
      notificationsEnabled={notificationsEnabled}
      loading={loading}
      unreadCount={unreadCount}
      sourceKind={sourceKind}
      sourceError={sourceError}
      onNotificationOpen={handleNotificationOpen}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onViewAll={showViewAll ? handleViewAll : undefined}
      compact={compact}
    />
  );
}
