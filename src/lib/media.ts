/**
 * Anime × mangá: tudo que muda entre os dois tipos fica aqui
 * (episódios × capítulos, "Assistindo" × "Lendo", categorias de mangá…).
 */
import type { BrowseFilters, ListEntry, ListStatus, Media, MediaFormat, MediaType } from '../types';
import { t } from './i18n';

type HasType = { type?: MediaType | null };

export const isManga = (x: HasType | null | undefined) => x?.type === 'MANGA';

/** Total de episódios (anime) ou capítulos (mangá); null = desconhecido/em lançamento */
export function totalUnits(x: { type?: MediaType | null; episodes?: number | null; chapters?: number | null }) {
  return x.type === 'MANGA' ? x.chapters ?? null : x.episodes ?? null;
}

/** "ep" ou "cap." */
export const unitShort = (x: HasType | null | undefined) => (isManga(x) ? t('cap.') : t('ep'));
/** "episódios" ou "capítulos" */
export const unitLong = (x: HasType | null | undefined) => (isManga(x) ? t('capítulos') : t('episódios'));

const MANGA_STATUS: Partial<Record<ListStatus, () => string>> = {
  WATCHING: () => t('Lendo'),
  PLANNING: () => t('Quero ler'),
};

/** Nome do status de acordo com o tipo (Assistindo × Lendo) */
export function statusLabel(status: ListStatus, x: HasType | null | undefined, fallback: string) {
  return isManga(x) ? MANGA_STATUS[status]?.() ?? fallback : fallback;
}

export const mediaPath = (m: { id: number; type?: MediaType | null }) => `/${isManga(m) ? 'manga' : 'anime'}/${m.id}`;
export const entryPath = (e: ListEntry) => mediaPath({ id: e.mediaId, type: e.type });

/** Categoria pra mostrar no card: Mangá, Manhwa, Manhua, Light novel */
export function mangaKind(x: { format?: MediaFormat | null; countryOfOrigin?: string | null; country?: string | null }) {
  if (x.format === 'NOVEL') return t('Light novel');
  const c = x.countryOfOrigin ?? x.country;
  if (c === 'KR') return t('Manhwa');
  if (c === 'CN' || c === 'TW') return t('Manhua');
  if (x.format === 'ONE_SHOT') return t('One-shot');
  return t('Mangá');
}

export type MangaCat = 'all' | 'manga' | 'manhwa' | 'manhua' | 'webtoon' | 'novel';

/** Categorias de leitura e o filtro do AniList que cada uma usa */
export const MANGA_CATS: { id: MangaCat; jp: string; label: string; filter: Partial<BrowseFilters> }[] = [
  {
    id: 'all',
    jp: '全部',
    get label() {
      return t('Tudo');
    },
    filter: {},
  },
  {
    id: 'manga',
    jp: '漫画',
    get label() {
      return t('Mangá');
    },
    filter: { country: 'JP', formats: ['MANGA', 'ONE_SHOT'] },
  },
  {
    id: 'manhwa',
    jp: '만화',
    get label() {
      return t('Manhwa');
    },
    filter: { country: 'KR', formats: ['MANGA', 'ONE_SHOT'] },
  },
  {
    id: 'manhua',
    jp: '漫画',
    get label() {
      return t('Manhua');
    },
    filter: { country: 'CN', formats: ['MANGA', 'ONE_SHOT'] },
  },
  {
    id: 'webtoon',
    jp: '縦読み',
    get label() {
      return t('Webtoon');
    },
    // "Long Strip" = rolagem vertical, o formato dos webtoons
    filter: { tags: ['Long Strip'], formats: ['MANGA'] },
  },
  {
    id: 'novel',
    jp: '小説',
    get label() {
      return t('Light novel');
    },
    filter: { formats: ['NOVEL'] },
  },
];

export const ANIME_FORMATS: MediaFormat[] = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
export const MANGA_FORMATS: MediaFormat[] = ['MANGA', 'ONE_SHOT', 'NOVEL'];

/** Media com os campos de leitura (pra converter entrada da lista de volta) */
export function withReading(m: Media, e: ListEntry): Media {
  return { ...m, type: e.type ?? 'ANIME', chapters: e.chapters ?? null, volumes: e.volumes ?? null, countryOfOrigin: e.country ?? null };
}
