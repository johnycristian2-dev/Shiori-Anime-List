import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { gql } from './anilist';
import { AIRING_QUERY, buildRecsQuery, CHARACTER_QUERY, DETAIL_QUERY, DISCOVER_QUERY, GENRES_QUERY, MANGA_DISCOVER_QUERY, PAGE_QUERY, STAFF_QUERY, STUDIO_QUERY } from './queries';
import type { AiringItem, BrowseFilters, CharacterDetail, Media, MediaDetail, MediaPage, PageInfo, StaffDetail, Studio } from '../types';
import { currentSeason, nextSeason } from '../lib/season';
import { HIDDEN_GENRES } from '../lib/labels';

export function filtersToVars(f: BrowseFilters) {
  return {
    sort: [f.search && f.sort === 'POPULARITY_DESC' ? 'SEARCH_MATCH' : f.sort],
    genres: f.genres,
    season: f.season,
    seasonYear: f.seasonYear,
    formats: f.formats,
    status: f.status,
    minScore: f.minScore,
    search: f.search?.trim(),
    yearFrom: f.yearFrom ? f.yearFrom * 10000 : undefined,
    yearTo: f.yearTo ? (f.yearTo + 1) * 10000 : undefined,
    genresNot: f.excludeGenres,
    licensed: f.streaming,
    // "tamanho": episódios no anime, capítulos no mangá
    ...(f.type === 'MANGA'
      ? {
          chMin: f.length === 'medium' ? 40 : f.length === 'long' ? 150 : undefined,
          chMax: f.length === 'short' ? 41 : f.length === 'medium' ? 151 : undefined,
        }
      : {
          epMin: f.length === 'medium' ? 13 : f.length === 'long' ? 26 : undefined,
          epMax: f.length === 'short' ? 14 : f.length === 'medium' ? 27 : undefined,
        }),
    country: f.country,
    tags: f.tags,
    type: f.type ?? 'ANIME',
  };
}

export async function fetchPage(vars: Record<string, unknown>, page = 1, perPage = 30) {
  const data = await gql<{ Page: MediaPage }>(PAGE_QUERY, { ...vars, page, perPage });
  return data.Page;
}

export function useBrowse(filters: BrowseFilters, perPage = 30, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['browse', filters, perPage],
    queryFn: ({ pageParam }) => fetchPage(filtersToVars(filters), pageParam, perPage),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.currentPage + 1 : undefined),
    enabled,
  });
}

export interface DiscoverData {
  trending: { media: Media[] };
  season: { media: Media[] };
  top: { media: Media[] };
  popular: { media: Media[] };
  upcoming: { media: Media[] };
}

export function useDiscover() {
  const cur = currentSeason();
  const nxt = nextSeason();
  return useQuery({
    queryKey: ['discover', cur, nxt],
    queryFn: () =>
      gql<DiscoverData>(DISCOVER_QUERY, {
        season: cur.season,
        year: cur.year,
        nextSeason: nxt.season,
        nextYear: nxt.year,
      }),
  });
}

export interface MangaDiscoverData {
  trending: { media: Media[] };
  releasing: { media: Media[] };
  manhwa: { media: Media[] };
  webtoon: { media: Media[] };
  top: { media: Media[] };
  novels: { media: Media[] };
}

export function useMangaDiscover(enabled = true) {
  return useQuery({ queryKey: ['discover-manga'], queryFn: () => gql<MangaDiscoverData>(MANGA_DISCOVER_QUERY), enabled });
}

export function useMedia(id: number) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: async () => (await gql<{ Media: MediaDetail }>(DETAIL_QUERY, { id })).Media,
    enabled: Number.isFinite(id),
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () =>
      (await gql<{ GenreCollection: string[] }>(GENRES_QUERY)).GenreCollection.filter(
        (g) => !HIDDEN_GENRES.includes(g),
      ),
    staleTime: Infinity,
  });
}

export interface RecItem {
  media: Media;
  score: number;
  because: number[];
}

/** Junta recomendações de vários animes "semente" e ranqueia pelo total de votos. */
export function usePersonalRecs(seeds: { id: number; weight: number }[]) {
  const ids = seeds.map((s) => s.id);
  return useQuery({
    queryKey: ['recs', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      type R = { id: number; recommendations: { nodes: { rating: number; mediaRecommendation: Media | null }[] } } | null;
      const data = await gql<Record<string, R>>(buildRecsQuery(ids));
      const map = new Map<number, RecItem>();
      seeds.forEach((seed, i) => {
        const node = data[`m${i}`];
        node?.recommendations.nodes.forEach((n) => {
          const m = n.mediaRecommendation;
          if (!m || n.rating <= 0) return;
          const item = map.get(m.id) ?? { media: m, score: 0, because: [] };
          item.score += Math.log2(1 + n.rating) * seed.weight;
          if (!item.because.includes(seed.id)) item.because.push(seed.id);
          map.set(m.id, item);
        });
      });
      return [...map.values()].sort((a, b) => b.score - a.score);
    },
  });
}

/** Episódios que vão ao ar numa janela de tempo (paginado até cobrir a semana). */
export function useAiring(from: number, to: number) {
  return useQuery({
    queryKey: ['airing', from, to],
    queryFn: async () => {
      const out: AiringItem[] = [];
      for (let page = 1; page <= 8; page++) {
        const d = await gql<{ Page: { pageInfo: PageInfo; airingSchedules: AiringItem[] } }>(AIRING_QUERY, { page, from, to });
        out.push(...d.Page.airingSchedules.filter((a) => !a.media.isAdult));
        if (!d.Page.pageInfo.hasNextPage) break;
      }
      return out;
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useStudio(id: number) {
  return useInfiniteQuery({
    queryKey: ['studio', id],
    queryFn: async ({ pageParam }) => (await gql<{ Studio: Studio }>(STUDIO_QUERY, { id, page: pageParam })).Studio,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.media.pageInfo.hasNextPage ? last.media.pageInfo.currentPage + 1 : undefined),
    enabled: Number.isFinite(id),
  });
}

export function useSearch(term: string, type: 'ANIME' | 'MANGA' = 'ANIME') {
  const t = term.trim();
  return useQuery({
    queryKey: ['search', t, type],
    queryFn: () => fetchPage({ search: t, sort: ['SEARCH_MATCH'], type }, 1, 8),
    enabled: t.length >= 2,
    staleTime: 1000 * 60 * 5,
  });
}

/** Busca um "pool" aleatório de até 50 animes que batem com o filtro (usado na Roleta). */
export async function fetchPool(vars: Record<string, unknown>, maxPages = 10) {
  const head = await fetchPage(vars, 1, 50);
  const pages = Math.min(Math.ceil((head.pageInfo.total || 1) / 50), maxPages);
  if (pages <= 1) return head.media;
  const page = 1 + Math.floor(Math.random() * pages);
  return page === 1 ? head.media : (await fetchPage(vars, page, 50)).media;
}

export function useCharacter(id: number) {
  return useQuery({
    queryKey: ['character', id],
    queryFn: async () => (await gql<{ Character: CharacterDetail }>(CHARACTER_QUERY, { id })).Character,
    enabled: Number.isFinite(id),
  });
}

export function useStaff(id: number) {
  return useInfiniteQuery({
    queryKey: ['staff', id],
    queryFn: async ({ pageParam }) => (await gql<{ Staff: StaffDetail }>(STAFF_QUERY, { id, page: pageParam })).Staff,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.characterMedia.pageInfo.hasNextPage ? last.characterMedia.pageInfo.currentPage + 1 : undefined),
    enabled: Number.isFinite(id),
  });
}
