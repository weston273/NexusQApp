import * as React from "react";
import { supabase } from "@/lib/supabase";

export type Lead = {
  id: string;
  client_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string | null; // "new" etc
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
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("lead_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (leadErr) setError(leadErr.message);
    if (eventErr) setError(eventErr.message);

    setLeads(leadData ?? []);
    setEvents(eventData ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { leads, events, loading, error, reload: load };
}
