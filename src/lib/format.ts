import { useUI } from '../store/ui';
import type { ListEntry, Media, Title } from '../types';
import { locale } from './i18n';

export function pickTitle(t: Title, lang: 'romaji' | 'english' | 'native') {
  if (lang === 'native') return t.native ?? t.romaji ?? t.english ?? '???';
  return (lang === 'english' ? t.english ?? t.romaji : t.romaji ?? t.english) ?? t.native ?? '???';
}

/** Hook que devolve uma função para pegar o título no idioma preferido. */
export function useTitle() {
  const lang = useUI((s) => s.titleLang);
  return (m: { title: Title }) => pickTitle(m.title, lang);
}

export function stripHtml(s: string | null | undefined) {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function entryToMedia(e: ListEntry): Media {
  return {
    id: e.mediaId,
    idMal: e.idMal,
    title: { romaji: e.title, english: e.titleEnglish, native: e.titleNative },
    coverImage: { extraLarge: e.cover, large: e.cover, color: e.color },
    bannerImage: null,
    episodes: e.episodes,
    format: e.format,
    status: null,
    season: null,
    seasonYear: e.year,
    averageScore: e.averageScore,
    popularity: null,
    genres: e.genres,
  };
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Limpa o markdown do AniList em descrições de personagem/staff:
 * esconde spoilers (~!texto!~), troca links [nome](url) por nome e tira __negrito__.
 */
export function cleanAniListText(s: string | null | undefined) {
  if (!s) return '';
  return stripHtml(
    s
      .replace(/~!([\s\S]*?)!~/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2'),
  ).trim();
}

export function fuzzyDate(d: { year?: number | null; month: number | null; day: number | null } | null | undefined) {
  if (!d || (!d.month && !d.year)) return null;
  if (!d.month) return String(d.year);
  return new Date(d.year ?? 2000, d.month - 1, d.day ?? 1).toLocaleDateString(locale(), { day: d.day ? 'numeric' : undefined, month: 'short', year: d.year ? 'numeric' : undefined });
}
