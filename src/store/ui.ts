import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Theme as ThemeDef } from '../lib/themes';

/** id de um tema pronto, de um tema seu, ou 'anime' (gerado a partir de um anime) */
export type Theme = string;
export type TitleLang = 'romaji' | 'english' | 'native';
export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'info' | 'err';
}

interface UIState {
  theme: Theme;
  customThemes: ThemeDef[];
  animeTheme: ThemeDef | null;
  /** Troca o tema todo dia entre os seus favoritos */
  rotateFavorites: boolean;
  saveCustomTheme: (t: ThemeDef) => void;
  deleteCustomTheme: (id: string) => void;
  setAnimeTheme: (t: ThemeDef) => void;
  setRotateFavorites: (v: boolean) => void;
  titleLang: TitleLang;
  lang: 'pt' | 'en' | 'ja';
  setLang: (l: 'pt' | 'en' | 'ja') => void;
  /** Modo do site: anime ou leitura (mangá, manhwa, webtoon…) */
  kind: 'ANIME' | 'MANGA';
  /** Esconde palavrões em posts e comentários (p***a) */
  cleanText: boolean;
  setCleanText: (v: boolean) => void;
  setKind: (k: 'ANIME' | 'MANGA') => void;
  petals: boolean;
  nickname: string;
  notify: boolean;
  setNotify: (v: boolean) => void;
  /** ids de airingSchedule já dispensados / já notificados */
  seenAiring: number[];
  notifiedAiring: number[];
  markSeen: (ids: number[]) => void;
  markNotified: (ids: number[]) => void;
  setNickname: (n: string) => void;
  toasts: Toast[];
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setTitleLang: (l: TitleLang) => void;
  setPetals: (v: boolean) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'noite',
      customThemes: [],
      animeTheme: null,
      rotateFavorites: false,
      saveCustomTheme: (t) =>
        set((s) => ({ customThemes: [...s.customThemes.filter((x) => x.id !== t.id), t], theme: t.id, rotateFavorites: false })),
      deleteCustomTheme: (id) =>
        set((s) => ({ customThemes: s.customThemes.filter((x) => x.id !== id), theme: s.theme === id ? 'noite' : s.theme })),
      setAnimeTheme: (t) => set({ animeTheme: t, theme: 'anime', rotateFavorites: false }),
      setRotateFavorites: (rotateFavorites) => set({ rotateFavorites }),
      titleLang: 'romaji',
      lang: (typeof navigator !== 'undefined' && navigator.language?.startsWith('ja') ? 'ja' : typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'pt') as 'pt' | 'en' | 'ja',
      setLang: (lang) => set({ lang }),
      kind: 'ANIME',
      cleanText: true,
      setCleanText: (cleanText) => set({ cleanText }),
      setKind: (kind) => set({ kind }),
      petals: true,
      nickname: '',
      notify: false,
      setNotify: (notify) => set({ notify }),
      seenAiring: [],
      notifiedAiring: [],
      markSeen: (ids) => set((s) => ({ seenAiring: [...new Set([...s.seenAiring, ...ids])].slice(-500) })),
      markNotified: (ids) => set((s) => ({ notifiedAiring: [...new Set([...s.notifiedAiring, ...ids])].slice(-500) })),
      setNickname: (nickname) => set({ nickname }),
      toasts: [],
      setTheme: (theme) => set({ theme, rotateFavorites: false }),
      toggleTheme: () => set({ theme: get().theme === 'noite' ? 'sakura' : 'noite', rotateFavorites: false }),
      setTitleLang: (titleLang) => set({ titleLang }),
      setPetals: (petals) => set({ petals }),
      toast: (text, tone = 'ok') => {
        const id = nextId++;
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
        setTimeout(() => get().dismiss(id), 2800);
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'shiori-ui',
      partialize: (s) => ({
        theme: s.theme,
        customThemes: s.customThemes,
        animeTheme: s.animeTheme,
        rotateFavorites: s.rotateFavorites,
        titleLang: s.titleLang,
        lang: s.lang,
        kind: s.kind,
        cleanText: s.cleanText,
        petals: s.petals,
        nickname: s.nickname,
        notify: s.notify,
        seenAiring: s.seenAiring,
        notifiedAiring: s.notifiedAiring,
      }),
    },
  ),
);
