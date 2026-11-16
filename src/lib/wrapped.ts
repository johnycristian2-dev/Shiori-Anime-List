/**
 * Retrospectiva do ano: números calculados a partir do histórico.
 * Para animes de antes do histórico existir, usa a data da última edição como aproximação.
 */
import { epMinutes } from './marathon';
import type { HistoryEvent, ListEntry } from '../types';

const inYear = (at: number, year: number) => new Date(at).getFullYear() === year;
const dayIndex = (at: number) => {
  const d = new Date(at);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
};

export function yearsWithData(entries: ListEntry[], history: HistoryEvent[]) {
  const ys = new Set<number>([new Date().getFullYear()]);
  history.forEach((h) => ys.add(new Date(h.at).getFullYear()));
  entries.forEach((e) => ys.add(new Date(e.addedAt).getFullYear()));
  return [...ys].sort((a, b) => b - a);
}

export function yearStats(entriesMap: Record<number, ListEntry>, history: HistoryEvent[], year: number) {
  const entries = Object.values(entriesMap);
  const ev = history.filter((h) => inYear(h.at, year) && entriesMap[h.m]);
  const hasDone = new Set(history.filter((h) => h.t === 'done').map((h) => h.m));
  const hasEp = new Set(history.filter((h) => h.t === 'ep').map((h) => h.m));

  // Completados no ano (histórico + aproximação pra dados antigos)
  const completed = new Set(ev.filter((h) => h.t === 'done').map((h) => h.m));
  entries.forEach((e) => e.status === 'COMPLETED' && !hasDone.has(e.mediaId) && inYear(e.updatedAt, year) && completed.add(e.mediaId));

  const added = new Set(ev.filter((h) => h.t === 'add').map((h) => h.m));
  entries.forEach((e) => inYear(e.addedAt, year) && added.add(e.mediaId));

  // Episódios por anime e por mês
  const epsBy = new Map<number, number>();
  const months = Array.from({ length: 12 }, () => 0);
  const days = new Set<number>();
  for (const h of ev) {
    if (h.t !== 'ep' || !h.v) continue;
    epsBy.set(h.m, (epsBy.get(h.m) ?? 0) + h.v);
    months[new Date(h.at).getMonth()] += h.v;
    days.add(dayIndex(h.at));
  }
  // Aproximação: completou no ano sem registro de episódios → conta os episódios do anime
  for (const id of completed) {
    if (hasEp.has(id)) continue;
    const e = entriesMap[id];
    const n = e?.episodes ?? e?.progress ?? 0;
    if (!n) continue;
    epsBy.set(id, (epsBy.get(id) ?? 0) + n);
    months[new Date(e.updatedAt).getMonth()] += n;
  }

  const eps = [...epsBy.values()].reduce((a, b) => a + b, 0);
  const minutes = [...epsBy.entries()].reduce((n, [id, c]) => n + c * epMinutes(entriesMap[id] ?? { format: null }), 0);

  // Maior sequência de dias seguidos assistindo
  const sorted = [...days].sort((a, b) => a - b);
  let best = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const genres = new Map<string, number>();
  for (const [id, c] of epsBy) entriesMap[id]?.genres.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + c));

  const mostWatched = [...epsBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const topRated = [...completed]
    .map((id) => entriesMap[id])
    .filter((e) => e && e.score > 0)
    .sort((a, b) => b.score - a.score || (b.averageScore ?? 0) - (a.averageScore ?? 0))
    .slice(0, 5);
  const bestMonth = months.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);

  return {
    year,
    eps,
    minutes,
    hours: Math.round(minutes / 60),
    completed: [...completed].map((id) => entriesMap[id]).filter(Boolean),
    addedCount: added.size,
    months,
    bestMonth: months[bestMonth] > 0 ? bestMonth : null,
    longestStreak: best,
    activeDays: days.size,
    genres: [...genres.entries()].sort((a, b) => b[1] - a[1]),
    mostWatched: mostWatched ? { entry: entriesMap[mostWatched[0]], eps: mostWatched[1] } : null,
    topRated,
    isEmpty: eps === 0 && completed.size === 0 && added.size === 0,
  };
}

export type YearStats = ReturnType<typeof yearStats>;
