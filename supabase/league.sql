-- ═══════════════ v0.15 · Liga da temporada (fantasy de anime) ═══════════════

-- Animes da temporada atual com os números do AniList (atualizado pela função shiori-tick)
create table if not exists public.season_catalog (
  media_id        int primary key,
  season          text not null,
  year            int not null,
  title           jsonb not null,
  cover           text,
  color           text,
  format          text,
  episodes        int,
  popularity      int not null default 0,
  score           int,
  status          text,
  next_episode    int,
  next_airing_at  timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists season_catalog_season_idx on public.season_catalog (season, year, popularity desc);
alter table public.season_catalog enable row level security;
drop policy if exists "catálogo é público" on public.season_catalog;
create policy "catálogo é público" on public.season_catalog for select to anon, authenticated using (true);

create table if not exists public.leagues (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name       text not null check (char_length(name) between 1 and 40),
  season     text not null,
  year       int not null,
  owner      uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.league_members (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  swaps_left int not null default 3,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);
create table if not exists public.league_picks (
  id         bigint generated always as identity primary key,
  league_id  uuid not null,
  user_id    uuid not null,
  media_id   int not null references public.season_catalog (media_id),
  picked_at  timestamptz not null default now(),
  base_pop   int not null,
  dropped_at timestamptz,
  end_pop    int,
  end_score  int,
  foreign key (league_id, user_id) references public.league_members (league_id, user_id) on delete cascade
);
-- um anime só pode estar em um time por vez dentro da liga
create unique index if not exists league_picks_unique_active on public.league_picks (league_id, media_id) where dropped_at is null;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_picks enable row level security;

create or replace function public.is_league_member(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members where league_id = p_league and user_id = auth.uid());
$$;
grant execute on function public.is_league_member(uuid) to authenticated;

drop policy if exists "ver minhas ligas" on public.leagues;
create policy "ver minhas ligas" on public.leagues for select to authenticated using (public.is_league_member(id));
drop policy if exists "ver membros" on public.league_members;
create policy "ver membros" on public.league_members for select to authenticated using (public.is_league_member(league_id));
drop policy if exists "sair da liga" on public.league_members;
create policy "sair da liga" on public.league_members for delete to authenticated using (user_id = auth.uid());
drop policy if exists "ver escalações" on public.league_picks;
create policy "ver escalações" on public.league_picks for select to authenticated using (public.is_league_member(league_id));
-- escrita só pelos RPCs abaixo

/** Temporada pela data (horário de Brasília): inverno=jan–mar, primavera=abr–jun, verão=jul–set, outono=out–dez. */
create or replace function public.current_season()
returns table (season text, year int) language sql stable as $$
  select (array['WINTER','WINTER','WINTER','SPRING','SPRING','SPRING','SUMMER','SUMMER','SUMMER','FALL','FALL','FALL'])
           [extract(month from (now() at time zone 'America/Sao_Paulo'))::int],
         extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
$$;
grant execute on function public.current_season() to anon, authenticated;

create or replace function public.create_league(p_name text, p_my_name text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cs record;
  l public.leagues;
  c text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if (select count(*) from leagues where owner = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  select * into cs from public.current_season();
  for i in 1..10 loop
    c := '';
    for j in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    begin
      insert into leagues (code, name, season, year, owner)
        values (c, left(btrim(coalesce(nullif(p_name, ''), 'Liga dos amigos')), 40), cs.season, cs.year, uid)
        returning * into l;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;
  if l.id is null then raise exception 'try_again' using errcode = 'P0001'; end if;
  insert into league_members (league_id, user_id, name) values (l.id, uid, left(btrim(coalesce(nullif(p_my_name, ''), 'Otaku')), 24));
  return l;
end $$;

create or replace function public.join_league(p_code text, p_my_name text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l public.leagues;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  select * into l from leagues where code = upper(btrim(p_code));
  if l.id is null then raise exception 'no_league' using errcode = 'P0001'; end if;
  if (select count(*) from league_members where league_id = l.id) >= 30 then raise exception 'league_full' using errcode = 'P0001'; end if;
  insert into league_members (league_id, user_id, name)
    values (l.id, uid, left(btrim(coalesce(nullif(p_my_name, ''), 'Otaku')), 24))
    on conflict (league_id, user_id) do nothing;
  return l;
end $$;

create or replace function public.league_pick(p_league uuid, p_media int)
returns public.league_picks language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l public.leagues;
  cat public.season_catalog;
  pk public.league_picks;
begin
  if not public.is_league_member(p_league) then raise exception 'not_member' using errcode = 'P0001'; end if;
  select * into l from leagues where id = p_league;
  select * into cat from season_catalog where media_id = p_media;
  if cat.media_id is null or cat.season <> l.season or cat.year <> l.year then raise exception 'not_this_season' using errcode = 'P0001'; end if;
  perform 1 from league_members where league_id = p_league and user_id = uid for update;
  if (select count(*) from league_picks where league_id = p_league and user_id = uid and dropped_at is null) >= 5 then
    raise exception 'team_full' using errcode = 'P0001';
  end if;
  begin
    insert into league_picks (league_id, user_id, media_id, base_pop)
      values (p_league, uid, p_media, cat.popularity) returning * into pk;
  exception when unique_violation then
    raise exception 'already_taken' using errcode = 'P0001';
  end;
  return pk;
end $$;

-- tirar um anime do time: guarda os pontos que ele fez e gasta uma troca
-- (sem custo se o time ainda não estava completo nas primeiras 24h do anime no time)
create or replace function public.league_drop(p_pick bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pk public.league_picks;
  cat public.season_catalog;
  free boolean;
begin
  select * into pk from league_picks where id = p_pick and user_id = uid and dropped_at is null for update;
  if pk.id is null then raise exception 'no_pick' using errcode = 'P0001'; end if;
  free := pk.picked_at > now() - interval '24 hours';
  if not free then
    update league_members set swaps_left = swaps_left - 1
      where league_id = pk.league_id and user_id = uid and swaps_left > 0;
    if not found then raise exception 'no_swaps' using errcode = 'P0001'; end if;
  end if;
  select * into cat from season_catalog where media_id = pk.media_id;
  if free then
    delete from league_picks where id = pk.id; -- arrependimento rápido: some sem pontuar
  else
    update league_picks set dropped_at = now(), end_pop = cat.popularity, end_score = cat.score where id = pk.id;
  end if;
end $$;

/** Pontos de cada escalação: 1 ponto a cada 1.000 membros novos no AniList + (nota ÷ 10) por semana no time. */
create or replace function public.league_points(p_league uuid)
returns table (pick_id bigint, user_id uuid, media_id int, active boolean, picked_at timestamptz, dropped_at timestamptz,
               members_gained int, weeks numeric, score int, points numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.user_id, p.media_id, p.dropped_at is null, p.picked_at, p.dropped_at,
         greatest(0, coalesce(p.end_pop, c.popularity) - p.base_pop),
         round((extract(epoch from (coalesce(p.dropped_at, now()) - p.picked_at)) / 604800)::numeric, 2),
         coalesce(p.end_score, c.score),
         round((greatest(0, coalesce(p.end_pop, c.popularity) - p.base_pop) / 1000.0
           + coalesce(coalesce(p.end_score, c.score), 0) / 10.0
             * extract(epoch from (coalesce(p.dropped_at, now()) - p.picked_at)) / 604800)::numeric, 1)
  from league_picks p join season_catalog c on c.media_id = p.media_id
  where p.league_id = p_league and public.is_league_member(p_league);
$$;

revoke all on function public.create_league(text, text) from public, anon;
revoke all on function public.join_league(text, text) from public, anon;
revoke all on function public.league_pick(uuid, int) from public, anon;
revoke all on function public.league_drop(bigint) from public, anon;
revoke all on function public.league_points(uuid) from public, anon;
grant execute on function public.create_league(text, text) to authenticated;
grant execute on function public.join_league(text, text) to authenticated;
grant execute on function public.league_pick(uuid, int) to authenticated;
grant execute on function public.league_drop(bigint) to authenticated;
grant execute on function public.league_points(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['league_members', 'league_picks'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
