-- Painel do dono e da moderação (nov/2026)
-- Papéis: dono (user_perks.owner) faz tudo; moderador (public.admins) cuida de conteúdo e denúncias.
-- Tudo que é feito fica registrado em mod_log.

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_perks where user_id = (select auth.uid()) and owner);
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- ───────── registro de ações ─────────
create table if not exists public.mod_log (
  id          bigint generated always as identity primary key,
  actor       uuid references auth.users (id) on delete set null,
  action      text not null,
  target_user uuid,
  target      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists mod_log_created_idx on public.mod_log (created_at desc);
create index if not exists mod_log_target_idx on public.mod_log (target_user);
alter table public.mod_log enable row level security;
drop policy if exists "moderação vê o registro" on public.mod_log;
create policy "moderação vê o registro" on public.mod_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.mod_log from anon, authenticated;

create or replace function public.mod_note(p_action text, p_target_user uuid, p_target text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.mod_log (actor, action, target_user, target, details) values ((select auth.uid()), p_action, p_target_user, p_target, p_details);
$$;
revoke execute on function public.mod_note(text, uuid, text, jsonb) from public, anon, authenticated;

-- ───────── configuração do site (anúncio e pausa) ─────────
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check
  check (key in ('amazon_tag', 'kofi_url', 'apoiase_url', 'payments_on', 'pix_key', 'pix_name', 'pix_city', 'turnstile_site',
                 'announcement', 'announcement_kind', 'community_paused', 'signups_note'));
insert into public.app_config (key, value) values ('announcement', ''), ('announcement_kind', 'info'), ('community_paused', 'false'), ('signups_note', '')
on conflict (key) do nothing;

create or replace function public.community_paused()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true' from public.app_config where key = 'community_paused'), false) and not public.is_admin();
$$;
revoke execute on function public.community_paused() from public, anon, authenticated;

create or replace function public.is_muted(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_mutes where user_id = uid and until > now());
$$;
revoke execute on function public.is_muted(uuid) from public, anon, authenticated;

-- ───────── palavras proibidas (lista editável) ─────────
create table if not exists public.banned_terms (
  term       text primary key check (char_length(term) between 3 and 60),
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.banned_terms enable row level security;
drop policy if exists "moderação vê termos" on public.banned_terms;
create policy "moderação vê termos" on public.banned_terms for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.banned_terms from anon, authenticated;

create or replace function public.has_hate_terms(txt text)
returns boolean language sql stable security definer set search_path = public as $$
  select translate(lower(coalesce(txt, '')), 'áàâãäéèêëíìîïóòôõöúùûüç@413057$', 'aaaaaeeeeiiiiooooouuuucaaieosts')
    ~ '(^|[^a-z])(crioul[oa]s?|viad[oa]s?|traveco|sapatao|nigg(er|a)s?|faggots?|f4gg?ots?|chinks?|tranny|kys)([^a-z]|$)'
  or exists (
    select 1 from public.banned_terms b
    where translate(lower(coalesce(txt, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%' || b.term || '%'
  );
$$;

-- ───────── proteções contra robôs + pausa + silêncio (valem pra chat, posts, comentários e party) ─────────
create or replace function public.blocks_new_account_link(uid uuid, body text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(body, '') ~* '(https?://|www\.|discord\.(gg|com/invite)|t\.me/|bit\.ly|[a-z0-9-]+\.(com|net|org|xyz|io|gg|ly|me|ru|top|link|site|click|shop|info|online|live|store|app|br)(/|\s|$))'
     and exists (select 1 from auth.users u where u.id = uid and u.created_at > now() - interval '24 hours');
$$;
revoke execute on function public.blocks_new_account_link(uuid, text) from public, anon, authenticated;

create or replace function public.chat_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare burst int; minute int; hour int;
begin
  if public.community_paused() then raise exception 'community_paused' using errcode = 'P0001'; end if;
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if public.blocks_new_account_link(new.user_id, new.body) then raise exception 'new_account_links' using errcode = 'P0001'; end if;
  select count(*) filter (where created_at > now() - interval '10 seconds'),
         count(*) filter (where created_at > now() - interval '1 minute'),
         count(*)
    into burst, minute, hour
    from public.chat_messages where user_id = new.user_id and created_at > now() - interval '1 hour';
  if burst >= 5 or minute >= 20 or hour >= 200 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if exists (select 1 from public.chat_messages where user_id = new.user_id and body = new.body and created_at > now() - interval '1 minute') then
    raise exception 'duplicate_message' using errcode = 'P0001';
  end if;
  if new.reply_to is not null and not exists (select 1 from public.chat_messages where id = new.reply_to and room_id = new.room_id) then
    new.reply_to := null;
  end if;
  new.hidden := false;
  new.created_at := now();
  return new;
end $$;

create or replace function public.comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare minute int; hour int;
begin
  if public.community_paused() then raise exception 'community_paused' using errcode = 'P0001'; end if;
  if public.is_muted(new.user_id) then raise exception 'muted' using errcode = 'P0001'; end if;
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if public.blocks_new_account_link(new.user_id, new.body) then raise exception 'new_account_links' using errcode = 'P0001'; end if;
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into minute, hour
    from public.post_comments where user_id = new.user_id and created_at > now() - interval '1 hour';
  if minute >= 10 or hour >= 60 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if exists (select 1 from public.post_comments where user_id = new.user_id and body = new.body and created_at > now() - interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  new.hidden := false; new.created_at := now();
  return new;
end $$;

create or replace function public.posts_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare minute int; hour int;
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' and public.community_paused() then raise exception 'community_paused' using errcode = 'P0001'; end if;
  if tg_op = 'INSERT' and public.is_muted(new.user_id) then raise exception 'muted' using errcode = 'P0001'; end if;
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if public.blocks_new_account_link(new.user_id, new.body) then raise exception 'new_account_links' using errcode = 'P0001'; end if;
  if new.media is not null and octet_length(new.media::text) > 2000 then raise exception 'media too large'; end if;
  if tg_op = 'INSERT' then
    select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into minute, hour
      from public.posts where user_id = new.user_id and created_at > now() - interval '1 hour';
    if minute >= 6 or hour >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
    new.like_count := 0; new.comment_count := 0; new.hidden := false; new.created_at := now();
  else
    new.like_count := old.like_count; new.comment_count := old.comment_count;
    if not public.is_admin() then new.hidden := old.hidden; end if;
    new.user_id := old.user_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.party_messages_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if new.kind <> 'msg' and coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if public.community_paused() then raise exception 'community_paused' using errcode = 'P0001'; end if;
  if public.is_muted(new.user_id) then raise exception 'muted' using errcode = 'P0001'; end if;
  new.created_at := now();
  new.body := btrim(new.body);
  if new.kind = 'msg' and public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if public.blocks_new_account_link(new.user_id, new.body) then raise exception 'new_account_links' using errcode = 'P0001'; end if;
  select count(*) into recent from public.party_messages
    where user_id = new.user_id and created_at > now() - interval '8 seconds';
  if recent >= 6 then raise exception 'slow_down' using errcode = 'P0001'; end if;
  return new;
end $$;

create or replace function public.likes_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.post_likes where user_id = new.user_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'like_rate' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.likes_before_insert() from public, anon, authenticated;
drop trigger if exists likes_before_insert on public.post_likes;
create trigger likes_before_insert before insert on public.post_likes for each row execute function public.likes_before_insert();

create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare open_profile boolean; minute int; day int;
begin
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into minute, day
    from public.follows where follower = new.follower and created_at > now() - interval '1 day';
  if minute >= 20 or day >= 300 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select coalesce(p.is_public, false) into open_profile from public.profiles p where p.user_id = new.followee;
  if open_profile and not public.is_minor(new.followee) then new.status := 'accepted'; else new.status := 'pending'; end if;
  new.created_at := now();
  return new;
end $$;

create or replace function public.my_image_count()
returns integer language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'profile-images' and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;
revoke execute on function public.my_image_count() from public, anon;
grant execute on function public.my_image_count() to authenticated;
drop policy if exists "enviar a própria imagem" on storage.objects;
create policy "enviar a própria imagem" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.my_image_count() < 6);

-- ───────── visão geral ─────────
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    'users_24h', (select count(*) from auth.users where created_at > now() - interval '24 hours' and not coalesce(is_anonymous, false)),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days' and not coalesce(is_anonymous, false)),
    'active_24h', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'active_lists_7d', (select count(*) from public.user_data where updated_at > now() - interval '7 days'),
    'public_profiles', (select count(*) from public.profiles where is_public),
    'banned', (select count(*) from auth.users where banned_until > now()),
    'muted', (select count(*) from public.chat_mutes where until > now()),
    'posts_24h', (select count(*) from public.posts where created_at > now() - interval '24 hours'),
    'comments_24h', (select count(*) from public.post_comments where created_at > now() - interval '24 hours'),
    'chat_24h', (select count(*) from public.chat_messages where created_at > now() - interval '24 hours'),
    'games_today', (select count(*) from public.game_scores where day = public.br_today()),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'bugs_open', (select count(*) from public.bug_reports where status = 'open'),
    'plus_active', (select count(*) from public.user_perks where plus_until > now()),
    'supporters', (select count(*) from public.user_perks where supporter_since is not null),
    'revenue_month_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'approved' and approved_at >= date_trunc('month', now())),
    'revenue_total_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'approved'),
    'paused', (select value = 'true' from public.app_config where key = 'community_paused'),
    'signups_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb) from (
        select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from auth.users
        where created_at > now() - interval '14 days' and not coalesce(is_anonymous, false) group by 1) s)
  );
end $$;

-- ───────── usuários ─────────
create or replace function public.admin_search_users(q text, p_filter text default 'all')
returns table (user_id uuid, email text, username text, display_name text, avatar_url text, created_at timestamptz,
               last_sign_in_at timestamptz, banned_until timestamptz, muted_until timestamptz, minor boolean, is_mod boolean,
               owner boolean, plus_until timestamptz, supporter boolean, reports_against int, is_public boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  return query
  select u.id,
         case when public.is_owner() then u.email::text end,
         p.username, p.display_name, p.avatar_url, u.created_at, u.last_sign_in_at, u.banned_until,
         (select m.until from public.chat_mutes m where m.user_id = u.id and m.until > now()),
         public.is_minor(u.id),
         exists (select 1 from public.admins a where a.user_id = u.id),
         coalesce(k.owner, false), k.plus_until, k.supporter_since is not null,
         (select count(*)::int from public.reports r where r.target_user = u.id),
         coalesce(p.is_public, false)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.user_perks k on k.user_id = u.id
  where not coalesce(u.is_anonymous, false)
    and (coalesce(trim(q), '') = ''
         or p.username ilike '%' || trim(q) || '%'
         or p.display_name ilike '%' || trim(q) || '%'
         or (public.is_owner() and u.email ilike '%' || trim(q) || '%')
         or u.id::text = trim(q))
    and (p_filter = 'all'
         or (p_filter = 'new' and u.created_at > now() - interval '7 days')
         or (p_filter = 'reported' and exists (select 1 from public.reports r where r.target_user = u.id and r.status = 'open'))
         or (p_filter = 'banned' and u.banned_until > now())
         or (p_filter = 'muted' and exists (select 1 from public.chat_mutes m where m.user_id = u.id and m.until > now()))
         or (p_filter = 'staff' and (exists (select 1 from public.admins a where a.user_id = u.id) or coalesce(k.owner, false)))
         or (p_filter = 'plus' and (k.plus_until > now() or k.supporter_since is not null)))
  order by u.created_at desc
  limit 60;
end $$;

create or replace function public.admin_user_activity(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'posts', (select count(*) from public.posts where user_id = p_user),
    'comments', (select count(*) from public.post_comments where user_id = p_user),
    'messages', (select count(*) from public.chat_messages where user_id = p_user),
    'followers', (select count(*) from public.follows where followee = p_user and status = 'accepted'),
    'following', (select count(*) from public.follows where follower = p_user and status = 'accepted'),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'reason', reason, 'details', details, 'status', status, 'at', created_at) order by created_at desc), '[]'::jsonb)
                from (select * from public.reports where target_user = p_user order by created_at desc limit 20) r),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('action', action, 'details', details, 'at', created_at) order by created_at desc), '[]'::jsonb)
            from (select * from public.mod_log where target_user = p_user order by created_at desc limit 20) l),
    'recent', (select coalesce(jsonb_agg(x order by (x ->> 'at') desc), '[]'::jsonb) from (
        (select jsonb_build_object('kind', 'post', 'id', id, 'body', left(body, 300), 'hidden', hidden, 'at', created_at) x from public.posts where user_id = p_user order by created_at desc limit 10)
        union all
        (select jsonb_build_object('kind', 'comment', 'id', id, 'body', left(body, 300), 'hidden', hidden, 'at', created_at) from public.post_comments where user_id = p_user order by created_at desc limit 10)
        union all
        (select jsonb_build_object('kind', 'message', 'id', id, 'body', left(body, 300), 'hidden', hidden, 'at', created_at, 'room', room_id) from public.chat_messages where user_id = p_user order by created_at desc limit 10)
      ) t)
  );
