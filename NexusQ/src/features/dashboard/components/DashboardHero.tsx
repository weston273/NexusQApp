import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactCurrency, formatDurationMinutes } from "@/lib/leads";
import { cn } from "@/lib/utils";
import type { IntelligencePlan, TodaySnapshot } from "@/features/dashboard/types";

type DashboardHeroProps = {
  intelligence: IntelligencePlan;
  todaySnapshot: TodaySnapshot;
  onPrimaryAction: () => void;
};

export function DashboardHero({
  intelligence,
  todaySnapshot,
  onPrimaryAction,
}: DashboardHeroProps) {
  return (
    <Card className="border-none bg-primary text-primary-foreground overflow-hidden">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6 lg:p-8 border-b border-white/10 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
                  Operations Focus
                </div>
                <h2 className="mt-2 text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {intelligence.headline}
                </h2>
                <p className="mt-3 text-sm text-primary-foreground/80 max-w-2xl">{intelligence.suggestion}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase border-white/20 shrink-0",
                  intelligence.priority === "high"
                    ? "bg-status-error/20 text-white"
                    : intelligence.priority === "medium"
                    ? "bg-status-warning/20 text-white"
                    : "bg-status-success/20 text-white"
                )}
              >
                {intelligence.priority} priority
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {intelligence.signals.map((signal) => (
                <div key={signal} className="rounded-xl border border-white/10 bg-background/10 p-3 text-sm">
                  {signal}
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Button className="bg-white text-black hover:bg-white/90 text-xs font-bold" onClick={onPrimaryAction}>
                {intelligence.actionLabel}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <div className="text-xs text-primary-foreground/70">Confidence {intelligence.confidence}%</div>
            </div>
          </div>

          <div className="p-6 lg:p-8 bg-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
                  Today Snapshot
                </div>
                <div className="mt-1 text-sm text-primary-foreground/80">{todaySnapshot.sourceLabel}</div>
              </div>
              <Badge variant="outline" className="border-white/20 text-[10px] uppercase text-white">
                {todaySnapshot.asOfLabel}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-background/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Leads</div>
                <div className="mt-2 text-2xl font-bold">{todaySnapshot.leadsCaptured ?? 0}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-background/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Booked</div>
                <div className="mt-2 text-2xl font-bold">{todaySnapshot.bookedCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-background/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Quoted</div>
                <div className="mt-2 text-2xl font-bold">{todaySnapshot.quotedCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-background/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Revenue</div>
                <div className="mt-2 text-2xl font-bold">${formatCompactCurrency(todaySnapshot.revenue)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-background/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-primary-foreground/70">Average Response</div>
              <div className="mt-2 text-xl font-bold">{formatDurationMinutes(todaySnapshot.avgResponseMinutes)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
