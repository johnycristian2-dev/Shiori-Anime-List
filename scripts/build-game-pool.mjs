// Gera public/games/anime-pool.json: os ~600 animes mais populares do AniList, só com o que os jogos usam.
// Uso: node scripts/build-game-pool.mjs  (rodar de vez em quando pra atualizar)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const Q = `query ($page: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false, format_in: [TV, MOVIE, ONA, OVA, TV_SHORT]) {
      id title { romaji english native } coverImage { extraLarge large color } genres seasonYear startDate { year }
      format episodes averageScore popularity
      studios(isMain: true) { nodes { name } }
    }
  }
}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (let page = 1; page <= 12; page++) {
  for (let tries = 0; ; tries++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: Q, variables: { page } }),
    });
    if (r.status === 429 && tries < 5) { await sleep(65_000); continue; }
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const { data } = await r.json();
    for (const m of data.Page.media) {
      const year = m.seasonYear ?? m.startDate?.year;
      if (!year || !m.averageScore || !(m.coverImage?.extraLarge || m.coverImage?.large)) continue;
      out.push({
        id: m.id,
        r: m.title.romaji,
        e: m.title.english ?? null,
        n: m.title.native ?? null,
        c: m.coverImage.extraLarge ?? m.coverImage.large,
        k: m.coverImage.color ?? null,
        g: m.genres,
        y: year,
        s: m.studios.nodes[0]?.name ?? null,
        f: m.format,
        ep: m.episodes ?? null,
        sc: m.averageScore,
        p: m.popularity,
      });
    }
    break;
  }
  await sleep(1200);
}
const file = resolve(import.meta.dirname, '../public/games/anime-pool.json');
writeFileSync(file, JSON.stringify({ v: new Date().toISOString().slice(0, 10), items: out }));
console.log(`${out.length} animes → ${file}`);
