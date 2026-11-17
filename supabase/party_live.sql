-- ═══════════════ v0.12 · Watch party ao vivo: chat + sincronia do player (extensão) ═══════════════

-- Chat da sala (só membros leem e escrevem)
create table if not exists public.party_messages (
  id         bigint generated always as identity primary key,
  code       text not null references public.party_rooms (code) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  body       text not null,
  kind       text not null default 'msg' check (kind in ('msg', 'sys')),
  created_at timestamptz not null default now(),
  constraint party_messages_len check (char_length(body) between 1 and 500),
  constraint party_messages_name_len check (char_length(name) between 1 and 24)
);
create index if not exists party_messages_code_idx on public.party_messages (code, created_at desc);

-- Estado do player compartilhado (uma linha por sala)
create table if not exists public.party_playback (
  code        text primary key references public.party_rooms (code) on delete cascade,
  episode_url text,
  episode_id  text,
  title       text,
  playing     boolean not null default false,
  position    double precision not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  by_name     text,
  by_client   text,
  constraint party_playback_pos check (position >= 0 and position < 86400)
);

alter table public.party_messages enable row level security;
alter table public.party_playback enable row level security;

drop policy if exists "ler chat da sala" on public.party_messages;
create policy "ler chat da sala" on public.party_messages for select to authenticated using (public.is_party_member(code));
drop policy if exists "falar na sala" on public.party_messages;
create policy "falar na sala" on public.party_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_party_member(code));
drop policy if exists "apagar minha msg" on public.party_messages;
create policy "apagar minha msg" on public.party_messages for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.party_rooms r where r.code = party_messages.code and r.host = auth.uid()));

drop policy if exists "ver player" on public.party_playback;
create policy "ver player" on public.party_playback for select to authenticated using (public.is_party_member(code));
drop policy if exists "criar player" on public.party_playback;
create policy "criar player" on public.party_playback for insert to authenticated
  with check (public.is_party_member(code) and updated_by = auth.uid());
drop policy if exists "controlar player" on public.party_playback;
create policy "controlar player" on public.party_playback for update to authenticated
  using (public.is_party_member(code)) with check (public.is_party_member(code) and updated_by = auth.uid());

-- Anti-flood + filtro de ódio no chat da sala; o horário vem sempre do servidor
create or replace function public.party_messages_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if new.kind = 'msg' and public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  select count(*) into recent from public.party_messages
    where user_id = new.user_id and created_at > now() - interval '8 seconds';
  if recent >= 6 then raise exception 'slow_down' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists party_messages_before on public.party_messages;
create trigger party_messages_before before insert on public.party_messages
  for each row execute function public.party_messages_before();

create or replace function public.party_playback_before()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists party_playback_before on public.party_playback;
create trigger party_playback_before before insert or update on public.party_playback
  for each row execute function public.party_playback_before();

-- Hora do servidor (a extensão usa pra corrigir relógio adiantado/atrasado)
create or replace function public.server_now() returns timestamptz language sql stable as $$ select now() $$;
grant execute on function public.server_now() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['party_messages', 'party_playback'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
