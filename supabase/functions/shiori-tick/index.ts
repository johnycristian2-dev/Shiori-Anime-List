// shiori-tick: roda a cada 30 min (pg_cron).
// 1) atualiza o catálogo da temporada (números do AniList pra Liga)
// 2) avisa por push quem está assistindo um anime que acabou de lançar episódio
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = 'BAeVP0bOk-STGixhgCo0-6okrkq_DM8GV0_g_qqcnXug-GExQrIOFq2FsT05-oijRb-6c8FQvKMfzI7zOINfndA';
const SITE = 'https://shiori-anime-list.vercel.app';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let tries = 0; ; tries++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429 && tries < 2) {
      await new Promise((ok) => setTimeout(ok, 6000));
      continue;
    }
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j.data as T;
  }
}

function currentSeason(d = new Date()) {
  const brt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const m = brt.getMonth();
  return { season: ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(m / 3)], year: brt.getFullYear() };
}

async function refreshCatalog() {
  const { season, year } = currentSeason();
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= 3; page++) {
    const d = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: any[] } }>(
      `query($p:Int,$s:MediaSeason,$y:Int){Page(page:$p,perPage:50){pageInfo{hasNextPage}
        media(season:$s,seasonYear:$y,type:ANIME,isAdult:false,format_in:[TV,TV_SHORT,ONA],sort:POPULARITY_DESC){
          id title{romaji english native} coverImage{extraLarge large color} format episodes popularity averageScore status
          nextAiringEpisode{episode airingAt}}}}`,
      { p: page, s: season, y: year }
    );
    for (const m of d.Page.media)
      rows.push({
        media_id: m.id,
        season,
        year,
        title: { r: m.title.romaji, e: m.title.english, n: m.title.native },
        cover: m.coverImage.extraLarge ?? m.coverImage.large,
        color: m.coverImage.color,
        format: m.format,
        episodes: m.episodes,
        popularity: m.popularity ?? 0,
        score: m.averageScore,
        status: m.status,
        next_episode: m.nextAiringEpisode?.episode ?? null,
        next_airing_at: m.nextAiringEpisode ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    if (!d.Page.pageInfo.hasNextPage) break;
    await new Promise((ok) => setTimeout(ok, 800));
  }
  if (rows.length) {
    const { error } = await db.from('season_catalog').upsert(rows);
    if (error) throw error;
  }
  return rows.length;
}

async function sendPushes(since: Date, until: Date) {
  const { data: watching, error } = await db.rpc('watching_for_push');
  if (error) throw error;
  const rows = (watching ?? []) as { user_id: string; media_id: number; progress: number }[];
  if (!rows.length) return 0;
  const ids = [...new Set(rows.map((r) => r.media_id))];
  const aired: { mediaId: number; episode: number; media: any }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await gql<{ Page: { airingSchedules: any[] } }>(
      `query($ids:[Int],$a:Int,$b:Int){Page(perPage:50){airingSchedules(mediaId_in:$ids,airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){
        mediaId episode media{title{romaji english} coverImage{large} episodes}}}}`,
      { ids: ids.slice(i, i + 50), a: Math.floor(since.getTime() / 1000), b: Math.floor(until.getTime() / 1000) }
    );
    aired.push(...d.Page.airingSchedules);
  }
  if (!aired.length) return 0;

  const { data: key } = await db.rpc('get_vapid_private');
  if (!key) throw new Error('vapid_private não configurada');
  webpush.setVapidDetails('mailto:shiori@shiori-anime-list.vercel.app', VAPID_PUBLIC, key as string);

  let sent = 0;
  for (const a of aired) {
    const who = rows.filter((r) => r.media_id === a.mediaId && r.progress < a.episode);
    for (const w of who) {
      // marca antes de mandar: se der erro, não fica mandando repetido
      const { error: dup } = await db.from('push_log').insert({ user_id: w.user_id, media_id: a.mediaId, episode: a.episode });
      if (dup) continue;
      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', w.user_id);
      const title = a.media.title.english ?? a.media.title.romaji;
      for (const s of subs ?? []) {
        const pt = (s.lang ?? 'pt') === 'pt';
        const payload = JSON.stringify({
          title: pt ? `Saiu o episódio ${a.episode}!` : `Episode ${a.episode} is out!`,
          body: `${title}${a.media.episodes ? ` · ${a.episode}/${a.media.episodes}` : ''}`,
          icon: a.media.coverImage?.large,
          url: `${SITE}/#/anime/${a.mediaId}`,
          tag: `ep-${a.mediaId}-${a.episode}`,
        });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }
  }
  return sent;
}

Deno.serve(async () => {
  const now = new Date();
  const { data: st } = await db.from('tick_state').select('*').eq('id', 1).maybeSingle();
  const lastRun = st ? new Date(st.last_run) : new Date(0);
  if (now.getTime() - lastRun.getTime() < 10 * 60_000)
    return Response.json({ skipped: true, reason: 'ran recently' });
  await db.from('tick_state').upsert({ id: 1, last_run: now.toISOString() });

  const info: Record<string, unknown> = {};
  try {
    info.catalog = await refreshCatalog();
  } catch (e) {
    info.catalogError = String(e);
  }
  try {
    const since = st?.last_air ? new Date(st.last_air) : new Date(now.getTime() - 3600_000);
    // nunca olha mais que 6h pra trás (se a rotina ficou parada, não manda aviso velho)
    const from = new Date(Math.max(since.getTime(), now.getTime() - 6 * 3600_000));
    info.pushes = await sendPushes(from, now);
    await db.from('tick_state').update({ last_air: now.toISOString() }).eq('id', 1);
  } catch (e) {
    info.pushError = String(e);
  }
  await db.from('tick_state').update({ info }).eq('id', 1);
  return Response.json(info);
});
