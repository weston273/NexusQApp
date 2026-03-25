alter table public.client_notifications
  add column if not exists source text;

alter table public.client_notifications
  add column if not exists status text;

alter table public.client_notifications
  add column if not exists severity text;

alter table public.client_notifications
  add column if not exists body text;

alter table public.client_notifications
  add column if not exists link_path text;

alter table public.client_notifications
  add column if not exists metadata jsonb;

alter table public.client_notifications
  add column if not exists target_path text;

alter table public.client_notifications
  add column if not exists level text;

alter table public.client_notifications
  add column if not exists path text;

alter table public.client_notifications
  add column if not exists subject text;

alter table public.client_notifications
  add column if not exists summary text;

alter table public.client_notifications
  add column if not exists data jsonb;
