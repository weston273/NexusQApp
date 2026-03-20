import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardStat, LeadTrendDatum } from "@/features/dashboard/types";

function LeadTrendChart({ data }: { data: LeadTrendDatum[] }) {
  return (
    <div className="h-[240px] w-full mt-4" role="img" aria-label="Lead volume area chart for last seven days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" opacity={0.6} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area type="monotone" dataKey="leads" stroke="hsl(var(--chart-1))" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DashboardOverviewSectionProps = {
  leadTrend: LeadTrendDatum[];
  stats: DashboardStat[];
};

export function DashboardOverviewSection({
  leadTrend,
  stats,
}: DashboardOverviewSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card className="lg:col-span-2 border-none card-surface-a">
        <CardHeader>
          <CardTitle className="text-lg">Lead Volume Trend</CardTitle>
          <CardDescription>Leads captured over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadTrendChart data={leadTrend} />
        </CardContent>
      </Card>

      <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className={`border-none ${["card-surface-a", "card-surface-b", "card-surface-c", "card-surface-d"][index % 4]}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div
                  className={cn(
                    "text-[10px] font-bold",
                    stat.change.startsWith("+")
                      ? "text-status-success"
                      : stat.change.startsWith("-")
                      ? "text-status-info"
                      : "text-muted-foreground"
                  )}
                >
                  {stat.change}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
