import { Bell, RefreshCcw, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationCenterPanel } from "@/features/notifications/components/NotificationCenterPanel";
import { NotificationOverview } from "@/features/notifications/components/NotificationOverview";
import { useNotificationCenterContext } from "@/features/notifications/NotificationCenterProvider";
import { OperatorAlertDeliveryIndicator } from "@/pages/settings/OperatorAlertDeliveryCard";

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    sourceKind,
    lastLoadedAt,
    refresh,
  } = useNotificationCenterContext();

  const actionableCount = notifications.filter((notification) => Boolean(notification.actionPath)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notification Center"
        description="Workspace alerts, automation outcomes, and fallback operator activity in one place."
        lastUpdatedLabel={`Last updated: ${lastLoadedAt ? lastLoadedAt.toLocaleTimeString() : "Not yet synced"}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={refresh}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4" />
              Notification Settings
            </Button>
          </>
        }
      />

      <NotificationOverview
        unreadCount={unreadCount}
        totalCount={notifications.length}
        sourceKind={sourceKind}
        actionableCount={actionableCount}
        lastLoadedAt={lastLoadedAt}
      />

      <OperatorAlertDeliveryIndicator />

      <Card className="border-none bg-muted/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Workspace queue</div>
              <div className="text-xs text-muted-foreground">
                Use this center for triage, then jump directly into the relevant workflow.
              </div>
            </div>
          </div>

          <NotificationCenterPanel />
        </CardContent>
      </Card>
    </div>
  );
}
