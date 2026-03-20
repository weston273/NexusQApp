import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityDatum, FunnelDatum, ResponseDatum } from "@/features/dashboard/types";

function ConversionFunnel({ data }: { data: FunnelDatum[] }) {
  return (
    <div className="h-[200px] w-full mt-4" role="img" aria-label="Conversion funnel chart by stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--chart-grid))" opacity={0.6} />
          <XAxis type="number" hide />
          <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResponseBarChart({ data }: { data: ResponseDatum[] }) {
  return (
    <div className="h-[200px] w-full mt-4" role="img" aria-label="Average response speed comparison chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" opacity={0.6} />
          <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [`${value}m`, "Avg Response"]}
          />
          <Bar dataKey="time" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityPieChart({ data }: { data: ActivityDatum[] }) {
  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-5))", "hsl(var(--chart-7))"];

  return (
    <div className="h-[200px] w-full mt-4" role="img" aria-label="Interaction breakdown pie chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {data.map((_, index) => (
              <Cell key={`activity-cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type DashboardMetricsSectionProps = {
  funnelData: FunnelDatum[];
  responseData: ResponseDatum[];
  activityData: ActivityDatum[];
};

export function DashboardMetricsSection({
  funnelData,
  responseData,
  activityData,
}: DashboardMetricsSectionProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="border-none card-surface-b">
        <CardHeader>
          <CardTitle className="text-base">Conversion Pipeline</CardTitle>
          <CardDescription>Where leads progress or drop off.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConversionFunnel data={funnelData} />
        </CardContent>
      </Card>

      <Card className="border-none card-surface-c">
        <CardHeader>
          <CardTitle className="text-base">Response Speed</CardTitle>
          <CardDescription>Average minutes to respond.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponseBarChart data={responseData} />
        </CardContent>
      </Card>

      <Card className="border-none card-surface-d">
        <CardHeader>
          <CardTitle className="text-base">Interaction Breakdown</CardTitle>
          <CardDescription>Activity distribution across channels.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityPieChart data={activityData} />
        </CardContent>
      </Card>
    </div>
  );
}
