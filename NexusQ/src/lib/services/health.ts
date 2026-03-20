import { supabase } from "@/lib/supabase";
import {
  asDomainRecord,
  pickString,
  pickTimestamp,
  type AutomationHealthRecord,
} from "@/lib/types/domain";

function toAutomationHealthRecord(row: unknown): AutomationHealthRecord | null {
  const record = asDomainRecord(row);
  if (!record) return null;

  const id =
    pickString(record.id) ??
    [pickString(record.client_id), pickString(record.workflow_name), pickTimestamp(record.last_run_at)].filter(Boolean).join(":");
  if (!id) return null;

  return {
    id,
    clientId: pickString(record.client_id),
    workflowName: pickString(record.workflow_name),
    lastRunAt: pickTimestamp(record.last_run_at),
    status: pickString(record.status),
    errorMessage: pickString(record.error_message),
    updatedAt: pickTimestamp(record.updated_at, record.created_at),
    raw: record,
  };
}

export async function listAutomationHealth(clientId: string) {
  const { data, error } = await supabase.from("automation_health").select("*").eq("client_id", clientId);
  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => toAutomationHealthRecord(row))
    .filter((row): row is AutomationHealthRecord => Boolean(row));
}
