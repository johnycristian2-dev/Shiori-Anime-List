import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCloudUser } from './cloud';

export interface Perks {
  user_id: string;
  owner: boolean;
  supporter_since: string | null;
  donated_cents: number;
  plus_until: string | null;
  banner: Banner | null;
}
export type Banner = 'aurora' | 'sakura' | 'neon' | 'ouro' | 'galaxia';
export const BANNERS: Banner[] = ['aurora', 'sakura', 'neon', 'ouro', 'galaxia'];

/** Preços do Shiori+ em centavos (iguais aos da função shiori-pay). */
export const PLANS = [
  { months: 1, cents: 790 },
  { months: 3, cents: 1990 },
  { months: 12, cents: 6990 },
] as const;
export const DONATIONS = [5, 10, 20, 50];

export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const isPlus = (p?: Perks | null) => !!p && (p.owner || (!!p.plus_until && new Date(p.plus_until) > new Date()));

/** A tabela de selos é pequena e pública: carrega inteira e guarda em cache. */
async function loadAllPerks(): Promise<Map<string, Perks>> {
  const m = new Map<string, Perks>();
  if (!supabase) return m;
  const { data } = await supabase.from('user_perks').select('user_id, owner, supporter_since, donated_cents, plus_until, banner');
  (data ?? []).forEach((p) => m.set(p.user_id, p as Perks));
  return m;
}
export function useAllPerks() {
  return useQuery({ queryKey: ['perks'], queryFn: loadAllPerks, staleTime: 5 * 60_000 });
}
export function usePerks(userId?: string | null) {
  const q = useAllPerks();
  return userId ? q.data?.get(userId) ?? null : null;
}
export function useMyPerks() {
  const user = useCloudUser((s) => s.user);
  return usePerks(user?.id);
}

export interface AppConfig {
  amazon_tag: string;
  kofi_url: string;
  apoiase_url: string;
  payments_on: boolean;
}
async function loadConfig(): Promise<AppConfig> {
  const c: AppConfig = { amazon_tag: '', kofi_url: '', apoiase_url: '', payments_on: false };
  if (!supabase) return c;
  const { data } = await supabase.from('app_config').select('key, value');
  for (const r of data ?? []) {
    if (r.key === 'payments_on') c.payments_on = r.value === 'true';
    else if (r.key in c) (c as unknown as Record<string, string>)[r.key] = r.value;
  }
  return c;
}
export function useConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: loadConfig, staleTime: 10 * 60_000 });
}
export async function saveConfig(key: keyof AppConfig, value: string) {
  if (!supabase) return;
  const { error } = await supabase.from('app_config').upsert({ key, value });
  if (error) throw error;
}

/** Link de busca na Amazon com a tag de afiliado. */
export function amazonLink(tag: string, query: string) {
  const u = new URL('https://www.amazon.com.br/s');
  u.searchParams.set('k', query);
  if (tag) u.searchParams.set('tag', tag);
  return u.toString();
}

export interface PixCharge {
  id: string;
  qr_code: string;
  qr_base64: string;
  amount_cents: number;
  expires_at: string;
}
export async function createPix(body: { kind: 'plus'; months: number } | { kind: 'donation'; amount: number }): Promise<PixCharge> {
  if (!supabase) throw new Error('offline');
  const { data, error } = await supabase.functions.invoke('shiori-pay', { body });
  if (error) {
    let code = '';
    try {
      code = (await (error as { context?: Response }).context?.json())?.error ?? '';
    } catch {
      /* sem corpo */
    }
    throw new Error(code || error.message);
  }
  return data as PixCharge;
}
export async function paymentStatus(id: string): Promise<string> {
  if (!supabase) return 'pending';
  const { data } = await supabase.from('payments').select('status').eq('id', id).maybeSingle();
  return data?.status ?? 'pending';
}

export async function setBanner(b: Banner | null) {
  if (!supabase) return;
  const { error } = await supabase.rpc('set_banner', { p_banner: b });
  if (error) throw error;
}

/* ---------- Reporte de bugs ---------- */
export type BugKind = 'bug' | 'ideia' | 'outro';
export interface BugRow {
  id: number;
  user_id: string | null;
  kind: BugKind;
  message: string;
  page: string | null;
  device: string | null;
  status: 'open' | 'doing' | 'done' | 'dismissed';
  reply: string | null;
  created_at: string;
}
export async function sendBug(kind: BugKind, message: string, page: string) {
  if (!supabase) throw new Error('offline');
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('bug_reports').insert({
    user_id: u.user?.id,
    kind,
    message: message.trim().slice(0, 2000),
    page: page.slice(0, 300),
    device: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}
export async function myBugs(): Promise<BugRow[]> {
  if (!supabase) return [];
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('bug_reports').select('*').eq('user_id', u.user?.id ?? '').order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []) as BugRow[];
}
export async function allBugs(status: BugRow['status']): Promise<BugRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('bug_reports').select('*').eq('status', status).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as BugRow[];
}
export async function updateBug(id: number, patch: { status?: BugRow['status']; reply?: string | null }) {
  if (!supabase) return;
  const { error } = await supabase.from('bug_reports').update(patch).eq('id', id);
  if (error) throw error;
}
