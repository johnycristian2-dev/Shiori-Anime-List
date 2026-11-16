import { describe, expect, it } from 'vitest';
import { applyDailyPull, canPullToday, liveStreak, prevDayKey } from './gacha';
import type { Media } from '../types';

const m = (id: number, score: number): Media => ({
  id,
  idMal: null,
  title: { romaji: `A${id}`, english: null, native: null },
  coverImage: { extraLarge: null, large: null, color: null },
  bannerImage: null,
  episodes: 12,
  format: 'TV',
  status: 'FINISHED',
  season: null,
  seasonYear: 2020,
  averageScore: score,
  popularity: 1,
  genres: [],
});

describe('gacha diário', () => {
  it('dia anterior atravessa mês e ano', () => {
    expect(prevDayKey('2026-03-01')).toBe('2026-02-28');
    expect(prevDayKey('2027-01-01')).toBe('2026-12-31');
  });

  it('1 giro por dia', () => {
    const g = applyDailyPull(undefined, m(1, 70), '2026-11-16');
    expect(canPullToday(g, '2026-11-16')).toBe(false);
    expect(canPullToday(g, '2026-11-17')).toBe(true);
    expect(applyDailyPull(g, m(2, 90), '2026-11-16')).toBe(g);
  });

  it('sequência de dias e SSR seguidos', () => {
    let g = applyDailyPull(undefined, m(1, 90), '2026-11-14');
    g = applyDailyPull(g, m(2, 88), '2026-11-15');
    g = applyDailyPull(g, m(3, 86), '2026-11-16');
    expect(g.streak).toBe(3);
    expect(g.ssrStreak).toBe(3);
    expect(g.ssr).toBe(3);
  });

  it('pular um dia zera a sequência', () => {
    let g = applyDailyPull(undefined, m(1, 90), '2026-11-14');
    g = applyDailyPull(g, m(2, 70), '2026-11-16');
    expect(g.streak).toBe(1);
    expect(g.bestStreak).toBe(1);
    expect(liveStreak(g, '2026-11-18')).toBe(0);
    expect(liveStreak(g, '2026-11-17')).toBe(1);
  });
});
