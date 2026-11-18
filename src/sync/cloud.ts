/**
 * Sincronização da lista com a nuvem (Supabase).
 * - Ao entrar: baixa o documento, mescla com o local e envia o resultado.
 * - A cada mudança local: espera 1,5s sem mudanças e envia (lendo e mesclando antes, pra não perder nada).
 * - Outro aparelho mudou? O Realtime avisa e a gente mescla na hora.
 */
import { captchaToken } from '../lib/captcha';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { redirectUrl, supabase } from '../lib/supabase';
import { docSignature } from '../lib/merge';
import { useList } from '../store/list';
import { useSyncStatus } from '../store/sync';
import type { SyncDoc } from '../types';
import { publishSnapshot } from './profile';

import { t } from '../lib/i18n';

export const useCloudUser = create<{ user: User | null; ready: boolean }>(() => ({ user: null, ready: false }));

const DEVICE = (() => {
  try {
    let id = localStorage.getItem('shiori-device');
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem('shiori-device', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
})();

let user: User | null = null;
let channel: RealtimeChannel | null = null;
let timer: number | undefined;
let lastSig = '';
let applyingRemote = false;
let busy: Promise<void> | null = null;

const status = (state: 'off' | 'syncing' | 'ok' | 'error', msg?: string) =>
  useSyncStatus.getState().set('cloud', { state, msg, at: Date.now() });

function normalize(doc: Partial<SyncDoc> | null | undefined): SyncDoc {
  return {
    entries: doc?.entries ?? {},
    deleted: doc?.deleted ?? {},
    lists: doc?.lists ?? {},
    skipped: doc?.skipped ?? [],
    history: doc?.history ?? [],
    ...(doc?.gacha ? { gacha: doc.gacha } : {}),
  };
}

function applyRemote(doc: Partial<SyncDoc>) {
  applyingRemote = true;
  try {
    useList.getState().mergeDoc(normalize(doc));
  } finally {
    applyingRemote = false;
  }
}

async function fetchRemote() {
  const { data, error } = await supabase!.from('user_data').select('doc').eq('user_id', user!.id).maybeSingle();
  if (error) throw error;
  return data?.doc as Partial<SyncDoc> | undefined;
}

/** Lê a nuvem, mescla e grava o resultado. Serializado: nunca roda duas vezes ao mesmo tempo. */
function syncNow(force = false): Promise<void> {
  if (!supabase || !user) return Promise.resolve();
  if (busy) return busy.then(() => syncNow(force));
  busy = (async () => {
    status('syncing');
    try {
      const remote = await fetchRemote();
      if (remote) applyRemote(remote);
      const doc = useList.getState().getDoc();
      const sig = docSignature(doc);
      const remoteSig = remote ? docSignature(normalize(remote)) : '';
      if (force || sig !== remoteSig) {
        const { error } = await supabase!
          .from('user_data')
          .upsert({ user_id: user!.id, doc, device: DEVICE, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      lastSig = sig;
      status('ok', t('Sincronizado'));
      // Mantém o perfil público atualizado (se existir; sem perfil, o update não afeta nada)
      publishSnapshot(user!.id).catch(() => null);
    } catch (e) {
      status('error', (e as Error).message);
    } finally {
      busy = null;
    }
  })();
  return busy;
}

function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(() => syncNow(), 1500);
}

function teardown() {
  clearTimeout(timer);
  if (channel) supabase?.removeChannel(channel);
  channel = null;
  lastSig = '';
}

function setup(u: User) {
  syncNow(true);
  channel = supabase!
    .channel(`user_data:${u.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_data', filter: `user_id=eq.${u.id}` }, (payload) => {
      const row = payload.new as { doc?: Partial<SyncDoc>; device?: string } | undefined;
      if (!row?.doc || row.device === DEVICE) return;
      applyRemote(row.doc);
      lastSig = docSignature(useList.getState().getDoc());
      status('ok', t('Atualizado por outro aparelho'));
    })
    .subscribe();
}

let started = false;
export function startCloudSync() {
  if (!supabase || started) return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    const u = session?.user ?? null;
    const changed = u?.id !== user?.id;
    user = u;
    useCloudUser.setState({ user: u, ready: true });
    // Limpa o ?code= do login e leva pra tela de Sync
    if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
      window.history.replaceState(null, '', `${window.location.pathname}#/perfil`);
    }
    if (!changed) return;
    teardown();
    // Convidado (login anônimo da watch party) não sincroniza a lista
    if (u && !u.is_anonymous) setTimeout(() => setup(u), 0);
    else {
      user = null;
      status('off');
    }
  });

  useList.subscribe((s, prev) => {
    if (!user || applyingRemote) return;
    if (s.entries === prev.entries && s.deleted === prev.deleted && s.lists === prev.lists && s.skipped === prev.skipped && s.history === prev.history && s.gacha === prev.gacha) return;
    if (docSignature(s.getDoc()) === lastSig) return;
    schedule();
  });

  const refresh = () => user && document.visibilityState === 'visible' && syncNow();
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
}

export const cloud = {
  syncNow: () => syncNow(true),
  async signInEmail(email: string) {
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), captchaToken: await captchaToken() } });
    if (error) throw error;
  },
  async signInGoogle() {
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    if (error) throw error;
  },
  async signOut() {
    await syncNow();
    await supabase!.auth.signOut();
  },
};
