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
