import { describe, expect, it } from 'vitest';
import { compareLists } from './compare';
import type { ListEntry } from '../types';

const e = (id: number, score: number, genres: string[], extra: Partial<ListEntry> = {}): ListEntry => ({
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
  genres,
  averageScore: 80,
  status: 'COMPLETED',
  score,
  progress: 12,
  addedAt: 0,
  updatedAt: 0,
  ...extra,
});

describe('compareLists', () => {
  it('listas iguais = compatibilidade alta', () => {
    const a = [e(1, 9, ['Action']), e(2, 6, ['Drama']), e(3, 8, ['Action', 'Drama']), e(4, 4, ['Comedy'])];
    const r = compareLists(a, a);
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.shared).toHaveLength(4);
  });

  it('notas opostas derrubam a compatibilidade', () => {
    const a = [e(1, 10, ['Action']), e(2, 2, ['Action']), e(3, 9, ['Action']), e(4, 1, ['Action'])];
    const b = [e(1, 1, ['Action']), e(2, 10, ['Action']), e(3, 2, ['Action']), e(4, 9, ['Action'])];
    const r = compareLists(a, b);
    expect(r.score).toBeLessThan(70);
    expect(r.disagree.length).toBeGreaterThan(0);
  });

  it('recomenda o que o outro amou e você não viu', () => {
    const me = [e(1, 8, ['Action']), e(5, 0, ['Romance'], { status: 'PLANNING' })];
    const them = [e(1, 9, ['Action']), e(2, 10, ['Drama']), e(5, 9, ['Romance']), e(3, 5, ['Drama'])];
    const r = compareLists(me, them);
    expect(r.forMe.map((x) => x.mediaId)).toEqual([2, 5]);
    expect(r.forThem).toHaveLength(0);
  });
});