end $$;

create or replace function public.admin_mute(p_user uuid, p_hours int, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.user_perks where user_id = p_user and owner) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_hours <= 0 then
    delete from public.chat_mutes where user_id = p_user;
    perform public.mod_note('unmute', p_user, null, null);
  else
    insert into public.chat_mutes (user_id, until, reason) values (p_user, now() + make_interval(hours => least(p_hours, 24 * 365)), left(p_reason, 200))
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_at = now();
    perform public.mod_note('mute', p_user, null, jsonb_build_object('hours', p_hours, 'reason', p_reason));
  end if;
end $$;

create or replace function public.admin_reset_profile(p_user uuid, p_fields text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.profiles set
    avatar_url   = case when 'avatar' = any (p_fields) then null else avatar_url end,
    banner_url   = case when 'banner' = any (p_fields) then null else banner_url end,
    bio          = case when 'bio' = any (p_fields) then null else bio end,
    display_name = case when 'name' = any (p_fields) then null else display_name end,
    is_public    = case when 'private' = any (p_fields) then false else is_public end,
    updated_at   = now()
  where user_id = p_user;
  perform public.mod_note('reset_profile', p_user, null, jsonb_build_object('fields', p_fields));
end $$;

create or replace function public.admin_rename(p_user uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.profiles set username = lower(trim(p_username)), updated_at = now() where user_id = p_user;
  perform public.mod_note('rename', p_user, null, jsonb_build_object('username', lower(trim(p_username))));
end $$;

create or replace function public.admin_purge_content(p_user uuid, p_hours int default 24)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; since timestamptz := now() - make_interval(hours => greatest(1, least(p_hours, 24 * 365)));
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  delete from public.chat_messages where user_id = p_user and created_at > since; get diagnostics a = row_count;
  delete from public.post_comments where user_id = p_user and created_at > since; get diagnostics b = row_count;
  delete from public.posts where user_id = p_user and created_at > since; get diagnostics c = row_count;
  perform public.mod_note('purge', p_user, null, jsonb_build_object('hours', p_hours, 'messages', a, 'comments', b, 'posts', c));
  return jsonb_build_object('messages', a, 'comments', b, 'posts', c);
end $$;

-- só o dono
create or replace function public.owner_set_moderator(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner_only' using errcode = 'P0001'; end if;
  if p_on then insert into public.admins (user_id) values (p_user) on conflict do nothing;
  elsif p_user <> (select auth.uid()) then delete from public.admins where user_id = p_user;
  end if;
  perform public.mod_note(case when p_on then 'add_mod' else 'remove_mod' end, p_user, null, null);
end $$;

create or replace function public.owner_grant_plus(p_user uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner_only' using errcode = 'P0001'; end if;
  if p_days <= 0 then
    update public.user_perks set plus_until = null, banner = case when owner then banner end, updated_at = now() where user_id = p_user;
  else
    insert into public.user_perks (user_id, plus_until) values (p_user, now() + make_interval(days => least(p_days, 3650)))
    on conflict (user_id) do update set plus_until = greatest(coalesce(user_perks.plus_until, now()), now()) + make_interval(days => least(p_days, 3650)), updated_at = now();
  end if;
  perform public.mod_note('plus', p_user, null, jsonb_build_object('days', p_days));
end $$;

create or replace function public.owner_set_supporter(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'owner_only' using errcode = 'P0001'; end if;
  insert into public.user_perks (user_id, supporter_since) values (p_user, case when p_on then now() end)
  on conflict (user_id) do update set supporter_since = case when p_on then coalesce(user_perks.supporter_since, now()) end, updated_at = now();
  perform public.mod_note(case when p_on then 'add_supporter' else 'remove_supporter' end, p_user, null, null);
end $$;

-- ───────── conteúdo recente ─────────
create or replace function public.admin_recent_content(p_kind text, q text default '', p_hidden boolean default null)
returns table (kind text, id bigint, user_id uuid, username text, body text, hidden boolean, created_at timestamptz, place text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  return query
  select * from (
    select 'post'::text, p.id, p.user_id, pr.username, p.body, p.hidden, p.created_at, coalesce(p.media ->> 'title', p.kind)
      from public.posts p left join public.profiles pr on pr.user_id = p.user_id where p_kind in ('all', 'post')
    union all
    select 'comment', c.id, c.user_id, pr.username, c.body, c.hidden, c.created_at, 'post #' || c.post_id
      from public.post_comments c left join public.profiles pr on pr.user_id = c.user_id where p_kind in ('all', 'comment')
    union all
    select 'message', m.id, m.user_id, pr.username, m.body, m.hidden, m.created_at, m.room_id
      from public.chat_messages m left join public.profiles pr on pr.user_id = m.user_id where p_kind in ('all', 'message')
  ) t(kind, id, user_id, username, body, hidden, created_at, place)
  where (coalesce(trim(q), '') = '' or t.body ilike '%' || trim(q) || '%' or t.username ilike '%' || trim(q) || '%')
    and (p_hidden is null or t.hidden = p_hidden)
  order by t.created_at desc
  limit 80;
end $$;

create or replace function public.admin_content(p_kind text, p_id bigint, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_kind = 'post' then
    select user_id into owner_id from public.posts where id = p_id;
    if p_action = 'delete' then delete from public.posts where id = p_id;
    else update public.posts set hidden = (p_action = 'hide') where id = p_id; end if;
  elsif p_kind = 'comment' then
    select user_id into owner_id from public.post_comments where id = p_id;
    if p_action = 'delete' then delete from public.post_comments where id = p_id;
    else update public.post_comments set hidden = (p_action = 'hide') where id = p_id; end if;
  elsif p_kind = 'message' then
    select user_id into owner_id from public.chat_messages where id = p_id;
    if p_action = 'delete' then delete from public.chat_messages where id = p_id;
    else update public.chat_messages set hidden = (p_action = 'hide') where id = p_id; end if;
  else raise exception 'bad_kind' using errcode = 'P0001';
  end if;
  perform public.mod_note(p_action || '_' || p_kind, owner_id, p_id::text, null);
end $$;

-- ───────── palavras proibidas ─────────
create or replace function public.admin_term(p_term text, p_add boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t text := translate(lower(trim(p_term)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_add then insert into public.banned_terms (term, added_by) values (t, (select auth.uid())) on conflict do nothing;
  else delete from public.banned_terms where term = t; end if;
  perform public.mod_note(case when p_add then 'add_term' else 'remove_term' end, null, t, null);
end $$;

-- configuração do site com registro (anúncio, pausa)
create or replace function public.admin_set_site(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_key not in ('announcement', 'announcement_kind', 'community_paused', 'signups_note') then raise exception 'bad_key' using errcode = 'P0001'; end if;
  insert into public.app_config (key, value) values (p_key, left(coalesce(p_value, ''), 500))
  on conflict (key) do update set value = excluded.value;
  perform public.mod_note('site_' || p_key, null, left(p_value, 120), null);
end $$;

-- grants
revoke execute on function public.admin_stats(), public.admin_search_users(text, text), public.admin_user_activity(uuid),
  public.admin_mute(uuid, int, text), public.admin_reset_profile(uuid, text[]), public.admin_rename(uuid, text),
  public.admin_purge_content(uuid, int), public.owner_set_moderator(uuid, boolean), public.owner_grant_plus(uuid, int),
  public.owner_set_supporter(uuid, boolean), public.admin_recent_content(text, text, boolean), public.admin_content(text, bigint, text),
  public.admin_term(text, boolean), public.admin_set_site(text, text) from public, anon;
grant execute on function public.admin_stats(), public.admin_search_users(text, text), public.admin_user_activity(uuid),
  public.admin_mute(uuid, int, text), public.admin_reset_profile(uuid, text[]), public.admin_rename(uuid, text),
  public.admin_purge_content(uuid, int), public.owner_set_moderator(uuid, boolean), public.owner_grant_plus(uuid, int),
  public.owner_set_supporter(uuid, boolean), public.admin_recent_content(text, text, boolean), public.admin_content(text, bigint, text),
  public.admin_term(text, boolean), public.admin_set_site(text, text) to authenticated;

-- encerra as sessões de quem foi banido (só a função do servidor chama)
create or replace function public.admin_signout_user(p_user uuid)
returns void language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where user_id = p_user;
$$;
revoke execute on function public.admin_signout_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_signout_user(uuid) to service_role;
