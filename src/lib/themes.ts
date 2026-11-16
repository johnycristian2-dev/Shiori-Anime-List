/**
 * Temas do Shiori. Cada tema é só um conjunto de cores (variáveis CSS) + um padrão de fundo.
 * Pra criar um tema novo, adicione um objeto em PRESETS — nada mais precisa mudar.
 */

export type Pattern = 'halftone' | 'checker' | 'scanlines' | 'stars' | 'waves' | 'grid' | 'none';

export interface ThemeColors {
  bg: string;
  bg2: string;
  panel: string;
  panel2: string;
  ink: string;
  muted: string;
  line: string;
  /** cor principal (botões, destaques) */
  pink: string;
  /** cor secundária */
  cyan: string;
  /** cor de apoio (notas, badges) */
  yellow: string;
  /** sombra "de mangá" */
  shadow: string;
}

export interface Theme {
  id: string;
  name: string;
  jp: string;
  /** de onde veio a inspiração (só texto) */
  inspired?: string;
  dark: boolean;
  colors: ThemeColors;
  pattern: Pattern;
  /** imagem de fundo bem suave (banner/capa do anime) */
  image?: string | null;
  petals?: 'sakura' | 'embers' | 'snow' | 'none';
}

const dark = (c: Partial<ThemeColors> & Pick<ThemeColors, 'bg' | 'pink' | 'cyan' | 'yellow'>): ThemeColors => ({
  bg2: mix(c.bg, '#ffffff', 0.04),
  panel: mix(c.bg, '#ffffff', 0.07),
  panel2: mix(c.bg, '#ffffff', 0.11),
  ink: '#f5f2ff',
  muted: mix('#f5f2ff', c.bg, 0.38),
  line: mix(c.bg, '#ffffff', 0.17),
  shadow: '#000000',
  ...c,
});

const light = (c: Partial<ThemeColors> & Pick<ThemeColors, 'bg' | 'pink' | 'cyan' | 'yellow' | 'ink'>): ThemeColors => ({
  bg2: mix(c.bg, c.ink, 0.05),
  panel: '#ffffff',
  panel2: mix(c.bg, c.ink, 0.03),
  muted: mix(c.ink, c.bg, 0.45),
  line: mix(c.bg, c.ink, 0.16),
  shadow: c.ink,
  ...c,
});

export const PRESETS: Theme[] = [
  {
    id: 'noite',
    name: 'Noite',
    jp: '夜',
    dark: true,
    pattern: 'halftone',
    petals: 'sakura',
    colors: { bg: '#0c0a1d', bg2: '#141030', panel: '#1a1538', panel2: '#231c4a', ink: '#f5f1ff', muted: '#a59fca', line: '#2e2660', pink: '#ff4f9a', cyan: '#3de2ff', yellow: '#ffe14d', shadow: '#000000' },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    jp: '桜',
    dark: false,
    pattern: 'halftone',
    petals: 'sakura',
    colors: { bg: '#fff4f8', bg2: '#ffe6ef', panel: '#ffffff', panel2: '#fff0f5', ink: '#1d1430', muted: '#6f6488', line: '#f2c2d5', pink: '#e2307a', cyan: '#0a9fc4', yellow: '#f5a800', shadow: '#1d1430' },
  },
  {
    id: 'cyberpunk',
    name: 'Neon City',
    jp: '電脳',
    inspired: 'Cyberpunk: Edgerunners',
    dark: true,
    pattern: 'scanlines',
    petals: 'none',
    colors: dark({ bg: '#07070f', pink: '#ff2a6d', cyan: '#05d9e8', yellow: '#f9f871', line: '#2a1838' }),
  },
  {
    id: 'shadow-monarch',
    name: 'Monarca das Sombras',
    jp: '影',
    inspired: 'Solo Leveling',
    dark: true,
    pattern: 'grid',
    petals: 'none',
    colors: dark({ bg: '#05070f', pink: '#8b5cf6', cyan: '#38bdf8', yellow: '#c4b5fd' }),
  },
  {
    id: 'demon-hunter',
    name: 'Caçador de Onis',
    jp: '炎',
    inspired: 'Kimetsu no Yaiba',
    dark: true,
    pattern: 'checker',
    petals: 'embers',
    colors: dark({ bg: '#0c1611', pink: '#f05a28', cyan: '#2fbf9a', yellow: '#f2c14e' }),
  },
  {
    id: 'cursed',
    name: 'Expansão de Domínio',
    jp: '呪',
    inspired: 'Jujutsu Kaisen',
    dark: true,
    pattern: 'stars',
    petals: 'none',
    colors: dark({ bg: '#090b1c', pink: '#7c5cff', cyan: '#4fd1ff', yellow: '#ff3d6e' }),
  },
  {
    id: 'walls',
    name: 'Além das Muralhas',
    jp: '壁',
    inspired: 'Shingeki no Kyojin',
    dark: true,
    pattern: 'grid',
    petals: 'embers',
    colors: dark({ bg: '#15130f', pink: '#c0392b', cyan: '#6f9a7a', yellow: '#d6b16a', ink: '#f1ebe0' }),
  },
  {
    id: 'grand-line',
    name: 'Grand Line',
    jp: '海',
    inspired: 'One Piece',
    dark: true,
    pattern: 'waves',
    petals: 'none',
    colors: dark({ bg: '#071d33', pink: '#e63946', cyan: '#4cc9f0', yellow: '#ffd166' }),
  },
  {
    id: 'hidden-leaf',
    name: 'Vila da Folha',
    jp: '忍',
    inspired: 'Naruto',
    dark: true,
    pattern: 'halftone',
    petals: 'sakura',
    colors: dark({ bg: '#16110c', pink: '#ff7a1a', cyan: '#3a86ff', yellow: '#ffbe0b' }),
  },
  {
    id: 'saiyan',
    name: 'Poder Saiyajin',
    jp: '気',
    inspired: 'Dragon Ball',
    dark: true,
    pattern: 'halftone',
    petals: 'embers',
    colors: dark({ bg: '#120c06', pink: '#ff8c00', cyan: '#2f6fed', yellow: '#ffd60a' }),
  },
  {
    id: 'notebook',
    name: 'Caderno da Morte',
    jp: '死',
    inspired: 'Death Note',
    dark: true,
    pattern: 'none',
    petals: 'none',
    colors: dark({ bg: '#0b0b0b', pink: '#c1121f', cyan: '#bdbdbd', yellow: '#e9e9e9', ink: '#ececec' }),
  },
  {
    id: 'unit01',
    name: 'Unidade 01',
    jp: '初号機',
    inspired: 'Evangelion',
    dark: true,
    pattern: 'scanlines',
    petals: 'none',
    colors: dark({ bg: '#120a1f', pink: '#8b5cf6', cyan: '#84cc16', yellow: '#f97316' }),
  },
  {
    id: 'journey',
    name: 'Jornada da Elfa',
    jp: '旅',
    inspired: 'Frieren',
    dark: false,
    pattern: 'stars',
    petals: 'snow',
    colors: light({ bg: '#f2f5f1', ink: '#22313a', pink: '#5f8f73', cyan: '#6c9cc2', yellow: '#c49a4a' }),
  },
  {
    id: 'forest',
    name: 'Espírito da Floresta',
    jp: '森',
    inspired: 'Studio Ghibli',
    dark: false,
    pattern: 'waves',
    petals: 'sakura',
    colors: light({ bg: '#eef4e6', ink: '#253b2a', pink: '#d9644a', cyan: '#5f9e86', yellow: '#e7b65c' }),
  },
  {
    id: 'manga',
    name: 'Mangá P&B',
    jp: '漫画',
    dark: false,
    pattern: 'halftone',
    petals: 'none',
    colors: { bg: '#f7f7f5', bg2: '#ececea', panel: '#ffffff', panel2: '#f2f2f0', ink: '#111111', muted: '#5a5a5a', line: '#cfcfcc', pink: '#111111', cyan: '#4a4a4a', yellow: '#d9d9d6', shadow: '#111111' },
  },
];

