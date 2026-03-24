create extension if not exists pgcrypto;

create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null,
  endpoint text not null,
  subscription_json jsonb not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_subscriptions
  add column if not exists client_id uuid;

alter table public.notification_subscriptions
  add column if not exists user_id uuid;

alter table public.notification_subscriptions
  add column if not exists endpoint text;

alter table public.notification_subscriptions
  add column if not exists subscription_json jsonb;

alter table public.notification_subscriptions
  add column if not exists user_agent text;

alter table public.notification_subscriptions
  add column if not exists created_at timestamptz default timezone('utc', now());

alter table public.notification_subscriptions
  add column if not exists updated_at timestamptz default timezone('utc', now());

update public.notification_subscriptions
set
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where created_at is null
   or updated_at is null;

alter table public.notification_subscriptions
  alter column client_id set not null;

alter table public.notification_subscriptions
  alter column user_id set not null;

alter table public.notification_subscriptions
  alter column endpoint set not null;

alter table public.notification_subscriptions
  alter column subscription_json set not null;

alter table public.notification_subscriptions
  alter column created_at set default timezone('utc', now());

alter table public.notification_subscriptions
  alter column updated_at set default timezone('utc', now());

create unique index if not exists notification_subscriptions_client_user_endpoint_key
  on public.notification_subscriptions (client_id, user_id, endpoint);

create index if not exists notification_subscriptions_client_user_idx
  on public.notification_subscriptions (client_id, user_id);

create index if not exists notification_subscriptions_user_idx
  on public.notification_subscriptions (user_id);
