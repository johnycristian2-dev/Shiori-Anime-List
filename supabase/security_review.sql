-- Revisão de segurança (nov/2026)

-- 1) Data de nascimento à prova de edição.
-- Antes ficava só no user_metadata, que o próprio usuário consegue mudar pelo auth.updateUser.
-- Agora vai pra uma tabela que só o servidor escreve; definida uma vez, não muda mais.
create table if not exists public.birthdates (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  birthdate date not null check (birthdate between '1900-01-01' and current_date),
  set_at    timestamptz not null default now()
);
alter table public.birthdates enable row level security;
drop policy if exists "ver minha data" on public.birthdates;
create policy "ver minha data" on public.birthdates for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.birthdates from anon, authenticated;

insert into public.birthdates (user_id, birthdate)
  select id, (raw_user_meta_data->>'birthdate')::date from auth.users
  where raw_user_meta_data->>'birthdate' ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (user_id) do nothing;

-- no cadastro por e-mail a data vem junto (formulário de cadastro)
create or replace function public.copy_birthdate_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data->>'birthdate' ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.birthdates (user_id, birthdate) values (new.id, (new.raw_user_meta_data->>'birthdate')::date)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.copy_birthdate_on_signup() from public, anon, authenticated;
drop trigger if exists copy_birthdate on auth.users;
create trigger copy_birthdate after insert on auth.users for each row execute function public.copy_birthdate_on_signup();

-- quem entrou pelo Google informa uma vez; depois não dá pra trocar
create or replace function public.set_birthdate(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if p_date > current_date - interval '13 years' or p_date < '1900-01-01' then raise exception 'bad_date' using errcode = 'P0001'; end if;
  insert into public.birthdates (user_id, birthdate) values ((select auth.uid()), p_date);
exception when unique_violation then
  raise exception 'already_set' using errcode = 'P0001';
end $$;
revoke execute on function public.set_birthdate(date) from public, anon;
grant execute on function public.set_birthdate(date) to authenticated;

-- sem data informada = tratado como menor (mais seguro) até a pessoa informar
create or replace function public.is_minor(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select b.birthdate > current_date - interval '18 years' from public.birthdates b where b.user_id = uid), true);
$$;

-- 2) Link do episódio na watch party: só Crunchyroll (evita link javascript: no botão)
update public.party_playback set episode_url = null where episode_url is not null and episode_url !~ '^https://([a-z0-9-]+\.)*crunchyroll\.com/';
alter table public.party_playback drop constraint if exists party_playback_url;
alter table public.party_playback add constraint party_playback_url
  check (episode_url is null or (episode_url ~ '^https://([a-z0-9-]+\.)*crunchyroll\.com/' and char_length(episode_url) <= 500));
alter table public.party_playback drop constraint if exists party_playback_title_len;
alter table public.party_playback add constraint party_playback_title_len check (title is null or char_length(title) <= 200);

-- 3) Perfil: imagens só do nosso storage ou do AniList; tamanhos máximos
alter table public.profiles drop constraint if exists profiles_avatar_host;
alter table public.profiles add constraint profiles_avatar_host check (avatar_url is null or avatar_url ~ '^https://(ahtalxodwxzmjltbxmaz\.supabase\.co/storage/v1/object/public/profile-images/|s4\.anilist\.co/)');
alter table public.profiles drop constraint if exists profiles_banner_host;
alter table public.profiles add constraint profiles_banner_host check (banner_url is null or banner_url ~ '^https://(ahtalxodwxzmjltbxmaz\.supabase\.co/storage/v1/object/public/profile-images/|s4\.anilist\.co/)');
alter table public.profiles drop constraint if exists profiles_display_len;
alter table public.profiles add constraint profiles_display_len check (display_name is null or char_length(display_name) <= 40);
alter table public.profiles drop constraint if exists profiles_snapshot_size;
alter table public.profiles add constraint profiles_snapshot_size check (snapshot is null or octet_length(snapshot::text) <= 2000000);
alter table public.profiles drop constraint if exists profiles_username_reserved;
alter table public.profiles add constraint profiles_username_reserved
  check (username !~ '^(admin|adm|administrador|shiori|shioriapp|suporte|support|moderador|moderacao|mod|dono|owner|staff|oficial|official|equipe|team)$');
alter table public.user_data drop constraint if exists user_data_doc_size;
alter table public.user_data add constraint user_data_doc_size check (octet_length(doc::text) <= 6000000);

-- 4) Limites contra spam: denúncias e salas de watch party
create or replace function public.reports_flood_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.reports_flood_guard() from public, anon, authenticated;
drop trigger if exists reports_flood on public.reports;
create trigger reports_flood before insert on public.reports for each row execute function public.reports_flood_guard();

create or replace function public.party_rooms_flood_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.party_rooms where host = new.host and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.party_rooms_flood_guard() from public, anon, authenticated;
drop trigger if exists party_rooms_flood on public.party_rooms;
create trigger party_rooms_flood before insert on public.party_rooms for each row execute function public.party_rooms_flood_guard();

-- 5) app_config: uma política por ação (desempenho)
drop policy if exists "admin muda config" on public.app_config;
create policy "admin cria config" on public.app_config for insert to authenticated with check (public.is_admin());
create policy "admin altera config" on public.app_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga config" on public.app_config for delete to authenticated using (public.is_admin());
