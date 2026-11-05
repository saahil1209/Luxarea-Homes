-- Luxarea: listings, intake drafts, editable home page, team.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Security model:
--   * The public can read published listings that are not off-market, and the published home page.
--   * Off-market listings are returned only through unlock_private(code), with a valid invite code.
--   * Everything else needs a signed-in member of team_members.
--   * The WhatsApp webhook and daily scan write drafts with the service-role key (server side only).

-- ---------- team ----------
create table if not exists public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and role = 'admin');
$$;

-- ---------- listings ----------
-- One row per property. `data` holds the Property shape used by the website
-- (src/data/listings.ts), so the site and the admin share one format.
create table if not exists public.listings (
  id text primary key,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  confidential boolean not null default false,
  source_draft_id uuid,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists listings_status_idx on public.listings (status);

-- ---------- intake drafts (WhatsApp, daily scan, manual) ----------
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('whatsapp', 'scan', 'manual')),
  received_at timestamptz not null default now(),
  from_label text,
  source_url text,
  -- Dedupe key: WhatsApp message id, or a hash of the scanned item's URL + title.
  external_id text unique,
  raw_text text not null default '',
  media text[] not null default '{}',
  extracted jsonb not null default '{}',
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  listing_id text references public.listings (id) on delete set null,
  note text
);
create index if not exists drafts_status_idx on public.drafts (status, received_at desc);

-- ---------- editable home page ----------
-- Two rows: 'home:draft' (team's working copy) and 'home:published' (what the build renders).
create table if not exists public.site_content (
  id text primary key check (id in ('home:draft', 'home:published')),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ---------- off-market invitations ----------
create table if not exists public.invite_codes (
  code text primary key,
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.unlock_private(invite text)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select l.data from public.listings l
  where l.status = 'published' and l.confidential
    and exists (
      select 1 from public.invite_codes c
      where upper(c.code) = upper(trim(invite)) and (c.expires_at is null or c.expires_at > now())
    );
$$;
grant execute on function public.unlock_private(text) to anon, authenticated;

-- ---------- row-level security ----------
alter table public.team_members enable row level security;
alter table public.listings enable row level security;
alter table public.drafts enable row level security;
alter table public.site_content enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "team reads team" on public.team_members;
create policy "team reads team" on public.team_members for select using (public.is_team());
drop policy if exists "admins manage team" on public.team_members;
create policy "admins manage team" on public.team_members for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public reads published listings" on public.listings;
create policy "public reads published listings" on public.listings for select using (status = 'published' and not confidential);
drop policy if exists "team manages listings" on public.listings;
create policy "team manages listings" on public.listings for all using (public.is_team()) with check (public.is_team());

drop policy if exists "team manages drafts" on public.drafts;
create policy "team manages drafts" on public.drafts for all using (public.is_team()) with check (public.is_team());

drop policy if exists "public reads published page" on public.site_content;
create policy "public reads published page" on public.site_content for select using (id = 'home:published');
drop policy if exists "team manages page" on public.site_content;
create policy "team manages page" on public.site_content for all using (public.is_team()) with check (public.is_team());

drop policy if exists "admins manage invites" on public.invite_codes;
create policy "admins manage invites" on public.invite_codes for all using (public.is_admin()) with check (public.is_admin());

-- ---------- photo storage ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists "team uploads media" on storage.objects;
create policy "team uploads media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_team());
drop policy if exists "team edits media" on storage.objects;
create policy "team edits media" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_team());
drop policy if exists "team deletes media" on storage.objects;
create policy "team deletes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_team());

-- ---------- first admin ----------
-- After the first person signs in once at /admin, make them an admin:
--   insert into public.team_members (user_id, email, name, role)
--   select id, email, 'Your name', 'admin' from auth.users where email = 'you@luxarea.in';
