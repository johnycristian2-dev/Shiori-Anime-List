/**
 * Social: seguir, amigos, pedidos, feed de atividades, notificações, bloquear e denunciar.
 * As regras de quem vê o quê ficam no banco (supabase/social.sql); aqui é só a ponte.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useList } from '../store/list';
import type { ListEntry, MediaType } from '../types';
import { useCloudUser } from './cloud';
import { useAccount } from './account';

export interface MiniProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_public?: boolean;
  bio?: string | null;
}

export type FollowState = 'none' | 'pending' | 'accepted';
export interface Relation {
  following: FollowState;
  followsMe: FollowState;
  blocked: boolean;
}

export interface ActivityMedia {
  id: number;
  title: string;
  titleEnglish?: string | null;
  cover: string | null;
  type?: MediaType;
  country?: string | null;
}
export type ActivityKind = 'add' | 'done' | 'score' | 'progress';
export interface Activity {
  id: number;
  user_id: string;
  kind: ActivityKind;
  media_id: number;
  media: ActivityMedia;
  value: number | null;
  status: string | null;
  created_at: string;
}
export interface Notification {
  id: number;
  actor: string | null;
  post_id?: number | null;
  kind: 'follow' | 'request' | 'accepted' | 'like' | 'comment';
  read: boolean;
  created_at: string;
}

export const REPORT_REASONS = [
  { id: 'spam', get label() { return t('Spam ou propaganda'); } },
  { id: 'harassment', get label() { return t('Assédio ou ofensa'); } },
  { id: 'hate', get label() { return t('Discurso de ódio'); } },
  { id: 'sexual', get label() { return t('Conteúdo sexual'); } },
  { id: 'violence', get label() { return t('Violência ou ameaça'); } },
  { id: 'minor_safety', get label() { return t('Risco a menor de idade'); } },
  { id: 'impersonation', get label() { return t('Se passando por outra pessoa'); } },
  { id: 'other', get label() { return t('Outro motivo'); } },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};
const me = () => {
  const u = useCloudUser.getState().user;
  if (!u || u.is_anonymous) throw new Error(t('Entre na sua conta primeiro.'));
  return u.id;
};

function friendly(e: { message?: string; code?: string } | null) {
  const m = e?.message ?? '';
  if (/rate_limited/.test(m)) return new Error(t('Calma! Muitas ações seguidas. Espere um minuto.'));
  if (/row-level security|violates/i.test(m)) return new Error(t('Não é possível fazer isso com este perfil.'));
  return new Error(m || t('Algo deu errado.'));
}

// ───────────── Estado global (badge de notificações) ─────────────
interface SocialState {
  unread: number;
  requests: number;
}
export const useSocial = create<SocialState>(() => ({ unread: 0, requests: 0 }));

export async function refreshCounts() {
  const u = useCloudUser.getState().user;
  if (!supabase || !u || u.is_anonymous) return useSocial.setState({ unread: 0, requests: 0 });
  const [n, r] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('read', false),
    supabase.from('follows').select('follower', { count: 'exact', head: true }).eq('followee', u.id).eq('status', 'pending'),
  ]);
  useSocial.setState({ unread: n.count ?? 0, requests: r.count ?? 0 });
}

// ───────────── Perfis ─────────────
const cache = new Map<string, MiniProfile>();

export async function miniProfiles(ids: string[]): Promise<Record<string, MiniProfile>> {
  const want = [...new Set(ids)].filter((id) => id && !cache.has(id));
  if (want.length) {
    const { data, error } = await sb().rpc('mini_profiles', { ids: want });
    if (error) throw friendly(error);
    (data as MiniProfile[]).forEach((p) => cache.set(p.user_id, p));
  }
  return Object.fromEntries(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)!]));
}

export async function searchProfiles(q: string) {
  if (q.trim().length < 2) return [];
  const { data, error } = await sb().rpc('search_profiles', { q: q.trim() });
  if (error) throw friendly(error);
  return data as MiniProfile[];
}

export async function followCounts(uid: string) {
  const { data, error } = await sb().rpc('follow_counts', { uid });
  if (error) throw friendly(error);
  const row = (data as { followers: number; following: number; friends: number }[])[0];
  return row ?? { followers: 0, following: 0, friends: 0 };
}

// ───────────── Relações ─────────────
export async function getRelation(other: string): Promise<Relation> {
  const uid = me();
  const [f, b] = await Promise.all([
    sb().from('follows').select('follower,followee,status').or(`and(follower.eq.${uid},followee.eq.${other}),and(follower.eq.${other},followee.eq.${uid})`),
    sb().from('blocks').select('blocked').eq('blocker', uid).eq('blocked', other),
  ]);
  if (f.error) throw friendly(f.error);
  const rows = (f.data ?? []) as { follower: string; followee: string; status: FollowState }[];
  return {
    following: rows.find((r) => r.follower === uid)?.status ?? 'none',
    followsMe: rows.find((r) => r.follower === other)?.status ?? 'none',
    blocked: !!b.data?.length,
  };
}

export async function follow(other: string): Promise<FollowState> {
  const { data, error } = await sb().from('follows').insert({ followee: other }).select('status').single();
  if (error) {
    if (error.code === '23505') return 'accepted';
    throw friendly(error);
  }
  return (data as { status: FollowState }).status;
}

export async function unfollow(other: string) {
  const { error } = await sb().from('follows').delete().eq('follower', me()).eq('followee', other);
  if (error) throw friendly(error);
}

export async function acceptRequest(from: string) {
  const { error } = await sb().from('follows').update({ status: 'accepted' }).eq('follower', from).eq('followee', me());
  if (error) throw friendly(error);
  refreshCounts();
}

/** Recusa um pedido ou remove alguém dos seus seguidores */
export async function removeFollower(from: string) {
  const { error } = await sb().from('follows').delete().eq('follower', from).eq('followee', me());
  if (error) throw friendly(error);
  refreshCounts();
}

