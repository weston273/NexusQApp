import { BellOff, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearStoredHealthState } from "@/features/health/cache";
import { clearIntakeDraft, clearRecentIntakeAddresses } from "@/lib/persistence/intake";
import { clearNotificationReadState } from "@/lib/persistence/notifications";
import { clearTelemetryEvents } from "@/lib/telemetry";

type LocalRecoveryCardProps = {
  clientId: string | null;
  onTelemetryCleared: () => void;
};

export function LocalRecoveryCard({ clientId, onTelemetryCleared }: LocalRecoveryCardProps) {
  return (
    <Card className="border-none bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">Local Recovery</CardTitle>
        <CardDescription>Browser-only state used for draft recovery, notification reads, and diagnostics.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Button
          variant="outline"
          className="h-auto min-h-14 justify-start gap-3 py-3 text-left"
          onClick={() => {
            clearIntakeDraft();
            clearRecentIntakeAddresses();
            toast.success("Saved intake draft and recent addresses cleared from this browser.");
          }}
        >
          <RefreshCcw className="h-4 w-4 shrink-0" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Clear intake draft</span>
            <span className="text-[11px] text-muted-foreground">Resets the recovered lead-intake form state.</span>
          </span>
        </Button>

        <Button
          variant="outline"
          className="h-auto min-h-14 justify-start gap-3 py-3 text-left"
          onClick={() => {
            clearNotificationReadState(clientId);
            toast.success("Notification read state reset for this workspace.");
          }}
        >
          <BellOff className="h-4 w-4 shrink-0" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Reset notification reads</span>
            <span className="text-[11px] text-muted-foreground">Marks workspace notifications as unread again on this device.</span>
          </span>
        </Button>

        <Button
          variant="outline"
          className="h-auto min-h-14 justify-start gap-3 py-3 text-left"
          onClick={() => {
            clearStoredHealthState();
            clearTelemetryEvents();
            onTelemetryCleared();
            toast.success("Client-side diagnostics and health cache cleared.");
          }}
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Clear diagnostics log</span>
            <span className="text-[11px] text-muted-foreground">Removes stored browser telemetry from this device.</span>
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}
