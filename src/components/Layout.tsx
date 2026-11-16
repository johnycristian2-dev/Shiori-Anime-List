import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOutsideClose } from './ui';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, Compass, Dices, Layers, ListChecks, Map, Menu, Palette, RefreshCw, Search, Gift, Popcorn, Sparkles, Timer, Trophy, Users, X } from 'lucide-react';
import { applyTheme, type Theme } from '../lib/themes';
import { useActiveTheme } from '../lib/useTheme';
import SearchModal from './SearchModal';
import EpisodeBell from './EpisodeBell';
import SyncBadge from './SyncBadge';
import { useUI } from '../store/ui';
import { useList } from '../store/list';

const NAV = [
  { to: '/', label: 'Descobrir', short: 'Início', jp: '発見', icon: Compass, main: true },
  { to: '/explorar', label: 'Explorar', short: 'Explorar', jp: '探索', icon: Search, main: true },
  { to: '/swipe', label: 'Modo rápido', short: 'Rápido', jp: '速攻', icon: Layers, main: true },
  { to: '/calendario', label: 'Calendário', short: 'Agenda', jp: '放送', icon: CalendarDays, main: true },
  { to: '/lista', label: 'Minha lista', short: 'Lista', jp: 'リスト', icon: ListChecks, main: true },
  { to: '/pra-voce', label: 'Pra você', short: 'Pra você', jp: 'おすすめ', icon: Sparkles, main: false },
  { to: '/comecar', label: 'Quiz: por onde começar', short: 'Quiz', jp: '診断', icon: Compass, main: false },
  { to: '/maratona', label: 'Planejar maratona', short: 'Maratona', jp: '一気見', icon: Timer, main: false },
  { to: '/roleta', label: 'Roleta', short: 'Roleta', jp: 'ガチャ', icon: Dices, main: false },
  { to: '/perfil', label: 'Perfil e conquistas', short: 'Perfil', jp: '実績', icon: Trophy, main: false },
  { to: '/party', label: 'Watch party', short: 'Party', jp: '鑑賞会', icon: Popcorn, main: false },
  { to: '/comparar', label: 'Comparar com amigo', short: 'Comparar', jp: '相性', icon: Users, main: false },
  { to: '/retrospectiva', label: 'Retrospectiva do ano', short: 'Retrô', jp: '年間', icon: Gift, main: false },
  { to: '/temas', label: 'Temas', short: 'Temas', jp: '着せ替え', icon: Palette, main: false },
  { to: '/sync', label: 'Importar / Exportar', short: 'Sync', jp: '同期', icon: RefreshCw, main: false },
  { to: '/roadmap', label: 'Roadmap', short: 'Roadmap', jp: '予定', icon: Map, main: false },
];
const MAIN = NAV.filter((n) => n.main);
const MORE = NAV.filter((n) => !n.main);
const MOBILE = [NAV[0], NAV[1], NAV[2], NAV[4]];

export function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl border-[2.5px] border-black bg-pink font-jp text-2xl font-black text-white shadow-[3px_3px_0_#000] -rotate-6">
        栞
      </span>
      <span className="leading-none">
        <span className="block font-display text-xl tracking-wide">SHIORI</span>
        <span className="block font-jp text-[10px] font-bold tracking-[0.3em] text-pink">アニメリスト</span>
      </span>
    </NavLink>
  );
}

