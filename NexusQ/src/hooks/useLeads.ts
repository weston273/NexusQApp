import * as React from "react";
import { supabase } from "@/lib/supabase";
import { triggerProgress } from "@/lib/progressBus";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";

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
};

const initialSnapshot: LeadsSnapshot = {
  leads: [],
  events: [],
  pipelineRows: [],
  loading: true,
  error: null,
  lastLoadedAt: null,
};

class LeadsStore {
  private snapshot: LeadsSnapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private started = false;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private settingsListenerBound = false;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.started) this.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  };

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

    const settings = loadAppSettings();
    if (!settings.autoRefresh) return;

    const everyMs = Math.max(5000, settings.refreshIntervalSec * 1000);
    this.refreshTimer = setInterval(() => {
      this.load({ silent: true }).catch(() => {});
    }, everyMs);
  }

  private start() {
    this.started = true;

    this.load().catch(() => {});
    this.channel = supabase
      .channel("rt-leads-events-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        triggerProgress(450);
        this.load({ silent: true }).catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_events" }, () => {
        triggerProgress(450);
        this.load({ silent: true }).catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline" }, () => {
        triggerProgress(450);
        this.load({ silent: true }).catch(() => {});
      })
      .subscribe();

    this.applyAutoRefresh();
    if (!this.settingsListenerBound && typeof window !== "undefined") {
      window.addEventListener(SETTINGS_CHANGED_EVENT, this.handleSettingsChange as EventListener);
      this.settingsListenerBound = true;
    }
  }

  private stop() {
    this.started = false;
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
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
    if (!silent) {
      this.setSnapshot({ loading: true, error: null });
      triggerProgress(650);
    } else {
      this.setSnapshot({ error: null });
    }

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
    this.setSnapshot({
      leads: (leadData ?? []) as any,
      events: (eventData ?? []) as any,
      pipelineRows: (pipeData ?? []) as any,
      error: firstErr ? firstErr.message : null,
      loading: false,
      lastLoadedAt: new Date(),
    });
  };
}

const sharedStore = new LeadsStore();

export function useLeads() {
  const snapshot = React.useSyncExternalStore(sharedStore.subscribe, sharedStore.getSnapshot);
  return {
    ...snapshot,
    reload: sharedStore.load,
  };
}
