/** Placar dos mini jogos: grava pelo RPC submit_score e lê o ranking do dia (eu + quem eu sigo). */
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

export type GameId = 'animedle' | 'maisoumenos' | 'imagem';
export interface GameScore {
  user_id: string;
  game: GameId;
  day: string;
  score: number;
  detail: Record<string, unknown> | null;
  name: string;
  plays: number;
  updated_at: string;
}

function friendly(e: { message?: string } | null) {
  const m = e?.message ?? '';
  if (/not_logged/.test(m)) return new Error(t('Entre na sua conta pra salvar a pontuação.'));
  if (/bad_day|bad_score|bad_game/.test(m)) return new Error(t('Pontuação inválida.'));
  return new Error(m || t('Algo deu errado.'));
}

/* ---------- jogos com o servidor como juiz ---------- */
// O anime secreto, as capas e os números ficam no servidor. O navegador manda só o chute.

export type Hit = 'ok' | 'near' | 'no';
export interface AnimedleView {
  guesses: { id: number; cells: { hit: Hit; arrow?: 'up' | 'down' | null }[] }[];
  done: boolean;
  won: boolean;
  secret: number | null;
  hint: string | null;
  score: number | null;
}
export interface CoverRoundView {
  done: boolean;
  i?: number;
  options?: number[];
  img?: string;
  elapsed?: number;
  score: number;
  marks: ('hit' | 'miss')[];
  answers?: number[];
}
export interface CoverAnswerView {
  ok: boolean;
  answer: number;
  pts: number;
  score: number;
  marks: ('hit' | 'miss')[];
  done: boolean;
}
export interface HlStart {
  run: string;
  left: number;
  left_value: number;
  right: number;
  score: number;
}
export interface HlAnswer {
  ok: boolean;
  right_value: number;
  score: number;
  done: boolean;
  next?: number;
}

const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
/** Capa servida pelo servidor (link temporário que não diz qual é o anime). */
export const gameCoverUrl = (token: string) => `${supaUrl}/functions/v1/game-cover?t=${encodeURIComponent(token)}`;

/** Jogar precisa de conta: o servidor guarda o andamento e confere cada jogada. */
async function play<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error(t('Algo deu errado.'));
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error(t('Entre na sua conta pra jogar.'));
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (/too_fast/.test(error.message)) throw new Error(t('Calma, uma resposta por vez 🙂'));
    throw friendly(error);
  }
  return data as T;
}
export const animedleState = () => play<AnimedleView>('animedle_state');
export const animedleGuess = (id: number) => play<AnimedleView>('animedle_guess', { p_media: id });
export const coverRound = () => play<CoverRoundView>('cover_round');
export const coverAnswer = (choice: number) => play<CoverAnswerView>('cover_answer', { p_choice: choice });
export const hlStart = (mode: 'p' | 'sc') => play<HlStart>('hl_start', { p_mode: mode });
export const hlAnswer = (run: string, higher: boolean) => play<HlAnswer>('hl_answer', { p_run: run, p_higher: higher });

/** (antigo) gravava a pontuação mandada pelo navegador; o servidor não aceita mais. */
export async function submitScore(game: GameId, day: string, score: number, detail?: Record<string, unknown>) {
  if (!supabase) return null;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null; // sem conta: joga do mesmo jeito, só não entra no ranking
  const { data, error } = await supabase.rpc('submit_score', { p_game: game, p_day: day, p_score: score, p_detail: detail ?? null });
  if (error) throw friendly(error);
  return data as GameScore;
}

/** Ranking do dia: eu + amigos que eu sigo. */
export async function dayBoard(game: GameId, day: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('game_scores')
    .select('*')
    .eq('game', game)
    .eq('day', day)
    .order('score', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(50);
  if (error) throw friendly(error);
  return (data ?? []) as GameScore[];
}

/** Meus últimos resultados num jogo (pra sequência de dias). */
export async function myHistory(game: GameId, userId: string, limit = 60) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('game_scores')
    .select('day, score')
    .eq('game', game)
    .eq('user_id', userId)
    .order('day', { ascending: false })
    .limit(limit);
  if (error) throw friendly(error);
  return (data ?? []) as { day: string; score: number }[];
}
