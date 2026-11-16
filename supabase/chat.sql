-- ═══════════════ v0.11 · Chats por anime/mangá, por temporada e sala geral ═══════════════
-- Rode depois do posts.sql. Idempotente.

create table if not exists public.chat_rooms (
  id              text primary key check (id ~ '^(media:[0-9]{1,9}|season:(WINTER|SPRING|SUMMER|FALL)-[0-9]{4}|geral)$'),
  title           text not null check (char_length(title) between 1 and 200),
  media           jsonb,
  message_count   int not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.chat_rooms enable row level security;
drop policy if exists "ver salas" on public.chat_rooms;
create policy "ver salas" on public.chat_rooms for select using (true);
-- salas são criadas só pela função ensure_room (sem insert direto)

create or replace function public.ensure_room(rid text, rtitle text, rmedia jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if rmedia is not null and octet_length(rmedia::text) > 2000 then raise exception 'media too large'; end if;
  insert into public.chat_rooms (id, title, media) values (rid, left(rtitle, 200), rmedia) on conflict (id) do nothing;
end;
$$;
revoke execute on function public.ensure_room(text, text, jsonb) from public, anon;
grant execute on function public.ensure_room(text, text, jsonb) to authenticated;

-- Silenciados pelo moderador (não escrevem em nenhum chat até "until")
create table if not exists public.chat_mutes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  until      timestamptz not null,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.chat_mutes enable row level security;
drop policy if exists "ver meu silêncio" on public.chat_mutes;
create policy "ver meu silêncio" on public.chat_mutes for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "moderador silencia" on public.chat_mutes;
create policy "moderador silencia" on public.chat_mutes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  room_id    text not null references public.chat_rooms (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 500),
  spoiler    boolean not null default false,
  -- spoiler marcado por episódio/capítulo: quem está antes vê borrado
  episode    int check (episode is null or episode between 0 and 100000),
  reply_to   bigint references public.chat_messages (id) on delete set null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at desc);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);
alter table public.chat_messages enable row level security;

drop policy if exists "ler mensagens" on public.chat_messages;
create policy "ler mensagens" on public.chat_messages for select using (
  (not hidden or user_id = auth.uid() or public.is_admin()) and public.can_see_user(user_id)
);
drop policy if exists "apagar mensagem" on public.chat_messages;
create policy "apagar mensagem" on public.chat_messages for delete to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "moderar mensagem" on public.chat_messages;
create policy "moderar mensagem" on public.chat_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Menores de 18 leem as salas públicas, mas não escrevem (proteção contra contato de estranhos — ECA Digital).
-- i_am_minor só responde sobre quem pergunta.
create or replace function public.i_am_minor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_minor(auth.uid());
$$;
grant execute on function public.i_am_minor() to authenticated;
drop policy if exists "escrever mensagem" on public.chat_messages;
create policy "escrever mensagem" on public.chat_messages for insert to authenticated with check (
  user_id = auth.uid()
  and not public.i_am_minor()
  and not exists (select 1 from public.chat_mutes m where m.user_id = auth.uid() and m.until > now())
);

create or replace function public.chat_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare burst int; minute int;
begin
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  -- modo devagar: até 5 mensagens em 10 s e 20 por minuto
  select count(*) filter (where created_at > now() - interval '10 seconds'), count(*)
    into burst, minute
    from public.chat_messages where user_id = new.user_id and created_at > now() - interval '1 minute';
  if burst >= 5 or minute >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  -- mesma mensagem repetida em 1 minuto = spam
  if exists (select 1 from public.chat_messages where user_id = new.user_id and body = new.body and created_at > now() - interval '1 minute') then
    raise exception 'duplicate_message' using errcode = 'P0001';
  end if;
  if new.reply_to is not null and not exists (select 1 from public.chat_messages where id = new.reply_to and room_id = new.room_id) then
    new.reply_to := null;
  end if;
  new.hidden := false;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists chat_before_insert on public.chat_messages;
create trigger chat_before_insert before insert on public.chat_messages
  for each row execute function public.chat_before_insert();

create or replace function public.chat_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_rooms set message_count = message_count + 1, last_message_at = new.created_at where id = new.room_id;
  return new;
end;
$$;
drop trigger if exists chat_after_insert on public.chat_messages;
create trigger chat_after_insert after insert on public.chat_messages
  for each row execute function public.chat_after_insert();

revoke execute on function public.chat_before_insert() from public, anon, authenticated;
revoke execute on function public.chat_after_insert() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- Sala geral sempre existe
insert into public.chat_rooms (id, title) values ('geral', 'Geral') on conflict (id) do nothing;
