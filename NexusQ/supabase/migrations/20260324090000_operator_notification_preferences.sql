alter table public.user_profiles
  add column if not exists phone text;

alter table public.user_profiles
  add column if not exists sms_alerts_enabled boolean;

alter table public.user_profiles
  add column if not exists push_alerts_enabled boolean;

update public.user_profiles
set
  sms_alerts_enabled = coalesce(sms_alerts_enabled, false),
  push_alerts_enabled = coalesce(push_alerts_enabled, true)
where sms_alerts_enabled is null
   or push_alerts_enabled is null;

alter table public.user_profiles
  alter column sms_alerts_enabled set default false;

alter table public.user_profiles
  alter column push_alerts_enabled set default true;

alter table public.user_profiles
  alter column sms_alerts_enabled set not null;

alter table public.user_profiles
  alter column push_alerts_enabled set not null;
