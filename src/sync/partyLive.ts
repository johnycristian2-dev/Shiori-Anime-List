/**
 * Watch party ao vivo: chat da sala + estado do player compartilhado.
 * O player em si roda no Crunchyroll; quem sincroniza é a extensão Shiori (pasta /extension).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

export interface PartyMessage {
  id: number;
  code: string;
  user_id: string;
  name: string;
  body: string;
  kind: 'msg' | 'sys';
  created_at: string;
}
export interface Playback {
  code: string;
  episode_url: string | null;
  episode_id: string | null;
  title: string | null;
  playing: boolean;
  position: number;
  updated_at: string;
  updated_by: string | null;
  by_name: string | null;
  by_client: string | null;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};

function friendly(e: { message?: string } | null) {
  const m = e?.message ?? '';
  if (/new_account_links/.test(m)) return new Error(t('Contas novas só podem mandar links depois de 24 horas.'));
  if (/community_paused/.test(m)) return new Error(t('A comunidade está pausada pela moderação. Tente de novo mais tarde.'));
  if (/\bmuted\b/.test(m)) return new Error(t('Você está silenciado pela moderação por um tempo.'));
  if (/hate_terms/.test(m)) return new Error(t('Sua mensagem tem termos ofensivos e não foi enviada.'));
  if (/slow_down/.test(m)) return new Error(t('Devagar! Espere alguns segundos antes de mandar mais.'));
  if (/row-level security|violates/i.test(m)) return new Error(t('Você não pode escrever neste chat agora.'));
  return new Error(m || t('Algo deu errado.'));
}

/** Link de episódio do Crunchyroll → id ("GXXXXXX"), ou null se não for um link de episódio. */
export function crunchyEpisode(url: string) {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)crunchyroll\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/watch\/([A-Z0-9]+)/i);
    return m ? { id: m[1].toUpperCase(), url: `https://www.crunchyroll.com${u.pathname}` } : null;
  } catch {
    return null;
  }
}

export async function loadMessages(code: string) {
  const { data, error } = await sb()
    .from('party_messages')
    .select('*')
    .eq('code', code)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw friendly(error);
  return ((data ?? []) as PartyMessage[]).reverse();
}

export async function sendMessage(code: string, userId: string, name: string, body: string) {
  const text = body.trim().slice(0, 500);
  if (!text) return;
  const { error } = await sb()
    .from('party_messages')
    .insert({ code, user_id: userId, name: name.trim().slice(0, 24) || 'Otaku', body: text });
  if (error) throw friendly(error);
}

export async function deleteMessage(id: number) {
  const { error } = await sb().from('party_messages').delete().eq('id', id);
  if (error) throw friendly(error);
}

export async function loadPlayback(code: string) {
  const { data, error } = await sb().from('party_playback').select('*').eq('code', code).maybeSingle();
  if (error) throw friendly(error);
  return (data as Playback | null) ?? null;
}

/** Define o episódio da sessão (pausado no começo). */
export async function setEpisode(code: string, userId: string, name: string, url: string) {
  const ep = crunchyEpisode(url);
  if (!ep) throw new Error(t('Cole o link de um episódio do Crunchyroll (crunchyroll.com/watch/…).'));
  const { error } = await sb().from('party_playback').upsert({
    code,
    episode_url: ep.url,
    episode_id: ep.id,
    title: null,
    playing: false,
    position: 0,
    updated_by: userId,
    by_name: name,
    by_client: 'site',
  });
  if (error) throw friendly(error);
}

/** Tempo atual estimado do player do grupo (em segundos). */
export const livePosition = (p: Playback, now = Date.now()) =>
  p.playing ? p.position + Math.max(0, (now - new Date(p.updated_at).getTime()) / 1000) : p.position;

export const clock = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  const h = Math.floor(v / 3600);
  const mm = String(Math.floor((v % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(v % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export function subscribeLive(
  code: string,
  onMessage: (m: PartyMessage, ev: 'INSERT' | 'DELETE') => void,
  onPlayback: (p: Playback) => void
) {
  const filter = `code=eq.${code}`;
  const ch: RealtimeChannel = sb()
    .channel(`party-live:${code}:${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter }, (p) =>
      onMessage(p.new as PartyMessage, 'INSERT')
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'party_messages' }, (p) =>
      onMessage(p.old as PartyMessage, 'DELETE')
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'party_playback', filter }, (p) => {
      if (p.new && (p.new as Playback).code) onPlayback(p.new as Playback);
    })
    .subscribe();
  return () => {
    sb().removeChannel(ch);
  };
}

/* ---------- ponte com a extensão (via window.postMessage) ---------- */

export const EXT_SOURCE_SITE = 'shiori-site';
export const EXT_SOURCE_EXT = 'shiori-ext';

export interface ExtStatus {
  version: string;
  loggedIn: boolean;
  room: string | null;
}

/** Pergunta à extensão se ela está instalada; resolve null se não responder. */
export function pingExtension(timeout = 700): Promise<ExtStatus | null> {
  return new Promise((resolve) => {
    const done = (v: ExtStatus | null) => {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== EXT_SOURCE_EXT || e.data.type !== 'status') return;
      done(e.data.status as ExtStatus);
    };
    const timer = setTimeout(() => done(null), timeout);
    window.addEventListener('message', onMsg);
    window.postMessage({ source: EXT_SOURCE_SITE, type: 'ping' }, window.location.origin);
  });
}

/** Diz à extensão em qual sala entrar (ela usa a própria conta logada). */
export function connectExtension(code: string, name: string) {
  window.postMessage({ source: EXT_SOURCE_SITE, type: 'connect', code, name }, window.location.origin);
}
