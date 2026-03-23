import { Server, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetworkSnapshot } from "@/features/health/types";
import { activeRouteDisplayName } from "@/features/health/utils";

export function HealthNetworkCard({ networkSnapshot }: { networkSnapshot: NetworkSnapshot }) {
  return (
    <Card className="border-none bg-muted/30 h-[30rem] flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Network Map</CardTitle>
        <CardDescription>Live health endpoint probes, latency, and browser connectivity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Wifi className="h-3.5 w-3.5" />
              Client Link
            </div>
            <div
              className={`mt-1 text-xs font-bold ${
                networkSnapshot.browser.online ? "text-status-success" : "text-status-error"
              }`}
            >
              {networkSnapshot.browser.online ? "Online" : "Offline"}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {networkSnapshot.browser.effectiveType ? `${networkSnapshot.browser.effectiveType.toUpperCase()} | ` : ""}
              {networkSnapshot.browser.downlinkMbps != null ? `${networkSnapshot.browser.downlinkMbps.toFixed(1)} Mbps` : "Downlink -"}
            </div>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Server className="h-3.5 w-3.5" />
              Active Route
            </div>
            <div className="mt-1 text-xs font-bold">{activeRouteDisplayName(networkSnapshot)}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Last probe: {networkSnapshot.checkedAt ? new Date(networkSnapshot.checkedAt).toLocaleTimeString() : "-"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {networkSnapshot.endpoints.map((endpoint) => {
            const reachableWithoutPayload = endpoint.ok && (endpoint.statusCode ?? 0) >= 400;
            const badgeLabel = endpoint.ok ? (reachableWithoutPayload ? "Reachable" : "Healthy") : "Issue";
            const routeTone = endpoint.ok ? "Managed health route" : "Health route needs attention";

            return (
              <div key={endpoint.label} className="rounded-xl border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">{endpoint.label}</div>
                <Badge
                  variant={endpoint.ok ? "outline" : "destructive"}
                  className="text-[9px] font-bold uppercase tracking-widest"
                >
                  {badgeLabel}
                </Badge>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{routeTone}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div className="rounded-lg border bg-background/80 px-2 py-2">
                  <div>Status</div>
                  <div className="mt-1 text-xs font-bold text-foreground">
                    {endpoint.statusCode == null ? "-" : endpoint.statusCode}
                  </div>
                </div>
                <div className="rounded-lg border bg-background/80 px-2 py-2">
                  <div>Latency</div>
                  <div className="mt-1 text-xs font-bold text-foreground">
                    {endpoint.latencyMs == null ? "-" : `${endpoint.latencyMs}ms`}
                  </div>
                </div>
                <div className="rounded-lg border bg-background/80 px-2 py-2">
                  <div>Checked</div>
                  <div className="mt-1 text-xs font-bold text-foreground">
                    {endpoint.checkedAt ? new Date(endpoint.checkedAt).toLocaleTimeString() : "-"}
                  </div>
                </div>
              </div>
              {endpoint.error ? <div className="mt-2 text-[10px] text-status-warning">{endpoint.error}</div> : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
