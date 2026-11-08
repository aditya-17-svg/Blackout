-- BLACKOUT · migration 002: pause / resume / end game (run once if you already ran schema.sql)
-- Supabase dashboard > SQL Editor > New query > paste > Run.

alter table public.games add column if not exists paused_at timestamptz;

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

-- no tagging while paused
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

-- no pings while paused
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

revoke execute on function public.pause_game(uuid), public.resume_game(uuid), public.end_game(uuid) from public, anon;
grant execute on function public.pause_game(uuid), public.resume_game(uuid), public.end_game(uuid) to authenticated;
