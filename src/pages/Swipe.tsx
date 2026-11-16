import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowUp, Eye, Heart, Undo2, X } from 'lucide-react';
import { useBrowse, useGenres } from '../api/hooks';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { DECADES, FORMAT_LABEL, genrePt } from '../lib/labels';
import { currentSeason } from '../lib/season';
import { stripHtml, useTitle } from '../lib/format';
import { useList } from '../store/list';
import type { BrowseFilters, ListEntry, Media } from '../types';

type Decision = 'PLANNING' | 'COMPLETED' | 'SKIP';
type Source = 'trending' | 'top' | 'popular' | 'season' | 'genre' | 'decade';

const SOURCES: { id: Source; label: string }[] = [
  { id: 'popular', label: 'Populares' },
  { id: 'top', label: 'Melhor nota' },
  { id: 'trending', label: 'Em alta' },
  { id: 'season', label: 'Temporada atual' },
  { id: 'genre', label: 'Gênero' },
  { id: 'decade', label: 'Década' },
];

function buildFilters(src: Source, genre: string, decade: number): BrowseFilters {
  const base: BrowseFilters = { sort: 'POPULARITY_DESC', genres: [], formats: [] };
  switch (src) {
    case 'top':
      return { ...base, sort: 'SCORE_DESC' };
    case 'trending':
      return { ...base, sort: 'TRENDING_DESC' };
    case 'season': {
      const c = currentSeason();
      return { ...base, season: c.season, seasonYear: c.year };
    }
    case 'genre':
      return { ...base, genres: [genre] };
    case 'decade':
      return { ...base, yearFrom: decade, yearTo: decade + 9 };
    default:
      return base;
  }
}

const exitVariants = {
  exit: (d: Decision) => ({
    x: d === 'PLANNING' ? 600 : d === 'SKIP' ? -600 : 0,
    y: d === 'COMPLETED' ? -700 : 40,
    rotate: d === 'PLANNING' ? 25 : d === 'SKIP' ? -25 : 0,
    opacity: 0,
    transition: { duration: 0.35 },
  }),
};

