import type { GachaState, Media, Rarity } from '../types';

export const RARITY: { name: Rarity; min: number; stars: string; color: string; glow: string }[] = [
  { name: 'SSR', min: 85, stars: '★★★★★', color: '#ffd23f', glow: '0 0 60px #ffd23f, 0 0 120px #ff4f9a' },
  { name: 'SR', min: 75, stars: '★★★★', color: '#c38bff', glow: '0 0 50px #c38bff' },
  { name: 'R', min: 0, stars: '★★★', color: '#3de2ff', glow: '0 0 40px #3de2ff' },
];

export const rarityOf = (score: number | null | undefined) => RARITY.find((r) => (score ?? 0) >= r.min)!;

const pad = (n: number) => String(n).padStart(2, '0');

/** Dia no horário local, ex.: 2026-11-16 */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prevDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export const emptyGacha = (): GachaState => ({
  lastDay: null,
  streak: 0,
  bestStreak: 0,
  pulls: 0,
  ssr: 0,
  ssrStreak: 0,
  bestSsrStreak: 0,
  log: [],
});

export const canPullToday = (g: GachaState | undefined, today = dayKey()) => g?.lastDay !== today;

/** Sequência atual considerando que hoje ainda não girou (se perdeu ontem, zera). */
export function liveStreak(g: GachaState | undefined, today = dayKey()) {
  if (!g?.lastDay) return 0;
  return g.lastDay === today || g.lastDay === prevDayKey(today) ? g.streak : 0;
}

/** Registra o giro diário: atualiza sequência de dias, SSRs e histórico. */
export function applyDailyPull(prev: GachaState | undefined, media: Media, today = dayKey()): GachaState {
  const g = prev ?? emptyGacha();
  if (g.lastDay === today) return g;
  const rarity = rarityOf(media.averageScore).name;
  const consecutive = g.lastDay === prevDayKey(today);
  const streak = consecutive ? g.streak + 1 : 1;
  const lastWasSsr = g.log[g.log.length - 1]?.rarity === 'SSR';
  const ssrStreak = rarity === 'SSR' ? (consecutive && lastWasSsr ? g.ssrStreak + 1 : 1) : 0;
  return {
    lastDay: today,
    streak,
    bestStreak: Math.max(g.bestStreak, streak),
    pulls: g.pulls + 1,
    ssr: g.ssr + (rarity === 'SSR' ? 1 : 0),
    ssrStreak,
    bestSsrStreak: Math.max(g.bestSsrStreak, ssrStreak),
    log: [
      ...g.log,
      {
        day: today,
        mediaId: media.id,
        title: media.title.romaji ?? media.title.english ?? '???',
        cover: media.coverImage.large,
        rarity,
      },
    ].slice(-60),
  };
}
