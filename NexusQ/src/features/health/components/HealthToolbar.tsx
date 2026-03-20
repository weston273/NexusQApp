import { AlertTriangle, CheckCircle2, RefreshCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

type HealthToolbarProps = {
  autoRefresh: boolean;
  loading: boolean;
  headlineOk: boolean;
  incidentMode: boolean;
  adaptiveIntervalSec: number;
  secondsUntilRefresh: number | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

export function HealthToolbar({
  autoRefresh,
  loading,
  headlineOk,
  incidentMode,
  adaptiveIntervalSec,
  secondsUntilRefresh,
  onRefresh,
  onOpenSettings,
}: HealthToolbarProps) {
  return (
    <div className="flex items-center gap-2 justify-end flex-wrap sticky top-[4.25rem] z-20 rounded-lg border bg-background/90 p-2 backdrop-blur-sm md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
      <Button variant="outline" size="sm" className="gap-2 h-10" onClick={onRefresh} aria-label="Refresh health data">
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      <Button variant="outline" size="sm" className="gap-2 h-10" onClick={onOpenSettings} aria-label="Open health settings">
        <Settings className="h-4 w-4" />
        Settings
      </Button>
      {autoRefresh ? (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
            incidentMode
              ? "bg-status-warning/10 text-status-warning border-status-warning/20"
              : "bg-status-info/10 text-status-info border-status-info/20"
          }`}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {incidentMode ? "Rapid Monitor" : "Auto Refresh"} {adaptiveIntervalSec}s
            {secondsUntilRefresh != null ? ` | ${secondsUntilRefresh}s` : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30 text-muted-foreground">
          <span className="text-[10px] font-bold uppercase tracking-wider">Auto Refresh Off</span>
        </div>
      )}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
          headlineOk
            ? "bg-status-success/10 text-status-success border-status-success/20"
            : "bg-status-warning/10 text-status-warning border-status-warning/20"
        }`}
      >
        {headlineOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <span className="text-xs font-bold uppercase tracking-wider">
          {loading ? "Checking..." : headlineOk ? "All Systems Nominal" : "Attention Needed"}
        </span>
      </div>
    </div>
  );
}
