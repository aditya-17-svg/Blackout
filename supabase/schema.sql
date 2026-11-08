-- BLACKOUT · Supabase schema
-- Run once: Supabase dashboard > SQL Editor > New query > paste everything > Run.

create extension if not exists pgcrypto;

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 2 and 14),
  created_at timestamptz not null default now(),
  games_played int not null default 0,
  wins int not null default 0,
  distance_m numeric not null default 0,
  calories numeric not null default 0,
  seconds_played int not null default 0
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','live','over')),
  center_lat double precision not null,
  center_lng double precision not null,
  rules jsonb not null default '{"roundMin":45,"pingMin":5,"headMin":3,"zoneM":840,"finalM":200,"shrink":true}',
  started_at timestamptz,
  next_ping_at timestamptz,
  winner text check (winner in ('hiders','seekers')),
  paused_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  role text not null default 'hider' check (role in ('hider','seeker')),
  status text not null default 'free' check (status in ('free','tagged')),
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- private position of every player (only the owner can read it; the server reads it for pings)
create table if not exists public.locations (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- live position of seekers (visible to everyone in the game)
create table if not exists public.live_positions (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- hider positions released at each ping (written only by the server)
create table if not exists public.pings (
  game_id uuid primary key references public.games(id) on delete cascade,
  taken_at timestamptz not null default now(),
  hiders jsonb not null default '[]'
);

create table if not exists public.tags (
  game_id uuid not null references public.games(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  by_user uuid not null references public.profiles(id) on delete cascade,
  by_name text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','disputed')),
  created_at timestamptz not null default now(),
  primary key (game_id, target)
);

-- one row per player per finished game (feeds the player database / leaderboard)
create table if not exists public.match_results (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text, won boolean not null default false,
  distance_m numeric not null default 0, calories numeric not null default 0, duration_s int not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

-- ============ NEW USER -> PROFILE ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  n := left(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1), ''), '[<>]', '', 'g'), 14);
  if char_length(n) < 2 then n := 'Player'; end if;
  insert into public.profiles (id, display_name) values (new.id, n) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ HELPERS ============
create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from game_players where game_id = g and user_id = auth.uid()) $$;

create or replace function public.is_seeker(g uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from game_players where game_id = g and user_id = auth.uid() and role = 'seeker') $$;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.locations enable row level security;
alter table public.live_positions enable row level security;
alter table public.pings enable row level security;
alter table public.tags enable row level security;
alter table public.match_results enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.games, public.game_players, public.pings, public.tags, public.match_results to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert on public.games, public.game_players to authenticated;
grant update (rules) on public.games to authenticated;
grant select, insert, update on public.locations, public.live_positions to authenticated;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
drop policy if exists "edit own name" on public.profiles;
create policy "edit own name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "games readable" on public.games;
create policy "games readable" on public.games for select to authenticated using (true);
drop policy if exists "host creates game" on public.games;
create policy "host creates game" on public.games for insert to authenticated with check (host = auth.uid());
drop policy if exists "host edits rules" on public.games;
create policy "host edits rules" on public.games for update to authenticated using (host = auth.uid() and status = 'lobby') with check (host = auth.uid());

drop policy if exists "players readable" on public.game_players;
create policy "players readable" on public.game_players for select to authenticated using (true);
drop policy if exists "join as hider" on public.game_players;
create policy "join as hider" on public.game_players for insert to authenticated
  with check (user_id = auth.uid() and role = 'hider' and status = 'free');

drop policy if exists "own location" on public.locations;
create policy "own location" on public.locations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members see seekers" on public.live_positions;
create policy "members see seekers" on public.live_positions for select to authenticated using (public.is_member(game_id));
drop policy if exists "seekers publish" on public.live_positions;
create policy "seekers publish" on public.live_positions for insert to authenticated with check (user_id = auth.uid() and public.is_seeker(game_id));
drop policy if exists "seekers update" on public.live_positions;
create policy "seekers update" on public.live_positions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_seeker(game_id));

