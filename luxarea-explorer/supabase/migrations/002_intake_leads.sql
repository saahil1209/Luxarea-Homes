-- Luxarea: WhatsApp intake, leads, and public teasers for off-market homes.
-- Run after 001_init.sql.

-- ---------- who may forward listings on WhatsApp ----------
-- Only messages from these numbers become inbox drafts; anything else is ignored.
alter table public.team_members add column if not exists whatsapp text unique;
comment on column public.team_members.whatsapp is 'International format, digits only, e.g. 917718961447';

-- ---------- leads from the website form ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  channel text,
  intent text,
  budget text,
  for_whom text,
  note text,
  page text,
  utm text,
  referrer text,
  consent boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  assigned_to text,
  team_note text
);
create index if not exists leads_created_idx on public.leads (created_at desc);
alter table public.leads enable row level security;
-- Inserts come only from the server (api/lead) with the service-role key; the team reads and updates.
drop policy if exists "team manages leads" on public.leads;
create policy "team manages leads" on public.leads for all using (public.is_team()) with check (public.is_team());

-- ---------- off-market teasers ----------
-- The public sees that an off-market home exists and roughly where (about 1 km),
-- never its name, building, price or exact pin.
create or replace function public.private_teasers()
returns table (id text, locality text, city text, segment text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select l.id,
         l.data->>'locality',
         l.data->>'city',
         l.data->>'segment',
         round((l.data->>'lat')::numeric, 2)::double precision,
         round((l.data->>'lng')::numeric, 2)::double precision
  from public.listings l
  where l.status = 'published' and l.confidential;
$$;
grant execute on function public.private_teasers() to anon, authenticated;

-- ---------- scan bookkeeping ----------
-- One row per scan run, so the team can see the scan is alive and what it found.
create table if not exists public.scan_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sources_checked int not null default 0,
  items_seen int not null default 0,
  drafts_created int not null default 0,
  errors jsonb not null default '[]'
);
alter table public.scan_runs enable row level security;
drop policy if exists "team reads scan runs" on public.scan_runs;
create policy "team reads scan runs" on public.scan_runs for select using (public.is_team());
