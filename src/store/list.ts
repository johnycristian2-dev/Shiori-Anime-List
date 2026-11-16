import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CustomList, HistoryEvent, ListEntry, ListStatus, Media, SyncDoc } from '../types';
import { HISTORY_MAX, mergeDocs } from '../lib/merge';
import { applyDailyPull } from '../lib/gacha';

export const STATUS_META: Record<ListStatus, { label: string; jp: string; color: string }> = {
  WATCHING: { label: 'Assistindo', jp: '視聴中', color: '#3de2ff' },
  PLANNING: { label: 'Quero ver', jp: '予定', color: '#ffe14d' },
  COMPLETED: { label: 'Completo', jp: '完了', color: '#7cff8a' },
  PAUSED: { label: 'Pausado', jp: '保留', color: '#b98cff' },
  DROPPED: { label: 'Dropado', jp: '中止', color: '#ff6b6b' },
};
export const STATUS_ORDER: ListStatus[] = ['WATCHING', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'];

export function mediaToEntry(m: Media, status: ListStatus, extra: Partial<ListEntry> = {}): ListEntry {
  const now = Date.now();
  return {
    mediaId: m.id,
    idMal: m.idMal,
    title: m.title.romaji ?? m.title.english ?? m.title.native ?? '???',
    titleEnglish: m.title.english,
    titleNative: m.title.native,
    cover: m.coverImage.extraLarge ?? m.coverImage.large,
    color: m.coverImage.color,
    format: m.format,
    episodes: m.episodes,
    year: m.seasonYear,
    genres: m.genres,
    averageScore: m.averageScore,
    status,
    score: 0,
    progress: status === 'COMPLETED' ? m.episodes ?? 0 : 0,
    addedAt: now,
    updatedAt: now,
    ...extra,
  };
}

export const LIST_EMOJIS = ['💕', '📼', '🔥', '🍿', '🌙', '⚔️', '😭', '🎌', '👀', '🏆'];

type EntryPatch = Partial<Pick<ListEntry, 'status' | 'score' | 'progress' | 'favorite' | 'notes'>>;

interface ListState extends SyncDoc {
  add: (m: Media, status: ListStatus) => void;
  addMany: (ms: Media[], status: ListStatus) => number;
  update: (id: number, patch: EntryPatch) => void;
  toggleFavorite: (id: number) => void;
  remove: (id: number) => void;
  /** Usado pelo "desfazer": volta a entrada ao estado anterior (ou apaga). */
  restore: (id: number, prev: ListEntry | undefined) => void;
  skip: (id: number) => void;
  unskip: (id: number) => void;
  clearSkipped: () => void;
  importEntries: (list: ListEntry[], mode: 'merge' | 'replace') => void;
  clearAll: () => void;
  // Listas personalizadas
  createList: (name: string, emoji?: string) => string;
  updateList: (id: string, patch: Partial<Pick<CustomList, 'name' | 'emoji'>>) => void;
  deleteList: (id: string) => void;
  toggleInList: (listId: string, m: Media) => void;
  // Gacha diário
  dailyPull: (m: Media) => void;
  // Sincronização
  getDoc: () => SyncDoc;
  /** Mescla um estado vindo de fora (nuvem/AniList) com o local. */
  mergeDoc: (remote: SyncDoc) => void;
}

const log = (h: HistoryEvent[] | undefined, ev: HistoryEvent[]) => (ev.length ? [...(h ?? []), ...ev].slice(-HISTORY_MAX) : h ?? []);

const tombstone = (deleted: Record<number, number>, ids: number[]) => {
  const now = Date.now();
  const next = { ...deleted };
  ids.forEach((id) => (next[id] = now));
  return next;
};

export const useList = create<ListState>()(
  persist(
    (set, get) => ({
      entries: {},
      deleted: {},
      lists: {},
      skipped: [],
      history: [],

      add: (m, status) =>
        set((s) => {
          const prev = s.entries[m.id];
          const entry = prev
            ? {
                ...prev,
                status,
                progress: status === 'COMPLETED' ? prev.episodes ?? prev.progress : prev.progress,
                updatedAt: Date.now(),
              }
            : mediaToEntry(m, status);
          const deleted = { ...s.deleted };
          delete deleted[m.id];
          const now = Date.now();
          const ev: HistoryEvent[] = [];
          if (!prev) ev.push({ m: m.id, t: 'add', at: now });
          if (status === 'COMPLETED' && prev?.status !== 'COMPLETED') ev.push({ m: m.id, t: 'done', at: now });
          return {
            entries: { ...s.entries, [m.id]: entry },
            deleted,
            skipped: s.skipped.filter((x) => x !== m.id),
            history: log(s.history, ev),
          };
        }),

      addMany: (ms, status) => {
        const fresh = ms.filter((m) => !get().entries[m.id]);
        if (!fresh.length) return 0;
        set((s) => {
          const entries = { ...s.entries };
          const deleted = { ...s.deleted };
          const now = Date.now();
          const ev: HistoryEvent[] = [];
          fresh.forEach((m) => {
            entries[m.id] = mediaToEntry(m, status);
            delete deleted[m.id];
            ev.push({ m: m.id, t: 'add', at: now });
            if (status === 'COMPLETED') ev.push({ m: m.id, t: 'done', at: now });
          });
          return { entries, deleted, history: log(s.history, ev) };
        });
        return fresh.length;
      },

      update: (id, patch) =>
        set((s) => {
          const e = s.entries[id];
          if (!e) return s;
          const next = { ...e, ...patch, updatedAt: Date.now() };
          if (patch.status === 'COMPLETED' && e.episodes) next.progress = e.episodes;
          if (next.episodes) next.progress = Math.min(next.progress, next.episodes);
          next.progress = Math.max(0, next.progress);
          // Automação: começou a ver → Assistindo; chegou no último ep → Completo
          if (patch.progress !== undefined && !patch.status) {
            if (next.episodes && next.progress === next.episodes && e.status !== 'COMPLETED') next.status = 'COMPLETED';
            else if (next.progress > 0 && e.status === 'PLANNING') next.status = 'WATCHING';
          }
          const ev: HistoryEvent[] = [];
          if (next.progress > e.progress) ev.push({ m: id, t: 'ep', at: next.updatedAt, v: next.progress - e.progress });
          if (next.status === 'COMPLETED' && e.status !== 'COMPLETED') ev.push({ m: id, t: 'done', at: next.updatedAt });
          if (patch.score !== undefined && patch.score > 0 && patch.score !== e.score) ev.push({ m: id, t: 'score', at: next.updatedAt, v: patch.score });
          return { entries: { ...s.entries, [id]: next }, history: log(s.history, ev) };
        }),

      toggleFavorite: (id) =>
        set((s) => {
          const e = s.entries[id];
          if (!e) return s;
          return { entries: { ...s.entries, [id]: { ...e, favorite: !e.favorite, updatedAt: Date.now() } } };
        }),

      remove: (id) =>
        set((s) => {
          const entries = { ...s.entries };
          delete entries[id];
          return { entries, deleted: tombstone(s.deleted, [id]) };
        }),

      restore: (id, prev) =>
        set((s) => {
          const entries = { ...s.entries };
          const deleted = { ...s.deleted };
          if (prev) {
            entries[id] = { ...prev, updatedAt: Date.now() };
            delete deleted[id];
          } else {
            delete entries[id];
            deleted[id] = Date.now();
          }
          return { entries, deleted };
        }),

      skip: (id) => set((s) => ({ skipped: s.skipped.includes(id) ? s.skipped : [...s.skipped, id] })),
      unskip: (id) => set((s) => ({ skipped: s.skipped.filter((x) => x !== id) })),
      clearSkipped: () => set({ skipped: [] }),

      importEntries: (list, mode) =>
        set((s) => {
          const entries = mode === 'replace' ? {} : { ...s.entries };
          const now = Date.now();
          list.forEach((e) => (entries[e.mediaId] = { ...e, updatedAt: Math.max(e.updatedAt ?? 0, now) }));
          const removed = mode === 'replace' ? Object.keys(s.entries).map(Number).filter((id) => !entries[id]) : [];
          const deleted = tombstone(s.deleted, removed);
          list.forEach((e) => delete deleted[e.mediaId]);
          return { entries, deleted };
        }),

      clearAll: () =>
        set((s) => ({
          entries: {},
          skipped: [],
          deleted: tombstone(s.deleted, Object.keys(s.entries).map(Number)),
          lists: Object.fromEntries(Object.values(s.lists).map((l) => [l.id, { ...l, deleted: true, updatedAt: Date.now() }])),
        })),

      createList: (name, emoji) => {
        const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const now = Date.now();
        const list: CustomList = {
          id,
          name: name.trim() || 'Nova lista',
          emoji: emoji ?? LIST_EMOJIS[Object.keys(get().lists).length % LIST_EMOJIS.length],
          mediaIds: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ lists: { ...s.lists, [id]: list } }));
        return id;
      },

      updateList: (id, patch) =>
        set((s) => (s.lists[id] ? { lists: { ...s.lists, [id]: { ...s.lists[id], ...patch, updatedAt: Date.now() } } } : s)),

      deleteList: (id) =>
        set((s) => (s.lists[id] ? { lists: { ...s.lists, [id]: { ...s.lists[id], deleted: true, mediaIds: [], updatedAt: Date.now() } } } : s)),

      toggleInList: (listId, m) => {
        const l = get().lists[listId];
        if (!l) return;
        const has = l.mediaIds.includes(m.id);
        // Entrar numa lista personalizada também coloca o anime na sua lista (como "Quero ver")
        if (!has && !get().entries[m.id]) get().add(m, 'PLANNING');
        set((s) => ({
          lists: {
            ...s.lists,
            [listId]: { ...l, mediaIds: has ? l.mediaIds.filter((x) => x !== m.id) : [...l.mediaIds, m.id], updatedAt: Date.now() },
          },
        }));
      },

      dailyPull: (m) => set((s) => ({ gacha: applyDailyPull(s.gacha, m) })),

      getDoc: () => {
        const { entries, deleted, lists, skipped, history, gacha } = get();
        return { entries, deleted, lists, skipped, history, ...(gacha ? { gacha } : {}) };
      },

      mergeDoc: (remote) => set(mergeDocs(get().getDoc(), remote)),
    }),
    { name: 'shiori-list', version: 1 },
  ),
);

/** Listas personalizadas ativas (sem as apagadas), na ordem de criação. */
export function activeLists(lists: Record<string, CustomList>) {
  return Object.values(lists)
    .filter((l) => !l.deleted)
    .sort((a, b) => a.createdAt - b.createdAt);
}
