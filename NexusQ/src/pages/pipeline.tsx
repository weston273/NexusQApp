// src/pages/Pipeline.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

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

import { MoreVertical, Plus, Zap, Filter, Settings, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/ui/page-header";
import { ActionEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/data-state";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { parseFunctionError } from "@/lib/access";

const stages = [
  { id: "new", title: "New", color: "bg-blue-500" },
  { id: "qualifying", title: "Qualifying", color: "bg-amber-500" },
  { id: "quoted", title: "Quoted", color: "bg-purple-500" },
  { id: "booked", title: "Booked", color: "bg-emerald-500" },
] as const;

type StageId = (typeof stages)[number]["id"];
const stageOrder: StageId[] = ["new", "qualifying", "quoted", "booked"];
const DEFAULT_VISIBLE_LEADS = 10;

type UiLead = {
  id: string;
  name: string;
  company: string;
  valueNum: number;
  value: string;
  time: string;
  stage: StageId;
  probability: number | null;
  createdAtMs: number;
};

function isStageId(value: string): value is StageId {
  return stageOrder.includes(value as StageId);
}

function DraggableLeadCard({
  lead,
  onOpenEdit,
  onMovePrev,
  onMoveNext,
}: {
  lead: UiLead;
  onOpenEdit: (lead: UiLead) => void;
  onMovePrev: (lead: UiLead) => void;
  onMoveNext: (lead: UiLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { leadId: lead.id, fromStage: lead.stage },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer bg-muted/10",
        isDragging && "opacity-60"
      )}
      onClick={() => onOpenEdit(lead)}
      title="Drag by handle or click to update stage/value"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold leading-none mb-1">{lead.name}</div>
            <div className="text-[10px] text-muted-foreground font-medium">{lead.company}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="inline-flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground hover:bg-background/80"
              aria-label="Drag card"
              onClick={(e) => e.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className="text-[10px] font-bold h-5 bg-background border-border/50">
              {lead.value}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
            <Zap className="h-3 w-3 text-amber-500" />
            High Intent
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMovePrev(lead);
              }}
              aria-label="Move to previous stage"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMoveNext(lead);
              }}
              aria-label="Move to next stage"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <div className="text-[10px] text-muted-foreground">{lead.time}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({ stageId, stageTitle, children }: { stageId: StageId; stageTitle: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`${stageTitle} stage drop area`}
      className={cn(
        "space-y-3 rounded-xl p-1 transition-colors duration-150",
        isOver && "bg-primary/10 ring-1 ring-primary/30"
      )}
    >
      {children}
    </div>
  );
}

