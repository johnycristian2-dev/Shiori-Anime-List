/**
 * Quiz ao vivo da watch party. O anfitrião gera as perguntas (da lista de animes dos jogos),
 * guarda as respostas só no navegador dele e revela uma por vez. As respostas dos outros ficam
 * escondidas pelo banco até a revelação.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { fmtMembers, isMainEntry, sample, shuffle, type PoolAnime } from '../games/core';

export interface QTitle {
  r: string;
  e: string | null;
  n: string | null;
}
export interface QOption {
  text?: string;
  title?: QTitle;
  c?: string;
}
export interface Question {
  kind: 'cover' | 'studio' | 'year' | 'popular' | 'score';
  about?: QTitle;
  image?: string;
  options: QOption[];
  /** valores pra mostrar depois de revelar (ex.: membros de cada opção) */
  extra?: string[];
}
export interface Quiz {
  code: string;
  status: 'question' | 'reveal' | 'done';
  round: number;
  total: number;
  seconds: number;
  question: Question;
  answer: number | null;
  history: { round: number; answer: number; started_at: string }[];
  started_at: string;
  updated_at: string;
}
export interface QuizAnswer {
  code: string;
  round: number;
  user_id: string;
  name: string;
  choice: number;
  answered_at: string;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};
const friendly = (e: { message?: string } | null) => {
  const m = e?.message ?? '';
  if (/row-level security|violates/i.test(m)) return new Error(t('O tempo dessa pergunta acabou.'));
  return new Error(m || t('Algo deu errado.'));
};

const tt = (a: PoolAnime): QTitle => ({ r: a.r, e: a.e, n: a.n });

/** Gera as perguntas com a resposta certa de cada uma. */
export function buildQuiz(pool: PoolAnime[], total = 10) {
  const main = pool.filter(isMainEntry).sort((a, b) => b.p - a.p).slice(0, 350);
  const kinds: Question['kind'][] = shuffle(
    Array.from({ length: total }, (_, i) => (['cover', 'studio', 'year', 'popular', 'score', 'cover', 'studio', 'year', 'popular', 'cover'] as const)[i % 10])
  );
  const used = new Set<number>();
  const fresh = (list: PoolAnime[], n: number) => {
    const pick = sample(list.filter((a) => !used.has(a.id)), n);
    pick.forEach((a) => used.add(a.id));
    return pick;
  };
  return kinds.map((kind) => {
    if (kind === 'cover') {
      const [a] = fresh(main, 1);
      const wrong = sample(main.filter((x) => x.id !== a.id && x.g.some((g) => a.g.includes(g))), 3);
      const opts = shuffle([a, ...wrong]);
      return { q: { kind, image: a.c, options: opts.map((o) => ({ title: tt(o) })) } as Question, answer: opts.indexOf(a) };
    }
    if (kind === 'studio') {
      const [a] = fresh(main.filter((x) => x.s), 1);
      const studios = [...new Set(main.map((x) => x.s).filter((s): s is string => !!s && s.toLowerCase() !== a.s!.toLowerCase()))];
      const opts = shuffle([a.s!, ...sample(studios, 3)]);
      return { q: { kind, about: tt(a), image: a.c, options: opts.map((s) => ({ text: s })) } as Question, answer: opts.indexOf(a.s!) };
    }
    if (kind === 'year') {
      const [a] = fresh(main, 1);
      const years = new Set<number>([a.y]);
      while (years.size < 4) {
        const y = a.y + Math.round((Math.random() * 2 - 1) * 6);
        if (y !== a.y && y >= 1960 && y <= new Date().getFullYear() + 1) years.add(y);
      }
      const opts = shuffle([...years]);
      return { q: { kind, about: tt(a), image: a.c, options: opts.map((y) => ({ text: String(y) })) } as Question, answer: opts.indexOf(a.y) };
    }
    // popular / score: 4 animes, o maior vence (sem empate)
    const key = kind === 'popular' ? 'p' : 'sc';
    let opts: PoolAnime[] = [];
    for (let k = 0; k < 30; k++) {
      opts = sample(main.filter((x) => !used.has(x.id)), 4);
      const vals = opts.map((o) => o[key]).sort((x, y) => y - x);
      if (vals[0] !== vals[1]) break;
    }
    opts.forEach((o) => used.add(o.id));
    const best = opts.reduce((m, o, i) => (o[key] > opts[m][key] ? i : m), 0);
    return {
      q: {
        kind,
        options: opts.map((o) => ({ title: tt(o), c: o.c })),
        extra: opts.map((o) => (kind === 'popular' ? fmtMembers(o.p) : `${o.sc}%`)),
      } as Question,
      answer: best,
    };
  });
}

/* ---------- respostas guardadas só no navegador do anfitrião ---------- */
const KEY = (code: string) => `shiori-quiz-${code}`;
export function saveKey(code: string, answers: number[], questions: Question[]) {
  try {
    sessionStorage.setItem(KEY(code), JSON.stringify({ answers, questions }));
  } catch {
    /* ignore */
  }
}
export function readKey(code: string): { answers: number[]; questions: Question[] } | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY(code)) || 'null');
  } catch {
    return null;
  }
}

