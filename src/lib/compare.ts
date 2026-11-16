/**
 * Compara duas listas: compatibilidade, animes em comum e recomendações cruzadas.
 */
import type { ListEntry } from '../types';

import { t } from './i18n';

const seen = (e: ListEntry) => e.status !== 'PLANNING';

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (!dx || !dy) return null;
  return num / Math.sqrt(dx * dy);
}

function genreVector(list: ListEntry[]) {
  const v = new Map<string, number>();
  list.filter(seen).forEach((e) => e.genres.forEach((g) => v.set(g, (v.get(g) ?? 0) + 1)));
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    dot += v * (b.get(k) ?? 0);
    na += v * v;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function compatLabel(score: number) {
  if (score >= 90) return {
    get label() {
      return t('Almas gêmeas');
    },

    jp: '運命'
  };
  if (score >= 75) return {
    get label() {
      return t('Muito parecidos');
    },

    jp: '親友'
  };
  if (score >= 55) return {
    get label() {
      return t('Combinam bem');
    },

    jp: '仲間'
  };
  if (score >= 35) return {
    get label() {
      return t('Gostos diferentes');
    },

    jp: '個性'
  };
  return {
    get label() {
      return t('Opostos que se atraem');
    },

    jp: '宿敵'
  };
}

export function compareLists(mineList: ListEntry[], theirsList: ListEntry[]) {
  const mine = new Map(mineList.map((e) => [e.mediaId, e]));
  const theirs = new Map(theirsList.map((e) => [e.mediaId, e]));

  const shared = mineList.filter((e) => seen(e) && theirs.get(e.mediaId) && seen(theirs.get(e.mediaId)!)).map((e) => ({ me: e, them: theirs.get(e.mediaId)! }));
  const scored = shared.filter((p) => p.me.score > 0 && p.them.score > 0);
  const corr = scored.length >= 3 ? pearson(scored.map((p) => p.me.score), scored.map((p) => p.them.score)) : null;

  const mySeen = new Set(mineList.filter(seen).map((e) => e.mediaId));
  const theirSeen = new Set(theirsList.filter(seen).map((e) => e.mediaId));
  const union = new Set([...mySeen, ...theirSeen]).size;
  const jaccard = union ? shared.length / union : 0;
  const genreSim = cosine(genreVector(mineList), genreVector(theirsList));

  // Jaccard costuma ser baixo mesmo entre amigos parecidos: raiz suaviza
  const overlap = Math.sqrt(jaccard);
  const raw = corr != null ? 0.45 * ((corr + 1) / 2) + 0.35 * genreSim + 0.2 * overlap : 0.7 * genreSim + 0.3 * overlap;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  const loved = (e: ListEntry) => e.score >= 8 || (e.score === 0 && e.favorite);
  const rank = (a: ListEntry, b: ListEntry) => b.score - a.score || Number(!!b.favorite) - Number(!!a.favorite) || (b.averageScore ?? 0) - (a.averageScore ?? 0);

  const forMe = theirsList.filter((e) => seen(e) && loved(e) && (!mine.has(e.mediaId) || mine.get(e.mediaId)!.status === 'PLANNING')).sort(rank);
  const forThem = mineList.filter((e) => seen(e) && loved(e) && (!theirs.has(e.mediaId) || theirs.get(e.mediaId)!.status === 'PLANNING')).sort(rank);
  const bothLove = scored.filter((p) => p.me.score >= 8 && p.them.score >= 8).sort((a, b) => b.me.score + b.them.score - (a.me.score + a.them.score));
  const disagree = scored
    .map((p) => ({ ...p, diff: Math.abs(p.me.score - p.them.score) }))
    .filter((p) => p.diff >= 3)
    .sort((a, b) => b.diff - a.diff);

  return {
    score,
    ...compatLabel(score),
    shared,
    scoredCount: scored.length,
    corr,
    genreSim,
    forMe,
    forThem,
    bothLove,
    disagree,
    myGenres: [...genreVector(mineList).entries()].sort((a, b) => b[1] - a[1]),
    theirGenres: [...genreVector(theirsList).entries()].sort((a, b) => b[1] - a[1]),
  };
}

export type Comparison = ReturnType<typeof compareLists>;
