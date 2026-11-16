import { useMemo } from 'react';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import { dayKey } from './gacha';
import { pickOfTheDay, PRESETS, themeFromColor, type Theme } from './themes';
import { t } from './i18n';

/** Todos os temas que o usuário pode escolher (prontos + os que ele criou). */
export function useAllThemes() {
  const custom = useUI((s) => s.customThemes);
  return useMemo(() => [...PRESETS, ...custom], [custom]);
}

/** Animes da sua lista que viram tema: favoritos primeiro, depois os que está assistindo. */
export function useThemeableAnimes() {
  const entries = useList((s) => s.entries);
  return useMemo(() => {
    const all = Object.values(entries).filter((e) => e.color);
    const fav = all.filter((e) => e.favorite);
    const rest = all
      .filter((e) => !e.favorite && (e.status === 'WATCHING' || e.score >= 8))
      .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
    return { favorites: fav, others: rest };
  }, [entries]);
}

/** O tema que está valendo agora. */
export function useActiveTheme(): Theme {
  const id = useUI((s) => s.theme);
  const custom = useUI((s) => s.customThemes);
  const animeTheme = useUI((s) => s.animeTheme);
  const rotate = useUI((s) => s.rotateFavorites);
  const { favorites, others } = useThemeableAnimes();
  const today = dayKey();

  return useMemo(() => {
    if (rotate) {
      const pool = favorites.length ? favorites : others.slice(0, 10);
      const e = pickOfTheDay(pool, today);
      if (e?.color) return themeFromColor(e.color, { id: `dia-${e.mediaId}`, name: t('Tema do dia: {0}', e.title), image: e.cover });
    }
    if (id === 'anime' && animeTheme) return animeTheme;
    return custom.find((t) => t.id === id) ?? PRESETS.find((t) => t.id === id) ?? PRESETS[0];
  }, [id, custom, animeTheme, rotate, favorites, others, today]);
}
