/**
 * Base dos mini jogos: lista fixa de animes (public/games/anime-pool.json, gerada por
 * scripts/build-game-pool.mjs), sorteio com semente (igual pra todo mundo no mesmo dia) e títulos.
 */
import { useQuery } from '@tanstack/react-query';
import { pickTitle } from '../lib/format';
import { useUI } from '../store/ui';
import type { MediaFormat } from '../types';

export interface PoolAnime {
  id: number;
  r: string; // romaji
  e: string | null; // inglês
  n: string | null; // nativo
  c: string; // capa
  k: string | null; // cor da capa
  g: string[];
  y: number;
  s: string | null; // estúdio principal
  f: MediaFormat;
  ep: number | null;
  sc: number; // nota média (0–100)
  p: number; // membros (popularidade)
}

let cache: Promise<PoolAnime[]> | null = null;
export function loadPool() {
  cache ??= fetch('/games/anime-pool.json')
    .then((r) => {
      if (!r.ok) throw new Error(`pool ${r.status}`);
      return r.json() as Promise<{ items: PoolAnime[] }>;
    })
    .then((d) => d.items)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}
export const usePool = () => useQuery({ queryKey: ['game-pool'], queryFn: loadPool, staleTime: Infinity, gcTime: Infinity });

export function useAnimeTitle() {
  const lang = useUI((s) => s.titleLang);
  return (a: PoolAnime) => pickTitle({ romaji: a.r, english: a.e, native: a.n }, lang);
}

/** Todos os nomes de um anime (pra busca aceitar romaji, inglês ou japonês). */
export const allNames = (a: PoolAnime) => [a.r, a.e, a.n].filter(Boolean) as string[];
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-龯]+/g, ' ')
    .trim();

/* ---------- dia e sorteio ---------- */

/** Dia de hoje no horário de Brasília, "AAAA-MM-DD" (o dia vira pra todo mundo junto). */
export function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export const EPOCH = '2026-11-16';
/** Número do desafio (#1 = 16/11/2026). */
export function dayNumber(key = todayKey()) {
  return Math.round((Date.parse(key + 'T12:00:00Z') - Date.parse(EPOCH + 'T12:00:00Z')) / 86_400_000) + 1;
}
export function shiftDay(key: string, delta: number) {
  const d = new Date(Date.parse(key + 'T12:00:00Z') + delta * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Gerador pseudoaleatório com semente (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sample<T>(arr: readonly T[], n: number, rand: () => number = Math.random) {
  return shuffle(arr, rand).slice(0, n);
}

/** Continuações são difíceis de adivinhar: ficam fora dos sorteios "principais". */
const SEQUEL = /(season|\b(2nd|3rd|\d+th)\b|part\s*\d|\bII+\b|\b\d+\s*$|: .*arc|kanketsu|zoku|\bfinal\b|movie\s*\d)/i;
export const isMainEntry = (a: PoolAnime) => !SEQUEL.test(a.r) && !SEQUEL.test(a.e ?? '');

export const fmtMembers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n);
