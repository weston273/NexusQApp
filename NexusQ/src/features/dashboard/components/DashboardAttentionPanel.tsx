import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/features/dashboard/types";

type DashboardAttentionPanelProps = {
  items: AttentionItem[];
};

function toneClasses(tone: AttentionItem["tone"]) {
  if (tone === "high") return "border-status-error/25 bg-status-error/5";
  if (tone === "medium") return "border-status-warning/30 bg-status-warning/10";
  return "border-border/60 bg-muted/20";
}

function badgeClasses(tone: AttentionItem["tone"]) {
  if (tone === "high") return "text-status-error bg-status-error/10";
  if (tone === "medium") return "text-status-warning bg-status-warning/15";
  return "text-muted-foreground bg-background";
}

export function DashboardAttentionPanel({ items }: DashboardAttentionPanelProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-none bg-muted/20">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-base">Needs Attention Now</CardTitle>
          <CardDescription>Priority actions surfaced from live lead, response, and revenue signals.</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2 self-start md:self-auto" onClick={() => navigate("/pipeline")}>
          Review Pipeline
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={`${item.title}-${item.actionPath}`} className={cn("rounded-2xl border p-4", toneClasses(item.tone))}>
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-background/80 p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]", badgeClasses(item.tone))}>
                  {item.countLabel}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-sm font-semibold">{item.title}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>

              <Button
                variant="ghost"
                className="mt-4 h-9 px-0 text-xs font-semibold"
                onClick={() => navigate(item.actionPath)}
              >
                {item.actionLabel}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
