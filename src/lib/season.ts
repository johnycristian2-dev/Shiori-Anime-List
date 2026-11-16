import type { Season } from '../types';

export const SEASON_LABEL: Record<Season, { pt: string; jp: string }> = {
  WINTER: { pt: 'Inverno', jp: '冬' },
  SPRING: { pt: 'Primavera', jp: '春' },
  SUMMER: { pt: 'Verão', jp: '夏' },
  FALL: { pt: 'Outono', jp: '秋' },
};

export const SEASONS: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

/** Temporadas de anime seguem o calendário japonês (jan = inverno). */
export function currentSeason(d = new Date()): { season: Season; year: number } {
  return { season: SEASONS[Math.floor(d.getMonth() / 3)], year: d.getFullYear() };
}

export function nextSeason(d = new Date()): { season: Season; year: number } {
  const i = Math.floor(d.getMonth() / 3);
  return i === 3 ? { season: 'WINTER', year: d.getFullYear() + 1 } : { season: SEASONS[i + 1], year: d.getFullYear() };
}

export const YEARS = (() => {
  const out: number[] = [];
  for (let y = new Date().getFullYear() + 1; y >= 1960; y--) out.push(y);
  return out;
})();
