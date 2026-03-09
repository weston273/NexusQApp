-- Fix ambiguous client_id reference inside workspace bootstrap/join functions.
-- Keeps function signatures unchanged for existing frontend/edge function contracts.

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
#variable_conflict use_column
declare
  v_client_id uuid;
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

  insert into public.clients (name, timezone, status)
  values (v_workspace_name, v_timezone, 'active')
  returning id into v_client_id;

  insert into public.user_access (user_id, client_id, role, is_active)
  values (p_user_id, v_client_id, 'owner', true)
  on conflict on constraint user_access_user_id_client_id_key do update
    set role = 'owner',
        is_active = true,
        updated_at = now();

  client_id := v_client_id;
  role := 'owner';
  return next;
  return;
end;
$$;

create or replace function public.join_workspace_with_access_key(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_raw_key text
)
returns table (client_id uuid, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_normalized_key text := upper(trim(coalesce(p_raw_key, '')));
  v_key_hash text;
  v_client_id uuid;
  v_key_role text;
  v_existing_role text;
  v_target_role text;
  v_final_role text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if v_normalized_key = '' then
    raise exception 'access key is required';
  end if;

  v_key_hash := encode(digest(v_normalized_key, 'sha256'), 'hex');

  select cak.client_id, cak.role
    into v_client_id, v_key_role
  from public.client_access_keys cak
  where cak.key_hash = v_key_hash
    and cak.is_active = true
    and (cak.expires_at is null or cak.expires_at > now())
  order by cak.created_at desc
  limit 1;

  if v_client_id is null then
    raise exception 'Invalid, inactive, or expired access key';
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

  select ua.role
    into v_existing_role
  from public.user_access ua
  where ua.user_id = p_user_id
    and ua.client_id = v_client_id
  limit 1;

  v_target_role := public.pick_higher_access_role(v_existing_role, v_key_role);

  insert into public.user_access (user_id, client_id, role, is_active)
  values (p_user_id, v_client_id, v_target_role, true)
  on conflict on constraint user_access_user_id_client_id_key do update
    set role = public.pick_higher_access_role(public.user_access.role, excluded.role),
        is_active = true,
        updated_at = now()
  returning public.user_access.role into v_final_role;

  client_id := v_client_id;
  role := v_final_role;
  return next;
  return;
end;
$$;

revoke all on function public.bootstrap_workspace_for_user(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace_for_user(uuid, text, text, text, text) to service_role;

revoke all on function public.join_workspace_with_access_key(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.join_workspace_with_access_key(uuid, text, text, text) to service_role;
