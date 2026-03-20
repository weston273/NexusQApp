import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HealthService } from "@/features/health/types";
import {
  effectiveMinutesSince,
  freshnessPercent,
  pickHealthIcon,
  staleSignalClasses,
  staleSignalLabel,
  statusBadgeVariant,
  statusLabel,
} from "@/features/health/utils";

export function HealthServiceGrid({ services }: { services: HealthService[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {services.map((service) => {
        const Icon = pickHealthIcon(service.name);
        const minutesSince = effectiveMinutesSince(service);
        const freshness = freshnessPercent(minutesSince);
        const staleSignal = staleSignalLabel(minutesSince, service.status);

        return (
          <Card
            key={service.name}
            className={`border-none ${
              service.status === "optimal"
                ? "card-surface-c"
                : service.status === "stale"
                ? "card-surface-d"
                : service.status === "degraded"
                ? "card-surface-b"
                : "card-surface-a"
            }`}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={statusBadgeVariant(service.status)} className="text-[9px] font-bold uppercase">
                    {statusLabel(service.status)}
                  </Badge>
                  {staleSignal ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${staleSignalClasses(staleSignal.tone)}`}
                    >
                      {staleSignal.label}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="text-sm font-bold">{service.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                  Last run: {minutesSince == null ? "-" : `${minutesSince}m ago`}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="opacity-60 uppercase">Freshness</span>
                  <span>{minutesSince == null ? "-" : `${Math.round(freshness)}%`}</span>
                </div>
                <Progress value={freshness} className="h-1" />
              </div>

              {service.error ? <div className="text-[10px] text-status-warning leading-snug">{service.error}</div> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