function SwipeCard({ media, onDecide, decision }: { media: Media; onDecide: (d: Decision) => void; decision: Decision }) {
  const title = useTitle();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-16, 16]);
  const likeOp = useTransform(x, [30, 130], [0, 1]);
  const nopeOp = useTransform(x, [-130, -30], [1, 0]);
  const seenOp = useTransform(y, [-130, -30], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x > 120 || velocity.x > 700) onDecide('PLANNING');
    else if (offset.x < -120 || velocity.x < -700) onDecide('SKIP');
    else if (offset.y < -120 || velocity.y < -700) onDecide('COMPLETED');
  };

  const cover = media.coverImage.extraLarge ?? media.coverImage.large;

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.92, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit="exit"
      variants={exitVariants}
      custom={decision}
    >
      <div
        className="relative h-full overflow-hidden rounded-3xl border-[3px] border-black bg-panel"
        style={{ boxShadow: `8px 8px 0 ${media.coverImage.color ?? 'var(--pink)'}` }}
      >
        {cover && <img src={cover} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-cover" />}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />

        <motion.div style={{ opacity: likeOp }} className="absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-yellow px-3 py-1 font-display text-2xl text-yellow">
          QUERO VER
        </motion.div>
        <motion.div style={{ opacity: nopeOp }} className="absolute right-5 top-6 rotate-12 rounded-xl border-4 border-red-400 px-3 py-1 font-display text-2xl text-red-400">
          PULAR
        </motion.div>
        <motion.div style={{ opacity: seenOp }} className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-xl border-4 border-[#7cff8a] px-3 py-1 font-display text-2xl text-[#7cff8a]">
          JÁ VI! 完了
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="mb-1 text-xs font-black uppercase tracking-wider text-white/70">
            {[media.format && FORMAT_LABEL[media.format], media.seasonYear, media.episodes && `${media.episodes} ep`, media.averageScore && `★ ${media.averageScore}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <h2 className="stroke-title font-display text-2xl leading-tight">{title(media)}</h2>
          {media.title.native && <div className="font-jp text-sm font-bold text-white/60">{media.title.native}</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {media.genres.slice(0, 4).map((g) => (
              <span key={g} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">
                {genrePt(g)}
              </span>
            ))}
          </div>
          {media.description && <p className="mt-2 line-clamp-2 text-xs text-white/70">{stripHtml(media.description)}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function Swipe() {
  const [src, setSrc] = useState<Source>('popular');
  const [genre, setGenre] = useState('Action');
  const [decade, setDecade] = useState(2010);
  const [decision, setDecision] = useState<Decision>('SKIP');
  const [history, setHistory] = useState<{ media: Media; prev?: ListEntry; d: Decision }[]>([]);
  const [stats, setStats] = useState({ PLANNING: 0, COMPLETED: 0, SKIP: 0 });
  const filters = useMemo(() => buildFilters(src, genre, decade), [src, genre, decade]);
  const q = useBrowse(filters, 50);
  const { data: genres } = useGenres();

  const entries = useList((s) => s.entries);
  const skipped = useList((s) => s.skipped);
  const add = useList((s) => s.add);
  const skip = useList((s) => s.skip);
  const unskip = useList((s) => s.unskip);
  const restore = useList((s) => s.restore);

  const queue = useMemo(() => {
    const sk = new Set(skipped);
    return (q.data?.pages.flatMap((p) => p.media) ?? []).filter((m) => !entries[m.id] && !sk.has(m.id));
  }, [q.data, entries, skipped]);

  useEffect(() => {
    if (queue.length < 6 && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
  }, [queue.length, q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  const top = queue[0];

  const decide = useCallback(
    (d: Decision) => {
      if (!top) return;
      setDecision(d);
      setHistory((h) => [...h.slice(-30), { media: top, prev: entries[top.id], d }]);
      setStats((s) => ({ ...s, [d]: s[d] + 1 }));
      if (d === 'SKIP') skip(top.id);
      else add(top, d);
    },
    [top, entries, add, skip],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setStats((s) => ({ ...s, [last.d]: Math.max(0, s[last.d] - 1) }));
    if (last.d === 'SKIP') unskip(last.media.id);
    else restore(last.media.id, last.prev);
  }, [history, unskip, restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') decide('PLANNING');
      else if (e.key === 'ArrowLeft') decide('SKIP');
      else if (e.key === 'ArrowUp') decide('COMPLETED');
      else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, undo]);

  return (
    <div className="mx-auto max-w-md">
      <SectionTitle title="Modo rápido" jp="速攻モード" />

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {SOURCES.map((s) => (
          <button key={s.id} className={`chip ${src === s.id ? 'on' : ''}`} onClick={() => setSrc(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {src === 'genre' && (
        <select className="field mb-3" value={genre} onChange={(e) => setGenre(e.target.value)}>
          {(genres ?? ['Action']).map((g) => (
            <option key={g} value={g}>
              {genrePt(g)}
            </option>
          ))}
        </select>
      )}
      {src === 'decade' && (
        <select className="field mb-3" value={decade} onChange={(e) => setDecade(Number(e.target.value))}>
          {DECADES.map((d) => (
            <option key={d} value={d}>
              Anos {String(d).slice(2)} ({d}–{d + 9})
            </option>
          ))}
        </select>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
        <div className="panel py-1.5"><span className="text-pink">♥</span> {stats.PLANNING} quero ver</div>
        <div className="panel py-1.5"><span className="text-cyan">✓</span> {stats.COMPLETED} já vi</div>
        <div className="panel py-1.5 text-muted">✕ {stats.SKIP} pulados</div>
      </div>

      <div className="relative mx-auto aspect-[2/3] h-[min(50dvh,600px)] max-w-full">
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <div className="skeleton absolute inset-0 rounded-3xl" />
        ) : !top ? (
          q.isFetchingNextPage ? (
            <div className="grid h-full place-items-center">
              <Spinner className="h-10 w-10 text-pink" />
            </div>
          ) : (
            <EmptyState jp="完" title="Acabou essa fonte!">
              Troque a fonte acima ou veja <Link to="/lista" className="font-bold text-pink">sua lista</Link>.
            </EmptyState>
          )
        ) : (
          <>
            {queue[1] && (
              <div className="absolute inset-0 translate-y-3 scale-[0.95] overflow-hidden rounded-3xl border-[3px] border-black opacity-60">
                {queue[1].coverImage.large && <img src={queue[1].coverImage.large} alt="" className="h-full w-full object-cover" />}
              </div>
            )}
            <AnimatePresence custom={decision}>
              <SwipeCard key={top.id} media={top} onDecide={decide} decision={decision} />
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button className="manga-btn ghost !h-12 !w-12 !rounded-full !p-0" onClick={undo} disabled={!history.length} aria-label="Desfazer">
          <Undo2 size={18} />
        </button>
        <button className="manga-btn !h-16 !w-16 !rounded-full !bg-red-400 !p-0 text-black" onClick={() => decide('SKIP')} disabled={!top} aria-label="Pular">
          <X size={28} strokeWidth={3} />
        </button>
        <button className="manga-btn !h-16 !w-16 !rounded-full !bg-[#7cff8a] !p-0 text-black" onClick={() => decide('COMPLETED')} disabled={!top} aria-label="Já vi">
          <Eye size={26} strokeWidth={3} />
        </button>
        <button className="manga-btn yellow !h-16 !w-16 !rounded-full !p-0" onClick={() => decide('PLANNING')} disabled={!top} aria-label="Quero ver">
          <Heart size={26} strokeWidth={3} />
        </button>
        {top && (
          <Link to={`/anime/${top.id}`} className="manga-btn ghost !h-12 !w-12 !rounded-full !p-0" aria-label="Detalhes">
            <ArrowUp size={18} className="rotate-45" />
          </Link>
        )}
      </div>
      <p className="mt-4 text-center text-xs font-bold text-muted">
        Teclado: ← pular · ↑ já vi · → quero ver · Backspace desfaz
      </p>
    </div>
  );
}
