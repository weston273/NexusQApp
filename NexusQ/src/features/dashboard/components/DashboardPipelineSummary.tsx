import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency } from "@/lib/leads";
import type { PipelineSummaryDatum } from "@/features/dashboard/types";

type DashboardPipelineSummaryProps = {
  data: PipelineSummaryDatum[];
  totalValue: number;
  onViewPipeline: () => void;
};

export function DashboardPipelineSummary({
  data,
  totalValue,
  onViewPipeline,
}: DashboardPipelineSummaryProps) {
  const chartData = data.map((item) => ({
    stage: item.name.split(":")[0],
    count: item.value,
  }));

  return (
    <Card className="border border-border/40 bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Pipeline Summary</CardTitle>
          <CardDescription>Live breakdown across stages.</CardDescription>
        </div>

        <Button variant="outline" size="sm" onClick={onViewPipeline} className="gap-2">
          View Pipeline <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] items-center">
        <div className="h-[260px] w-full rounded-xl border bg-muted/20 p-3" role="img" aria-label="Pipeline summary bar chart by stage">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Total Pipeline Value
            </div>
            <div className="mt-2 text-3xl font-bold">${formatCompactCurrency(totalValue)}</div>
          </div>

          <div className="space-y-2">
            {chartData.map((row) => (
              <div key={row.stage} className="flex items-center justify-between rounded-lg border bg-background p-3">
                <span className="text-sm font-medium text-muted-foreground">{row.stage}</span>
                <span className="text-lg font-bold">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