drop policy if exists "members see pings" on public.pings;
create policy "members see pings" on public.pings for select to authenticated using (public.is_member(game_id));
drop policy if exists "members see tags" on public.tags;
create policy "members see tags" on public.tags for select to authenticated using (public.is_member(game_id));
drop policy if exists "own results" on public.match_results;
create policy "own results" on public.match_results for select to authenticated using (user_id = auth.uid());

-- ============ GAME ACTIONS (the only way to change roles, tags, results) ============
create or replace function public.server_now() returns timestamptz language sql stable as $$ select now() $$;

create or replace function public.set_role(g uuid, u uuid, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if r not in ('hider','seeker') then raise exception 'bad role'; end if;
  if not exists (select 1 from games where id = g and host = auth.uid() and status = 'lobby') then raise exception 'not allowed'; end if;
  update game_players set role = r where game_id = g and user_id = u;
end $$;

create or replace function public.start_game(g uuid, r jsonb) returns public.games
language plpgsql security definer set search_path = public as $$
declare res public.games; ping int; head int;
begin
  if not exists (select 1 from games where id = g and host = auth.uid() and status = 'lobby') then raise exception 'not allowed'; end if;
  if not exists (select 1 from game_players where game_id = g and role = 'seeker') then raise exception 'need a seeker'; end if;
  if not exists (select 1 from game_players where game_id = g and role = 'hider') then raise exception 'need a hider'; end if;
  ping := least(greatest(coalesce((r->>'pingMin')::int, 5), 0), 30);
  head := least(greatest(coalesce((r->>'headMin')::int, 3), 0), 30);
  update games set
    rules = jsonb_build_object(
      'roundMin', least(greatest(coalesce((r->>'roundMin')::int, 45), 5), 180), 'pingMin', ping, 'headMin', head,
      'zoneM', least(greatest(coalesce((r->>'zoneM')::int, 840), 200), 3000),
      'finalM', least(greatest(coalesce((r->>'finalM')::int, 200), 100), 1500),
      'shrink', coalesce((r->>'shrink')::boolean, true)),
    status = 'live', started_at = now(),
    next_ping_at = case when ping > 0 then now() + make_interval(mins => head + ping) else null end
  where id = g returning * into res;
  return res;
end $$;

-- host stops the game for everyone: the clock, the zone and the pings freeze
create or replace function public.pause_game(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update games set paused_at = now()
   where id = g and host = auth.uid() and status = 'live' and paused_at is null;
end $$;

-- host resumes: the start time moves forward by the length of the break, so nothing is lost
create or replace function public.resume_game(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update games set
    started_at = started_at + (now() - paused_at),
    next_ping_at = case when next_ping_at is null then null else next_ping_at + (now() - paused_at) end,
    paused_at = null
   where id = g and host = auth.uid() and status = 'live' and paused_at is not null;
end $$;

-- host ends the game early (no winner)
create or replace function public.end_game(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update games set status = 'over', paused_at = null where id = g and host = auth.uid() and status = 'live';
end $$;

create or replace function public.claim_tag(g uuid, t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if not exists (select 1 from games where id = g and status = 'live' and paused_at is null) then raise exception 'game not live or paused'; end if;
  if not exists (select 1 from game_players where game_id = g and user_id = auth.uid() and role = 'seeker') then raise exception 'only seekers can tag'; end if;
  if not exists (select 1 from game_players where game_id = g and user_id = t and role = 'hider' and status = 'free') then raise exception 'not a free hider'; end if;
  select name into nm from game_players where game_id = g and user_id = auth.uid();
  delete from tags where game_id = g and target = t;
  insert into tags (game_id, target, by_user, by_name) values (g, t, auth.uid(), nm);
end $$;

create or replace function public.answer_tag(g uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tags where game_id = g and target = auth.uid() and status = 'pending') then raise exception 'nothing to answer'; end if;
  if accept then
    update tags set status = 'confirmed' where game_id = g and target = auth.uid();
    update game_players set status = 'tagged' where game_id = g and user_id = auth.uid() and role = 'hider';
    delete from locations where game_id = g and user_id = auth.uid();
  else
    update tags set status = 'disputed' where game_id = g and target = auth.uid();
  end if;
end $$;

create or replace function public.tag_self(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update game_players set status = 'tagged'
   where game_id = g and user_id = auth.uid() and role = 'hider'
     and exists (select 1 from games where id = g and status = 'live');
  delete from locations where game_id = g and user_id = auth.uid();
end $$;

create or replace function public.finish_game(g uuid, w text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if w not in ('hiders','seekers') then raise exception 'bad winner'; end if;
  update games set status = 'over', winner = w where id = g and host = auth.uid() and status = 'live';
end $$;

create or replace function public.save_result(g uuid, p_role text, p_won boolean, p_dist numeric, p_cal numeric, p_secs int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from game_players where game_id = g and user_id = auth.uid()) then raise exception 'not in this game'; end if;
  if not exists (select 1 from games where id = g and status in ('live','over')) then raise exception 'game not started'; end if;
  with ins as (
    insert into match_results (game_id, user_id, role, won, distance_m, calories, duration_s)
    values (g, auth.uid(), case when p_role in ('hider','seeker') then p_role end, coalesce(p_won, false),
            least(greatest(coalesce(p_dist, 0), 0), 50000), least(greatest(coalesce(p_cal, 0), 0), 5000), least(greatest(coalesce(p_secs, 0), 0), 14400))
    on conflict (game_id, user_id) do nothing
    returning won, distance_m, calories, duration_s)
  update profiles p set games_played = p.games_played + 1, wins = p.wins + case when ins.won then 1 else 0 end,
         distance_m = p.distance_m + ins.distance_m, calories = p.calories + ins.calories, seconds_played = p.seconds_played + ins.duration_s
  from ins where p.id = auth.uid();
end $$;

-- ============ SERVER JOBS (run by pg_cron, never callable from the app) ============
create or replace function public.release_pings() returns void
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  for g in select id, rules from games where status = 'live' and paused_at is null and next_ping_at is not null and next_ping_at <= now() loop
    insert into pings (game_id, taken_at, hiders)
      select g.id, now(), coalesce(jsonb_agg(jsonb_build_object('lat', l.lat, 'lng', l.lng)), '[]'::jsonb)
      from game_players p join locations l on l.game_id = p.game_id and l.user_id = p.user_id
      where p.game_id = g.id and p.role = 'hider' and p.status = 'free'
    on conflict (game_id) do update set taken_at = excluded.taken_at, hiders = excluded.hiders;
    update games set next_ping_at = now() + make_interval(mins => greatest(1, coalesce((g.rules->>'pingMin')::int, 5))) where id = g.id;
  end loop;
end $$;

-- privacy: delete games (and their locations) after 2 days
create or replace function public.cleanup_old() returns void
language sql security definer set search_path = public as
$$ delete from games where created_at < now() - interval '2 days' $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.server_now(), public.set_role(uuid, uuid, text), public.start_game(uuid, jsonb), public.claim_tag(uuid, uuid),
  public.answer_tag(uuid, boolean), public.tag_self(uuid), public.finish_game(uuid, text),
  public.save_result(uuid, text, boolean, numeric, numeric, int), public.is_member(uuid), public.is_seeker(uuid),
  public.pause_game(uuid), public.resume_game(uuid), public.end_game(uuid) to authenticated;
revoke execute on function public.release_pings(), public.cleanup_old(), public.handle_new_user() from authenticated;

-- ============ REALTIME ============
do $$ declare t text; begin
  foreach t in array array['games','game_players','tags','live_positions','pings'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ============ SCHEDULES (needs the pg_cron extension) ============
-- If this part errors: Dashboard > Database > Extensions > enable "pg_cron", then run these two lines again.
create extension if not exists pg_cron;
select cron.schedule('blackout-release-pings', '* * * * *', 'select public.release_pings()');
select cron.schedule('blackout-cleanup', '17 3 * * *', 'select public.cleanup_old()');
