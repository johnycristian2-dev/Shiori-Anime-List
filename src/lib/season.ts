import type { Season } from '../types';

import { t } from './i18n';

export const SEASON_LABEL: Record<Season, { pt: string; jp: string }> = {
  WINTER: {
    get pt() {
      return t('Inverno');
    },

    jp: '冬'
  },
  SPRING: {
    get pt() {
      return t('Primavera');
    },

    jp: '春'
  },
  SUMMER: {
    get pt() {
      return t('Verão');
    },

    jp: '夏'
  },
  FALL: {
    get pt() {
      return t('Outono');
    },

    jp: '秋'
  },
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
