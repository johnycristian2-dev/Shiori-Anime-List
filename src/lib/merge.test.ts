import { describe, expect, it } from 'vitest';
import { mergeDocs } from './merge';
import type { ListEntry, SyncDoc } from '../types';

const e = (id: number, updatedAt: number, extra: Partial<ListEntry> = {}): ListEntry => ({
  mediaId: id,
  idMal: null,
  title: `A${id}`,
  titleEnglish: null,
  titleNative: null,
  cover: null,
  color: null,
  format: 'TV',
  episodes: 12,
  year: 2020,
  genres: [],
  averageScore: 80,
  status: 'PLANNING',
  score: 0,
  progress: 0,
  addedAt: 0,
  updatedAt,
  ...extra,
});
const doc = (p: Partial<SyncDoc>): SyncDoc => ({ entries: {}, deleted: {}, lists: {}, skipped: [], ...p });

describe('mergeDocs', () => {
  it('une animes dos dois lados', () => {
    const m = mergeDocs(doc({ entries: { 1: e(1, 10) } }), doc({ entries: { 2: e(2, 10) } }));
    expect(Object.keys(m.entries)).toEqual(['1', '2']);
  });

  it('a edição mais recente vence', () => {
    const m = mergeDocs(
      doc({ entries: { 1: e(1, 10, { score: 5 }) } }),
      doc({ entries: { 1: e(1, 20, { score: 9 }) } }),
    );
    expect(m.entries[1].score).toBe(9);
  });

  it('remoção depois da edição apaga', () => {
    const m = mergeDocs(doc({ entries: { 1: e(1, 10) } }), doc({ deleted: { 1: 15 } }));
    expect(m.entries[1]).toBeUndefined();
  });

  it('readicionar depois da remoção mantém', () => {
    const m = mergeDocs(doc({ entries: { 1: e(1, 30) } }), doc({ deleted: { 1: 15 } }));
    expect(m.entries[1]).toBeDefined();
  });

  it('listas: a mais recente vence e lápide se propaga', () => {
    const l = { id: 'x', name: 'Clássicos', emoji: '📼', mediaIds: [1], createdAt: 0, updatedAt: 5 };
    const m = mergeDocs(doc({ lists: { x: l } }), doc({ lists: { x: { ...l, deleted: true, updatedAt: 9 } } }));
    expect(m.lists.x.deleted).toBe(true);
  });

  it('pulados: união sem os que estão na lista', () => {
    const m = mergeDocs(doc({ skipped: [1, 2], entries: { 2: e(2, 1) } }), doc({ skipped: [3] }));
    expect(m.skipped.sort()).toEqual([1, 3]);
  });

  it('histórico: união sem duplicar e em ordem', () => {
    const m = mergeDocs(
      doc({ history: [{ m: 1, t: 'add', at: 5 }, { m: 1, t: 'ep', at: 9, v: 1 }] }),
      doc({ history: [{ m: 1, t: 'add', at: 5 }, { m: 2, t: 'done', at: 7 }] }),
    );
    expect(m.history!.map((h) => h.at)).toEqual([5, 7, 9]);
  });

  it('gacha: vence quem girou mais', () => {
    const g = { lastDay: '2026-11-16', streak: 1, bestStreak: 1, pulls: 1, ssr: 0, ssrStreak: 0, bestSsrStreak: 0, log: [] };
    const m = mergeDocs(doc({ gacha: g }), doc({ gacha: { ...g, pulls: 5 } }));
    expect(m.gacha!.pulls).toBe(5);
  });
});
