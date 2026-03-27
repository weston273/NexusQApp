create table if not exists public.client_ai_agents (
  client_id uuid primary key references public.clients(id) on delete cascade,
  is_enabled boolean not null default false,
  model text not null default 'gpt-4.1-mini',
  assistant_name text not null default 'NexusQ Assistant',
  system_prompt text null,
  fallback_message text not null default 'Thanks for reaching out. We are reviewing your message now and will text you back shortly.',
  intent_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.client_service_pricing (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_code text null,
  service_name text not null,
  currency text not null default 'USD',
  price_from numeric(12,2) null,
  price_to numeric(12,2) null,
  unit_label text null,
  summary text null,
  pricing_notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_ai_sessions (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  phone text null,
  memory_summary text null,
  last_detected_intent text null,
  last_stage_applied text null,
  last_message_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists client_ai_agents_set_updated_at on public.client_ai_agents;
create trigger client_ai_agents_set_updated_at
before update on public.client_ai_agents
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists client_service_pricing_set_updated_at on public.client_service_pricing;
create trigger client_service_pricing_set_updated_at
before update on public.client_service_pricing
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists lead_ai_sessions_set_updated_at on public.lead_ai_sessions;
create trigger lead_ai_sessions_set_updated_at
before update on public.lead_ai_sessions
for each row
execute function public.set_updated_at_timestamp();

create index if not exists client_service_pricing_client_id_active_idx
  on public.client_service_pricing (client_id, is_active, service_name);

create unique index if not exists client_service_pricing_client_service_code_unique
  on public.client_service_pricing (client_id, lower(service_code))
  where service_code is not null;

create index if not exists lead_ai_sessions_client_id_updated_idx
  on public.lead_ai_sessions (client_id, updated_at desc);
