import { describe, expect, it } from 'vitest';
import { dayNumber, rng, shiftDay, todayKey, type PoolAnime } from './core';
import { compare, secretFor } from '../pages/games/Animedle';
import { makeRounds } from '../pages/games/CoverGuess';
import { buildQuiz } from '../sync/partyQuiz';
import poolFile from '../../public/games/anime-pool.json';

const pool = poolFile.items as PoolAnime[];

describe('mini jogos', () => {
  it('conta os dias a partir do desafio #1 (16/11/2026)', () => {
    expect(dayNumber('2026-11-16')).toBe(1);
    expect(dayNumber('2026-11-17')).toBe(2);
    expect(dayNumber('2027-03-01')).toBe(106);
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(todayKey(new Date('2026-11-17T02:30:00Z'))).toBe('2026-11-16'); // 23h30 em Brasília
  });

  it('o anime secreto é igual pra todo mundo e muda todo dia', () => {
    const a = secretFor(pool, '2026-11-20');
    expect(secretFor(pool, '2026-11-20').id).toBe(a.id);
    const week = new Set(Array.from({ length: 30 }, (_, i) => secretFor(pool, shiftDay('2026-11-17', i)).id));
    expect(week.size).toBe(30); // nada repete em 30 dias
  });

  it('compara chute e secreto', () => {
    const s = pool[0];
    expect(compare(s, s).every((c) => c.hit === 'ok')).toBe(true);
    const other = pool.find((a) => a.y < s.y - 5)!;
    expect(compare(other, s)[1]).toMatchObject({ hit: 'no', arrow: 'up' });
  });

  it('capas do dia: 10 rodadas iguais pra mesma semente, com 4 opções e a certa incluída', () => {
    const r1 = makeRounds(pool, rng(42));
    const r2 = makeRounds(pool, rng(42));
    expect(r1.map((r) => r.answer.id)).toEqual(r2.map((r) => r.answer.id));
    for (const r of r1) {
      expect(r.options).toHaveLength(4);
      expect(new Set(r.options.map((o) => o.id)).size).toBe(4);
      expect(r.options.some((o) => o.id === r.answer.id)).toBe(true);
    }
  });

  it('quiz: 10 perguntas com resposta certa válida', () => {
    for (let k = 0; k < 20; k++) {
      const quiz = buildQuiz(pool, 10);
      expect(quiz).toHaveLength(10);
      for (const { q, answer } of quiz) {
        expect(q.options.length).toBe(4);
        expect(answer).toBeGreaterThanOrEqual(0);
        expect(answer).toBeLessThan(4);
        const labels = q.options.map((o) => o.text ?? o.title?.r);
        expect(new Set(labels).size).toBe(4);
      }
    }
  });
});
