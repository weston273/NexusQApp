create extension if not exists pgcrypto;

create or replace function public.normalize_client_key(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_value text := lower(trim(coalesce(p_value, '')));
begin
  if v_value = '' then
    return null;
  end if;

  v_value := regexp_replace(v_value, '[^a-z0-9]+', '-', 'g');
  v_value := regexp_replace(v_value, '(^-+|-+$)', '', 'g');
  v_value := regexp_replace(v_value, '-{2,}', '-', 'g');

  if v_value = '' then
    return null;
  end if;

  return v_value;
end;
$$;

create or replace function public.build_client_key(
  p_name text,
  p_client_id uuid
)
returns text
language plpgsql
immutable
as $$
declare
  v_base text := public.normalize_client_key(p_name);
  v_suffix text := substr(replace(coalesce(p_client_id::text, gen_random_uuid()::text), '-', ''), 1, 8);
begin
  if v_base is null then
    v_base := 'client';
  end if;

  if length(v_base) > 40 then
    v_base := substr(v_base, 1, 40);
    v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  end if;

  return v_base || '-' || v_suffix;
end;
$$;

alter table public.clients
  add column if not exists client_key text;

update public.clients
set client_key = public.build_client_key(name, id)
where client_key is null
   or trim(client_key) = '';

alter table public.clients
  alter column client_key drop default;

create or replace function public.assign_client_key()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.client_key is null or trim(new.client_key) = '' then
    new.client_key := public.build_client_key(new.name, new.id);
  else
    new.client_key := public.normalize_client_key(new.client_key);
  end if;

  if new.client_key is null or trim(new.client_key) = '' then
    raise exception 'client_key could not be generated';
  end if;

  return new;
end;
$$;

drop trigger if exists assign_client_key_on_clients on public.clients;

create trigger assign_client_key_on_clients
before insert or update of client_key, name
on public.clients
for each row
execute function public.assign_client_key();

alter table public.clients
  alter column client_key set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_client_key_format'
  ) then
    alter table public.clients
      add constraint clients_client_key_format
      check (client_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
end;
$$;

create unique index if not exists clients_client_key_unique
  on public.clients (lower(client_key));

create or replace function public.bootstrap_workspace_for_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_workspace_name text,
  p_timezone text default 'UTC'
)
returns table (client_id uuid, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client_id uuid := gen_random_uuid();
  v_workspace_name text := nullif(trim(p_workspace_name), '');
  v_timezone text := nullif(trim(p_timezone), '');
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if v_workspace_name is null then
    raise exception 'workspace_name is required';
  end if;

  if v_timezone is null then
    v_timezone := 'UTC';
  end if;

  insert into public.user_profiles (id, email, full_name)
  values (
    p_user_id,
    nullif(trim(p_email), ''),
    nullif(trim(p_full_name), '')
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.user_profiles.email),
        full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
        updated_at = now();

  insert into public.clients (id, name, timezone, status, client_key)
  values (
    v_client_id,
    v_workspace_name,
    v_timezone,
    'active',
    public.build_client_key(v_workspace_name, v_client_id)
  );

  insert into public.user_access (user_id, client_id, role, is_active)
  values (p_user_id, v_client_id, 'owner', true)
  on conflict (user_id, client_id) do update
    set role = 'owner',
        is_active = true,
        updated_at = now();

  return query
  select v_client_id, 'owner'::text;
end;
$$;

revoke all on function public.bootstrap_workspace_for_user(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace_for_user(uuid, text, text, text, text) to service_role;
