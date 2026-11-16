import { describe, expect, it } from 'vitest';
import { yearStats } from './wrapped';
import type { HistoryEvent, ListEntry } from '../types';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 20).getTime();
const e = (id: number, extra: Partial<ListEntry> = {}): ListEntry => ({
  mediaId: id,
  idMal: null,
  title: `A${id}`,
  titleEnglish: null,
  titleNative: null,
  cover: null,
  color: null,
  format: 'TV',
  episodes: 12,
  year: 2020,
  genres: ['Action'],
  averageScore: 80,
  status: 'WATCHING',
  score: 0,
  progress: 0,
  addedAt: at(2026, 1, 1),
  updatedAt: at(2026, 1, 1),
  ...extra,
});

describe('yearStats', () => {
  it('soma episódios do ano, mês campeão e sequência de dias', () => {
    const entries = { 1: e(1, { genres: ['Romance'] }), 2: e(2) };
    const h: HistoryEvent[] = [
      { m: 1, t: 'ep', at: at(2026, 3, 1), v: 2 },
      { m: 1, t: 'ep', at: at(2026, 3, 2), v: 3 },
      { m: 2, t: 'ep', at: at(2026, 3, 3), v: 1 },
      { m: 2, t: 'ep', at: at(2026, 7, 10), v: 1 },
      { m: 2, t: 'ep', at: at(2025, 7, 10), v: 9 }, // outro ano
    ];
    const s = yearStats(entries, h, 2026);
    expect(s.eps).toBe(7);
    expect(s.hours).toBe(Math.round((7 * 24) / 60));
    expect(s.bestMonth).toBe(2); // março
    expect(s.longestStreak).toBe(3);
    expect(s.mostWatched?.entry.mediaId).toBe(1);
    expect(s.genres[0][0]).toBe('Romance');
  });

  it('aproxima dados antigos (completo sem histórico)', () => {
    const entries = { 1: e(1, { status: 'COMPLETED', progress: 12, score: 9, updatedAt: at(2026, 5, 5) }) };
    const s = yearStats(entries, [], 2026);
    expect(s.completed).toHaveLength(1);
    expect(s.eps).toBe(12);
    expect(s.topRated[0].score).toBe(9);
  });

  it('ano sem nada fica vazio', () => {
    const s = yearStats({ 1: e(1) }, [], 2024);
    expect(s.isEmpty).toBe(true);
  });
});
