-- ═══════════════ v0.30 · Erros do site + avisos para a equipe ═══════════════

-- ─── 1) Erros que acontecem no navegador das pessoas ───
-- Erros iguais (mesma mensagem + lugar) viram uma linha só com contador, pra não lotar a tabela.
create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  sig        text not null unique,
  message    text not null,
  stack      text,
  page       text,
  device     text,
  version    text,
  count      integer not null default 1,
  users      integer not null default 1,
  last_user  uuid,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  resolved   boolean not null default false
);
create index if not exists client_errors_last_idx on public.client_errors (resolved, last_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

-- limite global por minuto, contra quem tentar encher a tabela
create table if not exists public.client_error_rate (
  minute timestamptz primary key,
  n      integer not null default 0
);
alter table public.client_error_rate enable row level security;
revoke all on public.client_error_rate from anon, authenticated;

create or replace function public.log_client_error(p_message text, p_stack text, p_page text, p_device text, p_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  m text := left(coalesce(nullif(trim(p_message), ''), 'erro sem mensagem'), 500);
  s text := left(p_stack, 3000);
  k text;
  n integer;
  me uuid := auth.uid();
begin
  insert into public.client_error_rate (minute, n) values (date_trunc('minute', now()), 1)
    on conflict (minute) do update set n = client_error_rate.n + 1 returning client_error_rate.n into n;
  if n > 120 then return; end if;
  -- a assinatura ignora números (ids, posições) pra juntar o mesmo erro
  k := md5(regexp_replace(m || '|' || coalesce(split_part(s, E'\n', 2), ''), '[0-9]+', '#', 'g'));
  insert into public.client_errors (sig, message, stack, page, device, version, last_user)
  values (k, m, s, left(p_page, 300), left(p_device, 300), left(p_version, 40), me)
  on conflict (sig) do update set
    count = client_errors.count + 1,
    users = client_errors.users + (case when me is distinct from client_errors.last_user then 1 else 0 end),
    last_user = coalesce(me, client_errors.last_user),
    page = excluded.page, device = excluded.device, version = excluded.version,
    stack = coalesce(excluded.stack, client_errors.stack),
    last_at = now(),
    resolved = false;
end $$;
revoke all on function public.log_client_error(text, text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_client_errors(p_resolved boolean default false)
returns setof public.client_errors language sql stable security definer set search_path = public as $$
  select * from public.client_errors where public.is_admin() and resolved = p_resolved order by last_at desc limit 200;
$$;
revoke all on function public.admin_client_errors(boolean) from public, anon;
grant execute on function public.admin_client_errors(boolean) to authenticated;

create or replace function public.admin_resolve_error(p_id bigint, p_all boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_all then update public.client_errors set resolved = true where not resolved;
  else update public.client_errors set resolved = true where id = p_id; end if;
end $$;
revoke all on function public.admin_resolve_error(bigint, boolean) from public, anon;
grant execute on function public.admin_resolve_error(bigint, boolean) to authenticated;

-- ─── 2) Avisos no celular da equipe (denúncia, bug, pagamento) ───
alter table public.push_subscriptions add column if not exists staff boolean not null default false;

create or replace function public.set_staff_alerts(p_endpoint text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.push_subscriptions set staff = p_on where endpoint = p_endpoint and user_id = auth.uid();
  return found;
end $$;
revoke all on function public.set_staff_alerts(text, boolean) from public, anon;
grant execute on function public.set_staff_alerts(text, boolean) to authenticated;

create or replace function public.my_staff_alerts(p_endpoint text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select staff from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()), false);
$$;
grant execute on function public.my_staff_alerts(text) to authenticated;

-- segredo compartilhado entre o banco e a função que manda os avisos
insert into public.app_secrets (name, value)
values ('staff_hook_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

create or replace function public.notify_staff(p_kind text, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  select value into sec from public.app_secrets where name = 'staff_hook_secret';
  if sec is null then return; end if;
  if not exists (select 1 from public.push_subscriptions where staff) then return; end if;
  perform net.http_post(
    url := 'https://ahtalxodwxzmjltbxmaz.supabase.co/functions/v1/shiori-staff-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-shiori-hook', sec),
    body := jsonb_build_object('kind', p_kind, 'title', p_title, 'body', left(p_body, 180), 'url', p_url)
  );
exception when others then
  null; -- um aviso que falhou nunca pode travar a denúncia/bug/pagamento
end $$;
revoke all on function public.notify_staff(text, text, text, text) from public, anon, authenticated;

create or replace function public.trg_staff_report() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff('report', 'Nova denúncia',
    new.reason || ' · ' || new.target_kind || coalesce(' — ' || new.details, ''), '/moderacao?tab=reports');
  return new;
end $$;
drop trigger if exists staff_report on public.reports;
create trigger staff_report after insert on public.reports for each row execute function public.trg_staff_report();

create or replace function public.trg_staff_bug() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff('bug', case new.kind when 'bug' then 'Novo bug' when 'ideia' then 'Nova ideia' else 'Novo feedback' end,
    new.message, '/moderacao?tab=bugs');
  return new;
end $$;
drop trigger if exists staff_bug on public.bug_reports;
create trigger staff_bug after insert on public.bug_reports for each row execute function public.trg_staff_bug();

create or replace function public.trg_staff_payment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.notify_staff('payment',
      case new.kind when 'plus' then 'Nova assinatura Shiori+' else 'Nova doação' end,
      'R$ ' || to_char(new.amount_cents / 100.0, 'FM999990D00') || coalesce(' · ' || new.months || ' mês(es)', ''),
      '/moderacao');
  end if;
  return new;
end $$;
drop trigger if exists staff_payment on public.payments;
create trigger staff_payment after update of status on public.payments for each row execute function public.trg_staff_payment();

-- limpeza: erros resolvidos há mais de 30 dias e contadores por minuto antigos
select cron.unschedule('shiori-ops-cleanup') where exists (select 1 from cron.job where jobname = 'shiori-ops-cleanup');
select cron.schedule('shiori-ops-cleanup', '17 4 * * *', $$
  delete from public.client_errors where resolved and last_at < now() - interval '30 days';
  delete from public.client_errors where last_at < now() - interval '90 days';
  delete from public.client_error_rate where minute < now() - interval '1 day';
$$);
