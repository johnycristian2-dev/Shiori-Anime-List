/**
 * Chats em tempo real: uma sala por anime/mangá, uma por temporada e a sala Geral.
 * Regras (quem lê, quem escreve, limites) ficam no banco: supabase/chat.sql.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import type { MediaType, Season } from '../types';
import { useCloudUser } from './cloud';
import { useAccount } from './account';
import { miniProfiles, type MiniProfile } from './social';

export interface RoomMedia {
  id: number;
  title: string;
  titleEnglish?: string | null;
  cover: string | null;
  type?: MediaType;
  country?: string | null;
  total?: number | null;
}
export interface Room {
  id: string;
  title: string;
  media: RoomMedia | null;
  message_count: number;
  last_message_at: string | null;
}
export interface ChatMessage {
  id: number;
  room_id: string;
  user_id: string;
  body: string;
  spoiler: boolean;
  episode: number | null;
  reply_to: number | null;
  hidden: boolean;
  created_at: string;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};

function friendly(e: { message?: string } | null) {
  const m = e?.message ?? '';
  if (/hate_terms/.test(m)) return new Error(t('Sua mensagem tem termos ofensivos e não foi enviada.'));
  if (/rate_limited/.test(m)) return new Error(t('Devagar! Espere alguns segundos antes de mandar mais.'));
  if (/duplicate_message/.test(m)) return new Error(t('Você acabou de mandar essa mesma mensagem.'));
  if (/row-level security|violates/i.test(m)) return new Error(t('Você não pode escrever neste chat agora.'));
  return new Error(m || t('Algo deu errado.'));
}

export const mediaRoomId = (id: number) => `media:${id}`;
export const seasonRoomId = (season: Season, year: number) => `season:${season}-${year}`;

export async function ensureRoom(id: string, title: string, media?: RoomMedia | null) {
  const { error } = await sb().rpc('ensure_room', { rid: id, rtitle: title, rmedia: media ?? null });
  if (error) throw friendly(error);
}

export async function getRoom(id: string) {
  const { data, error } = await sb().from('chat_rooms').select('*').eq('id', id).maybeSingle();
  if (error) throw friendly(error);
  return data as Room | null;
}

export async function listRooms() {
  const { data, error } = await sb().from('chat_rooms').select('*').not('last_message_at', 'is', null).order('last_message_at', { ascending: false }).limit(40);
  if (error) throw friendly(error);
  return (data ?? []) as Room[];
}

export async function roomsByIds(ids: string[]) {
  if (!ids.length) return [] as Room[];
  const { data } = await sb().from('chat_rooms').select('*').in('id', ids);
  return (data ?? []) as Room[];
}

export async function loadMessages(roomId: string, before?: string) {
  let q = sb().from('chat_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(50);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw friendly(error);
  const messages = ((data ?? []) as ChatMessage[]).reverse();
  return { messages, profiles: await authors(messages.map((m) => m.user_id)) };
}

/** Nome e foto de quem escreveu (logado: pelas regras de amizade; visitante: perfis públicos) */
export async function authors(ids: string[]): Promise<Record<string, MiniProfile>> {
  const u = useCloudUser.getState().user;
  if (u && !u.is_anonymous) return miniProfiles(ids);
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const { data } = await sb().from('profiles').select('user_id,username,display_name,avatar_url').in('user_id', uniq);
  return Object.fromEntries(((data ?? []) as MiniProfile[]).map((p) => [p.user_id, p]));
}

export async function sendMessage(roomId: string, body: string, opts: { spoiler?: boolean; episode?: number | null; replyTo?: number | null } = {}) {
  const { data, error } = await sb()
    .from('chat_messages')
    .insert({ room_id: roomId, body: body.trim(), spoiler: !!opts.spoiler || opts.episode != null, episode: opts.episode ?? null, reply_to: opts.replyTo ?? null })
    .select()
    .single();
  if (error) throw friendly(error);
  return data as ChatMessage;
}

export async function deleteMessage(id: number) {
  const { error } = await sb().from('chat_messages').delete().eq('id', id);
  if (error) throw friendly(error);
}

export async function setMessageHidden(id: number, hidden: boolean) {
  const { error } = await sb().from('chat_messages').update({ hidden }).eq('id', id);
  if (error) throw friendly(error);
}

/** Moderador: silencia alguém em todos os chats por X horas */
export async function muteUser(userId: string, hours: number, reason?: string) {
  const until = new Date(Date.now() + hours * 3600_000).toISOString();
  const { error } = await sb().from('chat_mutes').upsert({ user_id: userId, until, reason: reason ?? null });
  if (error) throw friendly(error);
}

export async function myChatStatus() {
  const u = useCloudUser.getState().user;
  if (!supabase || !u || u.is_anonymous) return { minor: false, mutedUntil: null as string | null };
  const [minor, mute] = await Promise.all([supabase.rpc('i_am_minor'), supabase.from('chat_mutes').select('until').eq('user_id', u.id).maybeSingle()]);
  const until = (mute.data as { until: string } | null)?.until ?? null;
  return { minor: !!minor.data, mutedUntil: until && new Date(until) > new Date() ? until : null };
}

export interface PresenceUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Entra na sala em tempo real: novas mensagens, apagadas/ocultadas e quem está online.
 * Devolve uma função pra sair.
 */
export function joinRoom(
  roomId: string,
  handlers: {
    onInsert: (m: ChatMessage) => void;
    onUpdate: (m: ChatMessage) => void;
    onDelete: (id: number) => void;
    onPresence: (users: PresenceUser[], guests: number) => void;
  },
) {
  const client = sb();
  const u = useCloudUser.getState().user;
  const me = u && !u.is_anonymous ? useAccount.getState().profile : null;
  const key = me?.user_id ?? `guest-${Math.random().toString(36).slice(2, 10)}`;
  const channel: RealtimeChannel = client.channel(`room:${roomId}`, { config: { presence: { key } } });
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (p) => handlers.onInsert(p.new as ChatMessage))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (p) => handlers.onUpdate(p.new as ChatMessage))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
      const id = (p.old as { id?: number }).id;
      if (id) handlers.onDelete(id);
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceUser & { guest?: boolean }>();
      const all = Object.values(state).map((arr) => arr[0]);
      handlers.onPresence(all.filter((x) => !x.guest) as PresenceUser[], all.filter((x) => x.guest).length);
    })
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track(
        me ? { user_id: me.user_id, username: me.username, display_name: me.display_name, avatar_url: me.avatar_url ?? null } : { guest: true },
      );
    });
  return () => {
    client.removeChannel(channel);
  };
}