// ---------- charts ----------
const StageDistributionChart = ({ data }: { data: { stage: string; count: number }[] }) => (
  <Card className="border-none card-surface-a">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Leads per Stage</CardTitle>
      <CardDescription className="text-xs">Where workload is concentrated.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis
            dataKey="stage"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "hsl(var(--primary))" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
            {data.map((_, idx) => (
              <Cell key={`stage-cell-${idx}`} fill={`hsl(var(--chart-${(idx % 4) + 1}))`} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const RevenueStageChart = ({ data }: { data: { stage: string; revenue: number }[] }) => (
  <Card className="border-none card-surface-b">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Revenue Distribution</CardTitle>
      <CardDescription className="text-xs">Sum of pipeline.value per stage.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis
            dataKey="stage"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
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
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={30}>
            {data.map((_, idx) => (
              <Cell key={`revenue-cell-${idx}`} fill={`hsl(var(--chart-${(idx % 4) + 4}))`} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const PipelineFlowChart = ({ data }: { data: { stage: string; value: number }[] }) => (
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
          <YAxis
            dataKey="stage"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "hsl(var(--primary))" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((_, idx) => (
              <Cell key={`flow-cell-${idx}`} fill={`hsl(var(--chart-${(idx % 5) + 1}))`} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// ---------- helpers ----------
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

function formatMoney(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(safe));
  }
}

function parseMoneyInput(v: string) {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return num;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatNullableText(value: unknown) {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text ? text : "-";
}

// ---------- Workflow D caller ----------
async function callWorkflowD(args: { lead_id: string; status: StageId; value?: number | null }) {
  const payload: Record<string, unknown> = {
    lead_id: args.lead_id,
    status: args.status,
    stage: args.status,
    value: args.value ?? null,
  };

  const { data, error } = await supabase.functions.invoke("workflow-d-proxy", {
    body: payload,
  });
  if (error) {
    throw new Error(await parseFunctionError(error));
  }
  if (!data?.ok) {
    const message = typeof data?.error === "string" ? data.error : "Workflow D failed.";
    throw new Error(message);
  }
  return data;
}

export function Pipeline() {
  const navigate = useNavigate();
  const { leads, events, pipelineRows, loading, error, lastLoadedAt, reload } = useLeads();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } })
  );

  // --- Modal state ---
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [activeLead, setActiveLead] = React.useState<{
    id: string;
    name: string;
    stage: StageId;
    valueNum: number;
  } | null>(null);

  const [editStage, setEditStage] = React.useState<StageId>("new");
  const [editValue, setEditValue] = React.useState<string>("0");
  const [showAllLeads, setShowAllLeads] = React.useState(false);
  const [stageOverrides, setStageOverrides] = React.useState<Record<string, StageId>>({});
  const [activeDragLeadId, setActiveDragLeadId] = React.useState<string | null>(null);
  const dragOriginRef = React.useRef<Record<string, StageId>>({});

  // Map pipeline info by lead_id (dedupe by latest updated_at)
  const pipelineByLeadId = React.useMemo(() => {
    const m = new Map<string, (typeof pipelineRows)[number]>();
    for (const row of pipelineRows ?? []) {
      if (!row.lead_id) continue;
      const prev = m.get(row.lead_id);
      if (!prev) {
        m.set(row.lead_id, row);
        continue;
      }
      const a = new Date((prev as any).updated_at ?? 0).getTime();
      const b = new Date((row as any).updated_at ?? 0).getTime();
      if (b >= a) m.set(row.lead_id, row);
    }
    return m;
  }, [pipelineRows]);

  const leadSourceById = React.useMemo(() => {
    const map = new Map<string, (typeof leads)[number]>();
    for (const lead of leads ?? []) {
      map.set(lead.id, lead);
    }
    return map;
  }, [leads]);

  const latestEventByLeadId = React.useMemo(() => {
    const map = new Map<string, (typeof events)[number]>();
    for (const event of events ?? []) {
      if (!event.lead_id) continue;
      if (!map.has(event.lead_id)) {
        map.set(event.lead_id, event);
      }
    }
    return map;
  }, [events]);

  // UI leads: stage from pipeline first, fallback to leads.status
  const uiLeads = React.useMemo<UiLead[]>(() => {
    return (leads ?? []).map((l: any) => {
      const pipe: any = pipelineByLeadId.get(l.id);
      const stage = stageOverrides[l.id] ?? toStageId(pipe?.stage ?? l.status);
      const value = Number(pipe?.value ?? 0);

      const safeName =
        (typeof l.name === "string" && l.name.trim()) ||
        (typeof l.full_name === "string" && l.full_name.trim()) ||
        (typeof l.phone === "string" && l.phone.trim()) ||
        "Unknown";

      return {
        id: l.id,
        name: safeName,
        company: l.service ? String(l.service).toUpperCase() : "SERVICE",
        valueNum: Number.isFinite(value) ? value : 0,
        value: `$${formatMoney(Number.isFinite(value) ? value : 0)}`,
        time: new Date(l.created_at).toLocaleDateString(),
        stage,
        probability: pipe?.probability ?? null,
        createdAtMs: new Date(l.created_at ?? 0).getTime() || 0,
      };
    });
  }, [leads, pipelineByLeadId, stageOverrides]);

  const sortedLeadIdsByRecency = React.useMemo(() => {
    return [...uiLeads]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((lead) => lead.id);
  }, [uiLeads]);

  const visibleLeadIds = React.useMemo(() => {
    const ids = showAllLeads ? sortedLeadIdsByRecency : sortedLeadIdsByRecency.slice(0, DEFAULT_VISIBLE_LEADS);
    return new Set(ids);
  }, [showAllLeads, sortedLeadIdsByRecency]);

  const visibleUiLeads = React.useMemo(
    () => uiLeads.filter((lead) => visibleLeadIds.has(lead.id)),
    [uiLeads, visibleLeadIds]
  );

  const hasMoreLeads = uiLeads.length > DEFAULT_VISIBLE_LEADS;
  const hiddenLeadCount = Math.max(0, uiLeads.length - DEFAULT_VISIBLE_LEADS);

  React.useEffect(() => {
    if (uiLeads.length <= DEFAULT_VISIBLE_LEADS && showAllLeads) {
      setShowAllLeads(false);
    }
  }, [showAllLeads, uiLeads.length]);

  const leadById = React.useMemo(() => {
    const map = new Map<string, UiLead>();
    for (const lead of uiLeads) map.set(lead.id, lead);
    return map;
  }, [uiLeads]);

  const activeLeadSource = React.useMemo(() => {
    if (!activeLead) return null;
    return leadSourceById.get(activeLead.id) ?? null;
  }, [activeLead, leadSourceById]);

  const activePipeline = React.useMemo(() => {
    if (!activeLead) return null;
    return pipelineByLeadId.get(activeLead.id) ?? null;
  }, [activeLead, pipelineByLeadId]);

  const activeLatestEvent = React.useMemo(() => {
    if (!activeLead) return null;
    return latestEventByLeadId.get(activeLead.id) ?? null;
  }, [activeLead, latestEventByLeadId]);

  const activeEventSummary = React.useMemo(() => {
    if (!activeLatestEvent) {
      return {
        type: "-",
        detail: "No recent activity available.",
        time: "-",
      };
    }

    const payload = (activeLatestEvent.payload_json ?? null) as any;
    const detailCandidate =
      (typeof payload?.message === "string" && payload.message.trim()) ||
      (typeof payload?.summary === "string" && payload.summary.trim()) ||
      (typeof payload?.body === "string" && payload.body.trim()) ||
      (typeof payload?.note === "string" && payload.note.trim()) ||
      (typeof payload?.status === "string" && payload.status.trim()) ||
      (typeof payload?.stage === "string" && payload.stage.trim()) ||
      "";

    return {
      type: String(activeLatestEvent.event_type ?? "event").replace(/_/g, " "),
      detail: detailCandidate || "Event received with no additional text payload.",
      time: formatDateTime(activeLatestEvent.created_at),
    };
  }, [activeLatestEvent]);

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

  // Real revenue by stage from pipeline table
  const revenueData = React.useMemo(() => {
    const sums: Record<StageId, number> = { new: 0, qualifying: 0, quoted: 0, booked: 0 };
    for (const row of pipelineRows ?? []) {
      const stage = toStageId((row as any).stage);
      const v = Number((row as any).value ?? 0);
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

  const openEdit = (lead: UiLead) => {
    setActiveLead({ id: lead.id, name: lead.name, stage: lead.stage, valueNum: lead.valueNum });
    setEditStage(lead.stage);
    setEditValue(String(Math.round(lead.valueNum || 0)));
    setOpen(true);
  };

  const saveEdit = async () => {
    if (!activeLead) return;
    const previousStage = activeLead.stage;
    const previousValue = activeLead.valueNum;
    const leadId = activeLead.id;
    const leadName = activeLead.name;

    try {
      setSaving(true);

      const valueNum = parseMoneyInput(editValue);
      await callWorkflowD({
        lead_id: activeLead.id,
        status: editStage,
        value: valueNum,
      });

      toast.success("Pipeline updated", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await callWorkflowD({ lead_id: leadId, status: previousStage, value: previousValue });
              toast.success("Update reverted");
              await reload({ silent: true });
            } catch (undoError: any) {
              toast.error(undoError?.message || "Failed to undo update");
            }
          },
        },
      });
      setOpen(false);
      await reload({ silent: true });

      // realtime should refresh; but fallback:
      // reload();
    } catch (e: any) {
      toast.error(e?.message || `Failed to update ${leadName}`);
    } finally {
      setSaving(false);
    }
  };

  const moveLeadStage = async (lead: UiLead, direction: "prev" | "next") => {
    const idx = stageOrder.indexOf(lead.stage);
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= stageOrder.length) return;

    const previous = lead.stage;
    const next = stageOrder[nextIdx];

    setStageOverrides((prev) => ({ ...prev, [lead.id]: next }));
    try {
      await callWorkflowD({ lead_id: lead.id, status: next, value: lead.valueNum });
      toast.success(`Moved to ${next}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            setStageOverrides((prev) => ({ ...prev, [lead.id]: previous }));
            try {
              await callWorkflowD({ lead_id: lead.id, status: previous, value: lead.valueNum });
              toast.success("Stage reverted");
              await reload({ silent: true });
              setStageOverrides((prev) => {
                const nextState = { ...prev };
                delete nextState[lead.id];
                return nextState;
              });
            } catch (error: any) {
              toast.error(error?.message || "Failed to undo move");
            }
          },
        },
      });
      await reload({ silent: true });
      setStageOverrides((prev) => {
        const nextState = { ...prev };
        delete nextState[lead.id];
        return nextState;
      });
    } catch (error: any) {
      setStageOverrides((prev) => ({ ...prev, [lead.id]: previous }));
      toast.error(error?.message || "Failed to move stage");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const leadId = event.active.data.current?.leadId as string | undefined;
    const fromStage = event.active.data.current?.fromStage as StageId | undefined;
    if (!leadId || !fromStage) return;
    setActiveDragLeadId(leadId);
    dragOriginRef.current[leadId] = fromStage;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const leadId = event.active?.data?.current?.leadId as string | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    if (!leadId || !overId || !isStageId(overId)) return;
    setStageOverrides((prev) => {
      if (prev[leadId] === overId) return prev;
      return { ...prev, [leadId]: overId };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const leadId = event.active.data.current?.leadId as string | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    setActiveDragLeadId(null);

    if (!leadId) return;

    const originalStage = dragOriginRef.current[leadId] ?? leadById.get(leadId)?.stage;
    const targetStage =
      overId && isStageId(overId) ? (overId as StageId) : originalStage;
    const lead = leadById.get(leadId);

    if (!lead || !originalStage || !targetStage) return;

    if (targetStage === originalStage) {
      setStageOverrides((prev) => {
        const nextState = { ...prev };
        delete nextState[leadId];
        return nextState;
      });
      delete dragOriginRef.current[leadId];
      return;
    }

    setStageOverrides((prev) => ({ ...prev, [lead.id]: targetStage }));
    try {
      await callWorkflowD({ lead_id: lead.id, status: targetStage, value: lead.valueNum });
      toast.success(`Moved ${lead.name} to ${targetStage}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            setStageOverrides((prev) => ({ ...prev, [lead.id]: originalStage }));
            try {
              await callWorkflowD({ lead_id: lead.id, status: originalStage, value: lead.valueNum });
              toast.success("Stage reverted");
              await reload({ silent: true });
              setStageOverrides((prev) => {
                const nextState = { ...prev };
                delete nextState[lead.id];
                return nextState;
              });
            } catch (error: any) {
              toast.error(error?.message || "Failed to undo move");
            }
          },
        },
      });
      await reload({ silent: true });
      setStageOverrides((prev) => {
        const nextState = { ...prev };
        delete nextState[lead.id];
        return nextState;
      });
    } catch (error: any) {
      setStageOverrides((prev) => ({ ...prev, [lead.id]: originalStage }));
      toast.error(error?.message || "Failed to move stage");
    } finally {
      delete dragOriginRef.current[leadId];
    }
  };

  const handleDragCancel = () => {
    if (!activeDragLeadId) return;
    const originalStage = dragOriginRef.current[activeDragLeadId];
    if (originalStage) {
      setStageOverrides((prev) => {
        const nextState = { ...prev };
        delete nextState[activeDragLeadId];
        return nextState;
      });
      delete dragOriginRef.current[activeDragLeadId];
    }
    setActiveDragLeadId(null);
  };

  if (loading) {
    return <PageLoadingState title="Loading pipeline board" description="Fetching stage distribution, values, and board state." />;
  }
  if (error)
    return (
      <PageErrorState
        title="Pipeline data unavailable"
        message={error}
        onRetry={() => {
          void reload();
        }}
      />
    );

  return (
    <>
      <div className="space-y-8 pb-8">
        <PageHeader
          title="Pipeline Operations"
          description="Revenue flow and lead progression across all stages."
          lastUpdatedLabel={`Last updated: ${lastLoadedAt ? lastLoadedAt.toLocaleTimeString() : "Not yet synced"}`}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2"
                onClick={() => {
                  void reload();
                }}
              >
                <Filter className="h-4 w-4" />
                Refresh
              </Button>
              <Button size="sm" className="h-10 gap-2" onClick={() => navigate("/intake")}>
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </>
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          <StageDistributionChart data={stageDistributionData} />
          <RevenueStageChart data={revenueData} />
          <PipelineFlowChart data={pipelineFlowData} />
        </div>

        {!uiLeads.length ? (
          <ActionEmptyState
            title="No leads in pipeline"
            description="Create a lead to start workflow progression and stage analytics."
            primaryActionLabel="Add Lead"
            onPrimaryAction={() => navigate("/intake")}
            secondaryActionLabel="Refresh Pipeline"
            onSecondaryAction={() => {
              void reload();
            }}
          />
        ) : null}

        {hasMoreLeads ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              Showing {showAllLeads ? uiLeads.length : DEFAULT_VISIBLE_LEADS} of {uiLeads.length} most recent leads.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowAllLeads((prev) => !prev)}
            >
              {showAllLeads ? "Show Less" : `Show More (${hiddenLeadCount})`}
            </Button>
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ScrollArea className="w-full whitespace-nowrap rounded-md border-none" aria-label="Pipeline stage board">
            <div className="flex w-max space-x-6 min-h-[600px]">
              {stages.map((stage) => {
                const stageLeads = visibleUiLeads.filter((l) => l.stage === stage.id);
                const totalStageLeads = uiLeads.filter((l) => l.stage === stage.id).length;
                return (
                  <div key={stage.id} className="w-[85vw] sm:w-[300px] flex flex-col space-y-4" role="region" aria-label={`${stage.title} column`}>
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                        <h3 className="font-bold text-sm uppercase tracking-wider">{stage.title}</h3>
                        <Badge
                          variant="secondary"
                          className="ml-1 text-[10px] h-4 px-1.5 bg-muted/50 text-muted-foreground"
                        >
                          {showAllLeads ? stageLeads.length : `${stageLeads.length}/${totalStageLeads}`}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toast.info(`${stage.title} actions are available in the lead cards below.`)}
                        aria-label={`${stage.title} column actions`}
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <DroppableColumn stageId={stage.id} stageTitle={stage.title}>
                      {stageLeads.map((lead) => (
                        <DraggableLeadCard
                          key={lead.id}
                          lead={lead}
                          onOpenEdit={openEdit}
                          onMovePrev={(l) => moveLeadStage(l, "prev")}
                          onMoveNext={(l) => moveLeadStage(l, "next")}
                        />
                      ))}

                      {!stageLeads.length && (
                        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                          No leads in {stage.title} yet.
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        className="w-full border-2 border-dashed border-border/20 h-12 text-muted-foreground text-xs hover:border-border/50 hover:bg-muted/5"
                        onClick={() => navigate("/intake")}
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Add Lead
                      </Button>
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {activeDragLeadId && leadById.get(activeDragLeadId) ? (
              <Card className="w-[260px] border-none shadow-xl bg-card/95">
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-bold">{leadById.get(activeDragLeadId)?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{leadById.get(activeDragLeadId)?.company}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {leadById.get(activeDragLeadId)?.value}
                  </Badge>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* -------- Edit Modal -------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Pipeline</DialogTitle>
            <DialogDescription>
              Edit the stage and quote/value for this lead. Saving will sync with the database.
              <br />
              <span className="text-xs text-muted-foreground">
                If credentials are missing, update backend connector configuration.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Lead</div>
              <div className="font-bold">{activeLead?.name ?? "-"}</div>
              <div className="text-[10px] text-muted-foreground">ID: {activeLead?.id ?? "-"}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/10 p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Details</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="text-right font-medium break-all">{formatNullableText(activeLeadSource?.phone)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-right font-medium break-all">{formatNullableText(activeLeadSource?.email)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Service</span>
                    <span className="text-right font-medium">{formatNullableText(activeLeadSource?.service)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Urgency</span>
                    <span className="text-right font-medium">{formatNullableText(activeLeadSource?.urgency)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Address</span>
                    <span className="text-right font-medium break-words">{formatNullableText(activeLeadSource?.address)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Source</span>
                    <span className="text-right font-medium">{formatNullableText(activeLeadSource?.source)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Score</span>
                    <span className="text-right font-medium">{formatNullableText(activeLeadSource?.score)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-right font-medium">{formatNullableText(activeLeadSource?.status ?? activeLead?.stage)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-right font-medium">{formatDateTime(activeLeadSource?.created_at)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Last Contacted</span>
                    <span className="text-right font-medium">{formatDateTime(activeLeadSource?.last_contacted_at)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Pipeline Snapshot</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Current Stage</span>
                      <span className="text-right font-medium">{formatNullableText(activePipeline?.stage ?? activeLead?.stage)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Pipeline Value</span>
                      <span className="text-right font-medium">
                        ${formatMoney(Number(activePipeline?.value ?? activeLead?.valueNum ?? 0))}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Probability</span>
                      <span className="text-right font-medium">
                        {activePipeline?.probability == null ? "-" : `${activePipeline.probability}%`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Latest Activity</div>
                  <div className="space-y-1 text-xs">
                    <div className="font-medium">{activeEventSummary.type}</div>
                    <div className="text-muted-foreground leading-relaxed">{activeEventSummary.detail}</div>
                    <div className="text-[10px] text-muted-foreground">{activeEventSummary.time}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Stage</Label>
                <Select value={editStage} onValueChange={(v) => setEditStage(toStageId(v))}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualifying">Qualifying</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Value (USD)</Label>
                <Input
                  className="h-11"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 2500"
                />
                <div className="text-[10px] text-muted-foreground">
                  Parsed: <span className="font-mono">${formatMoney(parseMoneyInput(editValue))}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving || !activeLead}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}




