import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthLog } from "@/features/health/types";

type HealthActivityLogCardProps = {
  logs: HealthLog[];
  onRefresh: () => void;
  onOpenSettings: () => void;
};

export function HealthActivityLogCard({
  logs,
  onRefresh,
  onOpenSettings,
}: HealthActivityLogCardProps) {
  return (
    <Card className="lg:col-span-2 border-none bg-muted/10 h-[30rem] flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Real-time Activity Log</CardTitle>
        <CardDescription>
          Full retained event history from Workflow E proxy checks, automation snapshots, and Health UI ({logs.length} entries).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="space-y-0 font-mono text-xs h-full overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Health activity log">
          {logs.map((log, index) => (
            <div
              key={`${log.time ?? "na"}-${log.source}-${index}`}
              className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0"
            >
              <span className="text-muted-foreground/60 w-44 flex-shrink-0">
                {log.time ? new Date(log.time).toLocaleString() : "-"}
              </span>
              <div className="flex-1 flex items-center gap-2">
                {log.status === "success" ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-status-success" />
                ) : log.status === "warning" ? (
                  <AlertTriangle className="h-3 w-3 text-status-warning" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-status-info" />
                )}
                <span>{log.event}</span>
              </div>
              <Badge
                variant="secondary"
                className="text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background border"
              >
                {log.source}
              </Badge>
            </div>
          ))}

          {!logs.length && (
            <div className="rounded-lg border border-dashed bg-background/40 p-4 text-sm text-muted-foreground">
              <div>No logs yet.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-9" onClick={onRefresh}>
                  Refresh
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={onOpenSettings}>
                  Settings
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
