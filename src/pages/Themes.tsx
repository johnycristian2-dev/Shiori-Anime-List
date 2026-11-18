import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Moon, Pencil, Plus, Shuffle, Sun, Trash2, Wand2 } from 'lucide-react';
import { ConfirmButton, SectionTitle } from '../components/ui';
import { dayKey } from '../lib/gacha';
import { applyTheme, buildColors, contrast, ensureFont, FONT_CHOICES, PRESETS, themeFromColor, type Overlay, type Particles, type Pattern, type ShadowStyle, type Theme, type TitleStyle } from '../lib/themes';
import { ThemeParticles } from '../components/ThemeFx';
import { pickOfTheDay } from '../lib/themes';
import { useActiveTheme, useThemeableAnimes } from '../lib/useTheme';
import { pickTitle } from '../lib/format';
import { useUI } from '../store/ui';
import { useNavigate } from 'react-router-dom';
import { isPlus, useMyPerks } from '../sync/perks';
import type { ListEntry } from '../types';

import { t } from '../lib/i18n';

const PATTERNS: { id: Pattern; label: string }[] = [
  {
    id: 'halftone',

    get label() {
      return t('Retícula');
    }
  },
  {
    id: 'checker',

    get label() {
      return t('Xadrez');
    }
  },
  {
    id: 'scanlines',

    get label() {
      return t('Tela CRT');
    }
  },
  {
    id: 'stars',

    get label() {
      return t('Estrelas');
    }
  },
  {
    id: 'waves',

    get label() {
      return t('Ondas');
    }
  },
  {
    id: 'grid',

    get label() {
      return t('Grade');
    }
  },
  {
    id: 'none',

    get label() {
      return t('Liso');
    }
  },
];

const opt = <T extends string>(id: T, pt: string) => ({
  id,
  get label() {
    return t(pt);
  },
});

const PARTICLES = [
  opt<Particles>('sakura', '🌸 Pétalas'),
  opt<Particles>('embers', '🔥 Brasas'),
  opt<Particles>('snow', '✨ Poeira'),
  opt<Particles>('leaves', '🍃 Folhas'),
  opt<Particles>('bubbles', '🫧 Bolhas'),
  opt<Particles>('matrix', '💻 Chuva de código'),
  opt<Particles>('squares', '🟦 Sistema'),
  opt<Particles>('sparks', '⚡ Faíscas'),
  opt<Particles>('kanji', '漢 Kanji'),
  opt<Particles>('ash', '🌫️ Cinzas'),
  opt<Particles>('none', 'Nada'),
];
const SHADOWS = [opt<ShadowStyle>('manga', 'Mangá (contorno preto)'), opt<ShadowStyle>('glow', 'Neon'), opt<ShadowStyle>('soft', 'Suave'), opt<ShadowStyle>('none', 'Sem sombra')];
const TITLES = [
  opt<TitleStyle>('stroke', 'Contorno'),
  opt<TitleStyle>('pop3d', 'Pop 3D'),
  opt<TitleStyle>('glitch', 'Glitch'),
  opt<TitleStyle>('neon', 'Neon'),
  opt<TitleStyle>('brush', 'Pincel'),
  opt<TitleStyle>('elegant', 'Elegante'),
  opt<TitleStyle>('plain', 'Simples'),
];
const OVERLAYS = [
  opt<Overlay>('none', 'Nenhuma'),
  opt<Overlay>('scanlines', 'Monitor antigo (piscando)'),
  opt<Overlay>('vignette', 'Vinheta'),
  opt<Overlay>('paper', 'Papel'),
  opt<Overlay>('film', 'Filme antigo'),
  opt<Overlay>('hex', 'Hexágonos'),
];

/** Variáveis do tema só dentro do card (pra prévia não mexer no site). */
const scopeVars = (t: Theme): CSSProperties =>
  (({
    '--bg': t.colors.bg,
    '--panel': t.colors.panel,
    '--ink': t.colors.ink,
    '--pink': t.colors.pink,
    '--cyan': t.colors.cyan,
    '--yellow': t.colors.yellow,
    '--pattern-ink': `color-mix(in srgb, ${t.colors.ink} 10%, transparent)`,
    '--font-display': t.font?.display ? `'${t.font.display}', 'Dela Gothic One', sans-serif` : undefined,
  }) as CSSProperties);

