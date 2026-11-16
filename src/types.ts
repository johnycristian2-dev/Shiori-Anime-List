export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
export type MediaFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
export type MediaSort =
  | 'POPULARITY_DESC'
  | 'SCORE_DESC'
  | 'TRENDING_DESC'
  | 'START_DATE_DESC'
  | 'START_DATE'
  | 'FAVOURITES_DESC'
  | 'TITLE_ROMAJI'
  | 'SEARCH_MATCH';

export interface Title {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface Media {
  id: number;
  idMal: number | null;
  title: Title;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  episodes: number | null;
  format: MediaFormat | null;
  status: MediaStatus | null;
  season: Season | null;
  seasonYear: number | null;
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  description?: string | null;
}

export interface MediaDetail extends Media {
  description: string | null;
  studios: { nodes: { id: number; name: string }[] };
  characters: {
    edges: {
      role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
      node: Person;
      voiceActors: Person[];
    }[];
  };
  externalLinks: { site: string; url: string; type: string; color: string | null }[];
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  trailer: { id: string; site: string } | null;
  relations: { edges: { relationType: string; node: Media & { type: 'ANIME' | 'MANGA' } }[] };
  recommendations: { nodes: { rating: number; mediaRecommendation: Media | null }[] };
}

export interface Person {
  id: number;
  name: { full: string; native: string | null };
  image: { large: string | null };
}

export interface AiringItem {
  id: number;
  episode: number;
  airingAt: number;
  media: Media & { isAdult: boolean };
}

export interface Studio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  media: { pageInfo: PageInfo; nodes: Media[] };
}

export interface PageInfo {
  hasNextPage: boolean;
  currentPage: number;
  total: number;
}

export interface MediaPage {
  pageInfo: PageInfo;
  media: Media[];
}

/** Status da SUA lista (independente de onde for exportado). */
export type ListStatus = 'WATCHING' | 'COMPLETED' | 'PLANNING' | 'PAUSED' | 'DROPPED';

export interface ListEntry {
  mediaId: number;
  idMal: number | null;
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  color: string | null;
  format: MediaFormat | null;
  episodes: number | null;
  year: number | null;
  genres: string[];
  averageScore: number | null;
  status: ListStatus;
  /** 0 = sem nota, 1–10 */
  score: number;
  progress: number;
  favorite?: boolean;
  notes?: string;
  addedAt: number;
  updatedAt: number;
}

export interface BrowseFilters {
  sort: MediaSort;
  genres: string[];
  season?: Season;
  seasonYear?: number;
  formats: MediaFormat[];
  status?: MediaStatus;
  minScore?: number;
  search?: string;
  yearFrom?: number;
  yearTo?: number;
  /** Gêneros que NÃO podem aparecer */
  excludeGenres?: string[];
  /** ids de plataformas (ExternalLinkSource do AniList) */
  streaming?: number[];
  length?: 'short' | 'medium' | 'long';
  country?: 'JP' | 'CN' | 'KR';
  tags?: string[];
}

/** Lista personalizada ("Pra ver com a namorada", "Clássicos"...). */
export interface CustomList {
  id: string;
  name: string;
  emoji: string;
  mediaIds: number[];
  createdAt: number;
  updatedAt: number;
  /** Lápide: lista apagada (mantida pra sincronização não ressuscitar). */
  deleted?: boolean;
}

/** Evento do histórico (usado na retrospectiva do ano). */
export interface HistoryEvent {
  /** mediaId */
  m: number;
  /** add = entrou na lista · ep = episódios vistos · done = completou · score = deu nota */
  t: 'add' | 'ep' | 'done' | 'score';
  /** quando (ms) */
  at: number;
  /** ep: quantos episódios a mais · score: a nota */
  v?: number;
}

export type Rarity = 'SSR' | 'SR' | 'R';

export interface GachaState {
  /** dia (AAAA-MM-DD, horário local) do último giro diário */
  lastDay: string | null;
  streak: number;
  bestStreak: number;
  pulls: number;
  ssr: number;
  /** maior sequência de SSR em dias seguidos */
  ssrStreak: number;
  bestSsrStreak: number;
  log: { day: string; mediaId: number; title: string; cover: string | null; rarity: Rarity }[];
}

/** Tudo que é sincronizado entre aparelhos. */
export interface SyncDoc {
  entries: Record<number, ListEntry>;
  /** mediaId → quando foi removido (ms). Evita que outro aparelho "ressuscite" o anime. */
  deleted: Record<number, number>;
  lists: Record<string, CustomList>;
  skipped: number[];
  history?: HistoryEvent[];
  gacha?: GachaState;
}

export interface CharacterDetail {
  id: number;
  favourites: number | null;
  gender: string | null;
  age: string | null;
  bloodType: string | null;
  name: { full: string; native: string | null; alternative: string[] };
  image: { large: string | null };
  description: string | null;
  dateOfBirth: { month: number | null; day: number | null };
  media: {
    edges: { characterRole: string; node: Media; voiceActors: Person[] }[];
  };
}

export interface StaffDetail {
  id: number;
  favourites: number | null;
  gender: string | null;
  age: number | null;
  homeTown: string | null;
  yearsActive: number[];
  languageV2: string | null;
  name: { full: string; native: string | null };
  image: { large: string | null };
  description: string | null;
  dateOfBirth: { year: number | null; month: number | null; day: number | null };
  characterMedia: {
    pageInfo: PageInfo;
    edges: { characterRole: string; node: Media & { type: string }; characters: Person[] }[];
  };
}
