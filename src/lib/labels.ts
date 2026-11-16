import type { MediaFormat, MediaSort, MediaStatus } from '../types';

export const GENRES: Record<string, { pt: string; jp: string }> = {
  Action: { pt: 'Ação', jp: 'アクション' },
  Adventure: { pt: 'Aventura', jp: '冒険' },
  Comedy: { pt: 'Comédia', jp: 'コメディ' },
  Drama: { pt: 'Drama', jp: 'ドラマ' },
  Ecchi: { pt: 'Ecchi', jp: 'エッチ' },
  Fantasy: { pt: 'Fantasia', jp: 'ファンタジー' },
  Horror: { pt: 'Terror', jp: 'ホラー' },
  'Mahou Shoujo': { pt: 'Mahou Shoujo', jp: '魔法少女' },
  Mecha: { pt: 'Mecha', jp: 'メカ' },
  Music: { pt: 'Música', jp: '音楽' },
  Mystery: { pt: 'Mistério', jp: 'ミステリー' },
  Psychological: { pt: 'Psicológico', jp: '心理' },
  Romance: { pt: 'Romance', jp: '恋愛' },
  'Sci-Fi': { pt: 'Ficção científica', jp: 'SF' },
  'Slice of Life': { pt: 'Slice of Life', jp: '日常' },
  Sports: { pt: 'Esportes', jp: 'スポーツ' },
  Supernatural: { pt: 'Sobrenatural', jp: '超自然' },
  Thriller: { pt: 'Suspense', jp: 'スリラー' },
};
export const HIDDEN_GENRES = ['Hentai'];
export const genrePt = (g: string) => GENRES[g]?.pt ?? g;

export const FORMAT_LABEL: Record<MediaFormat, string> = {
  TV: 'TV',
  TV_SHORT: 'TV curto',
  MOVIE: 'Filme',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clipe',
};

export const MEDIA_STATUS_LABEL: Record<MediaStatus, string> = {
  FINISHED: 'Finalizado',
  RELEASING: 'Em lançamento',
  NOT_YET_RELEASED: 'Ainda não lançado',
  CANCELLED: 'Cancelado',
  HIATUS: 'Em hiato',
};

export const RELATION_LABEL: Record<string, string> = {
  SEQUEL: 'Sequência',
  PREQUEL: 'Prequela',
  SIDE_STORY: 'História paralela',
  ALTERNATIVE: 'Versão alternativa',
  SPIN_OFF: 'Spin-off',
  PARENT: 'Obra principal',
  SUMMARY: 'Resumo',
  CHARACTER: 'Mesmos personagens',
  COMPILATION: 'Compilação',
  CONTAINS: 'Contém',
  SOURCE: 'Fonte',
  ADAPTATION: 'Adaptação',
  OTHER: 'Relacionado',
};

export const SORT_OPTIONS: { value: MediaSort; label: string }[] = [
  { value: 'POPULARITY_DESC', label: 'Mais populares' },
  { value: 'SCORE_DESC', label: 'Melhor nota' },
  { value: 'TRENDING_DESC', label: 'Em alta agora' },
  { value: 'FAVOURITES_DESC', label: 'Mais favoritados' },
  { value: 'START_DATE_DESC', label: 'Mais recentes' },
  { value: 'START_DATE', label: 'Mais antigos' },
  { value: 'TITLE_ROMAJI', label: 'Título (A–Z)' },
];

export const DECADES = [1970, 1980, 1990, 2000, 2010, 2020];

/** Plataformas (ids do AniList). O catálogo é global: no Brasil pode variar. */
export const STREAMING = [
  { id: 10, name: 'Netflix', color: '#e50914' },
  { id: 5, name: 'Crunchyroll', color: '#f47521' },
  { id: 21, name: 'Prime Video', color: '#00a8e1' },
  { id: 118, name: 'Disney+', color: '#113ccf' },
  { id: 211, name: 'Max', color: '#5822b4' },
  { id: 20, name: 'HIDIVE', color: '#00baff' },
];

export const LENGTHS = [
  { id: 'short', label: 'Curto (até 13 ep)' },
  { id: 'medium', label: 'Médio (14–26 ep)' },
  { id: 'long', label: 'Longo (27+ ep)' },
] as const;

export const COUNTRIES = [
  { id: 'JP', label: 'Japão 🇯🇵' },
  { id: 'CN', label: 'China 🇨🇳' },
  { id: 'KR', label: 'Coreia 🇰🇷' },
] as const;

/** Tags temáticas do AniList, com nome em português. */
export const THEME_TAGS: { tag: string; pt: string }[] = [
  { tag: 'Isekai', pt: 'Isekai' },
  { tag: 'Reincarnation', pt: 'Reencarnação' },
  { tag: 'School', pt: 'Escola' },
  { tag: 'Super Power', pt: 'Superpoderes' },
  { tag: 'Martial Arts', pt: 'Artes marciais' },
  { tag: 'Revenge', pt: 'Vingança' },
  { tag: 'Survival', pt: 'Sobrevivência' },
  { tag: 'Time Loop', pt: 'Loop temporal' },
  { tag: 'Detective', pt: 'Detetive' },
  { tag: 'Military', pt: 'Militar' },
  { tag: 'Post-Apocalyptic', pt: 'Pós-apocalíptico' },
  { tag: 'Mythology', pt: 'Mitologia' },
  { tag: 'Found Family', pt: 'Família escolhida' },
  { tag: 'Coming of Age', pt: 'Amadurecimento' },
  { tag: 'Iyashikei', pt: 'Iyashikei (relaxante)' },
  { tag: 'Tragedy', pt: 'Tragédia' },
  { tag: 'Idol', pt: 'Idols' },
];
