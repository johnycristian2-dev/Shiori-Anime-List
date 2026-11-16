-- ═══════════════ v0.9 · Social: amigos, feed, notificações, bloqueio e denúncias ═══════════════
-- Rode depois do schema.sql. Tudo é idempotente (pode rodar de novo).

-- Quem pode ver o feed e quem aparece pros outros
alter table public.profiles add column if not exists share_activity boolean not null default true;

-- Administradores (moderação). Só dá pra mudar pelo painel/SQL, nunca pelo app.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Menor de idade? (data de nascimento fica nos dados privados da conta)
create or replace function public.is_minor(uid uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select (u.raw_user_meta_data->>'birthdate')::date > (current_date - interval '18 years')
       from auth.users u where u.id = uid and (u.raw_user_meta_data->>'birthdate') ~ '^\d{4}-\d{2}-\d{2}$'),
    false);
$$;

-- ───── Bloqueios ─────
create table if not exists public.blocks (
  blocker    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "ver meus bloqueios" on public.blocks;
create policy "ver meus bloqueios" on public.blocks for select to authenticated using (blocker = auth.uid());
drop policy if exists "bloquear" on public.blocks;
create policy "bloquear" on public.blocks for insert to authenticated with check (blocker = auth.uid());
drop policy if exists "desbloquear" on public.blocks;
create policy "desbloquear" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- Só responde sobre relações que envolvem quem pergunta
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() in (a, b)
    and exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Ajudantes sem RLS (evitam regras que dependem uma da outra em loop)
create or replace function public.profile_is_public(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_public from public.profiles where user_id = uid), false);
$$;
create or replace function public.follows_accepted(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() in (a, b)
    and exists (select 1 from public.follows where follower = a and followee = b and status = 'accepted');
$$;
create or replace function public.shares_activity(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select share_activity from public.profiles where user_id = uid), false);
$$;

-- ───── Seguir / amizade ─────
-- status: accepted (seguindo) ou pending (pedido pra perfil privado ou de menor)
-- amigos = os dois se seguem com status accepted
create table if not exists public.follows (
  follower   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followee   uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee_idx on public.follows (followee, status);
alter table public.follows enable row level security;

drop policy if exists "ver seguidores" on public.follows;
create policy "ver seguidores" on public.follows for select to authenticated using (
  follower = auth.uid() or followee = auth.uid()
  or (status = 'accepted' and public.profile_is_public(followee))
);
drop policy if exists "seguir" on public.follows;
create policy "seguir" on public.follows for insert to authenticated with check (
  follower = auth.uid() and not public.is_blocked_between(follower, followee)
);
drop policy if exists "aceitar pedido" on public.follows;
create policy "aceitar pedido" on public.follows for update to authenticated
  using (followee = auth.uid()) with check (followee = auth.uid() and status = 'accepted');
drop policy if exists "deixar de seguir ou remover" on public.follows;
create policy "deixar de seguir ou remover" on public.follows for delete to authenticated
  using (follower = auth.uid() or followee = auth.uid());

-- Decide sozinho se vira "seguindo" ou "pedido": perfil privado ou de menor de idade sempre pede.
create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  open_profile boolean;
  recent int;
begin
  select count(*) into recent from public.follows where follower = new.follower and created_at > now() - interval '1 minute';
  if recent >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select coalesce(p.is_public, false) into open_profile from public.profiles p where p.user_id = new.followee;
  if open_profile and not public.is_minor(new.followee) then
    new.status := 'accepted';
  else
    new.status := 'pending';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

-- Bloquear desfaz o seguir nos dois sentidos
create or replace function public.blocks_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows where (follower = new.blocker and followee = new.blocked) or (follower = new.blocked and followee = new.blocker);
  return new;
end;
$$;
drop trigger if exists blocks_after_insert on public.blocks;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- ───── Notificações ─────
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  actor      uuid references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('follow', 'request', 'accepted')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "ver minhas notificações" on public.notifications;
create policy "ver minhas notificações" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "marcar como lida" on public.notifications;
create policy "marcar como lida" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "apagar notificação" on public.notifications;
create policy "apagar notificação" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.follows_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    delete from public.notifications where user_id = new.followee and actor = new.follower and kind in ('follow', 'request');
    insert into public.notifications (user_id, actor, kind)
    values (new.followee, new.follower, case when new.status = 'accepted' then 'follow' else 'request' end);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    delete from public.notifications where user_id = new.followee and actor = new.follower and kind = 'request';
    insert into public.notifications (user_id, actor, kind) values (new.follower, new.followee, 'accepted');
  end if;
  return new;
end;
$$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert or update on public.follows
  for each row execute function public.follows_notify();

-- ───── Feed de atividades ─────
create table if not exists public.activities (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('add', 'done', 'score', 'progress')),
  media_id   int not null,
  media      jsonb not null,
  value      int,
  status     text,
  created_at timestamptz not null default now()
);
create index if not exists activities_user_idx on public.activities (user_id, created_at desc);
alter table public.activities enable row level security;

