import * as React from "react";
import { supabase } from "@/lib/supabase";
import { triggerProgress } from "@/lib/progressBus";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";
import { useAuth } from "@/context/AuthProvider";

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
  lead_id: string | null;
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

type LeadsSnapshot = {
  leads: Lead[];
  events: LeadEvent[];
  pipelineRows: PipelineRow[];
  loading: boolean;
  error: string | null;
  lastLoadedAt: Date | null;
  clientId: string | null;
};

const initialSnapshot: LeadsSnapshot = {
  leads: [],
  events: [],
  pipelineRows: [],
  loading: true,
  error: null,
  lastLoadedAt: null,
  clientId: null,
};

type AccessContext = {
  userId: string | null;
  clientId: string | null;
};

class LeadsStore {
  private snapshot: LeadsSnapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private started = false;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private settingsListenerBound = false;
  private accessContext: AccessContext = { userId: null, clientId: null };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.started) this.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  };

  configureAccess(context: AccessContext) {
    const changed =
      this.accessContext.userId !== context.userId ||
      this.accessContext.clientId !== context.clientId;
    if (!changed) return;

    this.accessContext = context;
    this.setSnapshot({ clientId: context.clientId });

    if (!this.canQuery()) {
      this.teardownRealtime();
      this.setSnapshot({
        leads: [],
        events: [],
        pipelineRows: [],
        loading: false,
        error: null,
        lastLoadedAt: null,
      });
      return;
    }

    if (this.started) {
      this.setupRealtime();
      void this.load();
    }
  }

  private canQuery() {
    return Boolean(this.accessContext.userId && this.accessContext.clientId);
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private setSnapshot(partial: Partial<LeadsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  private applyAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.canQuery()) return;

    const settings = loadAppSettings();
    if (!settings.autoRefresh) return;

    const everyMs = Math.max(5000, settings.refreshIntervalSec * 1000);
    this.refreshTimer = setInterval(() => {
      void this.load({ silent: true });
    }, everyMs);
  }

  private setupRealtime() {
    this.teardownRealtime();
    if (!this.canQuery() || !this.accessContext.clientId) return;

    const filter = `client_id=eq.${this.accessContext.clientId}`;
    this.channel = supabase
      .channel(`rt-leads-events-pipeline-${this.accessContext.clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter }, () => {
        triggerProgress(450);
        void this.load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_events", filter }, () => {
        triggerProgress(450);
        void this.load({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline", filter }, () => {
        triggerProgress(450);
        void this.load({ silent: true });
      })
      .subscribe();
  }

  private teardownRealtime() {
    if (!this.channel) return;
    supabase.removeChannel(this.channel);
    this.channel = null;
  }

  private start() {
    this.started = true;

    if (this.canQuery()) {
      void this.load();
      this.setupRealtime();
    } else {
      this.setSnapshot({ loading: false, error: null });
    }

    this.applyAutoRefresh();
    if (!this.settingsListenerBound && typeof window !== "undefined") {
      window.addEventListener(SETTINGS_CHANGED_EVENT, this.handleSettingsChange as EventListener);
      this.settingsListenerBound = true;
    }
  }

  private stop() {
    this.started = false;
    this.teardownRealtime();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.settingsListenerBound && typeof window !== "undefined") {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, this.handleSettingsChange as EventListener);
      this.settingsListenerBound = false;
    }
  }

  private handleSettingsChange = () => {
    this.applyAutoRefresh();
  };

  load = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!this.canQuery() || !this.accessContext.clientId) {
      this.setSnapshot({
        leads: [],
        events: [],
        pipelineRows: [],
        error: null,
        loading: false,
        lastLoadedAt: null,
      });
      return;
    }

    if (!silent) {
      this.setSnapshot({ loading: true, error: null });
      triggerProgress(650);
    } else {
      this.setSnapshot({ error: null });
    }

    const clientId = this.accessContext.clientId;
    const [
      { data: leadData, error: leadErr },
      { data: eventData, error: eventErr },
      { data: pipeData, error: pipeErr },
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("id, client_id, name, phone, email, source, status, score, created_at, last_contacted_at, service, urgency, address")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("lead_events")
        .select("id, client_id, lead_id, event_type, payload_json, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("pipeline")
        .select("id, client_id, lead_id, stage, value, probability, updated_at")
        .eq("client_id", clientId)
        .limit(2000),
    ]);

    const firstErr = leadErr ?? eventErr ?? pipeErr;
    if (firstErr) {
      this.setSnapshot({
        error: firstErr.message,
        loading: false,
        clientId,
      });
      return;
    }

    this.setSnapshot({
      leads: (leadData ?? []) as Lead[],
      events: (eventData ?? []) as LeadEvent[],
      pipelineRows: (pipeData ?? []) as PipelineRow[],
      error: null,
      loading: false,
      lastLoadedAt: new Date(),
      clientId,
    });
  };
}

const sharedStore = new LeadsStore();

export function useLeads() {
  const { user, clientId } = useAuth();
  const userId = user?.id ?? null;

  React.useEffect(() => {
    sharedStore.configureAccess({ userId, clientId });
  }, [clientId, userId]);

  const snapshot = React.useSyncExternalStore(sharedStore.subscribe, sharedStore.getSnapshot);
  return {
    ...snapshot,
    reload: sharedStore.load,
  };
}
