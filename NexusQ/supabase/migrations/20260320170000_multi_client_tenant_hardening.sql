-- Multi-client hardening:
-- 1. add a first-class client_key for deterministic public workflow routing
-- 2. remove the legacy default tenant fallback on leads.client_id
-- 3. enforce or forward-enforce non-null client_id across tenant-scoped tables
-- 4. add indexes used by tenant-safe workflow lookups

create or replace function public.generate_client_key()
returns text
language plpgsql
as $$
declare
  v_key text;
begin
  loop
    v_key := lower(substr(md5(random()::text || clock_timestamp()::text || random()::text), 1, 16));
    exit when not exists (
      select 1
      from public.clients
      where client_key = v_key
    );
  end loop;

  return v_key;
end;
$$;

alter table public.clients
  add column if not exists client_key text;

alter table public.clients
  alter column client_key set default public.generate_client_key();

update public.clients
set client_key = public.generate_client_key()
where client_key is null;

alter table public.clients
  alter column client_key set not null;

create unique index if not exists clients_client_key_unique
  on public.clients (lower(client_key));

create unique index if not exists clients_phone_unique
  on public.clients (phone)
  where phone is not null;

alter table public.leads
  alter column client_id drop default;

create index if not exists leads_client_id_phone_idx
  on public.leads (client_id, phone)
  where phone is not null;

create index if not exists leads_client_id_email_idx
  on public.leads (client_id, email)
  where email is not null;

create index if not exists messages_client_id_lead_id_created_idx
  on public.messages (client_id, lead_id, created_at desc)
  where client_id is not null;

do $$
begin
  if exists (select 1 from public.leads where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'leads_client_id_required'
    ) then
      alter table public.leads
        add constraint leads_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.leads
      alter column client_id set not null;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.lead_events where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'lead_events_client_id_required'
    ) then
      alter table public.lead_events
        add constraint lead_events_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.lead_events
      alter column client_id set not null;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.messages where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'messages_client_id_required'
    ) then
      alter table public.messages
        add constraint messages_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.messages
      alter column client_id set not null;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.pipeline where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'pipeline_client_id_required'
    ) then
      alter table public.pipeline
        add constraint pipeline_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.pipeline
      alter column client_id set not null;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.daily_kpis where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'daily_kpis_client_id_required'
    ) then
      alter table public.daily_kpis
        add constraint daily_kpis_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.daily_kpis
      alter column client_id set not null;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.automation_health where client_id is null limit 1) then
    if not exists (
      select 1 from pg_constraint where conname = 'automation_health_client_id_required'
    ) then
      alter table public.automation_health
        add constraint automation_health_client_id_required
        check (client_id is not null) not valid;
    end if;
  else
    alter table public.automation_health
      alter column client_id set not null;
  end if;
end;
$$;
