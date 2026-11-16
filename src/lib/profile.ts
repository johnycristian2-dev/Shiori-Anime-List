import type { GachaState, ListEntry, ListStatus } from '../types';

export const RANKS = [
  { min: 0, name: 'Novato', jp: '新人' },
  { min: 10, name: 'Iniciado', jp: '見習い' },
  { min: 30, name: 'Veterano', jp: '古参' },
  { min: 75, name: 'Sensei', jp: '先生' },
  { min: 150, name: 'Mestre', jp: '達人' },
  { min: 300, name: 'Lenda', jp: '伝説' },
];

export function rankOf(completed: number) {
  let i = 0;
  RANKS.forEach((r, j) => completed >= r.min && (i = j));
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  const pct = next ? (completed - cur.min) / (next.min - cur.min) : 1;
  return { ...cur, next, pct };
}

/** Duração média de episódio: TV ~24min, filme ~100min. Aproximado. */
const minutesPerEp = (e: ListEntry) => (e.format === 'MOVIE' ? 100 : e.format === 'TV_SHORT' ? 8 : 24);

export function computeStats(all: ListEntry[]) {
  const by = (s: ListStatus) => all.filter((e) => e.status === s).length;
  const scored = all.filter((e) => e.score > 0);
  const genres = new Map<string, number>();
  const decades = new Map<number, number>();
  const scores = Array.from({ length: 10 }, () => 0);
  all.forEach((e) => {
    e.genres.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1));
    if (e.year) decades.set(Math.floor(e.year / 10) * 10, (decades.get(Math.floor(e.year / 10) * 10) ?? 0) + 1);
    if (e.score) scores[e.score - 1]++;
  });
  const eps = all.reduce((n, e) => n + e.progress, 0);
  const minutes = all.reduce((n, e) => n + e.progress * minutesPerEp(e), 0);
  return {
    total: all.length,
    completed: by('COMPLETED'),
    watching: by('WATCHING'),
    planning: by('PLANNING'),
    paused: by('PAUSED'),
    dropped: by('DROPPED'),
    eps,
    hours: Math.round(minutes / 60),
    mean: scored.length ? scored.reduce((n, e) => n + e.score, 0) / scored.length : 0,
    scoredCount: scored.length,
    genres: [...genres.entries()].sort((a, b) => b[1] - a[1]),
    decades: [...decades.entries()].sort((a, b) => a[0] - b[0]),
    scores,
    movies: all.filter((e) => e.format === 'MOVIE' && e.status === 'COMPLETED').length,
    favorites: all.filter((e) => e.favorite).length,
    oldest: all.reduce((m, e) => (e.year && e.year < m ? e.year : m), 9999),
  };
}

export type Stats = ReturnType<typeof computeStats>;

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** Escondida: aparece como "???" até desbloquear */
  hidden?: boolean;
  test: (s: Stats, g?: GachaState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🌱', name: 'Primeiro passo', desc: 'Adicione seu primeiro anime', test: (s) => s.total >= 1 },
  { id: 'collector', icon: '📚', name: 'Colecionador', desc: '50 animes na lista', test: (s) => s.total >= 50 },
  { id: 'hoarder', icon: '🏯', name: 'Acumulador', desc: '200 animes na lista', test: (s) => s.total >= 200 },
  { id: 'finisher', icon: '✅', name: 'Terminador', desc: '10 animes completos', test: (s) => s.completed >= 10 },
  { id: 'marathon', icon: '🏃', name: 'Maratonista', desc: '500 episódios vistos', test: (s) => s.eps >= 500 },
  { id: 'thousand', icon: '🔥', name: 'Mil episódios', desc: '1.000 episódios vistos', test: (s) => s.eps >= 1000 },
  { id: 'week', icon: '⏳', name: 'Uma semana de anime', desc: '168 horas assistidas', test: (s) => s.hours >= 168 },
  { id: 'critic', icon: '🖋️', name: 'Crítico', desc: 'Dê nota a 20 animes', test: (s) => s.scoredCount >= 20 },
  { id: 'perfect', icon: '💯', name: 'Obra-prima', desc: 'Dê nota 10 a algum anime', test: (s) => s.scores[9] > 0 },
  { id: 'eclectic', icon: '🎨', name: 'Eclético', desc: 'Animes de 12 gêneros diferentes', test: (s) => s.genres.length >= 12 },
  { id: 'retro', icon: '📼', name: 'Arqueólogo', desc: 'Um anime anterior a 1990', test: (s) => s.oldest < 1990 },
  { id: 'cinema', icon: '🎬', name: 'Cinéfilo', desc: '10 filmes completos', test: (s) => s.movies >= 10 },
  { id: 'juggler', icon: '🤹', name: 'Malabarista', desc: '5 animes ao mesmo tempo', test: (s) => s.watching >= 5 },
  { id: 'hearts', icon: '💖', name: 'Coração de otaku', desc: '5 favoritos', test: (s) => s.favorites >= 5 },
  { id: 'honest', icon: '🗑️', name: 'Sem dó', desc: 'Drope um anime', test: (s) => s.dropped >= 1 },
  // Gacha diário
  { id: 'gacha1', icon: '🎁', name: 'Primeiro giro', desc: 'Faça o giro do dia', test: (_s, g) => (g?.pulls ?? 0) >= 1 },
  { id: 'streak7', icon: '📆', name: 'Devoto', desc: 'Giro do dia 7 dias seguidos', test: (_s, g) => (g?.bestStreak ?? 0) >= 7 },
  // Raras, escondidas
  { id: 'streak30', icon: '⛩️', name: 'Disciplina de monge', desc: 'Giro do dia 30 dias seguidos', hidden: true, test: (_s, g) => (g?.bestStreak ?? 0) >= 30 },
  { id: 'ssr3', icon: '🌟', name: 'Sorte divina', desc: 'SSR no giro do dia 3 dias seguidos', hidden: true, test: (_s, g) => (g?.bestSsrStreak ?? 0) >= 3 },
  { id: 'ssr10', icon: '👑', name: 'Colecionador de SSR', desc: '10 SSR no giro do dia', hidden: true, test: (_s, g) => (g?.ssr ?? 0) >= 10 },
];
