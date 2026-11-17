/**
 * Descobre qual anime do AniList (e qual episódio dele) corresponde ao que está passando no Crunchyroll.
 * O Crunchyroll junta várias temporadas numa série só; o AniList tem uma entrada por temporada.
 * Então: acha a 1ª temporada, segue as continuações (SEQUEL) e encaixa o episódio na temporada certa.
 */

export interface AniMedia {
  id: number;
  idMal: number | null;
  type: string;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  genres: string[];
  averageScore: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  relations: { edges: { relationType: string; node: { id: number; type: string; format: string | null } }[] };
}

const FIELDS = `id idMal type format episodes seasonYear genres averageScore synonyms
  title { romaji english native } coverImage { extraLarge large color }
  relations { edges { relationType(version: 2) node { id type format } } }`;

const SERIES_FORMATS = ['TV', 'TV_SHORT', 'ONA'];

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let tries = 0; ; tries++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429 && tries < 2) {
      await new Promise((ok) => setTimeout(ok, 4000 * (tries + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j.data as T;
  }
}

export const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9぀-ヿ一-龯]+/g, ' ')
    .trim();

/** Tira "Season 2", "(Dub)", "Temporada" etc. do nome que veio do Crunchyroll. */
export function cleanSeries(name: string) {
  return name
    .replace(/\((?:[^)]*dub[^)]*|legendado|dublado|[a-z]{2}-[a-z]{2})\)/gi, '')
    .replace(/\b(season|temporada|saison)\s*\d+\b/gi, '')
    .replace(/\s+[-–|]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function similarity(a: string, b: string) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return 0.9;
  const A = new Set(x.split(' '));
  const B = new Set(y.split(' '));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(A.size, B.size);
}
const bestName = (m: AniMedia, name: string) =>
  Math.max(...[m.title.romaji, m.title.english, m.title.native, ...(m.synonyms ?? [])].filter(Boolean).map((t) => similarity(t!, name)), 0);

async function byId(id: number) {
  const d = await gql<{ Media: AniMedia }>(`query($id:Int){Media(id:$id,type:ANIME){${FIELDS}}}`, { id });
  return d.Media;
}

/** Temporadas em ordem: [1ª, 2ª, ...] (só formatos de série). */
export async function seasonChain(start: AniMedia) {
  // volta até a primeira temporada
  let first = start;
  for (let i = 0; i < 8; i++) {
    const pre = first.relations.edges.find((e) => e.relationType === 'PREQUEL' && e.node.type === 'ANIME' && SERIES_FORMATS.includes(e.node.format ?? ''));
    if (!pre) break;
    const prev = await byId(pre.node.id);
    if (prev.episodes !== null && prev.episodes <= 2) break; // especial de 1–2 eps não é "temporada 1"
    first = prev;
  }
  const chain = [first];
  for (let i = 0; i < 10; i++) {
    const last = chain[chain.length - 1];
    const seq = last.relations.edges.find((e) => e.relationType === 'SEQUEL' && e.node.type === 'ANIME' && SERIES_FORMATS.includes(e.node.format ?? ''));
    if (!seq || chain.some((c) => c.id === seq.node.id)) break;
    chain.push(await byId(seq.node.id));
  }
  return chain;
}

export async function searchSeries(name: string) {
  const d = await gql<{ Page: { media: AniMedia[] } }>(
    `query($s:String){Page(perPage:10){media(search:$s,type:ANIME,sort:SEARCH_MATCH){${FIELDS}}}}`,
    { s: name }
  );
  const list = d.Page.media.filter((m) => SERIES_FORMATS.includes(m.format ?? '') || m.format === 'MOVIE');
  if (!list.length) return null;
  // melhor nome; empate fica com a ordem do AniList
  return list.map((m, i) => ({ m, s: bestName(m, name) - i * 0.01 })).sort((a, b) => b.s - a.s)[0].m;
}

/**
 * Encaixa (temporada, episódio) do Crunchyroll numa entrada do AniList.
 * Aceita numeração por temporada (T2 E3) e absoluta (E28 = 1º ep da T2 se a T1 tem 27).
 */
export function placeEpisode(chain: AniMedia[], season: number | null, episode: number) {
  if (!chain.length) return null;
  const walk = (from: number, ep: number) => {
    for (let i = from; i < chain.length; i++) {
      const m = chain[i];
      if (!m.episodes || ep <= m.episodes) return { media: m, episode: ep };
      ep -= m.episodes;
    }
    return null;
  };
  if (season && season >= 1 && chain[season - 1]) {
    const m = chain[season - 1];
    // 1) numeração da própria temporada (T2 E3)
    if (!m.episodes || episode <= m.episodes) return { media: m, episode };
    // 2) numeração absoluta (T2 E28 quando a T1 tem 27)
    const before = chain.slice(0, season - 1).reduce((n, c) => n + (c.episodes ?? 0), 0);
    if (episode - before >= 1 && episode - before <= m.episodes) return { media: m, episode: episode - before };
    // 3) a "temporada" do Crunchyroll junta partes que no AniList são separadas (T3 = Part 1 + Part 2)
    return walk(season - 1, episode);
  }
  return walk(0, episode);
}

export async function resolveEpisode(series: string, season: number | null, episode: number) {
  const name = cleanSeries(series);
  const hit = await searchSeries(name);
  if (!hit) return null;
  if (hit.format === 'MOVIE') return { media: hit, episode: 1, chain: [hit] };
  const chain = await seasonChain(hit);
  const placed = placeEpisode(chain, season, episode);
  return placed ? { ...placed, chain } : null;
}

/** Formato que a lista do Shiori usa (ListEntry). */
export const toEntry = (m: AniMedia) => ({
  mediaId: m.id,
  idMal: m.idMal,
  title: m.title.romaji ?? m.title.english ?? m.title.native ?? '???',
  titleEnglish: m.title.english,
  titleNative: m.title.native,
  cover: m.coverImage.extraLarge ?? m.coverImage.large,
  color: m.coverImage.color,
  format: m.format,
  episodes: m.episodes,
  year: m.seasonYear,
  genres: m.genres,
  averageScore: m.averageScore,
});
