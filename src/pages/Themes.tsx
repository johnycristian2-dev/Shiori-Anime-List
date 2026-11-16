import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Moon, Pencil, Plus, Shuffle, Sun, Trash2, Wand2 } from 'lucide-react';
import { ConfirmButton, SectionTitle } from '../components/ui';
import { dayKey } from '../lib/gacha';
import { applyTheme, buildColors, contrast, PRESETS, themeFromColor, type Pattern, type Theme } from '../lib/themes';
import { pickOfTheDay } from '../lib/themes';
import { useActiveTheme, useThemeableAnimes } from '../lib/useTheme';
import { pickTitle } from '../lib/format';
import { useUI } from '../store/ui';
import type { ListEntry } from '../types';

const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'halftone', label: 'Retícula' },
  { id: 'checker', label: 'Xadrez' },
  { id: 'scanlines', label: 'Tela CRT' },
  { id: 'stars', label: 'Estrelas' },
  { id: 'waves', label: 'Ondas' },
  { id: 'grid', label: 'Grade' },
  { id: 'none', label: 'Liso' },
];

const PARTICLES: { id: NonNullable<Theme['petals']>; label: string }[] = [
  { id: 'sakura', label: '🌸 Pétalas' },
  { id: 'embers', label: '🔥 Brasas' },
  { id: 'snow', label: '✨ Poeira' },
  { id: 'none', label: 'Nada' },
];

/** Variáveis do tema só dentro do card (pra prévia não mexer no site). */
const scopeVars = (t: Theme): CSSProperties =>
  ({
    '--bg': t.colors.bg,
    '--panel': t.colors.panel,
    '--ink': t.colors.ink,
    '--pink': t.colors.pink,
    '--cyan': t.colors.cyan,
    '--yellow': t.colors.yellow,
    '--pattern-ink': `color-mix(in srgb, ${t.colors.ink} 10%, transparent)`,
  }) as CSSProperties;

