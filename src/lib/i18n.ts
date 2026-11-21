/**
 * Tradução da interface. O texto em português é a própria chave:
 *   t('Minha lista')            → "My list" / "マイリスト"
 *   t('{0} animes', n)          → placeholders {0}, {1}... na ordem dos argumentos
 * Chave sem tradução cai no português (nunca quebra a tela).
 * Pra traduzir algo novo: use t('texto') e adicione a chave em i18n/en.ts e i18n/ja.ts.
 */
import { useUI } from '../store/ui';

export type Lang = 'pt' | 'en' | 'ja';

// Sigla em texto (o Windows não desenha emojis de bandeira, mostra "BR", "US"…)
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'pt', label: 'Português', short: 'PT' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ja', label: '日本語', short: '日本' },
];

// Cada idioma é um arquivo separado, baixado só por quem usa (economiza ~70 KB no celular de quem lê em português).
const DICTS: Partial<Record<Exclude<Lang, 'pt'>, Record<string, string>>> = {};
export async function loadLang(lang: Lang) {
  if (lang === 'pt' || DICTS[lang]) return;
  DICTS[lang] = (lang === 'en' ? await import('./i18n/en') : await import('./i18n/ja')).default;
}

export const getLang = (): Lang => useUI.getState().lang ?? 'pt';

export function t(key: string, ...args: unknown[]): string {
  const lang = getLang();
  const s = lang === 'pt' ? key : DICTS[lang]?.[key] ?? key;
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s;
}

/** Locale pra datas e números (toLocaleString). */
export const locale = () => ({ pt: 'pt-BR', en: 'en-US', ja: 'ja-JP' })[getLang()];
