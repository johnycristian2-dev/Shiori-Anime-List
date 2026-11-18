/** Painel do dono e da moderação: chamadas ao servidor (tudo confere o papel lá dentro). */
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

const sb = () => {
  if (!supabase) throw new Error('offline');
  return supabase;
};
function friendly(e: { message?: string } | null) {
  const m = e?.message ?? '';
  if (/owner_only/.test(m)) return new Error(t('Só o dono pode fazer isso.'));
  if (/not_allowed/.test(m)) return new Error(t('Você não tem permissão pra isso.'));
  if (/profiles_username/.test(m) || /duplicate key/.test(m)) return new Error(t('Esse apelido não pode ser usado.'));
  return new Error(m || t('Algo deu errado.'));
}
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw friendly(error);
  return data as T;
}

export interface AdminStats {
  users: number;
  users_24h: number;
  users_7d: number;
  active_24h: number;
  active_lists_7d: number;
  public_profiles: number;
  banned: number;
  muted: number;
  posts_24h: number;
  comments_24h: number;
  chat_24h: number;
  games_today: number;
  reports_open: number;
  bugs_open: number;
  plus_active: number;
  supporters: number;
  revenue_month_cents: number;
  revenue_total_cents: number;
  paused: boolean;
  signups_by_day: { day: string; n: number }[];
}
export interface AdminUser {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  muted_until: string | null;
  minor: boolean;
  is_mod: boolean;
  owner: boolean;
  plus_until: string | null;
  supporter: boolean;
  reports_against: number;
  is_public: boolean;
}
export type ContentKind = 'post' | 'comment' | 'message';
export interface UserActivity {
  posts: number;
  comments: number;
  messages: number;
  followers: number;
  following: number;
  reports: { id: number; reason: string; details: string | null; status: string; at: string }[];
  log: { action: string; details: Record<string, unknown> | null; at: string }[];
  recent: { kind: ContentKind; id: number; body: string; hidden: boolean; at: string; room?: string }[];
}
export interface ContentRow {
  kind: ContentKind;
  id: number;
  user_id: string;
  username: string | null;
  body: string;
  hidden: boolean;
  created_at: string;
  place: string | null;
}
export interface LogRow {
  id: number;
  actor: string | null;
  action: string;
  target_user: string | null;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const amIOwner = () => rpc<boolean>('is_owner');
export const adminStats = () => rpc<AdminStats>('admin_stats');
export const searchUsers = (q: string, filter: string) => rpc<AdminUser[]>('admin_search_users', { q, p_filter: filter });
export const userActivity = (id: string) => rpc<UserActivity>('admin_user_activity', { p_user: id });
export const muteFor = (id: string, hours: number, reason?: string) => rpc<void>('admin_mute', { p_user: id, p_hours: hours, p_reason: reason ?? null });
export const resetProfile = (id: string, fields: string[]) => rpc<void>('admin_reset_profile', { p_user: id, p_fields: fields });
export const renameUser = (id: string, username: string) => rpc<void>('admin_rename', { p_user: id, p_username: username });
export const purgeContent = (id: string, hours: number) => rpc<{ messages: number; comments: number; posts: number }>('admin_purge_content', { p_user: id, p_hours: hours });
export const setModerator = (id: string, on: boolean) => rpc<void>('owner_set_moderator', { p_user: id, p_on: on });
export const grantPlus = (id: string, days: number) => rpc<void>('owner_grant_plus', { p_user: id, p_days: days });
export const setSupporter = (id: string, on: boolean) => rpc<void>('owner_set_supporter', { p_user: id, p_on: on });
export const recentContent = (kind: string, q: string, hidden: boolean | null) =>
  rpc<ContentRow[]>('admin_recent_content', { p_kind: kind, q, p_hidden: hidden });
export const moderateContent = (kind: ContentKind, id: number, action: 'hide' | 'show' | 'delete') =>
  rpc<void>('admin_content', { p_kind: kind, p_id: id, p_action: action });
export const setTerm = (term: string, add: boolean) => rpc<void>('admin_term', { p_term: term, p_add: add });
export const setSite = (key: 'announcement' | 'announcement_kind' | 'community_paused', value: string) => rpc<void>('admin_set_site', { p_key: key, p_value: value });

export async function bannedTerms(): Promise<string[]> {
  const { data, error } = await sb().from('banned_terms').select('term').order('term');
  if (error) throw friendly(error);
  return (data ?? []).map((r) => r.term as string);
}
export async function modLog(limit = 100): Promise<LogRow[]> {
  const { data, error } = await sb().from('mod_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw friendly(error);
  return (data ?? []) as LogRow[];
}

/** Banir, desbanir e apagar conta passam pela função do servidor (precisa da chave de serviço). */
export async function accountAction(action: 'ban' | 'unban' | 'delete', user: string, extra: { hours?: number; reason?: string } = {}) {
  const { error } = await sb().functions.invoke('shiori-admin', { body: { action, user, ...extra } });
  if (error) {
    let code = '';
    try {
      code = (await (error as { context?: Response }).context?.json())?.error ?? '';
    } catch {
      /* sem corpo */
    }
    throw friendly({ message: code || error.message });
  }
}
