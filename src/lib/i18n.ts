/**
 * Tradução da interface. O texto em português é a própria chave:
 *   t('Minha lista')            → "My list" / "マイリスト"
 *   t('{0} animes', n)          → placeholders {0}, {1}... na ordem dos argumentos
 * Chave sem tradução cai no português (nunca quebra a tela).
 * Pra traduzir algo novo: use t('texto') e adicione a chave em i18n/en.ts e i18n/ja.ts.
 */
import { useUI } from '../store/ui';
import en from './i18n/en';
import ja from './i18n/ja';

export type Lang = 'pt' | 'en' | 'ja';

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
];

const DICTS: Record<Exclude<Lang, 'pt'>, Record<string, string>> = { en, ja };

export const getLang = (): Lang => useUI.getState().lang ?? 'pt';

export function t(key: string, ...args: unknown[]): string {
  const lang = getLang();
  const s = lang === 'pt' ? key : DICTS[lang][key] ?? key;
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s;
}

/** Locale pra datas e números (toLocaleString). */
export const locale = () => ({ pt: 'pt-BR', en: 'en-US', ja: 'ja-JP' })[getLang()];
