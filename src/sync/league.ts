/** Liga da temporada: ligas entre amigos, escalação de 5 animes da temporada e pontos pelo AniList. */
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

export interface League {
  id: string;
  code: string;
  name: string;
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  year: number;
  owner: string;
  created_at: string;
}
export interface LeagueMember {
  league_id: string;
  user_id: string;
  name: string;
  swaps_left: number;
  joined_at: string;
}
export interface CatalogAnime {
  media_id: number;
  season: string;
  year: number;
  title: { r: string; e: string | null; n: string | null };
  cover: string | null;
  color: string | null;
  format: string | null;
  episodes: number | null;
  popularity: number;
  score: number | null;
  status: string | null;
  next_episode: number | null;
  next_airing_at: string | null;
  updated_at: string;
}
export interface PickPoints {
  pick_id: number;
  user_id: string;
  media_id: number;
  active: boolean;
  picked_at: string;
  dropped_at: string | null;
  members_gained: number;
  weeks: number;
  score: number | null;
  points: number;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};
function friendly(e: { message?: string } | null) {
  const m = e?.message ?? '';
  if (/not_logged/.test(m)) return new Error(t('Entre na sua conta pra jogar a liga.'));
  if (/no_league/.test(m)) return new Error(t('Não existe liga com esse código.'));
  if (/league_full/.test(m)) return new Error(t('Essa liga já está cheia.'));
  if (/too_many/.test(m)) return new Error(t('Você criou ligas demais hoje. Tente amanhã.'));
  if (/team_full/.test(m)) return new Error(t('Seu time já tem 5 animes. Tire um pra escolher outro.'));
  if (/already_taken/.test(m)) return new Error(t('Alguém da liga já escolheu esse anime.'));
  if (/not_this_season/.test(m)) return new Error(t('Esse anime não é desta temporada.'));
  if (/no_swaps/.test(m)) return new Error(t('Suas trocas da temporada acabaram.'));
  if (/not_member/.test(m)) return new Error(t('Você não está nessa liga.'));
  return new Error(m || t('Algo deu errado.'));
}

export async function myLeagues() {
  const { data, error } = await sb().from('leagues').select('*').order('created_at', { ascending: false });
  if (error) throw friendly(error);
  return (data ?? []) as League[];
}

export async function createLeague(name: string, myName: string) {
  const { data, error } = await sb().rpc('create_league', { p_name: name, p_my_name: myName });
  if (error) throw friendly(error);
  return data as League;
}

export async function joinLeague(code: string, myName: string) {
  const { data, error } = await sb().rpc('join_league', { p_code: code, p_my_name: myName });
  if (error) throw friendly(error);
  return data as League;
}

export async function loadLeague(id: string) {
  const [l, m, p] = await Promise.all([
    sb().from('leagues').select('*').eq('id', id).maybeSingle(),
    sb().from('league_members').select('*').eq('league_id', id).order('joined_at'),
    sb().rpc('league_points', { p_league: id }),
  ]);
  for (const r of [l, m, p]) if (r.error) throw friendly(r.error);
  if (!l.data) throw new Error(t('Liga não encontrada (ou você não faz parte dela).'));
  return { league: l.data as League, members: (m.data ?? []) as LeagueMember[], points: (p.data ?? []) as PickPoints[] };
}

export async function loadCatalog(season: string, year: number) {
  const { data, error } = await sb()
    .from('season_catalog')
    .select('*')
    .eq('season', season)
    .eq('year', year)
    .order('popularity', { ascending: false })
    .limit(200);
  if (error) throw friendly(error);
  return (data ?? []) as CatalogAnime[];
}

export async function pick(leagueId: string, mediaId: number) {
  const { error } = await sb().rpc('league_pick', { p_league: leagueId, p_media: mediaId });
  if (error) throw friendly(error);
}

export async function drop(pickId: number) {
  const { error } = await sb().rpc('league_drop', { p_pick: pickId });
  if (error) throw friendly(error);
}

export async function leaveLeague(leagueId: string, userId: string) {
  const { error } = await sb().from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
  if (error) throw friendly(error);
}

export function subscribeLeague(id: string, onChange: () => void) {
  const filter = `league_id=eq.${id}`;
  const ch = sb()
    .channel(`league:${id}:${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'league_members', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'league_picks', filter }, onChange)
    .subscribe();
  return () => {
    sb().removeChannel(ch);
  };
}

/** Ranking: soma dos pontos de todas as escalações (inclusive as que já saíram do time). */
export function standings(members: LeagueMember[], points: PickPoints[]) {
  return members
    .map((m) => {
      const mine = points.filter((p) => p.user_id === m.user_id);
      return {
        ...m,
        total: Math.round(mine.reduce((n, p) => n + Number(p.points), 0) * 10) / 10,
        active: mine.filter((p) => p.active),
        past: mine.filter((p) => !p.active),
      };
    })
    .sort((a, b) => b.total - a.total);
}
