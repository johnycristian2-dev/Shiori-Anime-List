-- Mini jogos com o servidor como juiz (nov/2026).
-- Antes: o navegador calculava o anime do dia e mandava a própria pontuação (dava pra trapacear).
-- Agora: o anime secreto, as capas e os números ficam no servidor; o navegador só manda o chute
-- e o servidor confere, cronometra e grava a pontuação. submit_score deixa de ser liberado.

create table if not exists public.game_pool (
  id   int primary key,
  r    text not null,
  e    text,
  n    text,
  c    text not null,
  g    text[] not null default '{}',
  y    int,
  s    text,
  f    text,
  ep   int,
  sc   int,
  p    int not null,
  main boolean not null default true
);
alter table public.game_pool enable row level security;
revoke all on public.game_pool from anon, authenticated;

create table if not exists public.game_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  game        text not null check (game in ('animedle', 'maisoumenos', 'imagem')),
  day         date not null,
  state       jsonb not null default '{}',
  score       int,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists game_runs_daily on public.game_runs (user_id, game, day) where game in ('animedle', 'imagem');
create index if not exists game_runs_user_idx on public.game_runs (user_id, created_at desc);
alter table public.game_runs enable row level security;
revoke all on public.game_runs from anon, authenticated;

create table if not exists public.game_cover_tokens (
  token      uuid primary key default gen_random_uuid(),
  cover      text not null,
  expires_at timestamptz not null default now() + interval '2 hours'
);
alter table public.game_cover_tokens enable row level security;
revoke all on public.game_cover_tokens from anon, authenticated;

insert into public.app_secrets (name, value) values ('game_salt', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

create or replace function public.game_salt() returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_secrets where name = 'game_salt';
$$;
create or replace function public.br_today() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;
revoke execute on function public.game_salt() from public, anon, authenticated;

create or replace function public.game_player_name(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(display_name, username) from public.profiles where user_id = uid), 'Otaku');
$$;
revoke execute on function public.game_player_name(uuid) from public, anon, authenticated;

-- ───────── Animedle ─────────
create or replace function public.animedle_secret(d date) returns int
language sql stable security definer set search_path = public as $$
  select id from (
    select id from public.game_pool where main and f in ('TV', 'MOVIE', 'ONA') order by p desc limit 300
  ) c order by md5(public.game_salt() || ':animedle:' || d::text || ':' || id) limit 1;
$$;
revoke execute on function public.animedle_secret(date) from public, anon, authenticated;

