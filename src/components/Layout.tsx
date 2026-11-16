import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOutsideClose } from './ui';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, Compass, Dices, Layers, ListChecks, Map, Menu, Palette, RefreshCw, Search, Gift, Popcorn, Sparkles, Timer, Trophy, Users, X } from 'lucide-react';
import { applyTheme, type Theme } from '../lib/themes';
import { useActiveTheme } from '../lib/useTheme';
import SearchModal from './SearchModal';
import EpisodeBell from './EpisodeBell';
import SyncBadge from './SyncBadge';
import LangSwitch from './LangSwitch';
import { useUI } from '../store/ui';
import { useList } from '../store/list';

import { t } from '../lib/i18n';
import { ThemeOverlay, ThemeParticles } from './ThemeFx';
import AccountButton from './AccountButton';
import AuthModal from './AuthModal';

const NAV = [
  {
    to: '/',

    get label() {
      return t('Descobrir');
    },

    get short() {
      return t('Início');
    },

    jp: '発見',
    icon: Compass,
    main: true
  },
  {
    to: '/explorar',

    get label() {
      return t('Explorar');
    },

    get short() {
      return t('Explorar');
    },

    jp: '探索',
    icon: Search,
    main: true
  },
  {
    to: '/swipe',

    get label() {
      return t('Modo rápido');
    },

    get short() {
      return t('Rápido');
    },

    jp: '速攻',
    icon: Layers,
    main: true
  },
  {
    to: '/calendario',

    get label() {
      return t('Calendário');
    },

    get short() {
      return t('Agenda');
    },

    jp: '放送',
    icon: CalendarDays,
    main: true
  },
  {
    to: '/lista',

    get label() {
      return t('Minha lista');
    },

    get short() {
      return t('Lista');
    },

    jp: 'リスト',
    icon: ListChecks,
    main: true
  },
  {
    to: '/pra-voce',

    get label() {
      return t('Pra você');
    },

    get short() {
      return t('Pra você');
    },

    jp: 'おすすめ',
    icon: Sparkles,
    main: false
  },
  {
    to: '/comecar',

    get label() {
      return t('Quiz: por onde começar');
    },

    get short() {
      return t('Quiz');
    },

    jp: '診断',
    icon: Compass,
    main: false
  },
  {
    to: '/maratona',

    get label() {
      return t('Planejar maratona');
    },

    get short() {
      return t('Maratona');
    },

    jp: '一気見',
    icon: Timer,
    main: false
  },
  {
    to: '/roleta',

    get label() {
      return t('Roleta');
    },

    get short() {
      return t('Roleta');
    },

    jp: 'ガチャ',
    icon: Dices,
    main: false
  },
  {
    to: '/amigos',

    get label() {
      return t('Amigos e feed');
    },

    get short() {
      return t('Amigos');
    },

    jp: '仲間',
    icon: Users,
    main: false
  },
  {
    to: '/perfil',

    get label() {
      return t('Perfil e conquistas');
    },

    get short() {
      return t('Perfil');
    },

    jp: '実績',
    icon: Trophy,
    main: false
  },
  {
    to: '/party',

    get label() {
      return t('Watch party');
    },

    get short() {
      return t('Party');
    },

    jp: '鑑賞会',
    icon: Popcorn,
    main: false
  },
  {
    to: '/comparar',

    get label() {
      return t('Comparar com amigo');
    },

    get short() {
      return t('Comparar');
    },

    jp: '相性',
    icon: Users,
    main: false
  },
  {
    to: '/retrospectiva',

    get label() {
      return t('Retrospectiva do ano');
    },

    get short() {
      return t('Retrô');
    },

    jp: '年間',
    icon: Gift,
    main: false
  },
  {
    to: '/temas',

    get label() {
      return t('Temas');
    },

    get short() {
      return t('Temas');
    },

    jp: '着せ替え',
    icon: Palette,
    main: false
  },
  {
    to: '/sync',

    get label() {
      return t('Importar / Exportar');
    },

    get short() {
      return t('Sync');
    },

    jp: '同期',
    icon: RefreshCw,
    main: false
  },
  {
    to: '/roadmap',

    get label() {
      return t('Roadmap');
    },

    get short() {
      return t('Roadmap');
    },

    jp: '予定',
    icon: Map,
    main: false
  },
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
        <span className="block font-display text-xl tracking-wide">{t('SHIORI')}</span>
        <span className="block font-jp text-[10px] font-bold tracking-[0.3em] text-pink">アニメリスト</span>
      </span>
    </NavLink>
  );
}

function Petals({ kind }: { kind: Theme['petals'] }) {
  const on = useUI((s) => s.petals);
  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <ThemeParticles kind={kind} />
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[200] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border-[2.5px] border-black px-4 py-2.5 text-sm font-extrabold shadow-[4px_4px_0_#000] ${
            toastItem.tone === 'err' ? 'bg-red-400 text-black' : toastItem.tone === 'info' ? 'bg-cyan text-black' : 'bg-yellow text-black'
          }`}
        >
          <span className="line-clamp-2">{toastItem.text}</span>
          <button onClick={() => dismiss(toastItem.id)} aria-label={t('Fechar')}>
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
      <ThemeOverlay kind={theme.overlay} />
      <AuthModal />
      <header className="sticky top-0 z-40 border-b-2 border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
          <Logo />
          <nav className="ml-4 hidden flex-1 items-center gap-1 xl:flex">
            {MAIN.map(({ to, label }) => (
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
                {t('Mais')}{' '}<ChevronDown size={14} className={more ? 'rotate-180 transition' : 'transition'} />
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
            className="ml-auto flex items-center gap-2 rounded-xl border-2 border-line bg-panel px-3 py-2 text-sm font-bold text-muted transition hover:border-pink xl:ml-0"
            aria-label={t('Buscar')}
          >
            <Search size={16} /> <span className="hidden sm:inline">{t('Buscar')}</span>
            <kbd className="hidden rounded border border-line px-1.5 text-[10px] 2xl:inline">{t('Ctrl K')}</kbd>
          </button>
          <SyncBadge />
          <EpisodeBell />
          <div className="hidden sm:block">
            <LangSwitch />
          </div>
          <NavLink to="/temas" className="manga-btn ghost !p-2 hidden sm:inline-flex" aria-label={t('Temas')} title={t('Tema: {0}', theme.name)}>
            <Palette size={18} />
          </NavLink>
          <span className="hidden h-8 w-0.5 rounded bg-line sm:block" aria-hidden />
          <AccountButton />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-32 pt-6 xl:pb-16">{children}</main>

      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md xl:hidden">
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
            {t('Mais')}
          </button>
        </div>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-[60] xl:hidden" onClick={() => setSheet(false)}>
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
