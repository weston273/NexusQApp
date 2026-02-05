import React from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import { supabase } from "@/lib/supabase";

import {
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  ArrowRight,
  PhoneCall,
  CalendarCheck,
} from "lucide-react";

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

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

// -------------------------
// helpers
// -------------------------
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function minutesBetween(aIso?: string | null, bIso?: string | null) {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = b - a;
  if (diff < 0) return null;
  return diff / 60000;
}

function fmtMin(min: number | null) {
  if (min == null) return "-";
  if (min < 1) return "< 1m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

function money(n: number) {
  try {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(n));
  }
}

function normStatus(s?: string | null) {
  return (s ?? "new").toLowerCase().trim();
}

// -------------------------
// Charts (data via props)
// -------------------------
function PipelineSummaryFunnel({
  data,
  totalValue,
  onViewPipeline,
}: {
  data: Array<{ name: string; value: number }>;
  totalValue: number;
  onViewPipeline: () => void;
}) {
  // colors should match your brand palette without changing the base structure
  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--primary) / 0.85)",
    "hsl(var(--accent))",
    "hsl(var(--accent) / 0.75)",
    "hsl(var(--primary))",
  ];

  return (
    <Card className="border-none bg-muted/20">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Pipeline Summary</CardTitle>
          <CardDescription>Live funnel breakdown and pipeline value.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onViewPipeline} className="gap-2">
          View Pipeline <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-center">
        {/* Funnel */}
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Funnel
                dataKey="value"
                data={data}
                isAnimationActive={true}
              >
                <LabelList
                  position="right"
                  dataKey="name"
                  fill="hsl(var(--foreground))"
                  style={{ fontSize: 12, fontWeight: 700 }}
                />
                {data.map((_, i) => (
                  <Cell key={`f-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Right summary */}
        <div className="space-y-3">
          <div className="space-y-2">
            {data.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <div className="text-sm text-muted-foreground font-medium">{row.name}</div>
                <div className="text-lg font-bold">{row.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-background/60 border p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Total Pipeline Value
            </div>
            <div className="mt-2 text-2xl font-bold">${money(totalValue)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadTrendChart({ data }: { data: Array<{ day: string; leads: number }> }) {
  return (
    <div className="h-[240px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConversionFunnel({ data }: { data: Array<{ stage: string; value: number }> }) {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
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
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResponseBarChart({ data }: { data: Array<{ period: string; time: number }> }) {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
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
          <Bar dataKey="time" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// -------------------------
// Page
// -------------------------
export function Dashboard() {
  const navigate = useNavigate();
  const { leads, events, loading, error, reload } = useLeads();

  // Total pipeline value (optional: uses pipeline table if exists)
  const [pipelineValue, setPipelineValue] = React.useState<number>(0);

  React.useEffect(() => {
    let alive = true;

    async function loadPipelineValue() {
      try {
        // If you have RLS enabled, make sure anon user can SELECT pipeline or this will fail silently
        const { data, error } = await supabase
          .from("pipeline")
          .select("value")
          .limit(1000);

        if (error) return;
        const total = (data ?? []).reduce((sum: number, row: any) => sum + (Number(row?.value) || 0), 0);
        if (alive) setPipelineValue(total);
      } catch {
        // keep 0
      }
    }

    loadPipelineValue();
    return () => {
      alive = false;
    };
  }, []);

  // Pipeline Summary (top funnel)
  const pipelineSummary = React.useMemo(() => {
    const newLead = leads.filter((l) => normStatus(l.status) === "new").length;
    const inspections = leads.filter((l) => normStatus(l.status) === "qualifying").length;
    const quotes = leads.filter((l) => normStatus(l.status) === "quoted").length;

    // Follow-up heuristic: contacted but not booked
    const followUp = leads.filter((l) => l.last_contacted_at && normStatus(l.status) !== "booked").length;

    const wonDeals = leads.filter((l) => normStatus(l.status) === "booked").length;

    return [
      { name: `New Lead: ${newLead}`, value: newLead },
      { name: `Inspections: ${inspections}`, value: inspections },
      { name: `Quotes Sent: ${quotes}`, value: quotes },
      { name: `Follow-Up: ${followUp}`, value: followUp },
      { name: `Won Deals: ${wonDeals}`, value: wonDeals },
    ];
  }, [leads]);

  // LeadTrend (last 7 days)
  const leadTrend = React.useMemo(() => {
    const now = new Date();
    const days: Array<{ date: Date; label: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      days.push({ date: startOfDay(d), label });
    }

    const counts = new Map<string, number>();
    for (const d of days) counts.set(d.date.toISOString(), 0);

    for (const l of leads) {
      const created = new Date(l.created_at);
      const createdDay = startOfDay(created).toISOString();
      if (counts.has(createdDay)) counts.set(createdDay, (counts.get(createdDay) ?? 0) + 1);
    }

    return days.map((d) => ({
      day: d.label,
      leads: counts.get(d.date.toISOString()) ?? 0,
    }));
  }, [leads]);

  const funnelData = React.useMemo(() => {
    const total = leads.length;
    const qualifying = leads.filter((l) => normStatus(l.status) === "qualifying").length;
    const quoted = leads.filter((l) => normStatus(l.status) === "quoted").length;
    const booked = leads.filter((l) => normStatus(l.status) === "booked").length;

    return [
      { stage: "Leads", value: total },
      { stage: "Qualifying", value: qualifying },
      { stage: "Quoted", value: quoted },
      { stage: "Booked", value: booked },
    ];
  }, [leads]);

  const responseData = React.useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayMins: number[] = [];
    const yMins: number[] = [];

    for (const l of leads) {
      const mins = minutesBetween(l.created_at, l.last_contacted_at);
      if (mins == null) continue;

      const created = new Date(l.created_at);
      if (isSameDay(created, today)) todayMins.push(mins);
      if (isSameDay(created, yesterday)) yMins.push(mins);
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return [
      { period: "Yesterday", time: Number(avg(yMins).toFixed(1)) },
      { period: "Today", time: Number(avg(todayMins).toFixed(1)) },
    ];
  }, [leads]);

  const activityData = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const k = e.event_type ?? "unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (!sorted.length) {
      return [
        { name: "lead created", value: 0 },
        { name: "status changed", value: 0 },
        { name: "call logged", value: 0 },
      ];
    }

    return sorted.map(([name, value]) => ({ name: (name ?? "unknown").replace(/_/g, " "), value }));
  }, [events]);

  const recentActivity = React.useMemo(() => {
    return events.slice(0, 6).map((e) => {
      const name =
        e.payload_json?.name ||
        e.payload_json?.lead_snapshot?.name ||
        e.payload_json?.lead?.name ||
        "Unknown";

      const actionMap: Record<string, string> = {
        lead_created: "Requested Service",
        status_changed: "Status Updated",
        call_logged: "Call Logged",
        note_added: "Note Added",
      };

      return {
        id: e.id,
        type: "lead" as const,
        user: name,
        action: actionMap[e.event_type] ?? (e.event_type ?? "unknown").replace(/_/g, " "),
        time: new Date(e.created_at).toLocaleString(),
        status: e.payload_json?.status ?? "New",
      };
    });
  }, [events]);

  const leadsCaptured = leads.length;
  const bookedCount = leads.filter((l) => normStatus(l.status) === "booked").length;
  const quotedCount = leads.filter((l) => normStatus(l.status) === "quoted").length;

  const avgResponseToday = React.useMemo(() => {
    const today = new Date();
    const mins: number[] = [];
    for (const l of leads) {
      const created = new Date(l.created_at);
      if (!isSameDay(created, today)) continue;
      const m = minutesBetween(l.created_at, l.last_contacted_at);
      if (m != null) mins.push(m);
    }
    if (!mins.length) return null;
    return mins.reduce((a, b) => a + b, 0) / mins.length;
  }, [leads]);

  const conversion = leadsCaptured ? Math.round((bookedCount / leadsCaptured) * 100) : 0;

  const stats = [
    { label: "Leads Captured", value: String(leadsCaptured), change: "", icon: Users },
    { label: "Avg. Response", value: fmtMin(avgResponseToday), change: "", icon: Clock },
    { label: "Conversion", value: `${conversion}%`, change: "", icon: TrendingUp },
    { label: "Open Intents", value: String(Math.max(0, quotedCount)), change: "", icon: MessageSquare },
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-muted-foreground mt-1">Real-time revenue operations and system health.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/intake")} className="gap-2">
            Add Lead <ArrowRight className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={reload}>Refresh</Button>
        </div>
      </div>

      {/* ✅ 1) Pipeline Summary FIRST */}
      <PipelineSummaryFunnel
        data={pipelineSummary}
        totalValue={pipelineValue}
        onViewPipeline={() => navigate("/pipeline")}
      />

      {/* 2) Lead volume + stat cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-2 border-none bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Lead Volume Trend</CardTitle>
            <CardDescription>Leads captured over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadTrendChart data={leadTrend} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-none bg-muted/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                    {stat.label}
                  </p>
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

      {/* 3) Other charts row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Conversion Pipeline</CardTitle>
            <CardDescription>Where leads progress or drop off.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversionFunnel data={funnelData} />
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Response Speed</CardTitle>
            <CardDescription>Average minutes to respond.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponseBarChart data={responseData} />
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Interaction Breakdown</CardTitle>
            <CardDescription>Activity distribution across channels.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityPieChart data={activityData} />
          </CardContent>
        </Card>
      </div>

      {/* 4) Activity + intelligence */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Lead Activity</CardTitle>
              <CardDescription>Latest interactions across all channels.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/pipeline")}>
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">{activity.action}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">
                      {activity.status}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">{activity.time}</div>
                  </div>
                </div>
              ))}
              {!recentActivity.length && <div className="text-sm text-muted-foreground">No activity yet.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg">System Intelligence</CardTitle>
            <CardDescription className="text-primary-foreground/60">
              Nexus Q active automation insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-background/10 p-4 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider mb-2">Next Suggested Action</div>
              <p className="text-sm">
                {leads.filter((l) => normStatus(l.status) === "new").length} new leads awaiting follow-up.
              </p>
              <Button
                className="w-full mt-4 bg-white text-black hover:bg-white/90 text-xs font-bold"
                onClick={() => navigate("/pipeline")}
              >
                Review Pipeline
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs px-2">
              <span className="opacity-60">Realtime Status</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>Live</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
