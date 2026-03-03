// src/pages/Dashboard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";

import { Users, MessageSquare, TrendingUp, Clock, ArrowRight, Settings, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ActionEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/data-state";
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

function toStageId(s?: string | null) {
  const v = (s ?? "new").toLowerCase().trim();

  // direct matches
  if (v === "new" || v === "qualifying" || v === "quoted" || v === "booked") return v;

  // synonyms / backend event-style statuses
  if (v.includes("inspect") || v.includes("qualif") || v.includes("schedule")) return "qualifying";
  if (v.includes("quote") || v.includes("quoted") || v.includes("sent")) return "quoted";
  if (v.includes("book") || v.includes("won") || v.includes("deal")) return "booked";

  return "new";
}

// helper: safe display name
function isTruthyString(v: unknown) {
  return typeof v === "string" && v.trim().length > 0 && v.trim().toLowerCase() !== "unknown";
}

type IntelligencePlan = {
  headline: string;
  suggestion: string;
  actionLabel: string;
  actionPath: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  signals: string[];
};

function buildSystemIntelligence(args: {
  leads: any[];
  pipelineRows: any[];
  events: any[];
  conversion: number;
  avgResponseToday: number | null;
  newPipelineCount: number;
}): IntelligencePlan {
  const { leads, pipelineRows, events, conversion, avgResponseToday, newPipelineCount } = args;
  const now = Date.now();
  const inHours = (iso?: string | null) => {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return null;
    return (now - ts) / 3600000;
  };

  const quotedAging = leads.filter((l) => normStatus(l.status) === "quoted" && (inHours(l.created_at) ?? 0) > 72).length;
  const bookedLast7d = leads.filter((l) => normStatus(l.status) === "booked" && (inHours(l.created_at) ?? 0) <= 24 * 7).length;
  const leads24h = leads.filter((l) => (inHours(l.created_at) ?? 0) <= 24).length;
  const leadsPrev24h = leads.filter((l) => {
    const h = inHours(l.created_at) ?? 0;
    return h > 24 && h <= 48;
  }).length;
  const eventsLast6h = events.filter((e) => (inHours(e.created_at) ?? 0) <= 6).length;

  if (newPipelineCount >= 10) {
    const signals = [
      `${newPipelineCount} leads waiting in New stage`,
      `${leads24h} leads arrived in last 24h`,
      `${eventsLast6h} recent system events`,
    ];
    return {
      headline: "High inbound volume detected",
      suggestion: "Run a structured triage pass now to prevent qualification delays and dropped intent.",
      actionLabel: "Triage Pipeline",
      actionPath: "/pipeline",
      priority: "high",
      confidence: 88,
      signals,
    };
  }

  if (quotedAging >= 3) {
    const signals = [
      `${quotedAging} quoted leads older than 72 hours`,
      `${bookedLast7d} bookings closed in last 7 days`,
      "Follow-up momentum is the best conversion lever",
    ];
    return {
      headline: "Quote follow-ups are at risk",
      suggestion: "Prioritize stale quoted leads first and schedule same-day callbacks for top-value opportunities.",
      actionLabel: "Review Quoted Leads",
      actionPath: "/pipeline",
      priority: "high",
      confidence: 84,
      signals,
    };
  }

  if ((avgResponseToday ?? 0) > 45 || conversion < 18) {
    const signals = [
      `Avg response: ${fmtMin(avgResponseToday)}`,
      `Conversion: ${conversion}%`,
      `Lead delta 24h: ${leads24h - leadsPrev24h >= 0 ? "+" : ""}${leads24h - leadsPrev24h}`,
    ];
    return {
      headline: "Conversion performance can be optimized",
      suggestion: "Tighten first-response SLAs and automate early-stage follow-ups for high-intent services.",
      actionLabel: "Tune Operations",
      actionPath: "/health",
      priority: "medium",
      confidence: 76,
      signals,
    };
  }

  const stageRows = pipelineRows.length || leads.length;
  const signals = [
    `${bookedLast7d} recent bookings`,
    `${stageRows} active pipeline records`,
    `${eventsLast6h} live activity events in last 6h`,
  ];
  return {
    headline: "Pipeline is operating within baseline",
    suggestion: "Maintain cadence: keep lead intake quality high and review the board twice daily.",
    actionLabel: "Open Dashboard",
    actionPath: "/",
    priority: "low",
    confidence: 68,
    signals,
  };
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
  const cleanData = data.map((d) => ({
    stage: d.name.split(":")[0], // "New Lead"
    count: d.value,
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
        {/* chart */}
        <div
          className="h-[260px] w-full rounded-xl border bg-muted/20 p-3"
          role="img"
          aria-label="Pipeline summary bar chart by stage"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cleanData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

        {/* totals */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Total Pipeline Value
            </div>
            <div className="mt-2 text-3xl font-bold">${money(totalValue)}</div>
          </div>

          <div className="space-y-2">
            {cleanData.map((r) => (
              <div key={r.stage} className="flex items-center justify-between rounded-lg border bg-background p-3">
                <span className="text-sm font-medium text-muted-foreground">{r.stage}</span>
                <span className="text-lg font-bold">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadTrendChart({ data }: { data: Array<{ day: string; leads: number }> }) {
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

function ConversionFunnel({ data }: { data: Array<{ stage: string; value: number }> }) {
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

function ResponseBarChart({ data }: { data: Array<{ period: string; time: number }> }) {
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

function ActivityPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-5))", "hsl(var(--chart-7))"];

  return (
    <div className="h-[200px] w-full mt-4" role="img" aria-label="Interaction breakdown pie chart">
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

// -------------------------
// Page
// -------------------------
export function Dashboard() {
  const navigate = useNavigate();
  const { leads, events, pipelineRows, loading, error, lastLoadedAt, reload } = useLeads();

  // ? Total pipeline value from pipeline table (live via realtime)
  const pipelineValue = React.useMemo(() => {
    return (pipelineRows ?? []).reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  }, [pipelineRows]);

  // ? Pipeline Summary should come from pipeline.stage (real)
  const pipelineSummary = React.useMemo(() => {
    const counts = { new: 0, qualifying: 0, quoted: 0, booked: 0 };

    for (const row of pipelineRows ?? []) {
      const st = toStageId(row.stage);
      counts[st] += 1;
    }

    // keep your “Follow-Up” logic based on leads (last_contacted_at + not booked)
    const followUp = leads.filter((l) => l.last_contacted_at && normStatus(l.status) !== "booked").length;

    return [
      { name: `New Lead: ${counts.new}`, value: counts.new },
      { name: `Inspections: ${counts.qualifying}`, value: counts.qualifying },
      { name: `Quotes Sent: ${counts.quoted}`, value: counts.quoted },
      { name: `Follow-Up: ${followUp}`, value: followUp },
      { name: `Won Deals: ${counts.booked}`, value: counts.booked },
    ];
  }, [pipelineRows, leads]);

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

    return days.map((d) => ({ day: d.label, leads: counts.get(d.date.toISOString()) ?? 0 }));
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

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (!sorted.length) {
      return [
        { name: "lead created", value: 0 },
        { name: "status changed", value: 0 },
        { name: "call logged", value: 0 },
      ];
    }

    return sorted.map(([name, value]) => ({ name: (name ?? "unknown").replace(/_/g, " "), value }));
  }, [events]);

  // ? FIX: build a reliable lookup map from leads -> name
  // (your version had `l.name || l.name` and no typing; also guard empty strings)
  const leadNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads ?? []) {
      const nm =
        (typeof (l as any).name === "string" && (l as any).name.trim()) ||
        (typeof (l as any).full_name === "string" && (l as any).full_name.trim()) ||
        (typeof (l as any).first_name === "string" && (l as any).first_name.trim()) ||
        "";
      m.set((l as any).id, nm || "Unknown");
    }
    return m;
  }, [leads]);

  // ? FIX: smarter name resolution for events (covers lead_events payload patterns)
  const recentActivity = React.useMemo(() => {
    const actionMap: Record<string, string> = {
      lead_created: "Requested Service",
      status_changed: "Status Updated",
      call_logged: "Call Logged",
      note_added: "Note Added",
      first_response_sent: "Instant Response Sent",
    };

    const getNameFromEvent = (e: any) => {
      const candidates = [
        e?.payload_json?.name,
        e?.payload_json?.full_name,
        e?.payload_json?.lead_snapshot?.name,
        e?.payload_json?.lead_snapshot?.full_name,
        e?.payload_json?.lead?.name,
        e?.payload_json?.lead?.full_name,
        e?.payload_json?.raw?.name, // ?? your payload_json.raw.name exists
      ];

      for (const c of candidates) {
        if (isTruthyString(c)) return String(c).trim();
      }

      // try to resolve by lead_id
      const leadId =
        e?.lead_id ||
        e?.payload_json?.lead_id ||
        e?.payload_json?.lead?.id ||
        e?.payload_json?.lead_snapshot?.id ||
        null;

      if (leadId && leadNameById.has(String(leadId))) {
        const v = leadNameById.get(String(leadId));
        if (isTruthyString(v)) return v!;
      }

      // last resort: show phone if available (better than Unknown)
      const phone =
        e?.payload_json?.phone ||
        e?.payload_json?.raw?.phone ||
        e?.payload_json?.raw?.phone_raw ||
        null;

      if (isTruthyString(phone)) return String(phone).trim();

      return "Unknown";
    };

    return (events ?? []).slice(0, 4).map((e: any) => {
      const user = getNameFromEvent(e);

      return {
        id: e.id,
        type: "lead" as const,
        user,
        action: actionMap[e.event_type] ?? (e.event_type ?? "unknown").replace(/_/g, " "),
        time: new Date(e.created_at).toLocaleString(),
        status: e.payload_json?.status ?? "New",
      };
    });
  }, [events, leadNameById]);

  const leadsCaptured = leads.length;
  const bookedCount = leads.filter((l: any) => normStatus(l.status) === "booked").length;
  const quotedCount = leads.filter((l: any) => normStatus(l.status) === "quoted").length;

  const avgResponseToday = React.useMemo(() => {
    const today = new Date();
    const mins: number[] = [];
    for (const l of leads as any[]) {
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

  // For “System Intelligence” card: prefer pipeline new-stage count if available
  const newPipelineCount = React.useMemo(() => {
    const rows = pipelineRows ?? [];
    if (!rows.length) return leads.filter((l: any) => normStatus(l.status) === "new").length;
    return rows.filter((r: any) => toStageId(r.stage) === "new").length;
  }, [pipelineRows, leads]);

  const intelligence = React.useMemo(
    () =>
      buildSystemIntelligence({
        leads: leads as any[],
        pipelineRows: pipelineRows as any[],
        events: events as any[],
        conversion,
        avgResponseToday,
        newPipelineCount,
      }),
    [avgResponseToday, conversion, events, leads, newPipelineCount, pipelineRows]
  );

  if (loading) return <PageLoadingState title="Loading dashboard" description="Syncing pipeline, lead volume, and intelligence data." />;
  if (error)
    return (
      <PageErrorState
        title="Dashboard data unavailable"
        message={error}
        onRetry={() => {
          void reload();
        }}
      />
    );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Command Center"
        description="Real-time revenue operations and system health."
        lastUpdatedLabel={`Last updated: ${lastLoadedAt ? lastLoadedAt.toLocaleTimeString() : "Not yet synced"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="gap-2 h-10" aria-label="Open settings">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/intake")} className="gap-2 h-10" aria-label="Add a new lead">
              Add Lead <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="h-10"
              onClick={() => {
                void reload();
              }}
              aria-label="Refresh dashboard data"
            >
              Refresh
            </Button>
          </>
        }
      />

      {!leads.length && (
        <ActionEmptyState
          title="No leads yet"
          description="Add your first lead to unlock real-time trends, conversions, and automation insights."
          primaryActionLabel="Add First Lead"
          onPrimaryAction={() => navigate("/intake")}
          secondaryActionLabel="Refresh Data"
          onSecondaryAction={() => {
            void reload();
          }}
        />
      )}

      {/* 1) Pipeline Summary FIRST */}
      <PipelineSummaryFunnel data={pipelineSummary} totalValue={pipelineValue} onViewPipeline={() => navigate("/pipeline")} />

      {/* 2) Lead volume + stat cards */}
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
          {stats.map((stat) => (
            <Card key={stat.label} className={`border-none ${["card-surface-a", "card-surface-b", "card-surface-c", "card-surface-d"][stats.indexOf(stat) % 4]}`}>
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

      {/* 3) Other charts row */}
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
              {!recentActivity.length && (
                <div className="rounded-lg border border-dashed bg-background/40 p-4 text-sm text-muted-foreground">
                  <div>No activity yet.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-9" onClick={() => navigate("/intake")}>
                      Add Lead
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        void reload();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary text-primary-foreground h-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              System Intelligence
            </CardTitle>
            <CardDescription className="text-primary-foreground/60">
              Adaptive recommendations based on live pipeline behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex flex-col h-full">
            <div className="rounded-lg bg-background/10 p-4 border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-bold uppercase tracking-wider">Next Suggested Action</div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase border-white/20",
                    intelligence.priority === "high"
                      ? "bg-status-error/20 text-white"
                      : intelligence.priority === "medium"
                      ? "bg-status-warning/20 text-white"
                      : "bg-status-success/20 text-white"
                  )}
                >
                  {intelligence.priority}
                </Badge>
              </div>
              <p className="text-sm font-semibold">{intelligence.headline}</p>
              <p className="text-xs text-primary-foreground/80 mt-2">{intelligence.suggestion}</p>
              <div className="mt-3 space-y-1.5">
                {intelligence.signals.map((signal) => (
                  <div key={signal} className="text-[11px] flex items-center gap-2 text-primary-foreground/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-4 bg-white text-black hover:bg-white/90 text-xs font-bold"
                onClick={() => navigate(intelligence.actionPath)}
              >
                {intelligence.actionLabel}
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs px-2 mt-auto">
              <span className="opacity-60">Model Confidence</span>
              <span className="font-semibold">{intelligence.confidence}%</span>
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