export async function block(other: string) {
  const { error } = await sb().from('blocks').insert({ blocked: other });
  if (error && error.code !== '23505') throw friendly(error);
  cache.delete(other);
}

export async function unblock(other: string) {
  const { error } = await sb().from('blocks').delete().eq('blocker', me()).eq('blocked', other);
  if (error) throw friendly(error);
}

export async function listBlocked() {
  const { data, error } = await sb().from('blocks').select('blocked').eq('blocker', me());
  if (error) throw friendly(error);
  const ids = (data ?? []).map((r) => r.blocked as string);
  // perfil de quem você bloqueou não vem por mini_profiles (o bloqueio esconde); mostra o apelido se público
  const { data: ps } = await sb().from('profiles').select('user_id,username,display_name,avatar_url').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  return ids.map((id) => (ps ?? []).find((p) => p.user_id === id) ?? { user_id: id, username: '???', display_name: null, avatar_url: null }) as MiniProfile[];
}

export async function report(p: { targetUser: string; kind: 'profile' | 'activity' | 'post' | 'comment' | 'message'; targetId?: string; reason: ReportReason; details?: string }) {
  const { error } = await sb()
    .from('reports')
    .insert({ target_user: p.targetUser, target_kind: p.kind, target_id: p.targetId ?? null, reason: p.reason, details: p.details?.trim().slice(0, 500) || null });
  if (error) throw friendly(error);
}

/** Pessoas ligadas a você: seguindo, seguidores, amigos (os dois se seguem) e pedidos */
export async function myConnections() {
  const uid = me();
  const { data, error } = await sb().from('follows').select('follower,followee,status,created_at').or(`follower.eq.${uid},followee.eq.${uid}`).limit(1000);
  if (error) throw friendly(error);
  const rows = (data ?? []) as { follower: string; followee: string; status: FollowState; created_at: string }[];
  const following = rows.filter((r) => r.follower === uid && r.status === 'accepted').map((r) => r.followee);
  const sent = rows.filter((r) => r.follower === uid && r.status === 'pending').map((r) => r.followee);
  const followers = rows.filter((r) => r.followee === uid && r.status === 'accepted').map((r) => r.follower);
  const requests = rows.filter((r) => r.followee === uid && r.status === 'pending').map((r) => r.follower);
  const friends = following.filter((id) => followers.includes(id));
  const profiles = await miniProfiles([...following, ...sent, ...followers, ...requests]);
  return { following, sent, followers, requests, friends, profiles };
}

// ───────────── Feed ─────────────
export async function loadFeed(before?: string) {
  const uid = me();
  const { data: f } = await sb().from('follows').select('followee').eq('follower', uid).eq('status', 'accepted').limit(500);
  const ids = [uid, ...(f ?? []).map((r) => r.followee as string)];
  let q = sb().from('activities').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(30);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw friendly(error);
  const items = (data ?? []) as Activity[];
  const profiles = await miniProfiles(items.map((a) => a.user_id));
  return { items, profiles, followingCount: ids.length - 1, ids };
}

export async function deleteActivity(id: number) {
  const { error } = await sb().from('activities').delete().eq('id', id);
  if (error) throw friendly(error);
}

export async function friendsWithMedia(mediaId: number) {
  const { data, error } = await sb().rpc('friends_with_media', { mid: mediaId });
  if (error) throw friendly(error);
  return data as (MiniProfile & { status: string; score: number; progress: number })[];
}

