-- ═══════════════ v0.10 · Posts, reviews, reações, curtidas e comentários ═══════════════
-- Rode depois do social.sql. Idempotente.

-- Quem pode ver o conteúdo de uma pessoa: você mesmo, perfis públicos (de adultos)
-- ou quem você segue (aceito) — e nunca se um bloqueou o outro.
create or replace function public.can_see_user(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
    or public.is_admin()
    or (
      not exists (select 1 from public.blocks b where auth.uid() is not null and ((b.blocker = uid and b.blocked = auth.uid()) or (b.blocker = auth.uid() and b.blocked = uid)))
      and (
        (public.profile_is_public(uid) and not public.is_minor(uid))
        or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = uid and f.status = 'accepted')
      )
    );
$$;
grant execute on function public.can_see_user(uuid) to anon, authenticated;

-- Termos graves (ofensas de ódio) são recusados no servidor; palavrões comuns só são mascarados no app.
create or replace function public.has_hate_terms(txt text)
returns boolean language sql immutable set search_path = public as $$
  select translate(lower(coalesce(txt, '')), 'áàâãäéèêëíìîïóòôõöúùûüç@413057$', 'aaaaaeeeeiiiiooooouuuucaaieosts')
    ~ '(^|[^a-z])(crioul[oa]s?|viad[oa]s?|traveco|sapatao|nigg(er|a)s?|faggots?|f4gg?ots?|chinks?|tranny|kys)([^a-z]|$)';
$$;
grant execute on function public.has_hate_terms(text) to anon, authenticated;

create table if not exists public.posts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('review', 'post', 'reaction')),
  media_id      int,
  media         jsonb,
  body          text not null check (char_length(trim(body)) between 1 and 2000),
  score         int check (score is null or score between 1 and 10),
  spoiler       boolean not null default false,
  episode       int check (episode is null or episode between 0 and 100000),
  like_count    int not null default 0,
  comment_count int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (kind <> 'review' or (media_id is not null and score is not null)),
  check (kind <> 'reaction' or (media_id is not null and episode is not null))
);
create index if not exists posts_media_idx on public.posts (media_id, created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
-- uma review por pessoa por título (editar substitui)
create unique index if not exists posts_one_review on public.posts (user_id, media_id) where kind = 'review';
alter table public.posts enable row level security;

drop policy if exists "ver posts" on public.posts;
create policy "ver posts" on public.posts for select using (
  (not hidden or user_id = auth.uid() or public.is_admin()) and public.can_see_user(user_id)
);
drop policy if exists "postar" on public.posts;
create policy "postar" on public.posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "editar meu post" on public.posts;
create policy "editar meu post" on public.posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "apagar post" on public.posts;
create policy "apagar post" on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.posts_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  -- Atualização vinda dos gatilhos de curtida/comentário (contadores): deixa passar
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  if new.media is not null and octet_length(new.media::text) > 2000 then raise exception 'media too large'; end if;
  if tg_op = 'INSERT' then
    select count(*) into recent from public.posts where user_id = new.user_id and created_at > now() - interval '1 minute';
    if recent >= 6 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
    new.like_count := 0; new.comment_count := 0; new.hidden := false; new.created_at := now();
  else
    -- dono não mexe em contadores nem em "oculto"; só o moderador oculta
    new.like_count := old.like_count; new.comment_count := old.comment_count;
    if not public.is_admin() then new.hidden := old.hidden; end if;
    new.user_id := old.user_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists posts_before_write on public.posts;
create trigger posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

-- ───── Curtidas ─────
create table if not exists public.post_likes (
  post_id    bigint not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

create or replace function public.can_see_post(pid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.posts p where p.id = pid and (not p.hidden or p.user_id = auth.uid() or public.is_admin()) and public.can_see_user(p.user_id));
$$;
grant execute on function public.can_see_post(bigint) to anon, authenticated;

drop policy if exists "ver curtidas" on public.post_likes;
create policy "ver curtidas" on public.post_likes for select using (public.can_see_post(post_id));
drop policy if exists "curtir" on public.post_likes;
create policy "curtir" on public.post_likes for insert to authenticated with check (
  user_id = auth.uid() and public.can_see_post(post_id)
  and not exists (select 1 from public.posts p where p.id = post_id and public.is_blocked_between(p.user_id, auth.uid()))
);
drop policy if exists "descurtir" on public.post_likes;
create policy "descurtir" on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- ───── Comentários ─────
create table if not exists public.post_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 500),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists "ver comentários" on public.post_comments;
create policy "ver comentários" on public.post_comments for select using (
  (not hidden or user_id = auth.uid() or public.is_admin()) and public.can_see_post(post_id) and public.can_see_user(user_id)
);
drop policy if exists "comentar" on public.post_comments;
create policy "comentar" on public.post_comments for insert to authenticated with check (
  user_id = auth.uid() and public.can_see_post(post_id)
  and not exists (select 1 from public.posts p where p.id = post_id and public.is_blocked_between(p.user_id, auth.uid()))
);
drop policy if exists "apagar comentário" on public.post_comments;
create policy "apagar comentário" on public.post_comments for delete to authenticated using (
  user_id = auth.uid() or public.is_admin() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
);
drop policy if exists "moderar comentário" on public.post_comments;
create policy "moderar comentário" on public.post_comments for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if public.has_hate_terms(new.body) then raise exception 'hate_terms' using errcode = 'P0001'; end if;
  select count(*) into recent from public.post_comments where user_id = new.user_id and created_at > now() - interval '1 minute';
  if recent >= 10 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  new.hidden := false; new.created_at := now();
  return new;
end;
$$;
drop trigger if exists comments_before_insert on public.post_comments;
create trigger comments_before_insert before insert on public.post_comments
  for each row execute function public.comments_before_insert();

-- ───── Notificações de curtida e comentário ─────
alter table public.notifications add column if not exists post_id bigint references public.posts (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('follow', 'request', 'accepted', 'like', 'comment'));

-- Contadores + notificação ao dono do post
create or replace function public.likes_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      delete from public.notifications where user_id = owner and actor = new.user_id and kind = 'like' and post_id = new.post_id;
      insert into public.notifications (user_id, actor, kind, post_id) values (owner, new.user_id, 'like', new.post_id);
    end if;
    return new;
  else
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    delete from public.notifications where actor = old.user_id and kind = 'like' and post_id = old.post_id;
    return old;
  end if;
end;
$$;
drop trigger if exists likes_after_change on public.post_likes;
create trigger likes_after_change after insert or delete on public.post_likes
  for each row execute function public.likes_after_change();

create or replace function public.comments_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (user_id, actor, kind, post_id) values (owner, new.user_id, 'comment', new.post_id);
    end if;
    return new;
  else
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;
drop trigger if exists comments_after_change on public.post_comments;
create trigger comments_after_change after insert or delete on public.post_comments
  for each row execute function public.comments_after_change();

-- Denúncia de comentário
alter table public.reports drop constraint if exists reports_target_kind_check;
alter table public.reports add constraint reports_target_kind_check check (target_kind in ('profile', 'activity', 'post', 'comment', 'message'));

revoke execute on function public.posts_before_write() from public, anon, authenticated;
revoke execute on function public.comments_before_insert() from public, anon, authenticated;
revoke execute on function public.likes_after_change() from public, anon, authenticated;
revoke execute on function public.comments_after_change() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_comments') then
    alter publication supabase_realtime add table public.post_comments;
  end if;
end $$;
