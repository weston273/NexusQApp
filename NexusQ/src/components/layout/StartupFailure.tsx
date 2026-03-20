import React from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StartupFailure({
  title,
  description,
  details = [],
  actionLabel = "Reload application",
  onAction,
}: {
  title: string;
  description: string;
  details?: string[];
  actionLabel?: string;
  onAction?: () => void;
}) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl border-status-error/20 card-surface-a">
        <CardHeader className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-status-error/10 p-2 text-status-error">
              {offline ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {details.length ? (
            <div className="rounded-lg border bg-background/80 p-4">
              <div className="text-sm font-semibold text-foreground">What to check</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {details.map((detail) => (
                  <li key={detail}>- {detail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border bg-background/80 p-4 text-sm text-muted-foreground">
            Confirm `.env.local` contains real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values. If you just
            changed env values, restart the Vite dev server or redeploy the app first, then reload NexusQ.
          </div>

          {onAction ? (
            <Button onClick={onAction} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
