-- Proteções contra robôs e spam automatizado (nov/2026)

-- Conta criada há menos de 24 h não manda link (tática clássica de bot de spam)
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

-- Watch party: ninguém finge mensagem do sistema; links bloqueados pra conta nova
create or replace function public.party_messages_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if new.kind <> 'msg' and coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  new.created_at := now();
  new.body := btrim(new.body);
  if new.kind = 'msg' and public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if public.blocks_new_account_link(new.user_id, new.body) then raise exception 'new_account_links' using errcode = 'P0001'; end if;
  select count(*) into recent from public.party_messages
    where user_id = new.user_id and created_at > now() - interval '8 seconds';
  if recent >= 6 then raise exception 'slow_down' using errcode = 'P0001'; end if;
  return new;
end $$;

-- Curtidas: limite contra robô de curtir/descurtir em loop
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

-- Seguir: no máximo 20 por minuto e 300 por dia
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

-- Fotos de perfil: no máximo 6 arquivos por pessoa (o site apaga as antigas sozinho)
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
