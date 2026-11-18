-- Apoio, Shiori+, afiliados e reporte de bugs.
-- Tudo que dá vantagem (selo, Shiori+) só muda pelo servidor (função de pagamento ou admin).

-- Selos e vantagens de cada pessoa. Leitura pública (os selos aparecem pra todo mundo).
create table if not exists public.user_perks (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  owner           boolean not null default false,
  supporter_since timestamptz,
  donated_cents   integer not null default 0,
  plus_until      timestamptz,
  banner          text check (banner is null or banner in ('aurora', 'sakura', 'neon', 'ouro', 'galaxia')),
  updated_at      timestamptz not null default now()
);
alter table public.user_perks enable row level security;
drop policy if exists "selos são públicos" on public.user_perks;
create policy "selos são públicos" on public.user_perks for select to anon, authenticated using (true);
revoke insert, update, delete on public.user_perks from anon, authenticated;

create or replace function public.is_plus(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_perks where user_id = uid and (owner or plus_until > now()));
$$;
grant execute on function public.is_plus(uuid) to anon, authenticated;

-- Banner animado: só quem tem Shiori+ escolhe.
create or replace function public.set_banner(p_banner text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_plus((select auth.uid())) then raise exception 'plus_only' using errcode = 'P0001'; end if;
  insert into public.user_perks (user_id, banner) values ((select auth.uid()), p_banner)
  on conflict (user_id) do update set banner = excluded.banner, updated_at = now();
end $$;
revoke execute on function public.set_banner(text) from public, anon;
grant execute on function public.set_banner(text) to authenticated;

-- Configuração pública do site (tag de afiliado, links de apoio). Só admin muda.
create table if not exists public.app_config (
  key   text primary key check (key in ('amazon_tag', 'kofi_url', 'apoiase_url', 'payments_on')),
  value text not null default ''
);
alter table public.app_config enable row level security;
drop policy if exists "config é pública" on public.app_config;
create policy "config é pública" on public.app_config for select to anon, authenticated using (true);
drop policy if exists "admin muda config" on public.app_config;
create policy "admin muda config" on public.app_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.app_config (key, value) values ('amazon_tag', ''), ('kofi_url', ''), ('apoiase_url', ''), ('payments_on', 'false')
on conflict (key) do nothing;

-- Pagamentos via Pix (Mercado Pago). Criados e confirmados só pelas funções do servidor.
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('plus', 'donation')),
  months        integer,
  amount_cents  integer not null check (amount_cents between 100 and 100000),
  status        text not null default 'pending',
  mp_payment_id bigint unique,
  qr_code       text,
  qr_base64     text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
drop policy if exists "ver meus pagamentos" on public.payments;
create policy "ver meus pagamentos" on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete on public.payments from anon, authenticated;

-- Aplica o pagamento aprovado (chamada só pela função do webhook, com service_role).
create or replace function public.apply_payment(p_id uuid, p_mp_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  select * into pay from public.payments where id = p_id for update;
  if not found then return 'not_found'; end if;
  if pay.status = 'approved' then return 'already'; end if;
  update public.payments set status = 'approved', approved_at = now(), mp_payment_id = coalesce(mp_payment_id, p_mp_id) where id = p_id;
  if pay.kind = 'plus' then
    insert into public.user_perks (user_id, plus_until) values (pay.user_id, now() + make_interval(days => 30 * pay.months))
    on conflict (user_id) do update set
      plus_until = greatest(coalesce(user_perks.plus_until, now()), now()) + make_interval(days => 30 * pay.months),
      updated_at = now();
  else
    insert into public.user_perks (user_id, supporter_since, donated_cents) values (pay.user_id, now(), pay.amount_cents)
    on conflict (user_id) do update set
      supporter_since = coalesce(user_perks.supporter_since, now()),
      donated_cents = user_perks.donated_cents + pay.amount_cents,
      updated_at = now();
  end if;
  return 'ok';
end $$;
revoke execute on function public.apply_payment(uuid, bigint) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, bigint) to service_role;

