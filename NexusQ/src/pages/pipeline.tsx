import { useLeads } from "@/hooks/useLeads";
import React from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MoreVertical, Plus, Zap, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const stages = [
  { id: "new", title: "New", color: "bg-blue-500" },
  { id: "qualifying", title: "Qualifying", color: "bg-amber-500" },
  { id: "quoted", title: "Quoted", color: "bg-purple-500" },
  { id: "booked", title: "Booked", color: "bg-emerald-500" },
];

// ---------- charts (same as yours) ----------
const StageDistributionChart = ({ data }: { data: { stage: string; count: number }[] }) => (
  <Card className="border-none bg-muted/30">
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
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const RevenueStageChart = ({ data }: { data: { stage: string; revenue: number }[] }) => (
  <Card className="border-none bg-muted/30">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Revenue Distribution</CardTitle>
      <CardDescription className="text-xs">Sum of pipeline.value per stage.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "hsl(var(--primary))" }}
            formatter={(value) => [`$${value}`, "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={30}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 2 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"}
              />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const PipelineFlowChart = ({ data }: { data: { stage: string; value: number }[] }) => (
  <Card className="border-none bg-muted/30">
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
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// ---------- helpers ----------
function toStageId(s?: string | null) {
  const v = (s ?? "new").toLowerCase().trim();
  if (v === "new" || v === "qualifying" || v === "quoted" || v === "booked") return v;
  return "new";
}
function formatMoney(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(safe));
  }
}

// ---------------- MAIN PAGE ----------------
type PipelineRow = {
  id: string;
  lead_id: string | null;
  stage: string;
  value: number | null;
  probability: number | null;
  updated_at: string | null;
};

export function Pipeline() {
  const { leads, loading, error, reload } = useLeads();

  const [pipelineRows, setPipelineRows] = React.useState<PipelineRow[]>([]);
  const [pipeLoading, setPipeLoading] = React.useState(true);
  const [pipeError, setPipeError] = React.useState<string | null>(null);

  // Load pipeline table (for revenue + per-lead value)
  React.useEffect(() => {
    let alive = true;

    async function loadPipeline() {
      setPipeLoading(true);
      setPipeError(null);

      const { data, error } = await supabase
        .from("pipeline")
        .select("id, lead_id, stage, value, probability, updated_at")
        .limit(2000);

      if (!alive) return;

      if (error) {
        setPipeError(error.message);
        setPipelineRows([]);
      } else {
        setPipelineRows((data as any) ?? []);
      }

      setPipeLoading(false);
    }

    loadPipeline();
    return () => {
      alive = false;
    };
  }, []);

  // Map pipeline info by lead_id (so each lead card can show real value)
  const pipelineByLeadId = React.useMemo(() => {
    const m = new Map<string, PipelineRow>();
    for (const row of pipelineRows) {
      if (!row.lead_id) continue;
      // if duplicates exist, keep the latest updated_at
      const prev = m.get(row.lead_id);
      if (!prev) {
        m.set(row.lead_id, row);
        continue;
      }
      const a = new Date(prev.updated_at ?? 0).getTime();
      const b = new Date(row.updated_at ?? 0).getTime();
      if (b >= a) m.set(row.lead_id, row);
    }
    return m;
  }, [pipelineRows]);

  // UI leads (still based on leads table stages — stable + realtime)
  const uiLeads = React.useMemo(() => {
    return leads.map((l) => {
      const stage = toStageId(l.status);
      const pipe = pipelineByLeadId.get(l.id);
      const value = Number(pipe?.value ?? 0);
      return {
        id: l.id,
        name: l.name ?? "Unknown",
        company: l.service ? l.service.toUpperCase() : "SERVICE",
        valueNum: value,
        value: `$${formatMoney(value)}`,
        time: new Date(l.created_at).toLocaleDateString(),
        stage,
      };
    });
  }, [leads, pipelineByLeadId]);

  const stageCounts = React.useMemo(() => {
    return {
      new: uiLeads.filter((l) => l.stage === "new").length,
      qualifying: uiLeads.filter((l) => l.stage === "qualifying").length,
      quoted: uiLeads.filter((l) => l.stage === "quoted").length,
      booked: uiLeads.filter((l) => l.stage === "booked").length,
    };
  }, [uiLeads]);

  const stageDistributionData = [
    { stage: "New", count: stageCounts.new },
    { stage: "Qualifying", count: stageCounts.qualifying },
    { stage: "Quoted", count: stageCounts.quoted },
    { stage: "Booked", count: stageCounts.booked },
  ];

  // ✅ Real revenue by stage from pipeline table
  const revenueData = React.useMemo(() => {
    const sums: Record<string, number> = { new: 0, qualifying: 0, quoted: 0, booked: 0 };
    for (const row of pipelineRows) {
      const stage = toStageId(row.stage);
      const v = Number(row.value ?? 0);
      sums[stage] += Number.isFinite(v) ? v : 0;
    }
    return [
      { stage: "New", revenue: Math.round(sums.new) },
      { stage: "Qualifying", revenue: Math.round(sums.qualifying) },
      { stage: "Quoted", revenue: Math.round(sums.quoted) },
      { stage: "Booked", revenue: Math.round(sums.booked) },
    ];
  }, [pipelineRows]);

  const pipelineFlowData = [
    { stage: "New Leads", value: stageCounts.new },
    { stage: "Qualifying", value: stageCounts.qualifying },
    { stage: "Quoted", value: stageCounts.quoted },
    { stage: "Booked", value: stageCounts.booked },
  ];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-red-500">Failed to load: {error}</div>
        <Button onClick={reload} size="sm">Retry</Button>
      </div>
    );

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Operations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Revenue flow and lead progression across all stages.
          </p>
          {pipeError && (
            <div className="mt-2 text-[11px] text-red-500">
              Pipeline table error: {pipeError}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StageDistributionChart data={stageDistributionData} />
        <RevenueStageChart data={revenueData} />
        <PipelineFlowChart data={pipelineFlowData} />
      </div>

      <ScrollArea className="w-full whitespace-nowrap rounded-md border-none">
        <div className="flex w-max space-x-6 min-h-[600px]">
          {stages.map((stage) => (
            <div key={stage.id} className="w-[300px] flex flex-col space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                  <h3 className="font-bold text-sm uppercase tracking-wider">{stage.title}</h3>
                  <Badge
                    variant="secondary"
                    className="ml-1 text-[10px] h-4 px-1.5 bg-muted/50 text-muted-foreground"
                  >
                    {uiLeads.filter((l) => l.stage === stage.id).length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="space-y-3">
                {uiLeads
                  .filter((l) => l.stage === stage.id)
                  .map((lead) => (
                    <Card
                      key={lead.id}
                      className="border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer bg-muted/10"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-bold leading-none mb-1">{lead.name}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">{lead.company}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold h-5 bg-background border-border/50"
                          >
                            {lead.value}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/10">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            <Zap className="h-3 w-3 text-amber-500" />
                            High Intent
                          </div>
                          <div className="text-[10px] text-muted-foreground">{lead.time}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                <Button
                  variant="ghost"
                  className="w-full border-2 border-dashed border-border/20 h-12 text-muted-foreground text-xs hover:border-border/50 hover:bg-muted/5"
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Add Lead
                </Button>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
