import React from "react";
import {
  ShieldCheck,
  Cpu,
  Globe,
  Database,
  Activity,
  Zap,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type HealthService = {
  name: string;
  status: "optimal" | "stale" | "degraded" | "unknown";
  last_run_at: string | null;
  minutes_since: number | null;
  error?: string | null;
};

type HealthLog = {
  time: string | null;
  event: string;
  source: string;
  status: "success" | "warning" | "info";
};

type HealthPayload = {
  ok: boolean;
  allOperational: boolean;
  services: HealthService[];
  logs: HealthLog[];
  generated_at: string;
};

// Try test first (dev), then prod (when published)
const HEALTH_URLS = [
  "https://n8n-k7j4.onrender.com/webhook-test/health-status",
  "https://n8n-k7j4.onrender.com/webhook/health-status",
];

// -------------------------
// helpers
// -------------------------
function statusBadgeVariant(s: HealthService["status"]) {
  if (s === "optimal") return "outline";
  if (s === "stale") return "secondary";
  if (s === "degraded") return "destructive";
  return "secondary";
}

function statusLabel(s: HealthService["status"]) {
  if (s === "optimal") return "optimal";
  if (s === "stale") return "stale";
  if (s === "degraded") return "degraded";
  return "unknown";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function freshnessPercent(minutesSince: number | null) {
  // MVP: treat 0m => 100%, 100m => 0%
  if (minutesSince == null) return 0;
  return clamp(100 - minutesSince, 0, 100);
}

function pickIcon(serviceName: string) {
  const n = (serviceName || "").toLowerCase();

  // Adjust these to match your workflow names
  if (n.includes("workflow a") || n.includes("intake") || n.includes("normal")) return ShieldCheck;
  if (n.includes("workflow b") || n.includes("speed") || n.includes("response")) return Cpu;
  if (n.includes("workflow c") || n.includes("follow")) return Globe;
  if (n.includes("workflow d") || n.includes("pipeline") || n.includes("booking")) return Database;

  return Activity;
}

async function fetchHealthStatus(): Promise<HealthPayload> {
  const results = await Promise.allSettled(HEALTH_URLS.map((url) => fetch(url, { method: "GET" })));

  const okRes = results.find((r) => r.status === "fulfilled" && r.value.ok);
  if (!okRes || okRes.status !== "fulfilled") throw new Error("Health endpoint unreachable");

  const data = (await okRes.value.json()) as HealthPayload;
  if (!data?.ok) throw new Error("Health endpoint returned ok=false");

  return data;
}

// Dedupe services by name (keep the newest / best)
function dedupeServices(list: HealthService[]) {
  const map = new Map<string, HealthService>();

  for (const s of list) {
    if (!s?.name) continue;

    const prev = map.get(s.name);
    if (!prev) {
      map.set(s.name, s);
      continue;
    }

    // keep whichever has the most recent last_run_at
    const a = prev.last_run_at ? new Date(prev.last_run_at).getTime() : 0;
    const b = s.last_run_at ? new Date(s.last_run_at).getTime() : 0;
    map.set(s.name, b >= a ? s : prev);
  }

  return Array.from(map.values());
}

// Dedupe logs by a stable key
function dedupeLogs(list: HealthLog[]) {
  const seen = new Set<string>();
  const out: HealthLog[] = [];

  for (const l of list) {
    const key = `${l.time ?? ""}|${l.source ?? ""}|${l.event ?? ""}|${l.status ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }

  // newest first if time exists
  out.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });

  // keep it tight
  return out.slice(0, 30);
}

export function Health() {
  const [loading, setLoading] = React.useState(true);
  const [payload, setPayload] = React.useState<HealthPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const data = await fetchHealthStatus();

      // ✅ dedupe to avoid duplicates on UI
      const safe: HealthPayload = {
        ...data,
        services: dedupeServices(data.services ?? []),
        logs: dedupeLogs(data.logs ?? []),
      };

      setPayload(safe);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch health");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchHealthStatus();
        if (!mounted) return;

        setPayload({
          ...data,
          services: dedupeServices(data.services ?? []),
          logs: dedupeLogs(data.logs ?? []),
        });
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Failed to fetch health");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const t = setInterval(() => {
      load().catch(() => {});
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [load]);

  const services = payload?.services ?? [];
  const logs = payload?.logs ?? [];
  const headlineOk = payload?.allOperational ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground mt-1">
            Operational status of Nexus Q automation layers (live from Workflow E).
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
            headlineOk
              ? "bg-status-success/10 text-status-success border-status-success/20"
              : "bg-status-warning/10 text-status-warning border-status-warning/20"
          }`}
        >
          {headlineOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="text-xs font-bold uppercase tracking-wider">
            {loading ? "Checking…" : headlineOk ? "All Systems Nominal" : "Attention Needed"}
          </span>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border p-4 text-sm">
          <div className="text-red-500 font-bold">Health API Error</div>
          <div className="text-muted-foreground mt-1">{err}</div>
          <button className="mt-3 underline text-sm" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = pickIcon(service.name);
          const freshness = freshnessPercent(service.minutes_since);

          return (
            <Card key={service.name} className="border-none bg-muted/30">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>

                  <Badge variant={statusBadgeVariant(service.status)} className="text-[9px] font-bold uppercase">
                    {statusLabel(service.status)}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-bold">{service.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    Last run: {service.minutes_since == null ? "—" : `${service.minutes_since}m ago`}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="opacity-60 uppercase">Freshness</span>
                    <span>{service.minutes_since == null ? "—" : `${freshness}%`}</span>
                  </div>
                  <Progress value={freshness} className="h-1" />
                </div>

                {service.error ? <div className="text-[10px] text-status-warning leading-snug">{service.error}</div> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">Real-time Activity Log</CardTitle>
            <CardDescription>Event stream from Workflow E.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={`${log.time ?? "na"}-${log.source}-${i}`} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground/60 w-44 flex-shrink-0">
                    {log.time ? new Date(log.time).toLocaleString() : "—"}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    {log.status === "success" ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-status-success" />
                    ) : log.status === "warning" ? (
                      <AlertTriangle className="h-3 w-3 text-status-warning" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-status-info" />
                    )}
                    <span>{log.event}</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background border">
                    {log.source}
                  </Badge>
                </div>
              ))}

              {!logs.length && <div className="text-sm text-muted-foreground">No logs yet.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Network Map</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-2 border-dashed border-primary/20 animate-spin-slow" />
                  <Server className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">AWS</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">Edge</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">CDN</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold">Security & Compliance</span>
              </div>
              <p className="text-xs opacity-70 mb-4">
                All lead data is encrypted at rest and in transit. Nexus Q adheres to SOC2 and GDPR principles for home service operations.
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold border-t border-white/10 pt-4">
                <span className="opacity-60">Last Check</span>
                <span>{payload?.generated_at ? new Date(payload.generated_at).toLocaleString() : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}