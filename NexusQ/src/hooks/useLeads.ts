// src/hooks/useLeads.ts
import * as React from "react";
import { supabase } from "@/lib/supabase";
import { triggerProgress } from "@/lib/progressBus";

export type Lead = {
  id: string;
  client_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
  last_contacted_at: string | null;
  service: string | null;
  urgency: string | null;
  address: string | null;
};

export type LeadEvent = {
  id: string;
  client_id: string | null;
  lead_id: string | null; // ✅ schema says nullable
  event_type: string;
  payload_json: any;
  created_at: string;
};

export type PipelineRow = {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  stage: string;
  value: number | null;
  probability: number | null;
  updated_at: string | null;
};

export function useLeads() {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [events, setEvents] = React.useState<LeadEvent[]>([]);
  const [pipelineRows, setPipelineRows] = React.useState<PipelineRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    if (!silent) {
      setLoading(true);
      triggerProgress(650);
    }
    setError(null);

    const [
      { data: leadData, error: leadErr },
      { data: eventData, error: eventErr },
      { data: pipeData, error: pipeErr },
    ] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("lead_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase
        .from("pipeline")
        .select("id, client_id, lead_id, stage, value, probability, updated_at")
        .limit(2000),
    ]);

    const firstErr = leadErr ?? eventErr ?? pipeErr;
    if (firstErr) setError(firstErr.message);

    setLeads((leadData ?? []) as any);
    setEvents((eventData ?? []) as any);
    setPipelineRows((pipeData ?? []) as any);

    if (!silent) setLoading(false);
  }, []);

  React.useEffect(() => {
    // initial load
    load();

    // ✅ ONE channel for all tables
    const channel = supabase
      .channel("rt-leads-events-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        triggerProgress(450);
        load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_events" }, () => {
        triggerProgress(450);
        load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline" }, () => {
        triggerProgress(450);
        load({ silent: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { leads, events, pipelineRows, loading, error, reload: load };
}