drop policy if exists "ver atividades" on public.activities;
create policy "ver atividades" on public.activities for select to authenticated using (
  user_id = auth.uid() or (
    not public.is_blocked_between(user_id, auth.uid())
    and public.shares_activity(user_id)
    and (public.profile_is_public(user_id) or public.follows_accepted(auth.uid(), user_id))
  )
);
drop policy if exists "postar atividade" on public.activities;
create policy "postar atividade" on public.activities for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "apagar atividade" on public.activities;
create policy "apagar atividade" on public.activities for delete to authenticated using (user_id = auth.uid());

-- Sem flood: no máx. 40 por minuto; mesmo anime + mesmo tipo em 30 min só atualiza
create or replace function public.activities_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.activities where user_id = new.user_id and created_at > now() - interval '1 minute';
  if recent >= 40 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if octet_length(new.media::text) > 2000 then raise exception 'media too large'; end if;
  delete from public.activities
    where user_id = new.user_id and media_id = new.media_id and kind = new.kind and created_at > now() - interval '30 minutes';
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists activities_before_insert on public.activities;
create trigger activities_before_insert before insert on public.activities
  for each row execute function public.activities_before_insert();

-- ───── Denúncias ─────
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  reporter    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_user uuid references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('profile', 'activity', 'post', 'message')),
  target_id   text,
  reason      text not null check (reason in ('spam', 'harassment', 'sexual', 'violence', 'hate', 'minor_safety', 'impersonation', 'other')),
  details     text check (details is null or char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.reports enable row level security;
drop policy if exists "denunciar" on public.reports;
create policy "denunciar" on public.reports for insert to authenticated with check (reporter = auth.uid() and status = 'open');
drop policy if exists "ver minhas denúncias ou moderar" on public.reports;
create policy "ver minhas denúncias ou moderar" on public.reports for select to authenticated using (reporter = auth.uid() or public.is_admin());
drop policy if exists "moderar denúncia" on public.reports;
create policy "moderar denúncia" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Moderador pode ver qualquer perfil (pra analisar denúncias)
drop policy if exists "ver perfis públicos" on public.profiles;
create policy "ver perfis públicos" on public.profiles for select using (
  is_public
  or auth.uid() = user_id
  or public.is_admin()
  -- quem você segue (aceito) também vê seu perfil privado
  or public.follows_accepted(auth.uid(), user_id)
);

-- ───── Funções usadas pelo app ─────
-- Buscar pessoas: só perfis públicos, sem menores de idade, sem bloqueados
create or replace function public.search_profiles(q text)
returns table (user_id uuid, username text, display_name text, avatar_url text, bio text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, left(p.bio, 120)
  from public.profiles p
  where p.is_public
    and char_length(trim(q)) >= 2
    and p.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not public.is_minor(p.user_id)
    and not public.is_blocked_between(p.user_id, auth.uid())
    and (p.username ilike '%' || trim(q) || '%' or p.display_name ilike '%' || trim(q) || '%')
  order by (p.username = lower(trim(q))) desc, p.updated_at desc
  limit 20;
$$;

-- Contadores do perfil (funciona mesmo pra quem não pode ver a lista de seguidores)
create or replace function public.follow_counts(uid uuid)
returns table (followers int, following int, friends int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.follows where followee = uid and status = 'accepted'),
    (select count(*)::int from public.follows where follower = uid and status = 'accepted'),
    (select count(*)::int from public.follows a join public.follows b
       on b.follower = a.followee and b.followee = a.follower and b.status = 'accepted'
     where a.follower = uid and a.status = 'accepted');
$$;

-- Meus amigos que têm este título na lista (lido da "foto" pública da lista)
create or replace function public.friends_with_media(mid int)
returns table (user_id uuid, username text, display_name text, avatar_url text, status text, score int, progress int)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, e->>'s', coalesce((e->>'sc')::int, 0), coalesce((e->>'p')::int, 0)
  from public.follows a
  join public.follows b on b.follower = a.followee and b.followee = a.follower and b.status = 'accepted'
  join public.profiles p on p.user_id = a.followee
  cross join lateral jsonb_array_elements(coalesce(p.snapshot->'entries', '[]'::jsonb)) e
  where a.follower = auth.uid() and a.status = 'accepted' and (e->>'id')::int = mid
  limit 30;
$$;

revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
revoke execute on function public.follow_counts(uuid) from public;
grant execute on function public.follow_counts(uuid) to anon, authenticated;
revoke execute on function public.friends_with_media(int) from public, anon;
grant execute on function public.friends_with_media(int) to authenticated;
revoke execute on function public.is_minor(uuid) from public, anon, authenticated;
revoke execute on function public.follows_before_insert() from public, anon, authenticated;
revoke execute on function public.blocks_after_insert() from public, anon, authenticated;
revoke execute on function public.follows_notify() from public, anon, authenticated;
revoke execute on function public.activities_before_insert() from public, anon, authenticated;
-- Usadas dentro das regras (RLS): quem lê precisa poder executar, inclusive visitante sem conta
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated;
grant execute on function public.profile_is_public(uuid) to anon, authenticated;
grant execute on function public.follows_accepted(uuid, uuid) to anon, authenticated;
grant execute on function public.shares_activity(uuid) to anon, authenticated;

-- Menores de idade: perfil começa privado (pedido pra seguir, fora da busca)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  candidate text;
  n int := 0;
  minor boolean := false;
begin
  if new.is_anonymous then return new; end if;
  begin
    minor := (new.raw_user_meta_data->>'birthdate')::date > (current_date - interval '18 years');
  exception when others then minor := false;
  end;
  if base !~ '^[a-z0-9_]{3,20}$' then
    base := 'otaku_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) and n < 20 loop
    n := n + 1;
    candidate := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into public.profiles (user_id, username, display_name, is_public)
  values (new.id, candidate, nullif(new.raw_user_meta_data->>'display_name', ''), not coalesce(minor, false))
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Menor de idade não deixa o perfil público (proteção padrão do ECA Digital)
create or replace function public.profiles_guard_minor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_public and public.is_minor(new.user_id) then new.is_public := false; end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_minor on public.profiles;
create trigger profiles_guard_minor before insert or update of is_public on public.profiles
  for each row execute function public.profiles_guard_minor();
revoke execute on function public.profiles_guard_minor() from public, anon, authenticated;

-- Pedido recusado/cancelado: some a notificação dele
create or replace function public.follows_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where user_id = old.followee and actor = old.follower and kind in ('request', 'follow');
  return old;
end;
$$;
drop trigger if exists follows_after_delete on public.follows;
create trigger follows_after_delete after delete on public.follows
  for each row execute function public.follows_after_delete();
revoke execute on function public.follows_after_delete() from public, anon, authenticated;

-- Tempo real: notificações e feed
do $$
declare t text;
begin
  foreach t in array array['notifications', 'activities'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Para virar moderador (rode no SQL Editor com o seu apelido):
-- insert into public.admins (user_id) select user_id from public.profiles where username = 'SEU_APELIDO';

-- Nome e foto de quem aparece pra você (pedidos, seguidores, feed). Perfis privados só se houver ligação com você.
create or replace function public.mini_profiles(ids uuid[])
returns table (user_id uuid, username text, display_name text, avatar_url text, is_public boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, p.is_public
  from public.profiles p
  where p.user_id = any(ids[1:200])
    and auth.uid() is not null
    and not exists (select 1 from public.blocks b where (b.blocker = p.user_id and b.blocked = auth.uid()) or (b.blocker = auth.uid() and b.blocked = p.user_id))
    and (
      (p.is_public and not public.is_minor(p.user_id))
      or p.user_id = auth.uid()
      or exists (select 1 from public.follows f where (f.follower = p.user_id and f.followee = auth.uid()) or (f.follower = auth.uid() and f.followee = p.user_id))
    );
$$;
revoke execute on function public.mini_profiles(uuid[]) from public, anon;
grant execute on function public.mini_profiles(uuid[]) to authenticated;

-- Cartão mínimo de um perfil pelo apelido (pra perfil privado mostrar "enviar pedido").
-- Menor de idade só aparece pra quem já tem ligação com ele.
create or replace function public.profile_card(uname text)
returns table (user_id uuid, username text, display_name text, avatar_url text, is_public boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, p.is_public
  from public.profiles p
  where p.username = lower(trim(uname))
    and not exists (select 1 from public.blocks b where auth.uid() is not null and ((b.blocker = p.user_id and b.blocked = auth.uid()) or (b.blocker = auth.uid() and b.blocked = p.user_id)))
    and (
      not public.is_minor(p.user_id)
      or p.user_id = auth.uid()
      or exists (select 1 from public.follows f where (f.follower = p.user_id and f.followee = auth.uid()) or (f.follower = auth.uid() and f.followee = p.user_id))
    );
$$;
revoke execute on function public.profile_card(text) from public;
grant execute on function public.profile_card(text) to anon, authenticated;
