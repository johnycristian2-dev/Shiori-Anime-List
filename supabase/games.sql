-- ═══════════════ v0.13 · Mini jogos ═══════════════

-- Placar diário (Animedle, Mais ou menos, Adivinhe pela imagem). Só se grava pelo RPC submit_score.
create table if not exists public.game_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  game       text not null check (game in ('animedle', 'maisoumenos', 'imagem')),
  day        date not null,
  score      int not null,
  detail     jsonb,
  name       text not null,
  plays      int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, game, day)
);
create index if not exists game_scores_day_idx on public.game_scores (game, day, score desc);
alter table public.game_scores enable row level security;

drop policy if exists "ver meus placares e dos amigos" on public.game_scores;
create policy "ver meus placares e dos amigos" on public.game_scores for select to authenticated
  using (user_id = auth.uid() or public.follows_accepted(auth.uid(), user_id));

create or replace function public.submit_score(p_game text, p_day date, p_score int, p_detail jsonb default null)
returns public.game_scores language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  max_score int;
  uname text;
  row public.game_scores;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if p_day < today - 1 or p_day > today + 1 then raise exception 'bad_day' using errcode = 'P0001'; end if;
  max_score := case p_game when 'animedle' then 8 when 'maisoumenos' then 500 when 'imagem' then 1000 else null end;
  if max_score is null then raise exception 'bad_game' using errcode = 'P0001'; end if;
  if p_score < 0 or p_score > max_score then raise exception 'bad_score' using errcode = 'P0001'; end if;
  if p_detail is not null and octet_length(p_detail::text) > 4000 then p_detail := null; end if;
  select coalesce(display_name, username, 'Otaku') into uname from public.profiles where user_id = uid;

  if p_game in ('animedle', 'imagem') then
    -- desafios do dia: só a primeira tentativa vale
    insert into public.game_scores (user_id, game, day, score, detail, name)
      values (uid, p_game, p_day, p_score, p_detail, coalesce(uname, 'Otaku'))
      on conflict (user_id, game, day) do nothing;
  else
    insert into public.game_scores (user_id, game, day, score, detail, name)
      values (uid, p_game, p_day, p_score, p_detail, coalesce(uname, 'Otaku'))
      on conflict (user_id, game, day) do update
        set score = greatest(game_scores.score, excluded.score),
            detail = case when excluded.score > game_scores.score then excluded.detail else game_scores.detail end,
            plays = game_scores.plays + 1,
            name = excluded.name,
            updated_at = now();
  end if;
  select * into row from public.game_scores where user_id = uid and game = p_game and day = p_day;
  return row;
end $$;
revoke all on function public.submit_score(text, date, int, jsonb) from public, anon;
grant execute on function public.submit_score(text, date, int, jsonb) to authenticated;

-- ─── Quiz ao vivo na watch party ───
create table if not exists public.party_quiz (
  code       text primary key references public.party_rooms (code) on delete cascade,
  status     text not null check (status in ('question', 'reveal', 'done')),
  round      int not null check (round between 1 and 30),
  total      int not null check (total between 1 and 30),
  seconds    int not null default 20 check (seconds between 5 and 60),
  question   jsonb not null,
  answer     int,
  history    jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.party_quiz_answers (
  code        text not null references public.party_quiz (code) on delete cascade,
  round       int not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  choice      int not null check (choice between 0 and 5),
  answered_at timestamptz not null default now(),
  primary key (code, round, user_id)
);
alter table public.party_quiz enable row level security;
alter table public.party_quiz_answers enable row level security;

create or replace function public.is_party_host(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_rooms where code = p_code and host = auth.uid());
$$;
grant execute on function public.is_party_host(text) to authenticated;

-- a rodada ainda aceita respostas?
create or replace function public.quiz_open(p_code text, p_round int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_quiz q
    where q.code = p_code and q.round = p_round and q.status = 'question'
      and now() < q.started_at + make_interval(secs => q.seconds + 2)
  );
$$;
-- as respostas da rodada já podem ser vistas por todos?
create or replace function public.quiz_revealed(p_code text, p_round int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_quiz q
    where q.code = p_code and (q.round > p_round or (q.round = p_round and q.status <> 'question'))
  );
$$;
-- quantos já responderam (sem mostrar o quê)
create or replace function public.quiz_answer_count(p_code text, p_round int)
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_party_member(p_code)
    then (select count(*)::int from party_quiz_answers where code = p_code and round = p_round) else 0 end;
$$;
grant execute on function public.quiz_open(text, int) to authenticated;
grant execute on function public.quiz_revealed(text, int) to authenticated;
grant execute on function public.quiz_answer_count(text, int) to authenticated;

drop policy if exists "ver quiz" on public.party_quiz;
create policy "ver quiz" on public.party_quiz for select to authenticated using (public.is_party_member(code));
drop policy if exists "anfitrião cria quiz" on public.party_quiz;
create policy "anfitrião cria quiz" on public.party_quiz for insert to authenticated with check (public.is_party_host(code));
drop policy if exists "anfitrião conduz quiz" on public.party_quiz;
create policy "anfitrião conduz quiz" on public.party_quiz for update to authenticated
  using (public.is_party_host(code)) with check (public.is_party_host(code));
drop policy if exists "anfitrião encerra quiz" on public.party_quiz;
create policy "anfitrião encerra quiz" on public.party_quiz for delete to authenticated using (public.is_party_host(code));

drop policy if exists "responder" on public.party_quiz_answers;
create policy "responder" on public.party_quiz_answers for insert to authenticated
  with check (user_id = auth.uid() and public.is_party_member(code) and public.quiz_open(code, round));
drop policy if exists "ver respostas reveladas" on public.party_quiz_answers;
create policy "ver respostas reveladas" on public.party_quiz_answers for select to authenticated
  using (user_id = auth.uid() or (public.is_party_member(code) and public.quiz_revealed(code, round)));

-- horários sempre do servidor; resposta certa só aparece depois de revelar
create or replace function public.party_quiz_before()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'question' then
    new.answer := null;
    if tg_op = 'INSERT' or old.round is distinct from new.round or old.status <> 'question' then
      new.started_at := now();
    else
      new.started_at := old.started_at;
    end if;
  elsif tg_op = 'UPDATE' then
    new.started_at := old.started_at;
  end if;
  return new;
end $$;
drop trigger if exists party_quiz_before on public.party_quiz;
create trigger party_quiz_before before insert or update on public.party_quiz
  for each row execute function public.party_quiz_before();

create or replace function public.party_quiz_answers_before()
returns trigger language plpgsql as $$
begin
  new.answered_at := now();
  new.name := left(btrim(new.name), 24);
  return new;
end $$;
drop trigger if exists party_quiz_answers_before on public.party_quiz_answers;
create trigger party_quiz_answers_before before insert on public.party_quiz_answers
  for each row execute function public.party_quiz_answers_before();

do $$
declare t text;
begin
  foreach t in array array['party_quiz', 'party_quiz_answers'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
