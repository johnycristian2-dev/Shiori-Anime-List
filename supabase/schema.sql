-- Shiori 栞 — banco da sincronização entre aparelhos (Supabase)
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.

-- Um documento por usuário com a lista inteira (entradas, remoções, listas, pulados).
-- A mescla é feita no app, anime por anime, pelo campo updatedAt.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  doc        jsonb not null default '{}'::jsonb,
  device     text,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Cada usuário só enxerga e altera a própria linha
drop policy if exists "ler a própria lista" on public.user_data;
create policy "ler a própria lista" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "criar a própria lista" on public.user_data;
create policy "criar a própria lista" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "atualizar a própria lista" on public.user_data;
create policy "atualizar a própria lista" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atualização em tempo real entre aparelhos abertos ao mesmo tempo
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_data'
  ) then
    alter publication supabase_realtime add table public.user_data;
  end if;
end $$;

-- ═══════════════════ v0.5 · Social ═══════════════════

-- Perfil público: uma "foto" da lista (sem anotações) que qualquer um pode ver pelo link /u/apelido
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  is_public    boolean not null default true,
  snapshot     jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "ver perfis públicos" on public.profiles;
create policy "ver perfis públicos" on public.profiles
  for select using (is_public or auth.uid() = user_id);
drop policy if exists "criar o próprio perfil" on public.profiles;
create policy "criar o próprio perfil" on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "editar o próprio perfil" on public.profiles;
create policy "editar o próprio perfil" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "apagar o próprio perfil" on public.profiles;
create policy "apagar o próprio perfil" on public.profiles
  for delete using (auth.uid() = user_id);

-- Watch party: salas com código, candidatos e votos
create table if not exists public.party_rooms (
  code       text primary key check (code ~ '^[A-Z0-9]{6}$'),
  host       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  status     text not null default 'voting' check (status in ('voting', 'done')),
  winner     jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.party_members (
  code      text not null references public.party_rooms (code) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (code, user_id)
);
create table if not exists public.party_items (
  code       text not null references public.party_rooms (code) on delete cascade,
  media_id   int not null,
  media      jsonb not null,
  added_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_name text,
  created_at timestamptz not null default now(),
  primary key (code, media_id)
);
create table if not exists public.party_votes (
  code     text not null,
  media_id int not null,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (code, media_id, user_id),
  foreign key (code, media_id) references public.party_items (code, media_id) on delete cascade
);

-- Quem está na sala (security definer evita recursão nas políticas)
create or replace function public.is_party_member(p_code text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from party_members where code = p_code and user_id = auth.uid());
$$;

alter table public.party_rooms enable row level security;
alter table public.party_members enable row level security;
alter table public.party_items enable row level security;
alter table public.party_votes enable row level security;

-- Salas: quem tem o código pode ver (pra entrar); só o anfitrião cria/altera
drop policy if exists "ver salas" on public.party_rooms;
create policy "ver salas" on public.party_rooms for select to authenticated using (true);
drop policy if exists "criar sala" on public.party_rooms;
create policy "criar sala" on public.party_rooms for insert to authenticated with check (host = auth.uid());
drop policy if exists "anfitrião altera" on public.party_rooms;
create policy "anfitrião altera" on public.party_rooms for update to authenticated using (host = auth.uid()) with check (host = auth.uid());
drop policy if exists "anfitrião apaga" on public.party_rooms;
create policy "anfitrião apaga" on public.party_rooms for delete to authenticated using (host = auth.uid());

drop policy if exists "membros se veem" on public.party_members;
create policy "membros se veem" on public.party_members for select to authenticated using (public.is_party_member(code));
drop policy if exists "entrar na sala" on public.party_members;
create policy "entrar na sala" on public.party_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "mudar meu nome" on public.party_members;
create policy "mudar meu nome" on public.party_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "sair da sala" on public.party_members;
create policy "sair da sala" on public.party_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "ver candidatos" on public.party_items;
create policy "ver candidatos" on public.party_items for select to authenticated using (public.is_party_member(code));
drop policy if exists "sugerir anime" on public.party_items;
create policy "sugerir anime" on public.party_items for insert to authenticated
  with check (added_by = auth.uid() and public.is_party_member(code));
drop policy if exists "tirar sugestão" on public.party_items;
create policy "tirar sugestão" on public.party_items for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.party_rooms r where r.code = party_items.code and r.host = auth.uid()));

drop policy if exists "ver votos" on public.party_votes;
create policy "ver votos" on public.party_votes for select to authenticated using (public.is_party_member(code));
drop policy if exists "votar" on public.party_votes;
create policy "votar" on public.party_votes for insert to authenticated with check (user_id = auth.uid() and public.is_party_member(code));
drop policy if exists "desvotar" on public.party_votes;
create policy "desvotar" on public.party_votes for delete to authenticated using (user_id = auth.uid());

-- Tempo real nas tabelas da watch party
do $$
declare t text;
begin
  foreach t in array array['party_rooms', 'party_members', 'party_items', 'party_votes'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ═══════════════ v0.7 · Conta e perfil ═══════════════
-- Perfil com foto, banner, bio e anime favorito
alter table public.profiles add column if not exists avatar_url  text;
alter table public.profiles add column if not exists banner_url  text;
alter table public.profiles add column if not exists bio         text;
alter table public.profiles add column if not exists favorite_id int;
alter table public.profiles add column if not exists created_at  timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 300);

-- Apelido livre? (funciona mesmo pra perfis privados, sem expor nada além de sim/não)
create or replace function public.username_available(u text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(u) ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where username = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Cria o perfil automaticamente no cadastro (apelido vem do formulário).
-- Se o apelido já tiver dono, acrescenta números. Nunca bloqueia o cadastro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  candidate text;
  n int := 0;
begin
  if new.is_anonymous then return new; end if;
  if base !~ '^[a-z0-9_]{3,20}$' then
    base := 'otaku_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) and n < 20 loop
    n := n + 1;
    candidate := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into public.profiles (user_id, username, display_name, is_public)
  values (new.id, candidate, nullif(new.raw_user_meta_data->>'display_name', ''), true)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fotos de perfil e banners: pasta = id do usuário, máx. 2 MB, só imagem
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif'];

drop policy if exists "imagens de perfil são públicas" on storage.objects;
create policy "imagens de perfil são públicas" on storage.objects
  for select using (bucket_id = 'profile-images');
drop policy if exists "enviar a própria imagem" on storage.objects;
create policy "enviar a própria imagem" on storage.objects
  for insert to authenticated with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "trocar a própria imagem" on storage.objects;
create policy "trocar a própria imagem" on storage.objects
  for update to authenticated using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "apagar a própria imagem" on storage.objects;
create policy "apagar a própria imagem" on storage.objects
  for delete to authenticated using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Excluir a própria conta (LGPD). As imagens são apagadas antes pelo app (API do Storage);
-- aqui some o usuário e, em cascata, lista, perfil e dados de watch party.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Funções internas não ficam expostas na API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_party_member(text) from public, anon;
grant execute on function public.is_party_member(text) to authenticated;