// ───────────── Cores ─────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Mistura duas cores (t = 0 → a, 1 → b) */
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Luminância relativa (WCAG) */
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Gera um tema inteiro a partir da cor de capa de um anime (o AniList dá essa cor).
 * Escuro: fundo no mesmo tom bem apagado; destaque = a cor do anime; secundária = cor complementar.
 */
export function themeFromColor(color: string, opts: { id: string; name: string; image?: string | null; dark?: boolean }): Theme {
  const [h, s0] = hexToHsl(color);
  const s = Math.max(45, Math.min(95, s0 || 60));
  const isDark = opts.dark ?? true;
  const bg = isDark ? hslToHex(h, 32, 6) : hslToHex(h, 45, 96);
  // Ajusta o brilho até ter contraste suficiente com o fundo (cores claras como ciano somem no tema claro)
  const readable = (hue: number, sat: number, l: number) => {
    let col = hslToHex(hue, sat, l);
    for (let i = 0; i < 20 && contrast(col, bg) < 3.2; i++) {
      l += isDark ? 3 : -3;
      col = hslToHex(hue, sat, l);
    }
    return col;
  };
  const accent = readable(h, s, isDark ? 62 : 45);
  const second = readable(h + 150, Math.min(85, s), isDark ? 64 : 40);
  const third = readable(h + 50, Math.min(90, s), isDark ? 68 : 45);
  const colors: ThemeColors = isDark
    ? dark({ bg, pink: accent, cyan: second, yellow: third, ink: hslToHex(h, 30, 96) })
    : light({ bg, ink: hslToHex(h, 35, 12), pink: accent, cyan: second, yellow: third });
  return { id: opts.id, name: opts.name, jp: '推し', dark: isDark, pattern: 'halftone', image: opts.image ?? null, petals: 'sakura', colors };
}

/** Escolhe 1 item por dia de forma estável (mesmo dia = mesmo item). */
export function pickOfTheDay<T>(items: T[], day: string): T | undefined {
  if (!items.length) return undefined;
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return items[hash % items.length];
}

/** Aplica o tema na página (variáveis CSS na raiz). */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  const c = t.colors;
  const vars: Record<string, string> = {
    '--bg': c.bg,
    '--bg-2': c.bg2,
    '--panel': c.panel,
    '--panel-2': c.panel2,
    '--ink': c.ink,
    '--muted': c.muted,
    '--line': c.line,
    '--pink': c.pink,
    '--cyan': c.cyan,
    '--yellow': c.yellow,
    '--shadow': c.shadow,
    // texto em cima da cor principal: branco ou preto, o que tiver mais contraste
    '--on-pink': contrast(c.pink, '#ffffff') >= contrast(c.pink, '#0c0a1d') ? '#ffffff' : '#0c0a1d',
    '--glow': t.dark ? `0 0 24px color-mix(in srgb, ${c.pink} 45%, transparent)` : '0 0 0 transparent',
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  root.dataset.pattern = t.pattern;
  root.dataset.theme = t.dark ? 'noite' : 'sakura';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
}

/** Monta todas as cores de um tema a partir das 5 principais (o resto é derivado). */
export function buildColors(isDark: boolean, c: { bg: string; ink: string; pink: string; cyan: string; yellow: string }): ThemeColors {
  return isDark ? dark(c) : light(c);
}