// ───────────── Notificações ─────────────
export async function loadNotifications() {
  const { data, error } = await sb().from('notifications').select('id,actor,kind,read,created_at,post_id').eq('user_id', me()).order('created_at', { ascending: false }).limit(40);
  if (error) throw friendly(error);
  const items = (data ?? []) as Notification[];
  const postIds = [...new Set(items.map((n) => n.post_id).filter((x): x is number => !!x))];
  const [profiles, posts] = await Promise.all([
    miniProfiles(items.map((n) => n.actor ?? '').filter(Boolean)),
    postIds.length ? sb().from('posts').select('id,kind,media_id,media,body').in('id', postIds) : Promise.resolve({ data: [] }),
  ]);
  const postMap = Object.fromEntries(((posts.data ?? []) as { id: number; kind: string; media_id: number | null; media: ActivityMedia | null; body: string }[]).map((p) => [p.id, p]));
  return { items, profiles, posts: postMap };
}

export async function markAllRead() {
  const { error } = await sb().from('notifications').update({ read: true }).eq('user_id', me()).eq('read', false);
  if (error) throw friendly(error);
  useSocial.setState({ unread: 0 });
}

// ───────────── Postar no feed automaticamente ─────────────
function mediaOf(e: ListEntry): ActivityMedia {
  return { id: e.mediaId, title: e.title, titleEnglish: e.titleEnglish, cover: e.cover, type: e.type ?? 'ANIME', country: e.country ?? null };
}

async function post(kind: ActivityKind, e: ListEntry, value?: number) {
  if (!supabase) return;
  const u = useCloudUser.getState().user;
  const profile = useAccount.getState().profile;
  if (!u || u.is_anonymous || profile?.share_activity === false) return;
  await supabase.from('activities').insert({ kind, media_id: e.mediaId, media: mediaOf(e), value: value ?? null, status: e.status });
}

let wired = false;
let channel: RealtimeChannel | null = null;

export function wireSocial() {
  if (wired || !supabase) return;
  wired = true;
  const started = Date.now();
  let lastAt = Math.max(0, ...(useList.getState().history ?? []).map((h) => h.at));

  // Cada ação nova na lista (adicionou, terminou, deu nota, avançou) vira uma atividade no feed.
  // Eventos antigos que chegam pela sincronização são ignorados; importações em massa também.
  useList.subscribe((s, prev) => {
    if (s.history === prev.history) return;
    const fresh = (s.history ?? []).filter((h) => h.at > lastAt && h.at >= started && Date.now() - h.at < 15_000);
    if (fresh.length) lastAt = Math.max(lastAt, ...fresh.map((h) => h.at));
    if (!fresh.length || fresh.length > 6) return;
    for (const h of fresh) {
      const e = s.entries[h.m];
      if (!e) continue;
      const kind: ActivityKind = h.t === 'ep' ? 'progress' : h.t;
      post(kind, e, h.t === 'score' ? h.v : h.t === 'ep' ? e.progress : undefined).catch(() => undefined);
    }
  });

  // Notificações em tempo real (badge no menu da conta)
  let lastUser: string | undefined;
  useCloudUser.subscribe((st) => {
    const id = st.user && !st.user.is_anonymous ? st.user.id : undefined;
    if (id === lastUser) return;
    lastUser = id;
    if (channel) supabase!.removeChannel(channel);
    channel = null;
    cache.clear();
    refreshCounts().catch(() => undefined);
    if (!id) return;
    channel = supabase!
      .channel(`notif-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` }, () => {
        refreshCounts().catch(() => undefined);
      })
      .subscribe();
  });
}

/** Nome/foto de um perfil pelo apelido, mesmo privado (pra poder pedir pra seguir) */
export async function profileCard(username: string) {
  const { data, error } = await sb().rpc('profile_card', { uname: username });
  if (error) throw friendly(error);
  return ((data as MiniProfile[]) ?? [])[0] ?? null;
}

export async function amIAdmin() {
  if (!supabase) return false;
  const { data } = await supabase.rpc('is_admin');
  return !!data;
}

export interface ReportRow {
  id: number;
  reporter: string;
  target_user: string | null;
  target_kind: string;
  target_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

/** Moderação: denúncias (o banco só devolve tudo pra administradores) */
export async function loadReports(status: 'open' | 'resolved' | 'dismissed' = 'open') {
  const { data, error } = await sb().from('reports').select('*').eq('status', status).order('created_at', { ascending: false }).limit(100);
  if (error) throw friendly(error);
  const rows = (data ?? []) as ReportRow[];
  const ids = [...new Set(rows.flatMap((r) => [r.reporter, r.target_user ?? '']).filter(Boolean))];
  const { data: ps } = await sb().from('profiles').select('user_id,username,display_name,avatar_url,is_public,bio').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  return { rows, profiles: Object.fromEntries(((ps ?? []) as MiniProfile[]).map((p) => [p.user_id, p])) };
}

export async function setReportStatus(id: number, status: 'resolved' | 'dismissed' | 'open') {
  const { error } = await sb().from('reports').update({ status, resolved_at: status === 'open' ? null : new Date().toISOString() }).eq('id', id);
  if (error) throw friendly(error);
}