-- Reporte de bugs e sugestões.
create table if not exists public.bug_reports (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null check (kind in ('bug', 'ideia', 'outro')),
  message    text not null check (char_length(message) between 5 and 2000),
  page       text check (char_length(page) <= 300),
  device     text check (char_length(device) <= 300),
  status     text not null default 'open' check (status in ('open', 'doing', 'done', 'dismissed')),
  reply      text check (char_length(reply) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists bug_reports_user_idx on public.bug_reports (user_id);
create index if not exists bug_reports_status_idx on public.bug_reports (status, created_at desc);
alter table public.bug_reports enable row level security;
drop policy if exists "reportar bug" on public.bug_reports;
create policy "reportar bug" on public.bug_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and reply is null);
drop policy if exists "ver meus reportes" on public.bug_reports;
create policy "ver meus reportes" on public.bug_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "admin responde" on public.bug_reports;
create policy "admin responde" on public.bug_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.bug_flood_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.bug_reports where user_id = new.user_id and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.bug_flood_guard() from public, anon, authenticated;
drop trigger if exists bug_flood on public.bug_reports;
create trigger bug_flood before insert on public.bug_reports for each row execute function public.bug_flood_guard();

-- Liga: dono com Shiori+ ganha liga de até 60 pessoas (normal: 30).
create or replace function public.join_league(p_code text, p_my_name text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l public.leagues;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  select * into l from leagues where code = upper(btrim(p_code));
  if l.id is null then raise exception 'no_league' using errcode = 'P0001'; end if;
  if (select count(*) from league_members where league_id = l.id) >= (case when public.is_plus(l.owner) then 60 else 30 end) then
    raise exception 'league_full' using errcode = 'P0001';
  end if;
  insert into league_members (league_id, user_id, name)
    values (l.id, uid, left(btrim(coalesce(nullif(p_my_name, ''), 'Otaku')), 24))
    on conflict (league_id, user_id) do nothing;
  return l;
end $$;

-- Tag de dono: insert into public.user_perks (user_id, owner) select user_id, true from public.profiles where username = 'SEU_APELIDO'
--   on conflict (user_id) do update set owner = true;

-- ===== Reembolso automático e Pix direto do banco =====
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check
  check (key in ('amazon_tag', 'kofi_url', 'apoiase_url', 'payments_on', 'pix_key', 'pix_name', 'pix_city'));
insert into public.app_config (key, value) values ('pix_key', ''), ('pix_name', ''), ('pix_city', '') on conflict (key) do nothing;

alter table public.payments add column if not exists refunded_at timestamptz;

-- Desfaz o que um pagamento deu (chamada só pelo servidor quando o Pix é devolvido).
create or replace function public.revoke_payment(p_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  select * into pay from public.payments where id = p_id for update;
  if not found then return 'not_found'; end if;
  if pay.status <> 'approved' then
    update public.payments set status = p_status where id = p_id and status = 'pending';
    return 'not_approved';
  end if;
  update public.payments set status = p_status, refunded_at = now() where id = p_id;
  if pay.kind = 'plus' then
    update public.user_perks set
      plus_until = case when plus_until - make_interval(days => 30 * pay.months) > now() then plus_until - make_interval(days => 30 * pay.months) else null end,
      banner = case when owner or plus_until - make_interval(days => 30 * pay.months) > now() then banner else null end,
      updated_at = now()
    where user_id = pay.user_id;
  else
    update public.user_perks set
      donated_cents = greatest(0, donated_cents - pay.amount_cents),
      supporter_since = case when donated_cents - pay.amount_cents > 0 then supporter_since else null end,
      updated_at = now()
    where user_id = pay.user_id;
  end if;
  return 'ok';
end $$;
revoke execute on function public.revoke_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_payment(uuid, text) to service_role;

-- Chave pública do Cloudflare Turnstile (anti-robô no login)
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check
  check (key in ('amazon_tag', 'kofi_url', 'apoiase_url', 'payments_on', 'pix_key', 'pix_name', 'pix_city', 'turnstile_site'));
insert into public.app_config (key, value) values ('turnstile_site', '') on conflict (key) do nothing;
