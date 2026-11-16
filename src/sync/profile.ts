/**
 * Perfil público: guarda uma "foto" da lista (sem anotações) na tabela profiles,
 * que qualquer pessoa pode ver em /u/apelido.
 */
import { supabase } from '../lib/supabase';
import { ACHIEVEMENTS, computeStats, rankOf } from '../lib/profile';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { ListEntry, ListStatus, MediaFormat } from '../types';

import { t } from '../lib/i18n';

export interface Profile {
  user_id: string;
  username: string;
  display_name: string | null;
  is_public: boolean;
  snapshot: Snapshot;
  updated_at: string;
}

/** Formato compacto (chaves curtas) pra caber listas grandes */
interface SnapEntry {
  id: number;
  t: string;
  te: string | null;
  c: string | null;
  col: string | null;
  s: ListStatus;
  sc: number;
  p: number;
  f?: boolean;
  g: string[];
  y: number | null;
  fm: MediaFormat | null;
  ep: number | null;
  a: number | null;
  /** M = leitura (mangá, manhwa, webtoon…) */
  ty?: 'M';
  ch?: number | null;
  co?: string | null;
}

export interface Snapshot {
  v?: 1;
  rank?: { name: string; jp: string };
  stats?: { total: number; completed: number; eps: number; hours: number; mean: number; chapters?: number };
  achievements?: string[];
  entries?: SnapEntry[];
  updatedAt?: number;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function buildSnapshot(): Snapshot {
  const { entries, gacha } = useList.getState();
  const all = Object.values(entries);
  const st = computeStats(all);
  return {
    v: 1,
    rank: (({ name, jp }) => ({ name, jp }))(rankOf(st.completed)),
    stats: { total: st.total, completed: st.completed, eps: st.eps, hours: st.hours, mean: Math.round(st.mean * 10) / 10, chapters: st.chapters },
    achievements: ACHIEVEMENTS.filter((a) => a.test(st, gacha)).map((a) => a.id),
    entries: all.map((e) => ({
      id: e.mediaId,
      t: e.title,
      te: e.titleEnglish,
      c: e.cover,
      col: e.color,
      s: e.status,
      sc: e.score,
      p: e.progress,
      ...(e.favorite ? { f: true } : {}),
      g: e.genres,
      y: e.year,
      fm: e.format,
      ep: e.episodes,
      a: e.averageScore,
      ...(e.type === 'MANGA' ? { ty: 'M' as const, ch: e.chapters ?? null, co: e.country ?? null } : {}),
    })),
    updatedAt: Date.now(),
  };
}

export function snapshotEntries(s: Snapshot): ListEntry[] {
  return (s.entries ?? []).map((x) => ({
    mediaId: x.id,
    idMal: null,
    title: x.t,
    titleEnglish: x.te,
    titleNative: null,
    cover: x.c,
    color: x.col,
    format: x.fm,
    episodes: x.ep,
    year: x.y,
    genres: x.g ?? [],
    averageScore: x.a,
    status: x.s,
    score: x.sc,
    progress: x.p,
    favorite: x.f,
    ...(x.ty === 'M' ? { type: 'MANGA' as const, chapters: x.ch ?? null, country: x.co ?? null } : {}),
    addedAt: 0,
    updatedAt: 0,
  }));
}

export async function getMyProfile(userId: string) {
  const { data, error } = await supabase!.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getPublicProfile(username: string) {
  if (!supabase) throw new Error(t('Perfis públicos precisam da conta Shiori configurada (Supabase).'));
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(t('Perfil "{0}" não encontrado (ou é privado).', username));
  return data as Profile;
}

export async function saveProfile(userId: string, p: { username: string; display_name: string; is_public: boolean }) {
  const username = p.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error(t('Apelido: 3 a 20 letras minúsculas, números ou _'));
  const { error } = await supabase!.from('profiles').upsert({
    user_id: userId,
    username,
    display_name: p.display_name.trim() || null,
    is_public: p.is_public,
    snapshot: buildSnapshot(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505') throw new Error(t('Esse apelido já está em uso.'));
    throw error;
  }
  if (!useUI.getState().nickname) useUI.getState().setNickname(p.display_name.trim() || username);
}

let lastPublish = 0;
/** Atualiza a foto pública (no máximo a cada 30s). Chamado depois de cada sincronização. */
export async function publishSnapshot(userId: string, force = false) {
  if (!supabase || (!force && Date.now() - lastPublish < 30_000)) return;
  lastPublish = Date.now();
  await supabase.from('profiles').update({ snapshot: buildSnapshot(), updated_at: new Date().toISOString() }).eq('user_id', userId);
}

export const profileUrl = (username: string) => `${window.location.origin}${window.location.pathname}#/u/${username}`;
