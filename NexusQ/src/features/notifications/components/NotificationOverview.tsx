import { Bell, Clock3, Route, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type NotificationOverviewProps = {
  unreadCount: number;
  totalCount: number;
  sourceKind: "client_notifications" | "lead_events";
  actionableCount: number;
  lastLoadedAt: Date | null;
};

export function NotificationOverview({
  unreadCount,
  totalCount,
  sourceKind,
  actionableCount,
  lastLoadedAt,
}: NotificationOverviewProps) {
  const cards = [
    {
      label: "Unread",
      value: unreadCount,
      description: unreadCount ? "Workspace items still need operator review." : "Everything in the center has been reviewed.",
      icon: Bell,
    },
    {
      label: "Source",
      value: sourceKind === "client_notifications" ? "Workspace" : "Fallback",
      description:
        sourceKind === "client_notifications"
          ? "Using real client_notifications rows for this workspace."
          : "Using derived lead activity until workspace notifications arrive.",
      icon: ShieldCheck,
    },
    {
      label: "Action Targets",
      value: `${actionableCount}/${totalCount}`,
      description: "Notifications with a direct route into the relevant operator workflow.",
      icon: Route,
    },
    {
      label: "Last Sync",
      value: lastLoadedAt ? lastLoadedAt.toLocaleTimeString() : "Not yet",
      description: "Latest successful notification refresh in this browser session.",
      icon: Clock3,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-none bg-muted/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</div>
              <card.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{card.value}</div>
            <div className="text-xs text-muted-foreground">{card.description}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
