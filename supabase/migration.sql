-- ════════════════════════════════════════════════════════════════
-- Score Guru — Full schema, indexes, RLS, and storage.
-- Run in Supabase SQL Editor, or `supabase db push`.
-- Core principle: matches are an immutable event-log of deliveries;
-- scorecards / stats / leaderboards are DERIVED by aggregation.
-- ════════════════════════════════════════════════════════════════

-- ───────────── ENUMS ─────────────
do $$ begin
  create type player_status as enum ('pending','approved','rejected','hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type batting_hand as enum ('right','left');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('setup','live','innings_break','super_over','completed','abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type toss_decision as enum ('bat','bowl');
exception when duplicate_object then null; end $$;

do $$ begin
  create type extra_type as enum ('none','wide','no_ball','bye','leg_bye');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wicket_type as enum (
    'bowled','caught','lbw','run_out','stumped','hit_wicket',
    'caught_and_bowled','retired_out','obstructing'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type batting_event_type as enum ('in','retired_not_out','retired_out');
exception when duplicate_object then null; end $$;

-- Shared global sequence: deliveries and batting_events draw from ONE sequence
-- so their `seq` values interleave in true chronological order (the engine
-- replays both event streams in a single merged order).
create sequence if not exists event_seq;

-- ───────────── PLAYERS ─────────────
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  nickname      text,
  jersey_number int,
  batting_style batting_hand,
  bowling_style text,                       -- e.g. "right-arm pace", "left-arm spin"
  photo_url     text,
  status        player_status not null default 'pending',
  created_at    timestamptz not null default now()
);
-- Name is the identity: unique among everyone NOT rejected (rejected names freed up).
create unique index if not exists players_name_active_uidx
  on players (lower(name)) where status <> 'rejected';
create index if not exists players_status_idx on players (status);

-- ───────────── TEAMS ─────────────
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo_url   text,
  color      text default '#59C749',
  created_at timestamptz not null default now()
);

-- ───────────── MATCHES ─────────────
create table if not exists matches (
  id                       uuid primary key default gen_random_uuid(),
  name                     text,
  overs                    int not null default 6,
  venue                    text,
  team_a_id                uuid references teams(id),
  team_b_id                uuid references teams(id),
  toss_winner_team_id      uuid references teams(id),
  toss_decision            toss_decision,
  free_hit_enabled         boolean not null default true,
  last_man_stands          boolean not null default true,
  block_consecutive_overs  boolean not null default true,
  super_over_overs         int not null default 1,
  status                   match_status not null default 'setup',
  result_text              text,
  winner_team_id           uuid references teams(id),
  is_tie                   boolean not null default false,
  potm_player_id           uuid references players(id),
  match_date               timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  started_at               timestamptz,
  completed_at             timestamptz
);
create index if not exists matches_status_idx on matches (status);
create index if not exists matches_date_idx on matches (match_date desc);

-- ───────────── MATCH LINEUPS ─────────────
create table if not exists match_players (
  match_id   uuid not null references matches(id) on delete cascade,
  team_id    uuid not null references teams(id),
  player_id  uuid not null references players(id),
  batting_order int,                         -- optional hint; order is manual at scoring time
  primary key (match_id, player_id)
);
create index if not exists match_players_match_idx on match_players (match_id);

-- ───────────── INNINGS ─────────────
create table if not exists innings (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references matches(id) on delete cascade,
  innings_number   int not null,             -- 1, 2, then 3,4.. for super overs
  batting_team_id  uuid not null references teams(id),
  bowling_team_id  uuid not null references teams(id),
  target           int,
  is_super_over    boolean not null default false,
  is_closed        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (match_id, innings_number)
);
create index if not exists innings_match_idx on innings (match_id);

-- ───────────── DELIVERIES (the event log) ─────────────
create table if not exists deliveries (
  id                 uuid primary key default gen_random_uuid(),
  seq                bigint not null default nextval('event_seq'),                 -- global monotonic ordering / undo cursor
  innings_id         uuid not null references innings(id) on delete cascade,
  over_number        int not null,              -- 0-based over index
  ball_in_over       int not null,              -- 1-based position within over (display)
  legal_ball_number  int not null,              -- count of legal balls in innings up to & incl this
  bowler_id          uuid not null references players(id),
  striker_id         uuid not null references players(id),
  non_striker_id     uuid not null references players(id),
  runs_off_bat       int not null default 0,
  extra_type         extra_type not null default 'none',
  extra_runs         int not null default 0,    -- penalty + byes attached to the extra
  is_wicket          boolean not null default false,
  wicket_type        wicket_type,
  dismissed_player_id uuid references players(id),
  fielder_id         uuid references players(id),
  is_free_hit        boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists deliveries_innings_seq_idx on deliveries (innings_id, seq);
create index if not exists deliveries_innings_idx on deliveries (innings_id);
create index if not exists deliveries_bowler_idx on deliveries (bowler_id);
create index if not exists deliveries_striker_idx on deliveries (striker_id);

-- ───────────── BATTING EVENTS (non-ball events) ─────────────
-- batsman comes in, retires not-out (can return), retires out (a dismissal).
create table if not exists batting_events (
  id          uuid primary key default gen_random_uuid(),
  seq         bigint not null default nextval('event_seq'),
  innings_id  uuid not null references innings(id) on delete cascade,
  player_id   uuid not null references players(id),
  event_type  batting_event_type not null,
  at_end      text,                            -- 'striker' | 'non_striker' for an 'in' event
  created_at  timestamptz not null default now()
);
create index if not exists batting_events_innings_seq_idx on batting_events (innings_id, seq);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Public (anon) may SELECT everything (read-only viewer).
-- No public INSERT/UPDATE/DELETE. The service-role key (server only)
-- bypasses RLS, so all writes funnel through Score Guru's server.
-- EXCEPTION: public may INSERT a player submission (pending queue),
-- restricted to status='pending' so it can't self-approve.
-- ════════════════════════════════════════════════════════════════
alter table players        enable row level security;
alter table teams          enable row level security;
alter table matches        enable row level security;
alter table match_players  enable row level security;
alter table innings        enable row level security;
alter table deliveries     enable row level security;
alter table batting_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','teams','matches','match_players','innings','deliveries','batting_events']
  loop
    execute format('drop policy if exists "public_select_%1$s" on %1$s', t);
    execute format('create policy "public_select_%1$s" on %1$s for select using (true)', t);
  end loop;
end $$;

-- Public player submissions go to the pending queue (defense-in-depth: app also
-- routes submissions through the server, but this lets the anon form work directly
-- while preventing self-approval / arbitrary status).
drop policy if exists "public_submit_player" on players;
create policy "public_submit_player" on players
  for insert with check (status = 'pending');

-- ════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (player photos + team logos), public read.
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('player-photos','player-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-logos','team-logos', true)
on conflict (id) do nothing;

drop policy if exists "public_read_player_photos" on storage.objects;
create policy "public_read_player_photos" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "public_read_team_logos" on storage.objects;
create policy "public_read_team_logos" on storage.objects
  for select using (bucket_id = 'team-logos');
-- Uploads are performed server-side with the service-role key (bypasses RLS).

-- ════════════════════════════════════════════════════════════════
-- REALTIME: publish the tables the live viewer subscribes to.
-- ════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['matches','innings','deliveries','batting_events']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
