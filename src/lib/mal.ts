/**
 * Exportação/importação no formato XML do MyAnimeList.
 * MAL → Perfil → "Import" → tipo "MyAnimeList Import" aceita esse arquivo.
 */
import type { ListEntry, ListStatus, MediaFormat } from '../types';

import { t } from './i18n';

const TO_MAL: Record<ListStatus, string> = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  PLANNING: 'Plan to Watch',
  PAUSED: 'On-Hold',
  DROPPED: 'Dropped',
};

const MAL_TYPE: Record<MediaFormat, string> = {
  TV: 'TV',
  TV_SHORT: 'TV',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Novel',
  ONE_SHOT: 'One-shot',
};

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

const TO_MAL_MANGA: Record<ListStatus, string> = { ...TO_MAL, WATCHING: 'Reading', PLANNING: 'Plan to Read' };

/** Lista de leitura (mangá, manhwa, webtoon…) no formato de importação do MAL */
export function toMalMangaXml(all: ListEntry[]) {
  const entries = all.filter((e) => e.type === 'MANGA');
  const ok = entries.filter((e) => e.idMal);
  const skipped = entries.filter((e) => !e.idMal);
  const count = (s: ListStatus) => ok.filter((e) => e.status === s).length;
  const rows = ok.map(
    (e) => `  <manga>
    <manga_mangadb_id>${e.idMal}</manga_mangadb_id>
    <manga_title>${cdata(e.title)}</manga_title>
    <manga_volumes>${e.volumes ?? 0}</manga_volumes>
    <manga_chapters>${e.chapters ?? 0}</manga_chapters>
    <my_id>0</my_id>
    <my_read_volumes>0</my_read_volumes>
    <my_read_chapters>${e.progress}</my_read_chapters>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_scanalation_group>${cdata('')}</my_scanalation_group>
    <my_score>${e.score}</my_score>
    <my_storage></my_storage>
    <my_retail_volumes>0</my_retail_volumes>
    <my_status>${TO_MAL_MANGA[e.status]}</my_status>
    <my_comments>${cdata('')}</my_comments>
    <my_times_read>0</my_times_read>
    <my_tags>${cdata('')}</my_tags>
    <my_priority>Low</my_priority>
    <my_reread_value></my_reread_value>
    <my_rereading>NO</my_rereading>
    <my_discuss>YES</my_discuss>
    <my_sns>default</my_sns>
    <update_on_import>1</update_on_import>
  </manga>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_export_type>2</user_export_type>
    <user_total_manga>${ok.length}</user_total_manga>
    <user_total_reading>${count('WATCHING')}</user_total_reading>
    <user_total_completed>${count('COMPLETED')}</user_total_completed>
    <user_total_onhold>${count('PAUSED')}</user_total_onhold>
    <user_total_dropped>${count('DROPPED')}</user_total_dropped>
    <user_total_plantoread>${count('PLANNING')}</user_total_plantoread>
  </myinfo>
${rows.join('\n')}
</myanimelist>
`;
  return { xml, exported: ok.length, skipped };
}

export function toMalXml(all: ListEntry[]) {
  const entries = all.filter((e) => e.type !== 'MANGA');
  const ok = entries.filter((e) => e.idMal);
  const skipped = entries.filter((e) => !e.idMal);
  const count = (s: ListStatus) => ok.filter((e) => e.status === s).length;

  const rows = ok.map(
    (e) => `  <anime>
    <series_animedb_id>${e.idMal}</series_animedb_id>
    <series_title>${cdata(e.title)}</series_title>
    <series_type>${e.format ? MAL_TYPE[e.format] : 'TV'}</series_type>
    <series_episodes>${e.episodes ?? 0}</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>${e.progress}</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_rated></my_rated>
    <my_score>${e.score}</my_score>
    <my_storage></my_storage>
    <my_storage_value>0.00</my_storage_value>
    <my_status>${TO_MAL[e.status]}</my_status>
    <my_comments>${cdata('')}</my_comments>
    <my_times_watched>0</my_times_watched>
    <my_rewatch_value></my_rewatch_value>
    <my_priority>LOW</my_priority>
    <my_tags>${cdata('')}</my_tags>
    <my_rewatching>0</my_rewatching>
    <my_rewatching_ep>0</my_rewatching_ep>
    <my_discuss>1</my_discuss>
    <my_sns>default</my_sns>
    <update_on_import>1</update_on_import>
  </anime>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_export_type>1</user_export_type>
    <user_total_anime>${ok.length}</user_total_anime>
    <user_total_watching>${count('WATCHING')}</user_total_watching>
    <user_total_completed>${count('COMPLETED')}</user_total_completed>
    <user_total_onhold>${count('PAUSED')}</user_total_onhold>
    <user_total_dropped>${count('DROPPED')}</user_total_dropped>
    <user_total_plantowatch>${count('PLANNING')}</user_total_plantowatch>
  </myinfo>
${rows.join('\n')}
</myanimelist>
`;
  return { xml, exported: ok.length, skipped };
}

const FROM_MAL: Record<string, ListStatus> = {
  watching: 'WATCHING',
  '1': 'WATCHING',
  completed: 'COMPLETED',
  '2': 'COMPLETED',
  'on-hold': 'PAUSED',
  '3': 'PAUSED',
  dropped: 'DROPPED',
  '4': 'DROPPED',
  'plan to watch': 'PLANNING',
  '6': 'PLANNING',
  reading: 'WATCHING',
  'plan to read': 'PLANNING',
};

export interface MalRow {
  idMal: number;
  title: string;
  status: ListStatus;
  score: number;
  progress: number;
  type: 'ANIME' | 'MANGA';
}

/** Lê o arquivo exportado pelo MAL (.xml ou .xml.gz). */
export async function readMalFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.gz')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = (file.stream() as any).pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return file.text();
}

export function parseMalXml(xml: string): MalRow[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(t('Arquivo XML inválido.'));
  const animes = [...doc.querySelectorAll('anime')];
  const mangas = [...doc.querySelectorAll('manga')];
  if (!animes.length && !mangas.length) throw new Error(t('Nenhum anime ou mangá encontrado no arquivo.'));
  const read = (a: Element, type: 'ANIME' | 'MANGA'): MalRow => {
    const get = (tag: string) => a.querySelector(tag)?.textContent?.trim() ?? '';
    return {
      idMal: Number(get(type === 'ANIME' ? 'series_animedb_id' : 'manga_mangadb_id')),
      title: get(type === 'ANIME' ? 'series_title' : 'manga_title'),
      status: FROM_MAL[get('my_status').toLowerCase()] ?? 'PLANNING',
      score: Math.min(10, Math.max(0, Number(get('my_score')) || 0)),
      progress: Number(get(type === 'ANIME' ? 'my_watched_episodes' : 'my_read_chapters')) || 0,
      type,
    };
  };
  return [...animes.map((a) => read(a, 'ANIME')), ...mangas.map((a) => read(a, 'MANGA'))]
    .filter((r) => r.idMal > 0);
}