/* ---------- banco ---------- */

export async function loadQuiz(code: string) {
  const { data, error } = await sb().from('party_quiz').select('*').eq('code', code).maybeSingle();
  if (error) throw friendly(error);
  return (data as Quiz | null) ?? null;
}

export async function loadAnswers(code: string) {
  const { data, error } = await sb().from('party_quiz_answers').select('*').eq('code', code);
  if (error) throw friendly(error);
  return (data ?? []) as QuizAnswer[];
}

export async function answerCount(code: string, round: number) {
  const { data } = await sb().rpc('quiz_answer_count', { p_code: code, p_round: round });
  return (data as number | null) ?? 0;
}

export async function serverOffset() {
  const t0 = Date.now();
  const { data } = await sb().rpc('server_now');
  const t1 = Date.now();
  return data ? new Date(data as string).getTime() - (t0 + t1) / 2 : 0;
}

export async function startQuiz(code: string, pool: PoolAnime[], total = 10, seconds = 20) {
  const items = buildQuiz(pool, total);
  saveKey(
    code,
    items.map((i) => i.answer),
    items.map((i) => i.q)
  );
  await sb().from('party_quiz').delete().eq('code', code); // apaga o quiz anterior (e as respostas)
  const { error } = await sb()
    .from('party_quiz')
    .insert({ code, status: 'question', round: 1, total, seconds, question: items[0].q, history: [] });
  if (error) throw friendly(error);
}

export async function reveal(quiz: Quiz) {
  const key = readKey(quiz.code);
  const answer = key?.answers[quiz.round - 1];
  if (answer === undefined) throw new Error(t('As respostas deste quiz ficaram em outro navegador. Comece um novo quiz.'));
  const history = [...quiz.history.filter((h) => h.round !== quiz.round), { round: quiz.round, answer, started_at: quiz.started_at }];
  const { error } = await sb().from('party_quiz').update({ status: 'reveal', answer, history }).eq('code', quiz.code).eq('round', quiz.round);
  if (error) throw friendly(error);
}

export async function nextQuestion(quiz: Quiz) {
  const key = readKey(quiz.code);
  if (quiz.round >= quiz.total) {
    const { error } = await sb().from('party_quiz').update({ status: 'done' }).eq('code', quiz.code);
    if (error) throw friendly(error);
    return;
  }
  const q = key?.questions[quiz.round];
  if (!q) throw new Error(t('As respostas deste quiz ficaram em outro navegador. Comece um novo quiz.'));
  const { error } = await sb()
    .from('party_quiz')
    .update({ status: 'question', round: quiz.round + 1, question: q, answer: null })
    .eq('code', quiz.code);
  if (error) throw friendly(error);
}

export async function endQuiz(code: string) {
  const { error } = await sb().from('party_quiz').delete().eq('code', code);
  if (error) throw friendly(error);
}

export async function sendAnswer(code: string, round: number, userId: string, name: string, choice: number) {
  const { error } = await sb().from('party_quiz_answers').insert({ code, round, user_id: userId, name, choice });
  if (error && error.code !== '23505') throw friendly(error);
}

/** Pontos: 500 por acerto + até 500 pela velocidade. */
export function scoreboard(quiz: Quiz | null, answers: QuizAnswer[], seconds = 20) {
  const totals = new Map<string, { name: string; points: number; hits: number; last: number }>();
  if (!quiz) return [];
  const hist = new Map(quiz.history.map((h) => [h.round, h]));
  for (const a of answers) {
    const h = hist.get(a.round);
    const row = totals.get(a.user_id) ?? { name: a.name, points: 0, hits: 0, last: 0 };
    row.name = a.name;
    if (h && h.answer === a.choice) {
      const dt = (new Date(a.answered_at).getTime() - new Date(h.started_at).getTime()) / 1000;
      const pts = 500 + Math.round(500 * Math.max(0, 1 - dt / seconds));
      row.points += pts;
      row.hits += 1;
      if (a.round === quiz.round) row.last = pts;
    }
    totals.set(a.user_id, row);
  }
  return [...totals.entries()].map(([user_id, r]) => ({ user_id, ...r })).sort((a, b) => b.points - a.points);
}

export function subscribeQuiz(code: string, onQuiz: (q: Quiz | null) => void, onAnswer: () => void) {
  const filter = `code=eq.${code}`;
  const ch: RealtimeChannel = sb()
    .channel(`party-quiz:${code}:${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_quiz', filter }, (p) => onQuiz(p.new as Quiz))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'party_quiz', filter }, (p) => onQuiz(p.new as Quiz))
    // DELETE não aceita filtro no Supabase Realtime: confere o código na mão
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'party_quiz' }, (p) => {
      if ((p.old as Partial<Quiz>).code === code) onQuiz(null);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_quiz_answers', filter }, () => onAnswer())
    .subscribe();
  return () => {
    sb().removeChannel(ch);
  };
}
