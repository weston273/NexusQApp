import { supabase } from "@/lib/supabase";
import {
  asDomainRecord,
  normalizeMessageDirection,
  pickObject,
  pickString,
  pickTimestamp,
  type MessageRecord,
} from "@/lib/types/domain";

function toMessageRecord(row: unknown): MessageRecord | null {
  const record = asDomainRecord(row);
  if (!record) return null;

  const id =
    pickString(record.id) ??
    [
      pickString(record.client_id),
      pickString(record.provider_message_id),
      pickTimestamp(record.created_at, record.sent_at, record.received_at),
    ]
      .filter(Boolean)
      .join(":");
  const createdAt =
    pickTimestamp(record.created_at, record.sent_at, record.received_at, record.updated_at) ?? new Date().toISOString();

  if (!id) return null;

  return {
    id,
    clientId: pickString(record.client_id),
    leadId: pickString(record.lead_id),
    direction: normalizeMessageDirection(record.direction),
    channel: pickString(record.channel),
    provider: pickString(record.provider),
    providerMessageId: pickString(record.provider_message_id, record.message_id),
    status: pickString(record.status),
    body: pickString(record.body, record.message, record.text),
    createdAt,
    metadata: pickObject(record.metadata, record.payload_json, record.payload, record.provider_payload),
  };
}

export async function listMessages(args: { clientId: string; leadId?: string | null; limit?: number }) {
  const { clientId, leadId = null, limit = 50 } = args;

  let query = supabase
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => toMessageRecord(row))
    .filter((row): row is MessageRecord => Boolean(row))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function subscribeToLeadMessages(args: { clientId: string; leadId: string; onChange: () => void }) {
  const { clientId, leadId, onChange } = args;
  const channel = supabase
    .channel(`rt-messages-${clientId}-${leadId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
