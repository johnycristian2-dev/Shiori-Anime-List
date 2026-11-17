/**
 * Watch party: sala com código de 6 letras, cada um sugere animes e vota (até 3 votos por pessoa).
 * O anfitrião encerra e o mais votado vence (empate = sorteio). Tudo em tempo real (Supabase Realtime).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Media } from '../types';

import { t } from '../lib/i18n';

export const MAX_VOTES = 3;

export interface Room {
  code: string;
  host: string;
  name: string;
  status: 'voting' | 'done';
  winner: Media | null;
  created_at: string;
}
export interface Member {
  code: string;
  user_id: string;
  name: string;
}
export interface Item {
  code: string;
  media_id: number;
  media: Media;
  added_by: string;
  added_name: string | null;
}
export interface Vote {
  code: string;
  media_id: number;
  user_id: string;
}
export interface PartyState {
  room: Room;
  members: Member[];
  items: Item[];
  votes: Vote[];
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => ALPHABET[n % ALPHABET.length]).join('');

const sb = () => {
  if (!supabase) throw new Error(t('A watch party precisa da conta Shiori configurada (Supabase).'));
  return supabase;
};

/** Garante uma sessão: usa a conta logada ou entra como convidado (login anônimo do Supabase). */
export async function ensureSession() {
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session.user;
  const { data: anon, error } = await sb().auth.signInAnonymously();
  if (error) throw new Error(t(
    'Não deu pra entrar como convidado. Ative "Anonymous sign-ins" no Supabase ou entre com sua conta em Sync.'
  ));
  return anon.user!;
}

export async function createRoom(name: string, myName: string) {
  const user = await ensureSession();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { error } = await sb().from('party_rooms').insert({ code, host: user.id, name: name.trim() || 'Watch party' });
    if (error?.code === '23505') continue; // código repetido, tenta outro
    if (error) throw error;
    await joinRoom(code, myName);
    return code;
  }
  throw new Error(t('Não deu pra criar a sala, tente de novo.'));
}

export async function joinRoom(code: string, myName: string) {
  const user = await ensureSession();
  const c = code.trim().toUpperCase();
  const { data: room, error } = await sb().from('party_rooms').select('code').eq('code', c).maybeSingle();
  if (error) throw error;
  if (!room) throw new Error(t('Sala {0} não existe.', c));
  const name = myName.trim().slice(0, 24) || 'Otaku';
  // insert simples: "upsert" exigiria já enxergar a lista de membros (que só membros veem)
  const { error: e2 } = await sb().from('party_members').insert({ code: c, user_id: user.id, name });
  if (e2?.code === '23505') {
    // já estava na sala: só atualiza o nome
    const { error: e3 } = await sb().from('party_members').update({ name }).eq('code', c).eq('user_id', user.id);
    if (e3) throw e3;
  } else if (e2) throw e2;
  return c;
}

export async function loadParty(code: string): Promise<PartyState> {
  const [room, members, items, votes] = await Promise.all([
    sb().from('party_rooms').select('*').eq('code', code).maybeSingle(),
    sb().from('party_members').select('*').eq('code', code).order('joined_at'),
    sb().from('party_items').select('*').eq('code', code).order('created_at'),
    sb().from('party_votes').select('*').eq('code', code),
  ]);
  for (const r of [room, members, items, votes]) if (r.error) throw r.error;
  if (!room.data) throw new Error(t('Sala {0} não existe.', code));
  return { room: room.data as Room, members: (members.data ?? []) as Member[], items: (items.data ?? []) as Item[], votes: (votes.data ?? []) as Vote[] };
}

/** Só os campos que a sala precisa (mantém a linha pequena). */
const slim = (m: Media): Media => ({
  id: m.id,
  idMal: m.idMal,
  title: m.title,
  coverImage: m.coverImage,
  bannerImage: m.bannerImage,
  episodes: m.episodes,
  format: m.format,
  status: m.status,
  season: m.season,
  seasonYear: m.seasonYear,
  averageScore: m.averageScore,
  popularity: m.popularity,
  genres: m.genres,
});

export async function addItem(code: string, media: Media, myName: string) {
  const user = await ensureSession();
  const { error } = await sb().from('party_items').insert({ code, media_id: media.id, media: slim(media), added_by: user.id, added_name: myName });
  if (error?.code === '23505') throw new Error(t('Esse anime já está na votação.'));
  if (error) throw error;
}

export async function removeItem(code: string, mediaId: number) {
  const { error } = await sb().from('party_items').delete().eq('code', code).eq('media_id', mediaId);
  if (error) throw error;
}

export async function setVote(code: string, mediaId: number, on: boolean) {
  const user = await ensureSession();
  const q = on
    ? sb().from('party_votes').insert({ code, media_id: mediaId, user_id: user.id })
    : sb().from('party_votes').delete().eq('code', code).eq('media_id', mediaId).eq('user_id', user.id);
  const { error } = await q;
  if (error && error.code !== '23505') throw error;
}

/** Conta os votos; empate é decidido no sorteio. */
export function tally(items: Item[], votes: Vote[]) {
  const count = new Map<number, number>();
  votes.forEach((v) => count.set(v.media_id, (count.get(v.media_id) ?? 0) + 1));
  return items
    .map((i) => ({ item: i, votes: count.get(i.media_id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || (b.item.media.averageScore ?? 0) - (a.item.media.averageScore ?? 0));
}

export async function closeVoting(state: PartyState) {
  const ranked = tally(state.items, state.votes);
  if (!ranked.length) throw new Error(t('Adicione pelo menos um anime antes de encerrar.'));
  const top = ranked.filter((r) => r.votes === ranked[0].votes);
  const winner = top[Math.floor(Math.random() * top.length)].item.media;
  const { error } = await sb().from('party_rooms').update({ status: 'done', winner }).eq('code', state.room.code);
  if (error) throw error;
}

export async function reopenVoting(code: string) {
  const { error } = await sb().from('party_rooms').update({ status: 'voting', winner: null }).eq('code', code);
  if (error) throw error;
}

/** Escuta mudanças da sala e quem está online (presence). */
export function subscribeParty(code: string, me: { id: string; name: string }, onChange: () => void, onPresence: (ids: string[]) => void) {
  const filter = `code=eq.${code}`;
  let ch: RealtimeChannel = sb().channel(`party:${code}`, { config: { presence: { key: me.id } } });
  for (const table of ['party_rooms', 'party_members', 'party_items', 'party_votes'])
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange);
  ch.on('presence', { event: 'sync' }, () => onPresence(Object.keys(ch.presenceState()))).subscribe((status) => {
    if (status === 'SUBSCRIBED') ch.track({ name: me.name });
  });
  return () => {
    sb().removeChannel(ch);
  };
}
