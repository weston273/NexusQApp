import * as React from "react";
import { supabase } from "@/lib/supabase";

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
  lead_id: string;
  event_type: string;
  payload_json: any;
  created_at: string;
};

export function useLeads() {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [events, setEvents] = React.useState<LeadEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const [{ data: leadData, error: leadErr }, { data: eventData, error: eventErr }] =
      await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("lead_events").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

    if (leadErr || eventErr) {
      setError([leadErr?.message, eventErr?.message].filter(Boolean).join(" | "));
    }

    setLeads(leadData ?? []);
    setEvents(eventData ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();

    // Realtime: watch both tables
    const channel = supabase
      .channel("realtime-leads-and-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_events" },
        () => {
          load();
        }
      )
      .subscribe((status) => {
       
        console.log("Realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { leads, events, loading, error, reload: load };
}
