import { beforeAll, describe, expect, it } from 'vitest';
import { useUI } from '../store/ui';
import { isManga, mangaKind, mediaPath, MANGA_CATS, statusLabel, totalUnits } from './media';
import { toMalMangaXml, toMalXml } from './mal';
import type { ListEntry } from '../types';

const base: ListEntry = {
  mediaId: 1,
  idMal: 10,
  title: 'X',
  titleEnglish: null,
  titleNative: null,
  cover: null,
  color: null,
  format: 'TV',
  episodes: 12,
  year: 2020,
  genres: [],
  averageScore: 80,
  status: 'WATCHING',
  score: 8,
  progress: 3,
  addedAt: 0,
  updatedAt: 0,
};
const manga: ListEntry = { ...base, mediaId: 2, idMal: 20, format: 'MANGA', episodes: null, type: 'MANGA', chapters: 179, country: 'KR' };

describe('anime × mangá', () => {
  beforeAll(() => useUI.setState({ lang: 'pt' }));
  it('entradas antigas (sem type) continuam sendo anime', () => {
    expect(isManga(base)).toBe(false);
    expect(totalUnits(base)).toBe(12);
    expect(mediaPath({ id: 1 })).toBe('/anime/1');
  });
  it('mangá usa capítulos e /manga/', () => {
    expect(isManga(manga)).toBe(true);
    expect(totalUnits(manga)).toBe(179);
    expect(mediaPath({ id: 2, type: 'MANGA' })).toBe('/manga/2');
  });
  it('status muda de nome na leitura', () => {
    expect(statusLabel('WATCHING', manga, 'Assistindo')).toBe('Lendo');
    expect(statusLabel('WATCHING', base, 'Assistindo')).toBe('Assistindo');
    expect(statusLabel('COMPLETED', manga, 'Completo')).toBe('Completo');
  });
  it('categoria pelo país/formato', () => {
    expect(mangaKind({ countryOfOrigin: 'KR', format: 'MANGA' })).toBe('Manhwa');
    expect(mangaKind({ countryOfOrigin: 'CN', format: 'MANGA' })).toBe('Manhua');
    expect(mangaKind({ countryOfOrigin: 'JP', format: 'NOVEL' })).toBe('Light novel');
    expect(MANGA_CATS.find((c) => c.id === 'webtoon')?.filter.tags).toEqual(['Long Strip']);
  });
  it('exporta anime e mangá em arquivos separados do MAL', () => {
    const a = toMalXml([base, manga]);
    const m = toMalMangaXml([base, manga]);
    expect(a.exported).toBe(1);
    expect(a.xml).not.toContain('<manga>');
    expect(m.exported).toBe(1);
    expect(m.xml).toContain('<manga_mangadb_id>20</manga_mangadb_id>');
    expect(m.xml).toContain('<my_status>Reading</my_status>');
    expect(m.xml).toContain('<user_export_type>2</user_export_type>');
  });
});