function ThemeCard({ t, active, onPick, actions }: { t: Theme; active: boolean; onPick: () => void; actions?: React.ReactNode }) {
  const c = t.colors;
  return (
    <div className="group relative">
      <button
        onClick={onPick}
        className={`block w-full overflow-hidden rounded-2xl border-[3px] text-left transition hover:-translate-y-1 ${active ? 'border-pink' : 'border-black'}`}
        style={{ boxShadow: `5px 5px 0 ${active ? c.pink : '#000'}` }}
      >
        <div data-pattern={t.pattern} className="pattern-preview relative h-28 p-3" style={{ ...scopeVars(t), backgroundColor: c.bg }}>
          {t.image && <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url("${t.image}")` }} />}
          <div className="absolute -right-1 -top-3 font-jp text-5xl font-black opacity-20" style={{ color: c.pink }}>
            {t.jp}
          </div>
          <div className="relative flex gap-2">
            <div className="h-16 w-12 rounded-md border-2" style={{ background: c.panel, borderColor: c.line }} />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-2 w-3/4 rounded" style={{ background: c.ink }} />
              <div className="h-2 w-1/2 rounded" style={{ background: c.muted }} />
              <div className="flex gap-1.5 pt-1">
                <span className="h-5 w-10 rounded border-2 border-black" style={{ background: c.pink }} />
                <span className="h-5 w-6 rounded border-2 border-black" style={{ background: c.cyan }} />
                <span className="h-5 w-6 rounded border-2 border-black" style={{ background: c.yellow }} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: c.panel, color: c.ink }}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold">{t.name}</div>
            <div className="truncate text-[10px] font-bold" style={{ color: c.muted }}>
              {t.inspired ? `inspirado em ${t.inspired}` : t.dark ? 'escuro' : 'claro'}
            </div>
          </div>
          {active && (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-black" style={{ background: c.pink, color: '#fff' }}>
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </div>
      </button>
      {actions && <div className="absolute right-2 top-2 flex gap-1">{actions}</div>}
    </div>
  );
}

function Editor({ base, onClose }: { base: Theme; onClose: () => void }) {
  const save = useUI((s) => s.saveCustomTheme);
  const toast = useUI((s) => s.toast);
  const isNew = !base.id.startsWith('custom-');
  const [name, setName] = useState(isNew ? `Meu tema` : base.name);
  const [isDark, setDark] = useState(base.dark);
  const [c, setC] = useState({ bg: base.colors.bg, ink: base.colors.ink, pink: base.colors.pink, cyan: base.colors.cyan, yellow: base.colors.yellow });
  const [pattern, setPattern] = useState<Pattern>(base.pattern);
  const [petals, setPetals] = useState<NonNullable<Theme['petals']>>(base.petals ?? 'sakura');
  const [seed, setSeed] = useState(base.colors.pink);

  const draft: Theme = {
    id: isNew ? `custom-${Date.now().toString(36)}` : base.id,
    name: name.trim() || 'Meu tema',
    jp: '自作',
    dark: isDark,
    pattern,
    petals,
    image: base.image ?? null,
    colors: buildColors(isDark, c),
  };
  const readable = contrast(draft.colors.ink, draft.colors.bg);

  // Prévia ao vivo no site inteiro enquanto edita
  useEffect(() => {
    applyTheme(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draft.colors), pattern, isDark]);

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
            <Moon size={14} /> Escuro
          </button>
          <button className={`chip ${!isDark ? 'on' : ''}`} onClick={() => setDark(false)}>
            <Sun size={14} /> Claro
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-line p-3 text-sm font-bold">
        <span>Atalho: gerar tudo a partir de uma cor</span>
        <input type="color" value={seed} onChange={(e) => setSeed(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-2 border-black" />
        <button
          className="manga-btn ghost !py-1.5"
          onClick={() => {
            const g = themeFromColor(seed, { id: 'x', name, dark: isDark });
            setC({ bg: g.colors.bg, ink: g.colors.ink, pink: g.colors.pink, cyan: g.colors.cyan, yellow: g.colors.yellow });
          }}
        >
          Gerar
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {field('bg', 'Fundo')}
        {field('ink', 'Texto')}
        {field('pink', 'Cor principal')}
        {field('cyan', 'Cor secundária')}
        {field('yellow', 'Destaques e notas')}
      </div>
      {readable < 4.5 && <p className="text-sm font-bold text-red-400">⚠️ Texto com pouco contraste no fundo ({readable.toFixed(1)}:1) — fica difícil de ler. O ideal é 7:1.</p>}

      <div>
        <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-muted">Fundo</div>
        <div className="flex flex-wrap gap-1.5">
          {PATTERNS.map((p) => (
            <button key={p.id} className={`chip !text-xs ${pattern === p.id ? 'on' : ''}`} onClick={() => setPattern(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-black uppercase tracking-wider text-muted">Partículas</div>
        <div className="flex flex-wrap gap-1.5">
          {PARTICLES.map((p) => (
            <button key={p.id} className={`chip !text-xs ${petals === p.id ? 'on' : ''}`} onClick={() => setPetals(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="manga-btn"
          onClick={() => {
            save(draft);
            toast(`Tema "${draft.name}" salvo e aplicado!`);
            onClose();
          }}
        >
          <Check size={16} /> Salvar e usar
        </button>
        <button className="manga-btn ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function AnimeChip({ e, onPick, active }: { e: ListEntry; onPick: () => void; active: boolean }) {
  const lang = useUI((s) => s.titleLang);
  return (
    <button onClick={onPick} className="group w-24 shrink-0 text-left" title={`Usar as cores de ${e.title}`}>
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
  const [editing, setEditing] = useState<Theme | null>(null);
  const [genDark, setGenDark] = useState(true);
  const { favorites, others } = useThemeableAnimes();
  const pool = favorites.length ? favorites : others.slice(0, 10);
  const todays = pickOfTheDay(pool, dayKey());

  const fromAnime = (e: ListEntry) => {
    setAnimeTheme(themeFromColor(e.color!, { id: 'anime', name: e.title, image: e.cover, dark: genDark }));
    toast(`Tema de ${e.title} aplicado 🎨`);
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
      <SectionTitle title="Temas" jp="着せ替え" action={<span className="text-muted">Agora: {active.name}</span>} />

      {editing && <Editor base={editing} onClose={closeEditor} />}

      <section className="mb-10">
        <SectionTitle title="Do seu anime" jp="推し色" />
        <p className="-mt-2 mb-4 text-sm font-bold text-muted">
          Escolha um anime da sua lista e o site inteiro ganha as cores dele (e a capa bem suave no fundo).
        </p>
        <div className="panel mb-4 flex flex-wrap items-center gap-3 p-3">
          <button className={`chip ${rotate ? 'on' : ''}`} onClick={() => setRotate(!rotate)} disabled={!pool.length}>
            <Shuffle size={14} /> Trocar todo dia entre meus {favorites.length ? 'favoritos' : 'animes'}
          </button>
          {rotate && todays && <span className="text-sm font-bold">Hoje: {todays.title}</span>}
          <div className="ml-auto flex gap-1">
            <button className={`chip !text-xs ${genDark ? 'on' : ''}`} onClick={() => setGenDark(true)}>
              <Moon size={12} /> Escuro
            </button>
            <button className={`chip !text-xs ${!genDark ? 'on' : ''}`} onClick={() => setGenDark(false)}>
              <Sun size={12} /> Claro
            </button>
          </div>
        </div>
        {pool.length ? (
          <>
            {favorites.length > 0 && <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">♥ Favoritos</div>}
            <div className="no-scrollbar -mx-4 mb-3 flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
              {(favorites.length ? favorites : others).slice(0, 24).map((e) => (
                <AnimeChip key={e.mediaId} e={e} onPick={() => fromAnime(e)} active={!rotate && themeId === 'anime' && animeTheme?.name === e.title} />
              ))}
            </div>
            {favorites.length > 0 && others.length > 0 && (
              <>
                <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">Assistindo e bem avaliados</div>
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
            Favorite ♥ ou marque como Assistindo alguns animes e eles aparecem aqui. Na página de qualquer anime também tem o botão 🎨 "Usar como tema".
          </p>
        )}
      </section>

      <section className="mb-10">
        <SectionTitle
          title="Seus temas"
          jp="自作"
          action={
            <button className="inline-flex items-center gap-1" onClick={() => setEditing(active)}>
              <Plus size={14} /> Criar tema
            </button>
          }
        />
        {custom.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {custom.map((t) => (
              <ThemeCard
                key={t.id}
                t={t}
                active={!rotate && themeId === t.id}
                onPick={() => setTheme(t.id)}
                actions={
                  <>
                    <button className="grid h-7 w-7 place-items-center rounded-lg border-2 border-black bg-yellow text-black" onClick={() => setEditing(t)} aria-label="Editar">
                      <Pencil size={13} />
                    </button>
                    <ConfirmButton
                      className="grid h-7 min-w-7 place-items-center rounded-lg border-2 border-black bg-red-400 px-1 text-[10px] font-black text-black"
                      confirmText="Apagar?"
                      onConfirm={() => deleteCustom(t.id)}
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
            <Wand2 size={18} /> Monte o seu: cores, fundo e partículas, com prévia ao vivo
          </button>
        )}
      </section>

      <SectionTitle title="Temas prontos" jp="プリセット" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {PRESETS.map((t) => (
          <ThemeCard
            key={t.id}
            t={t}
            active={!rotate && themeId === t.id}
            onPick={() => setTheme(t.id)}
            actions={
              <button
                className="grid h-7 w-7 place-items-center rounded-lg border-2 border-black bg-yellow text-black opacity-0 transition group-hover:opacity-100"
                onClick={() => setEditing(t)}
                aria-label="Usar como base"
                title="Usar como base pra um tema seu"
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
