alter table if exists public.profiles
  add column if not exists saved_events jsonb not null default '[]'::jsonb;

comment on column public.profiles.saved_events is
  'Concert event ids the visitor starred on the tickets hub "near you" rail, so saves follow the account across devices.';
