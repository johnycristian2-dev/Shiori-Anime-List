import { describe, expect, it } from 'vitest';
import { planMarathon, type FranchiseItem } from './marathon';

const item = (id: number, episodes: number | null, duration = 24, main = true, format: FranchiseItem['format'] = 'TV'): FranchiseItem => ({
  id,
  idMal: null,
  title: { romaji: `A${id}`, english: null, native: null },
  coverImage: { extraLarge: null, large: null, color: null },
  bannerImage: null,
  episodes,
  format,
  status: 'FINISHED',
  season: null,
  seasonYear: 2020,
  averageScore: 80,
  popularity: 1,
  genres: [],
  duration,
  startDate: { year: 2020, month: 1, day: 1 },
  main,
});

const monday = new Date(2026, 10, 16); // segunda-feira

describe('planMarathon', () => {
  it('2h por dia = 5 eps de 24min por dia', () => {
    const r = planMarathon([item(1, 12)], { minutesPerDay: 120, weekdays: [], includeExtras: false, watched: {}, start: monday });
    expect(r.totalEpisodes).toBe(12);
    expect(r.calendarDays).toBe(3); // 5 + 5 + 2
    expect(r.plan[0].endDay).toBe(2);
  });

  it('continua no mesmo dia na temporada seguinte', () => {
    const r = planMarathon([item(1, 3), item(2, 3)], { minutesPerDay: 120, weekdays: [], includeExtras: false, watched: {}, start: monday });
    expect(r.plan[1].startDay).toBe(0);
    expect(r.plan[1].endDay).toBe(1);
  });

  it('pula dias da semana que não assiste', () => {
    // só sábado (6) e domingo (0): começa na segunda → primeiro dia útil é sábado (dia 5)
    const r = planMarathon([item(1, 2)], { minutesPerDay: 60, weekdays: [0, 6], includeExtras: false, watched: {}, start: monday });
    expect(r.plan[0].startDay).toBe(5);
    expect(r.plan[0].endDay).toBe(5);
  });

  it('desconta episódios vistos e ignora extras se desligado', () => {
    const r = planMarathon([item(1, 12), item(2, 2, 24, false)], { minutesPerDay: 600, weekdays: [], includeExtras: false, watched: { 1: 10 }, start: monday });
    expect(r.totalEpisodes).toBe(2);
    expect(r.plan).toHaveLength(1);
  });

  it('filme maior que o tempo do dia ocupa um dia', () => {
    const r = planMarathon([item(1, 1, 120, true, 'MOVIE'), item(2, 1, 120, true, 'MOVIE')], { minutesPerDay: 60, weekdays: [], includeExtras: false, watched: {}, start: monday });
    expect(r.calendarDays).toBe(2);
  });

  it('sem número de episódios fica de fora da conta', () => {
    const r = planMarathon([item(1, null)], { minutesPerDay: 60, weekdays: [], includeExtras: false, watched: {}, start: monday });
    expect(r.plan[0].skipped).toBe('sem-episodios');
    expect(r.totalEpisodes).toBe(0);
  });
});
