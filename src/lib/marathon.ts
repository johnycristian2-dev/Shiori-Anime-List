/**
 * Planejador de maratona: monta a franquia na ordem de lançamento e
 * distribui os episódios pelos dias, de acordo com o tempo disponível.
 */
import { gql } from '../api/anilist';
import { MEDIA_FIELDS } from '../api/queries';
import type { Media } from '../types';

export interface FranchiseItem extends Media {
  duration: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  /** true = linha principal (prequela/sequência); false = extra (história paralela, especial...) */
  main: boolean;
}

type Node = FranchiseItem & {
  type: string;
  relations: { edges: { relationType: string; node: { id: number; type: string; format: string | null } }[] };
};

const MAIN = ['PREQUEL', 'SEQUEL', 'PARENT'];
const EXTRA = ['SIDE_STORY', 'SPIN_OFF', 'SUMMARY'];

/** Busca a franquia a partir de um anime, em lotes (um alias por anime). */
export async function fetchFranchise(rootId: number, maxNodes = 45): Promise<FranchiseItem[]> {
  const found = new Map<number, Node>();
  const main = new Set<number>([rootId]);
  let frontier = [rootId];
  let rounds = 0;
  while (frontier.length && found.size < maxNodes && rounds < 8) {
    rounds++;
    const batch = frontier.slice(0, 15);
    frontier = frontier.slice(15);
    const q = `query { ${batch
      .map(
        (id, i) =>
          `m${i}: Media(id: ${Number(id)}) { ${MEDIA_FIELDS} type duration startDate { year month day } relations { edges { relationType(version: 2) node { id type format } } } }`,
      )
      .join('\n')} }`;
    const data = await gql<Record<string, Node | null>>(q);
    for (const n of Object.values(data)) {
      if (!n || found.has(n.id)) continue;
      found.set(n.id, n);
      // Extras só são expandidos a partir da linha principal (evita puxar o universo inteiro)
      if (!main.has(n.id)) continue;
      for (const e of n.relations.edges) {
        const t = e.node;
        if (t.type !== 'ANIME' || t.format === 'MUSIC' || found.has(t.id) || frontier.includes(t.id)) continue;
        if (MAIN.includes(e.relationType)) {
          main.add(t.id);
          frontier.push(t.id);
        } else if (EXTRA.includes(e.relationType)) {
          frontier.push(t.id);
        }
      }
    }
  }
  return [...found.values()]
    .map(({ relations: _r, type: _t, ...m }) => ({ ...m, main: main.has(m.id) }))
    .sort((a, b) => dateKey(a) - dateKey(b));
}

const dateKey = (m: FranchiseItem) =>
  m.startDate.year ? m.startDate.year * 10000 + (m.startDate.month ?? 12) * 100 + (m.startDate.day ?? 28) : 99999999;

export interface PlanItem {
  media: FranchiseItem;
  episodes: number;
  minutesPerEp: number;
  totalMinutes: number;
  startDay: number;
  endDay: number;
  startDate: Date;
  endDate: Date;
  skipped?: 'sem-episodios' | 'visto';
}

export interface PlanOptions {
  minutesPerDay: number;
  /** Quais dias da semana você assiste (0 = domingo ... 6 = sábado) */
  weekdays: number[];
  includeExtras: boolean;
  /** Episódios já vistos por anime (pra pular) */
  watched: Record<number, number>;
  start?: Date;
}

export const epMinutes = (m: { duration?: number | null; format: FranchiseItem['format'] }) => m.duration ?? (m.format === 'MOVIE' ? 100 : m.format === 'TV_SHORT' ? 8 : 24);

/**
 * Distribui episódios inteiros pelos dias disponíveis.
 * Um episódio maior que o tempo do dia (ex.: filme) ocupa o dia sozinho.
 */
export function planMarathon(items: FranchiseItem[], o: PlanOptions) {
  const start = o.start ? new Date(o.start) : new Date();
  start.setHours(0, 0, 0, 0);
  const days = o.weekdays.length ? o.weekdays : [0, 1, 2, 3, 4, 5, 6];
  let day = 0; // índice de dia do calendário a partir de hoje
  let used = 0; // minutos usados no dia atual
  const dateOf = (d: number) => new Date(start.getTime() + d * 864e5);
  const isActive = (d: number) => days.includes(dateOf(d).getDay());
  const advanceToActive = () => {
    while (!isActive(day)) day++;
  };

  const plan: PlanItem[] = [];
  for (const m of items) {
    if (!m.main && !o.includeExtras) continue;
    const per = epMinutes(m);
    const total = m.episodes ?? 0;
    const seen = Math.min(o.watched[m.id] ?? 0, total);
    const eps = total - seen;
    const base = { media: m, minutesPerEp: per, episodes: eps, totalMinutes: eps * per };
    if (!m.episodes) {
      plan.push({ ...base, episodes: 0, totalMinutes: 0, startDay: day, endDay: day, startDate: dateOf(day), endDate: dateOf(day), skipped: 'sem-episodios' });
      continue;
    }
    if (eps <= 0) {
      plan.push({ ...base, startDay: day, endDay: day, startDate: dateOf(day), endDate: dateOf(day), skipped: 'visto' });
      continue;
    }
    advanceToActive();
    if (used >= o.minutesPerDay) {
      day++;
      used = 0;
      advanceToActive();
    }
    const startDay = day;
    for (let i = 0; i < eps; i++) {
      if (used > 0 && used + per > o.minutesPerDay) {
        day++;
        used = 0;
        advanceToActive();
      }
      used += per;
    }
    plan.push({ ...base, startDay, endDay: day, startDate: dateOf(startDay), endDate: dateOf(day) });
  }

  const counted = plan.filter((p) => !p.skipped);
  const totalMinutes = counted.reduce((n, p) => n + p.totalMinutes, 0);
  const lastDay = counted.length ? counted[counted.length - 1].endDay : 0;
  return {
    plan,
    totalMinutes,
    totalEpisodes: counted.reduce((n, p) => n + p.episodes, 0),
    calendarDays: counted.length ? lastDay + 1 : 0,
    endDate: dateOf(lastDay),
  };
}