function Chips<T extends string>({ label, items, value, onPick }: { label: string; items: { id: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((p) => (
          <button key={p.id} className={`chip !text-xs ${value === p.id ? 'on' : ''}`} onClick={() => onPick(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeCard({ theme: th, active, onPick, actions, locked }: { theme: Theme; active: boolean; onPick: () => void; actions?: React.ReactNode; locked?: boolean }) {
  const c = th.colors;
  useEffect(() => ensureFont(th.font?.display, th.font?.weights), [th.font?.display, th.font?.weights]);
  const r = th.radius ?? 18;
  const glow = th.shadow === 'glow';
  const soft = th.shadow === 'soft';
  const btnShadow = glow ? `0 0 12px ${c.pink}` : soft ? '0 4px 10px rgba(0,0,0,.35)' : '2px 2px 0 #000';
  const display = th.font?.display ? `'${th.font.display}', 'Dela Gothic One', sans-serif` : undefined;
  return (
    <div className="group relative">
      {th.plus && (
        <span className="badge-plus absolute bottom-[calc(100%-8.4rem)] right-2 z-10 inline-flex items-center gap-1 rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-black">
          {locked ? '🔒' : '✦'} Shiori+
        </span>
      )}
      <button
        onClick={onPick}
        className={`block w-full overflow-hidden border-[3px] text-left transition hover:-translate-y-1 ${active ? 'border-pink' : 'border-black'}`}
        style={{
          borderRadius: Math.max(6, r),
          boxShadow: glow ? `0 0 ${active ? 26 : 14}px ${c.pink}` : soft ? '0 12px 28px rgba(0,0,0,.4)' : `5px 5px 0 ${active ? c.pink : '#000'}`,
        }}
      >
        <div data-pattern={th.pattern} className="pattern-preview relative h-36 overflow-hidden p-3" style={{ ...scopeVars(th), backgroundColor: c.bg }}>
          {th.image && <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url("${th.image}")` }} />}
          <ThemeParticles kind={th.petals} count={7} />
          {th.overlay && th.overlay !== 'none' && <div aria-hidden className="theme-overlay !absolute" data-kind={th.overlay} />}
          <div className="absolute -right-1 -top-3 font-jp text-5xl font-black opacity-20" style={{ color: c.pink }}>
            {th.jp}
          </div>
          <div className="relative">
            <div
              className={`preview-title truncate text-xl leading-tight`}
              data-title={th.title ?? 'stroke'}
              style={{ fontFamily: display ?? 'var(--font-display)', color: c.ink, ['--pink' as string]: c.pink, ['--cyan' as string]: c.cyan }}
            >
              {th.name}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="h-14 w-10 border-2" style={{ background: c.panel, borderColor: glow ? c.pink : c.line, borderRadius: r * 0.5, boxShadow: glow ? `0 0 8px ${c.pink}` : undefined }} />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-2 w-3/4 rounded" style={{ background: c.ink, opacity: 0.8 }} />
                <div className="h-2 w-1/2 rounded" style={{ background: c.muted }} />
                <div className="flex gap-1.5 pt-1">
                  <span className="h-5 w-12 border-2" style={{ background: c.pink, borderColor: glow ? c.pink : '#000', borderRadius: r * 0.4, boxShadow: btnShadow }} />
                  <span className="h-5 w-6 border-2" style={{ background: c.cyan, borderColor: glow ? c.cyan : '#000', borderRadius: r * 0.4 }} />
                  <span className="h-5 w-6 border-2" style={{ background: c.yellow, borderColor: glow ? c.yellow : '#000', borderRadius: r * 0.4 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: c.panel, color: c.ink }}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold" style={{ color: c.muted }}>
              {th.inspired ? t('inspirado em {0}', th.inspired) : th.dark ? t('escuro') : t('claro')}
            </div>
            {th.font?.display && (
              <div className="truncate text-[10px] font-bold opacity-70">
                Aa · {th.font.display}
              </div>
            )}
          </div>
          {active && (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-black" style={{ background: c.pink, color: '#fff' }}>
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </div>
      </button>
      {actions && !locked && <div className="absolute right-2 top-2 z-10 flex gap-1">{actions}</div>}
    </div>
  );
}

function Editor({ base, onClose }: { base: Theme; onClose: () => void }) {
  const save = useUI((s) => s.saveCustomTheme);
  const toast = useUI((s) => s.toast);
  const isNew = !base.id.startsWith('custom-');
  const [name, setName] = useState(isNew ? t('Meu tema') : base.name);
  const [isDark, setDark] = useState(base.dark);
  const [c, setC] = useState({ bg: base.colors.bg, ink: base.colors.ink, pink: base.colors.pink, cyan: base.colors.cyan, yellow: base.colors.yellow });
  const [pattern, setPattern] = useState<Pattern>(base.pattern);
  const [petals, setPetals] = useState<Particles>(base.petals ?? 'sakura');
  const [font, setFont] = useState(base.font?.display ?? 'Dela Gothic One');
  const [radius, setRadius] = useState(base.radius ?? 18);
  const [shadow, setShadow] = useState<ShadowStyle>(base.shadow ?? 'manga');
  const [title, setTitle] = useState<TitleStyle>(base.title ?? 'stroke');
  const [overlay, setOverlay] = useState<Overlay>(base.overlay ?? 'none');
  const [seed, setSeed] = useState(base.colors.pink);
  useEffect(() => FONT_CHOICES.forEach((f) => ensureFont(f)), []);

  const draft: Theme = {
    id: isNew ? `custom-${Date.now().toString(36)}` : base.id,
    name: name.trim() || t('Meu tema'),
    jp: '自作',
    dark: isDark,
    pattern,
    petals,
    image: base.image ?? null,
    colors: buildColors(isDark, c),
    font: font === 'Dela Gothic One' ? undefined : { display: font, body: base.font?.display === font ? base.font?.body : undefined },
    radius,
    shadow,
    title,
    overlay,
  };
  const readable = contrast(draft.colors.ink, draft.colors.bg);

  // Prévia ao vivo no site inteiro enquanto edita
  useEffect(() => {
    applyTheme(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draft.colors), pattern, isDark, font, radius, shadow, title, overlay]);

  const field = (k: keyof typeof c, label: string) => (
    <label className="flex items-center gap-3 rounded-xl bg-panel-2 p-2 text-sm font-bold">
      <input type="color" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} className="h-9 w-12 cursor-pointer rounded border-2 border-black bg-transparent" />
      <span className="flex-1">{label}</span>
      <code className="text-xs text-muted">{c[k]}</code>
    </label>
  );

  return (
    <div className="panel pop-in mb-10 space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Wand2 className="text-pink" />
        <input className="field !w-auto flex-1 font-display" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-1">
          <button className={`chip ${isDark ? 'on' : ''}`} onClick={() => setDark(true)}>
            <Moon size={14} />{' '}{t('Escuro')}
          </button>
          <button className={`chip ${!isDark ? 'on' : ''}`} onClick={() => setDark(false)}>
            <Sun size={14} />{' '}{t('Claro')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-line p-3 text-sm font-bold">
        <span>{t('Atalho: gerar tudo a partir de uma cor')}</span>
        <input type="color" value={seed} onChange={(e) => setSeed(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-2 border-black" />
        <button
          className="manga-btn ghost !py-1.5"
          onClick={() => {
            const g = themeFromColor(seed, { id: 'x', name, dark: isDark });
            setC({ bg: g.colors.bg, ink: g.colors.ink, pink: g.colors.pink, cyan: g.colors.cyan, yellow: g.colors.yellow });
          }}
        >
          {t('Gerar')}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {field('bg', t('Fundo'))}
        {field('ink', t('Texto'))}
        {field('pink', t('Cor principal'))}
        {field('cyan', t('Cor secundária'))}
        {field('yellow', t('Destaques e notas'))}
      </div>
      {readable < 4.5 && <p className="text-sm font-bold text-red-400">{t('⚠️ Texto com pouco contraste no fundo (')}{readable.toFixed(1)}{t(':1) — fica difícil de ler. O ideal é 7:1.')}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Chips label={t('Fundo')} items={PATTERNS} value={pattern} onPick={setPattern} />
        <Chips label={t('Partículas')} items={PARTICLES} value={petals} onPick={setPetals} />
        <Chips label={t('Efeito nos títulos')} items={TITLES} value={title} onPick={setTitle} />
        <Chips label={t('Sombras e bordas')} items={SHADOWS} value={shadow} onPick={setShadow} />
        <Chips label={t('Camada na tela')} items={OVERLAYS} value={overlay} onPick={setOverlay} />
        <div>
          <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-muted">{t('Cantos')} · {radius}px</div>
          <input type="range" min={0} max={28} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--pink)]" />
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-muted">{t('Fonte dos títulos')}</div>
        <div className="flex flex-wrap gap-1.5">
          {FONT_CHOICES.map((f) => (
            <button
              key={f}
              onMouseEnter={() => ensureFont(f)}
              onFocus={() => ensureFont(f)}
              className={`chip !text-sm ${font === f ? 'on' : ''}`}
              style={{ fontFamily: `'${f}', sans-serif` }}
              onClick={() => {
                ensureFont(f);
                setFont(f);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="manga-btn"
          onClick={() => {
            save(draft);
            toast(t('Tema "{0}" salvo e aplicado!', draft.name));
            onClose();
          }}
        >
          <Check size={16} />{' '}{t('Salvar e usar')}
        </button>
        <button className="manga-btn ghost" onClick={onClose}>
          {t('Cancelar')}
        </button>
      </div>
    </div>
  );
}

function AnimeChip({ e, onPick, active }: { e: ListEntry; onPick: () => void; active: boolean }) {
  const lang = useUI((s) => s.titleLang);
  return (
    <button onClick={onPick} className="group w-24 shrink-0 text-left" title={t('Usar as cores de {0}', e.title)}>
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-xl border-[3px] transition group-hover:-translate-y-1 ${active ? 'border-pink' : 'border-black'}`}
        style={{ boxShadow: `4px 4px 0 ${e.color}` }}
      >
        {e.cover && <img src={e.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute bottom-1 left-1 h-4 w-4 rounded-full border-2 border-black" style={{ background: e.color ?? undefined }} />
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight">{pickTitle({ romaji: e.title, english: e.titleEnglish, native: null }, lang)}</div>
    </button>
  );
}

export default function Themes() {
  const active = useActiveTheme();
  const themeId = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const custom = useUI((s) => s.customThemes);
  const deleteCustom = useUI((s) => s.deleteCustomTheme);
  const animeTheme = useUI((s) => s.animeTheme);
  const setAnimeTheme = useUI((s) => s.setAnimeTheme);
  const rotate = useUI((s) => s.rotateFavorites);
  const setRotate = useUI((s) => s.setRotateFavorites);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const plus = isPlus(useMyPerks());
  const [editing, setEditing] = useState<Theme | null>(null);
  const [genDark, setGenDark] = useState(true);
  const { favorites, others } = useThemeableAnimes();
  const pool = favorites.length ? favorites : others.slice(0, 10);
  const todays = pickOfTheDay(pool, dayKey());

  const fromAnime = (e: ListEntry) => {
    setAnimeTheme(themeFromColor(e.color!, { id: 'anime', name: e.title, image: e.cover, dark: genDark }));
    toast(t('Tema de {0} aplicado 🎨', e.title));
  };

  const closeEditor = () => {
    setEditing(null);
  };

  // Ao sair do editor sem salvar, volta pro tema ativo
  useEffect(() => {
    if (!editing) applyTheme(active);
  }, [editing, active]);

  return (
    <>
      <SectionTitle title={t('Temas')} jp="着せ替え" action={<span className="text-muted">{t('Agora:')}{' '}{active.name}</span>} />

      {editing && <Editor base={editing} onClose={closeEditor} />}

      <section className="mb-10">
        <SectionTitle title={t('Do seu anime')} jp="推し色" />
        <p className="-mt-2 mb-4 text-sm font-bold text-muted">
          {t(
            'Escolha um anime da sua lista e o site inteiro ganha as cores dele (e a capa bem suave no fundo).'
          )}
        </p>
        <div className="panel mb-4 flex flex-wrap items-center gap-3 p-3">
          <button className={`chip ${rotate ? 'on' : ''}`} onClick={() => setRotate(!rotate)} disabled={!pool.length}>
            <Shuffle size={14} />{' '}{t('Trocar todo dia entre meus')}{' '}{favorites.length ? t('favoritos') : t('animes')}
          </button>
          {rotate && todays && <span className="text-sm font-bold">{t('Hoje:')}{' '}{todays.title}</span>}
          <div className="ml-auto flex gap-1">
            <button className={`chip !text-xs ${genDark ? 'on' : ''}`} onClick={() => setGenDark(true)}>
              <Moon size={12} />{' '}{t('Escuro')}
            </button>
            <button className={`chip !text-xs ${!genDark ? 'on' : ''}`} onClick={() => setGenDark(false)}>
              <Sun size={12} />{' '}{t('Claro')}
            </button>
          </div>
        </div>
        {pool.length ? (
          <>
            {favorites.length > 0 && <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{t('♥ Favoritos')}</div>}
            <div className="no-scrollbar -mx-4 mb-3 flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
              {(favorites.length ? favorites : others).slice(0, 24).map((e) => (
                <AnimeChip key={e.mediaId} e={e} onPick={() => fromAnime(e)} active={!rotate && themeId === 'anime' && animeTheme?.name === e.title} />
              ))}
            </div>
            {favorites.length > 0 && others.length > 0 && (
              <>
                <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{t('Assistindo e bem avaliados')}</div>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
                  {others.slice(0, 24).map((e) => (
                    <AnimeChip key={e.mediaId} e={e} onPick={() => fromAnime(e)} active={!rotate && themeId === 'anime' && animeTheme?.name === e.title} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="panel p-4 text-sm font-bold text-muted">
            {t(
              'Favorite ♥ ou marque como Assistindo alguns animes e eles aparecem aqui. Na página de qualquer anime também tem o botão 🎨 "Usar como tema".'
            )}
          </p>
        )}
      </section>

      <section className="mb-10">
        <SectionTitle
          title={t('Seus temas')}
          jp="自作"
          action={
            <button className="inline-flex items-center gap-1" onClick={() => setEditing(active)}>
              <Plus size={14} />{' '}{t('Criar tema')}
            </button>
          }
        />
        {custom.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {custom.map((th) => (
              <ThemeCard
                key={th.id}
                theme={th}
                active={!rotate && themeId === th.id}
                onPick={() => setTheme(th.id)}
                actions={
                  <>
                    <button className="grid h-7 w-7 place-items-center rounded-lg border-2 border-black bg-yellow text-black" onClick={() => setEditing(th)} aria-label={t('Editar')}>
                      <Pencil size={13} />
                    </button>
                    <ConfirmButton
                      className="grid h-7 min-w-7 place-items-center rounded-lg border-2 border-black bg-red-400 px-1 text-[10px] font-black text-black"
                      confirmText={t('Apagar?')}
                      onConfirm={() => deleteCustom(th.id)}
                    >
                      <Trash2 size={13} />
                    </ConfirmButton>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <button className="panel flex w-full items-center justify-center gap-2 border-dashed p-6 font-bold text-muted hover:border-pink hover:text-pink" onClick={() => setEditing(active)}>
            <Wand2 size={18} />{' '}{t('Monte o seu: cores, fundo e partículas, com prévia ao vivo')}
          </button>
        )}
      </section>

      <SectionTitle title={t('Temas prontos')} jp="プリセット" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {PRESETS.map((th) => (
          <ThemeCard
            key={th.id}
            theme={th}
            active={!rotate && themeId === th.id}
            locked={th.plus && !plus}
            onPick={() => {
              if (th.plus && !plus) {
                toast(t('Tema exclusivo do Shiori+'));
                navigate('/apoiar');
                return;
              }
              setTheme(th.id);
            }}
            actions={
              <button
                className="grid h-7 w-7 place-items-center rounded-lg border-2 border-black bg-yellow text-black opacity-0 transition group-hover:opacity-100"
                onClick={() => setEditing(th)}
                aria-label={t('Usar como base')}
                title={t('Usar como base pra um tema seu')}
              >
                <Pencil size={13} />
              </button>
            }
          />
        ))}
      </div>
    </>
  );
}