function Petals({ kind }: { kind: Theme['petals'] }) {
  const on = useUI((s) => s.petals);
  if (!on || kind === 'none') return null;
  const cls = kind === 'embers' ? 'ember' : kind === 'snow' ? 'snowflake' : 'petal';
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => {
        const size = kind === 'sakura' || !kind ? 8 + ((i * 5) % 10) : 3 + ((i * 3) % 5);
        return (
          <span
            key={i}
            className={cls}
            style={{
              left: `${(i * 73) % 100}%`,
              width: size,
              height: kind === 'sakura' || !kind ? size * 0.8 : size,
              animationDelay: `${(i * 1.7) % 12}s`,
              animationDuration: `${11 + ((i * 3) % 9)}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[200] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border-[2.5px] border-black px-4 py-2.5 text-sm font-extrabold shadow-[4px_4px_0_#000] ${
            t.tone === 'err' ? 'bg-red-400 text-black' : t.tone === 'info' ? 'bg-cyan text-black' : 'bg-yellow text-black'
          }`}
        >
          <span className="line-clamp-2">{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const theme = useActiveTheme();
  const count = useList((s) => Object.keys(s.entries).length);
  const { pathname } = useLocation();
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const closeMore = useCallback(() => setMore(false), []);
  useOutsideClose(moreRef, more, closeMore);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setSheet(false);
    setMore(false);
  }, [pathname]);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="relative min-h-dvh">
      {theme.image && <div aria-hidden className="theme-art" style={{ backgroundImage: `url("${theme.image}")` }} />}
      <Petals kind={theme.petals} />
      <header className="sticky top-0 z-40 border-b-2 border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {MAIN.map(({ to, label, jp }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `group relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-extrabold transition ${
                    isActive ? 'bg-pink text-white shadow-[3px_3px_0_var(--shadow)]' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {label}
                <span className="ml-1.5 font-jp text-[10px] opacity-60 xl:inline hidden">{jp}</span>
                {to === '/lista' && count > 0 && (
                  <span className="ml-1.5 rounded-full bg-yellow px-1.5 text-[10px] font-black text-black">{count}</span>
                )}
              </NavLink>
            ))}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMore((v) => !v)}
                className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-extrabold ${MORE.some((m) => m.to === pathname) ? 'text-pink' : 'text-muted hover:text-ink'}`}
              >
                Mais <ChevronDown size={14} className={more ? 'rotate-180 transition' : 'transition'} />
              </button>
              {more && (
                <>
                  <div className="pop-in panel absolute left-0 top-12 z-50 w-60 p-1.5 shadow-[6px_6px_0_var(--shadow)]">
                    {MORE.map(({ to, label, jp, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setMore(false)}
                        className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-panel-2 ${isActive ? 'text-pink' : ''}`}
                      >
                        <Icon size={16} /> <span className="flex-1">{label}</span> <span className="font-jp text-[10px] text-muted">{jp}</span>
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
          <button
            onClick={() => setSearch(true)}
            className="ml-auto flex items-center gap-2 rounded-xl border-2 border-line bg-panel px-3 py-2 text-sm font-bold text-muted transition hover:border-pink lg:ml-0"
            aria-label="Buscar"
          >
            <Search size={16} /> <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-line px-1.5 text-[10px] md:inline">Ctrl K</kbd>
          </button>
          <SyncBadge />
          <EpisodeBell />
          <NavLink to="/temas" className="manga-btn ghost !p-2" aria-label="Temas" title={`Tema: ${theme.name}`}>
            <Palette size={18} />
          </NavLink>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-32 pt-6 lg:pb-16">{children}</main>

      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE.map(({ to, short, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold ${isActive ? 'text-pink' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-8 place-items-center rounded-lg transition ${isActive ? 'bg-pink text-white' : ''}`}>
                    <Icon size={18} />
                  </span>
                  <span className="truncate">{short}</span>
                  {to === '/lista' && count > 0 && (
                    <span className="absolute right-3 top-1 rounded-full bg-yellow px-1 text-[9px] font-black text-black">{count}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setSheet(true)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold ${
              NAV.some((n) => !MOBILE.includes(n) && n.to === pathname) ? 'text-pink' : 'text-muted'
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg">
              <Menu size={18} />
            </span>
            Mais
          </button>
        </div>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setSheet(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="pop-in absolute inset-x-0 bottom-0 rounded-t-3xl border-t-[3px] border-black bg-bg p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <div className="grid grid-cols-3 gap-3">
              {NAV.filter((n) => !MOBILE.includes(n)).map(({ to, short, jp, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `panel flex flex-col items-center gap-1 p-3 text-center text-xs font-extrabold ${isActive ? 'border-pink text-pink' : ''}`
                  }
                >
                  <Icon size={22} />
                  {short}
                  <span className="font-jp text-[10px] text-muted">{jp}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
      <SearchModal open={search} onClose={() => setSearch(false)} />
      <Toasts />
    </div>
  );
}
