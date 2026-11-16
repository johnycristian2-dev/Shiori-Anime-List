/**
 * Exportação/importação no formato XML do MyAnimeList.
 * MAL → Perfil → "Import" → tipo "MyAnimeList Import" aceita esse arquivo.
 */
import type { ListEntry, ListStatus, MediaFormat } from '../types';

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
};

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export function toMalXml(entries: ListEntry[]) {
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
};

export interface MalRow {
  idMal: number;
  title: string;
  status: ListStatus;
  score: number;
  progress: number;
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
  if (doc.querySelector('parsererror')) throw new Error('Arquivo XML inválido.');
  const animes = [...doc.querySelectorAll('anime')];
  if (!animes.length) throw new Error('Nenhum anime encontrado no arquivo.');
  return animes
    .map((a) => {
      const get = (tag: string) => a.querySelector(tag)?.textContent?.trim() ?? '';
      return {
        idMal: Number(get('series_animedb_id')),
        title: get('series_title'),
        status: FROM_MAL[get('my_status').toLowerCase()] ?? 'PLANNING',
        score: Math.min(10, Math.max(0, Number(get('my_score')) || 0)),
        progress: Number(get('my_watched_episodes')) || 0,
      };
    })
    .filter((r) => r.idMal > 0);
}
