import {
  BarChart as ReBarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PipelineChartPoint,
  PipelineRevenuePoint,
  PipelineStageCountPoint,
} from "@/features/pipeline/types";

function StageDistributionChart({ data }: { data: PipelineStageCountPoint[] }) {
  return (
    <Card className="border-none card-surface-a">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Leads per Stage</CardTitle>
        <CardDescription className="text-xs">Where workload is concentrated.</CardDescription>
      </CardHeader>
      <CardContent className="h-[200px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ReBarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
            <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              itemStyle={{ color: "hsl(var(--primary))" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
              {data.map((_, index) => (
                <Cell key={`stage-cell-${index}`} fill={`hsl(var(--chart-${(index % 4) + 1}))`} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RevenueStageChart({ data }: { data: PipelineRevenuePoint[] }) {
  return (
    <Card className="border-none card-surface-b">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Revenue Distribution</CardTitle>
        <CardDescription className="text-xs">Sum of pipeline.value per stage.</CardDescription>
      </CardHeader>
      <CardContent className="h-[200px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ReBarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
            <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              itemStyle={{ color: "hsl(var(--primary))" }}
              formatter={(value) => [`$${value}`, "Revenue"]}
            />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={30}>
              {data.map((_, index) => (
                <Cell key={`revenue-cell-${index}`} fill={`hsl(var(--chart-${(index % 4) + 4}))`} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function PipelineFlowChart({ data }: { data: PipelineChartPoint[] }) {
  return (
    <Card className="border-none card-surface-c">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Pipeline Progression</CardTitle>
        <CardDescription className="text-xs">Leads count across stages.</CardDescription>
      </CardHeader>
      <CardContent className="h-[200px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ReBarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
            <XAxis type="number" hide />
            <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              itemStyle={{ color: "hsl(var(--primary))" }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((_, index) => (
                <Cell key={`flow-cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

type PipelineStatsBarProps = {
  stageDistributionData: PipelineStageCountPoint[];
  revenueData: PipelineRevenuePoint[];
  pipelineFlowData: PipelineChartPoint[];
};

export function PipelineStatsBar({
  stageDistributionData,
  revenueData,
  pipelineFlowData,
}: PipelineStatsBarProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <StageDistributionChart data={stageDistributionData} />
      <RevenueStageChart data={revenueData} />
      <PipelineFlowChart data={pipelineFlowData} />
    </div>
  );
}
