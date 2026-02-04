// src/pages/dashboard.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";

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
} from "recharts";

/* ------------------------- helpers (real data builders) ------------------------- */

function last7DaysTrend(leads: { created_at: string }[]) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map = new Map<string, number>();

  // init last 7 days to 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    map.set(key, 0);
  }

  for (const l of leads) {
    const key = new Date(l.created_at).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => {
    const d = new Date(date);
    return { day: dayNames[d.getDay()], leads: count };
  });
}

function funnelFromStatus(leads: { status: string | null }[]) {
  const norm = (s: string | null) => (s ?? "new").toLowerCase();

  const total = leads.length;

  // Adjust these buckets whenever you finalize your pipeline stages.
  const contacted = leads.filter((l) =>
    ["contacted", "qualifying", "quoted", "booked", "converted"].includes(
      norm(l.status)
    )
  ).length;

  const qualified = leads.filter((l) =>
    ["qualifying", "quoted", "booked", "converted"].includes(norm(l.status))
  ).length;

  const converted = leads.filter((l) =>
    ["booked", "converted"].includes(norm(l.status))
  ).length;

  return [
    { stage: "Leads", value: total },
    { stage: "Contacted", value: contacted },
    { stage: "Qualified", value: qualified },
    { stage: "Converted", value: converted },
  ];
}

function activityFromEvents(events: { event_type: string }[]) {
  const counts = new Map<string, number>();

  for (const e of events) {
    const k = (e.event_type ?? "unknown").toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }));

  return top.length ? top : [{ name: "no activity", value: 1 }];
}

/* ------------------------------ chart components ------------------------------ */

function LeadTrendChart({
  data,
}: {
  data: { day: string; leads: number }[];
}) {
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

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--muted-foreground))"
            opacity={0.1}
          />

          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            allowDecimals={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />

          <Area
            type="monotone"
            dataKey="leads"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorLeads)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConversionFunnel({
  data,
}: {
  data: { stage: string; value: number }[];
}) {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="hsl(var(--muted-foreground))"
            opacity={0.1}
          />
          <XAxis type="number" hide />
          <YAxis
            dataKey="stage"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
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

function ResponseBarChart({
  data,
}: {
  data: { period: string; time: number }[];
}) {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--muted-foreground))"
            opacity={0.1}
          />
          <XAxis
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="time" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityPieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
  ];

  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
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

/* ----------------------------------- page ----------------------------------- */

export function Dashboard() {
  const navigate = useNavigate();
  const { leads, events, loading, error, reload } = useLeads();

  const leadsCaptured = leads.length;

  const leadTrend = React.useMemo(() => last7DaysTrend(leads), [leads]);
  const funnelData = React.useMemo(() => funnelFromStatus(leads), [leads]);
  const activityData = React.useMemo(() => activityFromEvents(events), [events]);

  // Keep this static for MVP (we can compute real response time later)
  const responseData = React.useMemo(
    () => [
      { period: "Yesterday", time: 3.2 },
      { period: "Today", time: 1.8 },
    ],
    []
  );

  const recentActivity = React.useMemo(() => {
    const actionMap: Record<string, string> = {
      lead_created: "Requested Service",
      status_changed: "Status Updated",
      call_logged: "Call Logged",
      note_added: "Note Added",
    };

    return events.slice(0, 6).map((e) => {
      const name =
        e.payload_json?.name ||
        e.payload_json?.lead_snapshot?.name ||
        e.payload_json?.lead?.name ||
        "Unknown";

      return {
        id: e.id,
        type: "lead",
        user: name,
        action: actionMap[e.event_type] ?? e.event_type,
        time: new Date(e.created_at).toLocaleString(),
        status: e.payload_json?.status ?? "New",
      };
    });
  }, [events]);

  const stats = React.useMemo(
    () => [
      { label: "Leads Captured", value: String(leadsCaptured), change: "", icon: Users },
      { label: "Avg. Response", value: "-", change: "", icon: Clock },
      { label: "Conversion", value: "-", change: "", icon: TrendingUp },
      { label: "Open Intents", value: "-", change: "", icon: MessageSquare },
    ],
    [leadsCaptured]
  );

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-red-500">Failed to load: {error}</div>
        <Button onClick={reload} size="sm">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground mt-1">
          Real-time revenue operations and system health.
        </p>
      </div>

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Lead Activity</CardTitle>
              <CardDescription>Latest interactions across all channels.</CardDescription>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate("/pipeline")}
            >
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
                      {activity.type === "lead" ? (
                        <Users className="h-5 w-5" />
                      ) : activity.type === "booking" ? (
                        <CalendarCheck className="h-5 w-5" />
                      ) : (
                        <PhoneCall className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-bold">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.action}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-tighter"
                    >
                      {activity.status}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {activity.time}
                    </div>
                  </div>
                </div>
              ))}
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
              <div className="text-xs font-bold uppercase tracking-wider mb-2">
                Next Suggested Action
              </div>
              <p className="text-sm">
                Review new leads and move them into Qualifying for faster booking.
              </p>

              <Button
                className="w-full mt-4 bg-white text-black hover:bg-white/90 text-xs font-bold"
                onClick={() => navigate("/pipeline")}
              >
                Open Pipeline
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs px-2">
              <span className="opacity-60">Realtime Sync</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>Active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
