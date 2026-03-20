import { ArrowRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentActivityItem } from "@/features/dashboard/types";

type DashboardActivityCardProps = {
  recentActivity: RecentActivityItem[];
  onViewAll: () => void;
  onAddLead: () => void;
  onRefresh: () => void;
};

export function DashboardActivityCard({
  recentActivity,
  onViewAll,
  onAddLead,
  onRefresh,
}: DashboardActivityCardProps) {
  return (
    <Card className="border-none bg-muted/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Lead Activity</CardTitle>
          <CardDescription>Latest interactions across all channels.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onViewAll}>
          View All <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{activity.user}</div>
                  <div className="text-xs text-muted-foreground">{activity.action}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">
                  {activity.status}
                </Badge>
                <div className="text-[10px] text-muted-foreground mt-1">{activity.time}</div>
              </div>
            </div>
          ))}

          {!recentActivity.length && (
            <div className="rounded-lg border border-dashed bg-background/40 p-4 text-sm text-muted-foreground">
              <div>No activity yet.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-9" onClick={onAddLead}>
                  Add Lead
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={onRefresh}>
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
