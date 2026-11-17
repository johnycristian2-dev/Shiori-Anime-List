-- ═══════════════ v0.14 · Lista automática (a extensão marca episódios assistidos) ═══════════════
-- Atualiza UMA entrada do documento da lista (user_data.doc) sem o app precisar estar aberto.
-- O app mescla por updatedAt, então a mudança chega nos outros aparelhos pelo Realtime.

create or replace function public.scrobble_episode(p_entry jsonb, p_episode int, p_undo jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid int := (p_entry ->> 'mediaId')::int;
  k text;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  d jsonb;
  prev jsonb;
  next jsonb;
  eps int;
  ev jsonb := '[]'::jsonb;
  hist jsonb;
begin
  if uid is null then raise exception 'not_logged' using errcode = 'P0001'; end if;
  if mid is null or mid <= 0 then raise exception 'bad_media' using errcode = 'P0001'; end if;
  k := mid::text;

  insert into public.user_data (user_id, doc) values (uid, '{}'::jsonb) on conflict (user_id) do nothing;
  select doc into d from public.user_data where user_id = uid for update;
  d := coalesce(d, '{}'::jsonb);
  prev := d -> 'entries' -> k;

  -- desfazer: volta a entrada ao que era (ou tira da lista, se não existia)
  if p_undo is not null then
    if jsonb_typeof(p_undo) = 'null' or p_undo = '{}'::jsonb then
      d := jsonb_set(d, '{entries}', coalesce(d -> 'entries', '{}'::jsonb) - k, true);
      d := jsonb_set(d, '{deleted}', coalesce(d -> 'deleted', '{}'::jsonb) || jsonb_build_object(k, now_ms), true);
      next := null;
    else
      next := p_undo || jsonb_build_object('updatedAt', now_ms);
      d := jsonb_set(d, '{entries}', coalesce(d -> 'entries', '{}'::jsonb), true);
      d := jsonb_set(d, array['entries', k], next, true);
    end if;
    update public.user_data set doc = d, device = 'extensao', updated_at = now() where user_id = uid;
    return jsonb_build_object('changed', true, 'entry', next);
  end if;

  if p_episode is null or p_episode < 1 or p_episode > 5000 then raise exception 'bad_episode' using errcode = 'P0001'; end if;
  -- já tinha visto esse (ou um depois)? não mexe
  if prev is not null and coalesce((prev ->> 'progress')::int, 0) >= p_episode then
    return jsonb_build_object('changed', false, 'entry', prev, 'prev', prev);
  end if;

  eps := nullif(coalesce(prev ->> 'episodes', p_entry ->> 'episodes'), '')::int;
  if prev is null then
    next := jsonb_build_object(
      'mediaId', mid,
      'idMal', p_entry -> 'idMal',
      'title', coalesce(p_entry ->> 'title', '???'),
      'titleEnglish', p_entry -> 'titleEnglish',
      'titleNative', p_entry -> 'titleNative',
      'cover', p_entry -> 'cover',
      'color', p_entry -> 'color',
      'format', p_entry -> 'format',
      'episodes', p_entry -> 'episodes',
      'year', p_entry -> 'year',
      'genres', coalesce(p_entry -> 'genres', '[]'::jsonb),
      'averageScore', p_entry -> 'averageScore',
      'status', 'WATCHING',
      'score', 0,
      'progress', p_episode,
      'addedAt', now_ms,
      'updatedAt', now_ms
    );
    ev := ev || jsonb_build_object('m', mid, 't', 'add', 'at', now_ms);
  else
    next := prev || jsonb_build_object('progress', p_episode, 'updatedAt', now_ms,
      'status', case when prev ->> 'status' in ('PLANNING', 'PAUSED', 'DROPPED') then 'WATCHING' else prev ->> 'status' end);
  end if;
  ev := ev || jsonb_build_object('m', mid, 't', 'ep', 'at', now_ms, 'v', p_episode - coalesce((prev ->> 'progress')::int, 0));

  if eps is not null and p_episode >= eps and next ->> 'status' <> 'COMPLETED' then
    next := next || jsonb_build_object('status', 'COMPLETED', 'progress', eps);
    ev := ev || jsonb_build_object('m', mid, 't', 'done', 'at', now_ms);
  end if;

  d := jsonb_set(d, '{entries}', coalesce(d -> 'entries', '{}'::jsonb), true);
  d := jsonb_set(d, array['entries', k], next, true);
  -- histórico (mesmo limite do app)
  hist := coalesce(d -> 'history', '[]'::jsonb) || ev;
  if jsonb_array_length(hist) > 4000 then
    select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into hist
      from jsonb_array_elements(hist) with ordinality as t(x, i)
      where i > jsonb_array_length(hist) - 4000;
  end if;
  d := jsonb_set(d, '{history}', hist, true);

  update public.user_data set doc = d, device = 'extensao', updated_at = now() where user_id = uid;
  return jsonb_build_object('changed', true, 'entry', next, 'prev', prev);
end $$;
revoke all on function public.scrobble_episode(jsonb, int, jsonb) from public, anon;
grant execute on function public.scrobble_episode(jsonb, int, jsonb) to authenticated;