create or replace function public.animedle_cells(gid int, sid int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g public.game_pool; s public.game_pool; shared int;
begin
  select * into g from public.game_pool where id = gid;
  select * into s from public.game_pool where id = sid;
  shared := (select count(*) from unnest(g.g) x where x = any (s.g));
  return jsonb_build_array(
    jsonb_build_object('hit', case when shared = cardinality(g.g) and shared = cardinality(s.g) then 'ok' when shared > 0 then 'near' else 'no' end),
    jsonb_build_object('hit', case when g.y = s.y then 'ok' when abs(g.y - s.y) <= 3 then 'near' else 'no' end,
                       'arrow', case when s.y > g.y then 'up' when s.y < g.y then 'down' end),
    jsonb_build_object('hit', case when g.s is not null and s.s is not null and lower(g.s) = lower(s.s) then 'ok' else 'no' end),
    jsonb_build_object('hit', case when g.f = s.f then 'ok' else 'no' end),
    jsonb_build_object('hit', case when g.ep is not distinct from s.ep then 'ok' when g.ep is not null and s.ep is not null and abs(g.ep - s.ep) <= 3 then 'near' else 'no' end,
                       'arrow', case when g.ep is not null and s.ep is not null then case when s.ep > g.ep then 'up' when s.ep < g.ep then 'down' end end),
    jsonb_build_object('hit', case when g.sc = s.sc then 'ok' when abs(g.sc - s.sc) <= 4 then 'near' else 'no' end,
                       'arrow', case when s.sc > g.sc then 'up' when s.sc < g.sc then 'down' end)
  );
end $$;
revoke execute on function public.animedle_cells(int, int) from public, anon, authenticated;

create or replace function public.animedle_view(r public.game_runs) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid int; guesses int[]; wrong int; done boolean; won boolean;
begin
  if r.id is null then
    return jsonb_build_object('guesses', '[]'::jsonb, 'done', false, 'won', false, 'secret', null, 'hint', null, 'score', null);
  end if;
  sid := (r.state ->> 'secret')::int;
  guesses := array(select (x)::int from jsonb_array_elements_text(r.state -> 'guesses') x);
  done := r.finished_at is not null;
  won := sid = any (guesses);
  wrong := cardinality(array_remove(guesses, sid));
  return jsonb_build_object(
    'guesses', coalesce((select jsonb_agg(jsonb_build_object('id', gid, 'cells', public.animedle_cells(gid, sid)) order by ord)
                         from unnest(guesses) with ordinality as t(gid, ord)), '[]'::jsonb),
    'done', done,
    'won', won,
    'secret', case when done then sid end,
    -- dica da capa só nos últimos chutes (e a imagem vem do servidor, sem revelar qual é)
    'hint', case when not done and wrong >= 5 then r.state ->> 'hint' end,
    'score', r.score
  );
end $$;
revoke execute on function public.animedle_view(public.game_runs) from public, anon, authenticated;

create or replace function public.animedle_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.game_runs;
begin
  if (select auth.uid()) is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  select * into r from public.game_runs where user_id = (select auth.uid()) and game = 'animedle' and day = public.br_today();
  return public.animedle_view(r);
end $$;

create or replace function public.animedle_guess(p_media int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  d date := public.br_today();
  r public.game_runs;
  sid int;
  guesses jsonb;
  n int;
  won boolean;
  tok uuid;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.game_pool where id = p_media) then raise exception 'bad_media' using errcode = 'P0001'; end if;
  insert into public.game_runs (user_id, game, day, state)
    values (uid, 'animedle', d, jsonb_build_object('secret', public.animedle_secret(d), 'guesses', '[]'::jsonb))
    on conflict (user_id, game, day) where game in ('animedle', 'imagem') do nothing;
  select * into r from public.game_runs where user_id = uid and game = 'animedle' and day = d for update;
  if r.finished_at is not null then return public.animedle_view(r); end if;
  sid := (r.state ->> 'secret')::int;
  guesses := r.state -> 'guesses';
  if guesses @> to_jsonb(p_media) then return public.animedle_view(r); end if;
  guesses := guesses || to_jsonb(p_media);
  n := jsonb_array_length(guesses);
  won := p_media = sid;
  r.state := jsonb_set(r.state, '{guesses}', guesses);
  -- a partir do 5º erro, a dica da capa vem por um link temporário que não revela o anime
  if not won and n >= 5 and r.state ->> 'hint' is null then
    insert into public.game_cover_tokens (cover) select c from public.game_pool where id = sid returning token into tok;
    r.state := jsonb_set(r.state, '{hint}', to_jsonb(tok::text));
  end if;
  if won or n >= 8 then
    r.finished_at := now();
    r.score := case when won then 9 - n else 0 end;
    insert into public.game_scores (user_id, game, day, score, detail, name)
      values (uid, 'animedle', d, r.score, jsonb_build_object('guesses', n, 'won', won), public.game_player_name(uid))
      on conflict (user_id, game, day) do nothing;
  end if;
  update public.game_runs set state = r.state, finished_at = r.finished_at, score = r.score where id = r.id;
  return public.animedle_view(r);
end $$;

-- ───────── Adivinhe pela capa ─────────
create or replace function public.cover_build(d date) returns jsonb
language sql stable security definer set search_path = public as $$
  with top as (select id, g from public.game_pool where main order by p desc limit 400),
  answers as (
    select id, g, row_number() over (order by md5(public.game_salt() || ':imagem:' || d::text || ':' || id)) rn
    from top order by md5(public.game_salt() || ':imagem:' || d::text || ':' || id) limit 10
  )
  select jsonb_agg(jsonb_build_object('a', a.id, 'o', (
    select jsonb_agg(x.id order by md5(public.game_salt() || ':o:' || d::text || ':' || a.id || ':' || x.id))
    from (
      select a.id
      union all
      select w.id from (
        select t.id from top t
        where t.id <> a.id
        order by (t.g && a.g) desc, md5(public.game_salt() || ':w:' || d::text || ':' || a.id || ':' || t.id)
        limit 3
      ) w
    ) x
  )) order by a.rn)
  from answers a;
$$;
revoke execute on function public.cover_build(date) from public, anon, authenticated;

create or replace function public.cover_round() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  d date := public.br_today();
  r public.game_runs;
  i int;
  rd jsonb;
  tok uuid;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  insert into public.game_runs (user_id, game, day, state)
    values (uid, 'imagem', d, jsonb_build_object('rounds', public.cover_build(d), 'i', 0, 'score', 0, 'marks', '[]'::jsonb))
    on conflict (user_id, game, day) where game in ('animedle', 'imagem') do nothing;
  select * into r from public.game_runs where user_id = uid and game = 'imagem' and day = d for update;
  if r.finished_at is not null then
    return jsonb_build_object('done', true, 'score', r.score, 'marks', r.state -> 'marks',
      'answers', (select jsonb_agg(x -> 'a') from jsonb_array_elements(r.state -> 'rounds') x));
  end if;
  i := (r.state ->> 'i')::int;
  rd := r.state -> 'rounds' -> i;
  if r.state ->> 'started' is null then
    insert into public.game_cover_tokens (cover) select c from public.game_pool where id = (rd ->> 'a')::int returning token into tok;
    r.state := r.state || jsonb_build_object('started', to_jsonb(clock_timestamp()), 'tok', tok::text);
    update public.game_runs set state = r.state where id = r.id;
  end if;
  return jsonb_build_object(
    'done', false,
    'i', i,
    'options', rd -> 'o',
    'img', r.state ->> 'tok',
    'elapsed', extract(epoch from clock_timestamp() - (r.state ->> 'started')::timestamptz),
    'score', (r.state ->> 'score')::int,
    'marks', r.state -> 'marks'
  );
end $$;

create or replace function public.cover_answer(p_choice int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  d date := public.br_today();
  r public.game_runs;
  i int;
  ans int;
  e numeric;
  ok boolean;
  pts int;
  sc int;
  marks jsonb;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  select * into r from public.game_runs where user_id = uid and game = 'imagem' and day = d for update;
  if r.id is null or r.finished_at is not null then raise exception 'no_round' using errcode = 'P0001'; end if;
  if r.state ->> 'started' is null then raise exception 'no_round' using errcode = 'P0001'; end if;
  i := (r.state ->> 'i')::int;
  ans := (r.state -> 'rounds' -> i ->> 'a')::int;
  e := extract(epoch from clock_timestamp() - (r.state ->> 'started')::timestamptz);
  -- tempo contado pelo servidor; resposta em menos de 0,25 s não é de gente (a capa nem carregou)
  ok := p_choice = ans and e <= 15.5 and e >= 0.25;
  pts := case when ok then greatest(10, round(100 * (1 - least(e, 15) / 15))::int) else 0 end;
  sc := (r.state ->> 'score')::int + pts;
  marks := (r.state -> 'marks') || to_jsonb(case when ok then 'hit' else 'miss' end);
  r.state := (r.state - 'started' - 'tok') || jsonb_build_object('i', i + 1, 'score', sc, 'marks', marks);
  if i + 1 >= jsonb_array_length(r.state -> 'rounds') then
    r.finished_at := now();
    r.score := sc;
    insert into public.game_scores (user_id, game, day, score, detail, name)
      values (uid, 'imagem', d, sc, jsonb_build_object('hits', (select count(*) from jsonb_array_elements_text(marks) m where m = 'hit')), public.game_player_name(uid))
      on conflict (user_id, game, day) do nothing;
  end if;
  update public.game_runs set state = r.state, finished_at = r.finished_at, score = r.score where id = r.id;
  return jsonb_build_object('ok', ok, 'answer', ans, 'pts', pts, 'score', sc, 'marks', marks, 'done', r.finished_at is not null);
end $$;

-- ───────── Mais ou menos ─────────
create or replace function public.hl_value(mid int, mode text) returns int
language sql stable security definer set search_path = public as $$
  select case when mode = 'sc' then sc else p end from public.game_pool where id = mid;
$$;
revoke execute on function public.hl_value(int, text) from public, anon, authenticated;

create or replace function public.hl_pick(mode text, not_id int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare cand int; lv int; v int; k int := 0;
begin
  lv := public.hl_value(not_id, mode);
  loop
    k := k + 1;
    select id into cand from public.game_pool order by random() limit 1;
    if not_id is null then return cand; end if;
    if cand <> not_id then
      v := public.hl_value(cand, mode);
      -- evita empate e diferença minúscula (seria pura sorte)
      if (mode = 'sc' and abs(v - lv) >= 2) or (mode = 'p' and abs(v - lv) >= greatest(lv * 0.04, 2000)) then return cand; end if;
    end if;
    if k >= 50 then return cand; end if;
  end loop;
end $$;
revoke execute on function public.hl_pick(text, int) from public, anon, authenticated;

create or replace function public.hl_start(p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  l int; r int; rid uuid;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if p_mode not in ('p', 'sc') then raise exception 'bad_mode' using errcode = 'P0001'; end if;
  if (select count(*) from public.game_runs where user_id = uid and game = 'maisoumenos' and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- partidas abertas antigas são encerradas
  update public.game_runs set finished_at = now() where user_id = uid and game = 'maisoumenos' and finished_at is null;
  l := public.hl_pick(p_mode, null);
  r := public.hl_pick(p_mode, l);
  insert into public.game_runs (user_id, game, day, state)
    values (uid, 'maisoumenos', public.br_today(), jsonb_build_object('mode', p_mode, 'l', l, 'r', r, 'score', 0, 'last', to_jsonb(clock_timestamp())))
    returning id into rid;
  return jsonb_build_object('run', rid, 'left', l, 'left_value', public.hl_value(l, p_mode), 'right', r, 'score', 0);
end $$;

create or replace function public.hl_answer(p_run uuid, p_higher boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  g public.game_runs;
  mode text; l int; r int; lv int; rv int; ok boolean; sc int; nxt int;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  select * into g from public.game_runs where id = p_run and user_id = uid and game = 'maisoumenos' for update;
  if g.id is null or g.finished_at is not null then raise exception 'no_round' using errcode = 'P0001'; end if;
  -- ritmo humano: a revelação leva ~1 s; respostas em rajada são de robô
  if clock_timestamp() - (g.state ->> 'last')::timestamptz < interval '700 milliseconds' then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;
  mode := g.state ->> 'mode'; l := (g.state ->> 'l')::int; r := (g.state ->> 'r')::int;
  lv := public.hl_value(l, mode); rv := public.hl_value(r, mode);
  ok := rv = lv or (case when p_higher then rv > lv else rv < lv end);
  sc := (g.state ->> 'score')::int;
  if ok then
    sc := least(500, sc + 1);
    nxt := public.hl_pick(mode, r);
    g.state := g.state || jsonb_build_object('l', r, 'r', nxt, 'score', sc, 'last', to_jsonb(clock_timestamp()));
    update public.game_runs set state = g.state, score = sc where id = g.id;
    return jsonb_build_object('ok', true, 'right_value', rv, 'score', sc, 'done', false, 'next', nxt);
  end if;
  update public.game_runs set finished_at = now(), score = sc where id = g.id;
  if sc > 0 then
    insert into public.game_scores (user_id, game, day, score, detail, name)
      values (uid, 'maisoumenos', g.day, sc, jsonb_build_object('mode', mode), public.game_player_name(uid))
      on conflict (user_id, game, day) do update
        set score = greatest(game_scores.score, excluded.score),
            detail = case when excluded.score > game_scores.score then excluded.detail else game_scores.detail end,
            plays = game_scores.plays + 1,
            name = excluded.name,
            updated_at = now();
  end if;
  return jsonb_build_object('ok', false, 'right_value', rv, 'score', sc, 'done', true);
end $$;

-- quem chama o quê
revoke execute on function public.animedle_state(), public.animedle_guess(int), public.cover_round(), public.cover_answer(int),
  public.hl_start(text), public.hl_answer(uuid, boolean) from public, anon;
grant execute on function public.animedle_state(), public.animedle_guess(int), public.cover_round(), public.cover_answer(int),
  public.hl_start(text), public.hl_answer(uuid, boolean) to authenticated;

-- o navegador não manda mais pontuação
revoke execute on function public.submit_score(text, date, int, jsonb) from authenticated;

-- limpeza: links de capa vencidos
create or replace function public.game_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from public.game_cover_tokens where expires_at < now();
  delete from public.game_runs where game = 'maisoumenos' and created_at < now() - interval '3 days';
$$;
revoke execute on function public.game_cleanup() from public, anon, authenticated;
select cron.unschedule('shiori-game-cleanup') where exists (select 1 from cron.job where jobname = 'shiori-game-cleanup');
select cron.schedule('shiori-game-cleanup', '23 7 * * *', $$ select public.game_cleanup(); $$);

-- Carrega/atualiza o catálogo dos jogos a partir do JSON público (scripts/build-game-pool.mjs)
create or replace function public.game_pool_load(doc jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  insert into public.game_pool (id, r, e, n, c, g, y, s, f, ep, sc, p, main)
  select (x ->> 'id')::int, x ->> 'r', x ->> 'e', x ->> 'n', x ->> 'c',
         coalesce(array(select jsonb_array_elements_text(x -> 'g')), '{}'),
         (x ->> 'y')::int, x ->> 's', x ->> 'f', (x ->> 'ep')::int, (x ->> 'sc')::int, (x ->> 'p')::int,
         not ((x ->> 'r') ~* '(season|\y(2nd|3rd|\d+th)\y|part\s*\d|\yII+\y|\y\d+\s*$|: .*arc|kanketsu|zoku|\yfinal\y|movie\s*\d)'
              or coalesce(x ->> 'e', '') ~* '(season|\y(2nd|3rd|\d+th)\y|part\s*\d|\yII+\y|\y\d+\s*$|: .*arc|kanketsu|zoku|\yfinal\y|movie\s*\d)')
  from jsonb_array_elements(doc -> 'items') x
  on conflict (id) do update set r = excluded.r, e = excluded.e, n = excluded.n, c = excluded.c, g = excluded.g, y = excluded.y,
    s = excluded.s, f = excluded.f, ep = excluded.ep, sc = excluded.sc, p = excluded.p, main = excluded.main;
  get diagnostics cnt = row_count;
  return cnt;
end $$;
revoke execute on function public.game_pool_load(jsonb) from public, anon, authenticated;
