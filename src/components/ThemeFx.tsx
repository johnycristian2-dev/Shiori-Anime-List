import type { Particles, Theme } from '../lib/themes';

const KANJI = '栞夢魂鬼影刃月星炎桜闇光神龍死命'.split('');
const KATA = 'アカサタナハマヤラワ0123456789ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃ';

const CLS: Record<Exclude<Particles, 'none'>, string> = {
  sakura: 'petal',
  embers: 'ember',
  snow: 'snowflake',
  leaves: 'leaf',
  bubbles: 'bubble',
  matrix: 'matrix',
  squares: 'square',
  sparks: 'spark',
  kanji: 'kanji',
  ash: 'ash',
};

/** Partículas de fundo (pétalas, brasas, chuva de código…) — determinístico, sem random. */
export function ThemeParticles({ kind, count }: { kind: Theme['petals']; count?: number }) {
  if (!kind || kind === 'none') return null;
  const cls = CLS[kind] ?? 'petal';
  const n = count ?? (kind === 'matrix' ? 16 : kind === 'kanji' ? 10 : 14);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {Array.from({ length: n }, (_, i) => {
        const base = { left: `${(i * 73) % 100}%`, animationDelay: `${-((i * 1.7) % 12)}s`, animationDuration: `${11 + ((i * 3) % 9)}s` };
        let style: React.CSSProperties = base;
        let text: string | undefined;
        if (kind === 'sakura') {
          const s = 8 + ((i * 5) % 10);
          style = { ...base, width: s, height: s * 0.8 };
        } else if (kind === 'leaves') {
          const s = 10 + ((i * 7) % 10);
          style = { ...base, width: s, height: s * 0.6 };
        } else if (kind === 'bubbles') {
          const s = 6 + ((i * 7) % 18);
          style = { ...base, width: s, height: s, animationDuration: `${9 + ((i * 3) % 8)}s` };
        } else if (kind === 'matrix') {
          text = Array.from({ length: 14 }, (_, j) => KATA[(i * 7 + j * 13) % KATA.length]).join('');
          style = { ...base, animationDuration: `${6 + ((i * 5) % 8)}s`, opacity: 0.12 + ((i * 7) % 5) * 0.04 };
        } else if (kind === 'squares') {
          const s = 6 + ((i * 5) % 12);
          style = { ...base, width: s, height: s };
        } else if (kind === 'sparks') {
          style = { ...base, height: 10 + ((i * 7) % 16), animationDuration: `${4 + ((i * 3) % 5)}s` };
        } else if (kind === 'kanji') {
          text = KANJI[i % KANJI.length];
          style = { ...base, fontSize: 18 + ((i * 11) % 26), animationDuration: `${16 + ((i * 3) % 10)}s` };
        } else {
          const s = 3 + ((i * 3) % 5);
          style = { ...base, width: s, height: s };
        }
        return (
          <span key={i} className={cls} style={style}>
            {text}
          </span>
        );
      })}
    </div>
  );
}

/** Camada por cima da tela (scanlines, vinheta, papel, filme, hexágonos). */
export function ThemeOverlay({ kind }: { kind: Theme['overlay'] }) {
  if (!kind || kind === 'none') return null;
  return <div aria-hidden className="theme-overlay" data-kind={kind} />;
}
