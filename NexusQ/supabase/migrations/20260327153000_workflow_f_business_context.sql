create table if not exists public.client_profiles (
  client_id uuid primary key references public.clients(id) on delete cascade,
  business_name text null,
  business_description text null,
  services_summary text null,
  ideal_customer text null,
  service_area text null,
  limitations text null,
  offers_summary text null,
  onboarding_status text not null default 'pending',
  onboarding_summary text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint client_profiles_onboarding_status_check
    check (onboarding_status in ('pending', 'in_progress', 'completed'))
);

create table if not exists public.pricing_models (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_code text null,
  service_name text not null,
  package_name text null,
  currency text not null default 'USD',
  price_from numeric(12,2) null,
  price_to numeric(12,2) null,
  unit_label text null,
  description text null,
  pricing_notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  rule_type text not null,
  rule_key text not null,
  rule_label text null,
  rule_text text not null,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_behavior_config (
  client_id uuid primary key references public.clients(id) on delete cascade,
  is_enabled boolean not null default false,
  model text not null default 'gpt-4.1-mini',
  assistant_name text not null default 'NexusQ Assistant',
  tone text not null default 'friendly',
  system_prompt text null,
  fallback_message text not null default 'Thanks for reaching out. We are reviewing your message now and will text you back shortly.',
  onboarding_questions jsonb not null default '[
    {"key":"business_description","question":"What does your business do and what services or products do you sell?"},
    {"key":"pricing","question":"What are your main pricing ranges, packages, or quote rules?"},
    {"key":"offers","question":"What deals, offers, or packages are you comfortable making?"},
    {"key":"ideal_customer","question":"What qualifies as a good customer for your business?"},
    {"key":"limitations","question":"Are there limits on geography, capacity, timing, or availability?"},
    {"key":"tone","question":"What tone should the AI use with leads: formal, friendly, premium, urgent, or something else?"}
  ]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.client_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  started_by_user_id uuid null,
  status text not null default 'open',
  current_question_key text null,
  collected_context jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint client_onboarding_sessions_status_check
    check (status in ('open', 'completed', 'archived'))
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

drop trigger if exists client_profiles_set_updated_at on public.client_profiles;
create trigger client_profiles_set_updated_at
before update on public.client_profiles
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists pricing_models_set_updated_at on public.pricing_models;
create trigger pricing_models_set_updated_at
before update on public.pricing_models
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists business_rules_set_updated_at on public.business_rules;
create trigger business_rules_set_updated_at
before update on public.business_rules
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists ai_behavior_config_set_updated_at on public.ai_behavior_config;
create trigger ai_behavior_config_set_updated_at
before update on public.ai_behavior_config
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists client_onboarding_sessions_set_updated_at on public.client_onboarding_sessions;
create trigger client_onboarding_sessions_set_updated_at
before update on public.client_onboarding_sessions
for each row
execute function public.set_updated_at_timestamp();

create unique index if not exists pricing_models_client_service_code_unique
  on public.pricing_models (client_id, lower(service_code))
  where service_code is not null;

create index if not exists pricing_models_client_active_idx
  on public.pricing_models (client_id, is_active, service_name);

create unique index if not exists business_rules_client_key_unique
  on public.business_rules (client_id, rule_type, lower(rule_key));

create index if not exists client_onboarding_sessions_client_status_idx
  on public.client_onboarding_sessions (client_id, status, updated_at desc);

insert into public.client_profiles (
  client_id,
  business_name,
  onboarding_status,
  onboarding_summary
)
select
  c.id,
  c.name,
  'pending',
  null
from public.clients c
on conflict (client_id) do update
set business_name = coalesce(public.client_profiles.business_name, excluded.business_name);

insert into public.ai_behavior_config (
  client_id,
  is_enabled,
  model,
  assistant_name,
  system_prompt,
  fallback_message
)
select
  a.client_id,
  a.is_enabled,
  a.model,
  a.assistant_name,
  a.system_prompt,
  a.fallback_message
from public.client_ai_agents a
on conflict (client_id) do update
set
  is_enabled = excluded.is_enabled,
  model = excluded.model,
  assistant_name = excluded.assistant_name,
  system_prompt = excluded.system_prompt,
  fallback_message = excluded.fallback_message;

insert into public.pricing_models (
  client_id,
  service_code,
  service_name,
  currency,
  price_from,
  price_to,
  unit_label,
  description,
  pricing_notes,
  is_active
)
select
  p.client_id,
  p.service_code,
  p.service_name,
  p.currency,
  p.price_from,
  p.price_to,
  p.unit_label,
  p.summary,
  p.pricing_notes,
  p.is_active
from public.client_service_pricing p
where not exists (
  select 1
  from public.pricing_models pm
  where pm.client_id = p.client_id
    and coalesce(lower(pm.service_code), '') = coalesce(lower(p.service_code), '')
    and lower(pm.service_name) = lower(p.service_name)
);
