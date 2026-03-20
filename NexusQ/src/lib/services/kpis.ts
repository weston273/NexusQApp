import { supabase } from "@/lib/supabase";
import {
  asDomainRecord,
  pickNumber,
  pickObject,
  pickString,
  pickTimestamp,
  type DailyKpiRecord,
} from "@/lib/types/domain";

function normalizeDay(record: Record<string, unknown>) {
  return (
    pickTimestamp(record.day, record.date, record.kpi_date) ??
    pickString(record.day, record.date, record.kpi_date) ??
    new Date().toISOString()
  );
}

function toDailyKpiRecord(row: unknown): DailyKpiRecord | null {
  const record = asDomainRecord(row);
  if (!record) return null;

  const id =
    pickString(record.id) ??
    [pickString(record.client_id), normalizeDay(record), pickString(record.metric_set)].filter(Boolean).join(":");
  if (!id) return null;

  return {
    id,
    clientId: pickString(record.client_id),
    day: normalizeDay(record),
    leadsCaptured: pickNumber(record.leads_captured, record.lead_count, record.total_leads, record.new_leads),
    quotedCount: pickNumber(record.quoted_count, record.quotes_sent, record.quoted_leads),
    bookedCount: pickNumber(record.booked_count, record.bookings, record.booked_leads),
    revenue: pickNumber(record.revenue, record.pipeline_value, record.booked_revenue),
    avgResponseMinutes: pickNumber(
      record.avg_response_minutes,
      record.average_response_minutes,
      record.response_minutes
    ),
    conversionRate: pickNumber(record.conversion_rate, record.conversion, record.booking_rate),
    payload: pickObject(record.payload_json, record.payload, record.metadata, record.data),
    updatedAt: pickTimestamp(record.updated_at, record.created_at),
  };
}

export async function listDailyKpis(clientId: string, limit = 30) {
  const { data, error } = await supabase.from("daily_kpis").select("*").eq("client_id", clientId).limit(limit);
  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => toDailyKpiRecord(row))
    .filter((row): row is DailyKpiRecord => Boolean(row))
    .sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime());
}
