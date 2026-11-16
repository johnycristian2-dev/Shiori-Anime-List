/**
 * Sincronização automática com o AniList (precisa estar conectado em Sync).
 * - Ao abrir: puxa sua lista do AniList e mescla (vence a edição mais recente).
 * - Cada mudança local (status, nota, episódios, remoção) entra numa fila e é enviada sozinha.
 */
import { gql } from '../api/anilist';
import {
  DELETE_ENTRY_MUTATION,
  MEDIA_LIST_ID_QUERY,
  SAVE_ENTRY_MUTATION,
  VIEWER_LIST_QUERY,
  VIEWER_QUERY,
} from '../api/queries';
import { sleep } from '../lib/format';
import { useAuth, validToken, type Viewer } from '../store/auth';
import { mediaToEntry, useList } from '../store/list';
import { useSyncStatus } from '../store/sync';
import type { ListEntry, ListStatus, Media, SyncDoc } from '../types';

import { t } from '../lib/i18n';

export const AL_TO_LOCAL: Record<string, ListStatus> = {
  CURRENT: 'WATCHING',
  REPEATING: 'WATCHING',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  DROPPED: 'DROPPED',
};
export const LOCAL_TO_AL: Record<ListStatus, string> = {
  WATCHING: 'CURRENT',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  DROPPED: 'DROPPED',
};

/** O que o AniList guarda de cada anime: se isso não mudou, não precisa enviar. */
const sigOf = (e: ListEntry) => `${e.status}|${e.score}|${e.progress}`;

const synced = new Map<number, string>();
const queue = new Map<number, 'save' | 'delete'>();
let timer: number | undefined;
let running = false;
let applyingRemote = false;
let pulledFor: number | null = null;

const status = (state: 'off' | 'syncing' | 'ok' | 'error', msg?: string) =>
  useSyncStatus.getState().set('anilist', { state, msg, at: Date.now() });

const active = () => {
  const { autoSync, viewer } = useAuth.getState();
  return autoSync && !!viewer && !!validToken();
};

async function ensureViewer(): Promise<Viewer | null> {
  const { viewer, setViewer } = useAuth.getState();
  if (viewer) return viewer;
  const token = validToken();
  if (!token) return null;
  const d = await gql<{ Viewer: Viewer }>(VIEWER_QUERY, {}, { token });
  setViewer(d.Viewer);
  return d.Viewer;
}

/** Puxa a lista do AniList e mescla com a local. */
export async function pullFromAniList() {
  const token = validToken();
  const viewer = await ensureViewer();
  if (!token || !viewer) return;
  status('syncing', t('Baixando do AniList…'));
  type R = {
    MediaListCollection: {
      lists: { entries: { status: string; score: number; progress: number; updatedAt: number; media: Media }[] }[];
    };
  };
  // Anime e leitura (mangá, manhwa, webtoon…) ficam em listas separadas no AniList
  const lists: R['MediaListCollection']['lists'] = [];
  for (const type of ['ANIME', 'MANGA'] as const) {
    const d = await gql<R>(VIEWER_LIST_QUERY, { userId: viewer.id, type }, { token });
    lists.push(...d.MediaListCollection.lists);
  }
  const remote: SyncDoc = { entries: {}, deleted: {}, lists: {}, skipped: [] };
  const local = useList.getState().entries;
  for (const l of lists) {
    for (const e of l.entries) {
      const prev = local[e.media.id];
      const entry: ListEntry = {
        ...(prev ?? mediaToEntry(e.media, 'PLANNING')),
        status: AL_TO_LOCAL[e.status] ?? 'PLANNING',
        score: Math.round(e.score || 0),
        progress: e.progress || 0,
        updatedAt: (e.updatedAt || 0) * 1000,
      };
      remote.entries[e.media.id] = entry;
      synced.set(e.media.id, sigOf(entry));
    }
  }
  applyingRemote = true;
  try {
    useList.getState().mergeDoc(remote);
  } finally {
    applyingRemote = false;
  }
  // O que ficou diferente do AniList (só existe aqui, ou é mais novo aqui) vai pra fila
  const now = useList.getState().entries;
  for (const e of Object.values(now)) if (synced.get(e.mediaId) !== sigOf(e)) queue.set(e.mediaId, 'save');
  pulledFor = viewer.id;
  status('ok', t('Sincronizado com o AniList'));
  kick(300);
}

function kick(ms = 1500) {
  clearTimeout(timer);
  timer = window.setTimeout(processQueue, ms);
}

async function processQueue() {
  if (running || !queue.size || !active()) return;
  running = true;
  const token = validToken()!;
  const viewer = useAuth.getState().viewer!;
  try {
    while (queue.size && active()) {
      const [id, op] = queue.entries().next().value as [number, 'save' | 'delete'];
      queue.delete(id);
      status('syncing', t('Enviando pro AniList… ({0} na fila)', queue.size + 1));
      if (op === 'save') {
        const e = useList.getState().entries[id];
        if (!e) continue;
        await gql(SAVE_ENTRY_MUTATION, { mediaId: id, status: LOCAL_TO_AL[e.status], scoreRaw: e.score * 10, progress: e.progress }, { token });
        synced.set(id, sigOf(e));
      } else {
        const r = await gql<{ MediaList: { id: number } | null }>(MEDIA_LIST_ID_QUERY, { userId: viewer.id, mediaId: id }, { token }).catch(
          () => ({ MediaList: null }),
        );
        if (r.MediaList) await gql(DELETE_ENTRY_MUTATION, { id: r.MediaList.id }, { token });
        synced.delete(id);
      }
      await sleep(900);
    }
    status('ok', t('Sincronizado com o AniList'));
  } catch (e) {
    status('error', (e as Error).message);
    kick(30_000); // tenta de novo depois
  } finally {
    running = false;
  }
}

let started = false;
export function startAniListSync() {
  if (started) return;
  started = true;

  useList.subscribe((s, prev) => {
    if (applyingRemote || !active() || s.entries === prev.entries) return;
    for (const [k, e] of Object.entries(s.entries)) {
      const id = Number(k);
      if (prev.entries[id] !== e && synced.get(id) !== sigOf(e)) queue.set(id, 'save');
    }
    for (const k of Object.keys(prev.entries)) if (!s.entries[Number(k)] && synced.has(Number(k))) queue.set(Number(k), 'delete');
    if (queue.size) kick();
  });

  // Puxa quando conecta, quando liga o auto-sync e ao abrir o app
  const maybePull = () => {
    const { viewer, autoSync } = useAuth.getState();
    if (!autoSync || !validToken()) {
      status('off');
      return;
    }
    if (viewer && pulledFor === viewer.id) return;
    pullFromAniList().catch((e) => status('error', (e as Error).message));
  };
  useAuth.subscribe((s, p) => {
    if (s.token !== p.token || s.autoSync !== p.autoSync || s.viewer?.id !== p.viewer?.id) {
      if (!s.token) pulledFor = null;
      maybePull();
    }
  });
  maybePull();
  window.addEventListener('online', () => kick(500));
}
