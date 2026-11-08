-- Apply ONLY in the new Fun Run Supabase project; never in SKVASRA's existing database.
-- Event-only data; KK identity and profile remain in the original SKVASRA project.
begin;
create table if not exists public.funrun_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date,
  venue text,
  distances int[] not null default array[3,5,10],
  shirt_sizes text[] not null default array['XS','S','M','L','XL','2XL','3XL'],
  registration_open boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.funrun_registrations (
  id uuid primary key default gen_random_uuid(),
  registration_number bigint generated always as identity unique,
  event_id uuid not null references public.funrun_events(id),
  member_id uuid not null, -- from authenticated SKVASRA bridge; not a cross-project FK
  distance_km integer not null check (distance_km between 1 and 100),
  shirt_size text not null check (shirt_size in ('XS','S','M','L','XL','2XL','3XL')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  unique(event_id,member_id)
);
create index if not exists funrun_registrations_event_idx
  on public.funrun_registrations(event_id,created_at desc);
create table if not exists public.funrun_login_nonces (
  nonce text primary key check(length(nonce) between 16 and 80),
  created_at timestamptz not null default now()
);
-- RLS enabled for exposed public schema; no public table access at all.
alter table public.funrun_events enable row level security;
alter table public.funrun_registrations enable row level security;
alter table public.funrun_login_nonces enable row level security;
revoke all on public.funrun_events,public.funrun_registrations,public.funrun_login_nonces
  from anon,authenticated;
grant select,insert,update,delete on public.funrun_events,public.funrun_registrations,public.funrun_login_nonces
  to service_role;
grant usage,select on all sequences in schema public to service_role;
insert into public.funrun_events(title,registration_open)
select 'SK Vasra Fun Run — Set official event details', false
where not exists(select 1 from public.funrun_events);
commit;
-- Before opening registration, update venue, event_date, and official distances.
-- Then set registration_open=true in the new project only.
-- Delete consumed login nonces older than 7 days as scheduled maintenance.
