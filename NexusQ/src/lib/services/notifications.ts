import { supabase } from "@/lib/supabase";
import {
  asDomainRecord,
  normalizeNotificationSeverity,
  pickObject,
  pickString,
  pickTimestamp,
  type ClientNotificationRecord,
} from "@/lib/types/domain";

function toClientNotification(row: unknown): ClientNotificationRecord | null {
  const record = asDomainRecord(row);
  if (!record) return null;

  const id =
    pickString(record.id) ??
    [pickString(record.client_id), pickString(record.title, record.type), pickTimestamp(record.created_at)].filter(Boolean).join(":");
  const createdAt = pickTimestamp(record.created_at, record.inserted_at, record.updated_at) ?? new Date().toISOString();

  if (!id) return null;

  return {
    id,
    clientId: pickString(record.client_id),
    title: pickString(record.title, record.subject, record.event_type, record.type) ?? "Notification",
    body: pickString(record.body, record.message, record.summary, record.description),
    severity: normalizeNotificationSeverity(record.severity ?? record.level ?? record.status),
    createdAt,
    readAt: pickTimestamp(record.read_at, record.readAt),
    linkPath: pickString(record.link_path, record.target_path, record.path, record.href),
    leadId: pickString(record.lead_id),
    source: pickString(record.source, record.category, record.workflow_name),
    status: pickString(record.status),
    type: pickString(record.type, record.event_type),
    metadata: pickObject(record.metadata, record.payload_json, record.payload, record.data),
  };
}

export async function listClientNotifications(clientId: string, limit = 20) {
  const { data, error } = await supabase
    .from("client_notifications")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => toClientNotification(row))
    .filter((row): row is ClientNotificationRecord => Boolean(row))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function subscribeToClientNotifications(clientId: string, onChange: () => void) {
  const filter = `client_id=eq.${clientId}`;
  const channel = supabase
    .channel(`rt-client-notifications-${clientId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "client_notifications", filter }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function markClientNotificationRead(notificationId: string) {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("client_notifications")
    .update({ read_at: readAt })
    .eq("id", notificationId)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return readAt;
}

export async function markAllClientNotificationsRead(clientId: string) {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("client_notifications")
    .update({ read_at: readAt })
    .eq("client_id", clientId)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return readAt;
}
