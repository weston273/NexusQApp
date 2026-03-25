create or replace function public.delete_lead_cascade(
  p_lead_id uuid,
  p_client_id uuid default null
)
returns table (
  lead_id uuid,
  client_id uuid,
  deleted_pipeline integer,
  deleted_messages integer,
  deleted_events integer,
  deleted_notifications integer,
  deleted_leads integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_lead public.leads%rowtype;
  v_deleted_pipeline integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_events integer := 0;
  v_deleted_notifications integer := 0;
  v_deleted_leads integer := 0;
begin
  if p_lead_id is null then
    raise exception 'p_lead_id is required';
  end if;

  select *
    into v_lead
  from public.leads
  where id = p_lead_id
    and (p_client_id is null or client_id = p_client_id)
  for update;

  if not found then
    raise exception 'Lead not found.';
  end if;

  delete from public.client_notifications
  where lead_id = v_lead.id;
  get diagnostics v_deleted_notifications = row_count;

  delete from public.messages
  where lead_id = v_lead.id;
  get diagnostics v_deleted_messages = row_count;

  delete from public.lead_events
  where lead_id = v_lead.id;
  get diagnostics v_deleted_events = row_count;

  delete from public.pipeline
  where lead_id = v_lead.id;
  get diagnostics v_deleted_pipeline = row_count;

  delete from public.leads
  where id = v_lead.id;
  get diagnostics v_deleted_leads = row_count;

  if v_deleted_leads <> 1 then
    raise exception 'Lead delete did not persist.';
  end if;

  return query
  select
    v_lead.id,
    v_lead.client_id,
    v_deleted_pipeline,
    v_deleted_messages,
    v_deleted_events,
    v_deleted_notifications,
    v_deleted_leads;
end;
$$;

revoke all on function public.delete_lead_cascade(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_lead_cascade(uuid, uuid) to service_role;
