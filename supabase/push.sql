-- ═══════════════ v0.16 · Aviso de episódio novo (Web Push) + rotina shiori-tick ═══════════════
-- A chave privada VAPID fica no Vault (nunca no código):
--   select vault.create_secret('<chave privada>', 'vapid_private');

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lang       text not null default 'pt',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "minhas inscrições" on public.push_subscriptions;
create policy "minhas inscrições" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "inscrever" on public.push_subscriptions;
create policy "inscrever" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "desinscrever" on public.push_subscriptions;
create policy "desinscrever" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- cada (pessoa, anime, episódio) só é avisado uma vez
create table if not exists public.push_log (
  user_id  uuid not null references auth.users (id) on delete cascade,
  media_id int not null,
  episode  int not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, media_id, episode)
);
alter table public.push_log enable row level security;

create table if not exists public.tick_state (
  id       int primary key default 1 check (id = 1),
  last_run timestamptz not null default now() - interval '1 hour',
  last_air timestamptz not null default now() - interval '1 hour',
  info     jsonb
);
insert into public.tick_state (id) values (1) on conflict do nothing;
alter table public.tick_state enable row level security;

-- só a função (service role) lê a chave privada
create or replace function public.get_vapid_private()
returns text language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private' limit 1;
$$;
revoke all on function public.get_vapid_private() from public, anon, authenticated;
grant execute on function public.get_vapid_private() to service_role;

-- animes em "Assistindo" de quem ativou os avisos
create or replace function public.watching_for_push()
returns table (user_id uuid, media_id int, progress int)
language sql stable security definer set search_path = public as $$
  select u.user_id, (e.value ->> 'mediaId')::int, coalesce((e.value ->> 'progress')::int, 0)
  from public.user_data u
  join (select distinct s.user_id from public.push_subscriptions s) s on s.user_id = u.user_id
  cross join lateral jsonb_each(coalesce(u.doc -> 'entries', '{}'::jsonb)) e
  where e.value ->> 'status' = 'WATCHING' and coalesce(e.value ->> 'type', 'ANIME') = 'ANIME';
$$;
revoke all on function public.watching_for_push() from public, anon, authenticated;
grant execute on function public.watching_for_push() to service_role;

-- rotina: chama a função shiori-tick a cada 30 min (catálogo da liga + avisos)
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule('shiori-tick') where exists (select 1 from cron.job where jobname = 'shiori-tick');
select cron.schedule(
  'shiori-tick',
  '*/30 * * * *',
  $$ select net.http_post(
       url := 'https://ahtalxodwxzmjltbxmaz.supabase.co/functions/v1/shiori-tick',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     ) $$
);
