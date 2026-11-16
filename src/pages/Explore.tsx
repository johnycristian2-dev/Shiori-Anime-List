import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListPlus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useBrowse, useGenres } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { ErrorBox, SectionTitle, SkeletonCard, Spinner, useDebounced, EmptyState } from '../components/ui';
import { COUNTRIES, DECADES, FORMAT_LABEL, GENRES, LENGTHS, MEDIA_STATUS_LABEL, SORT_OPTIONS, STREAMING, THEME_TAGS, genrePt } from '../lib/labels';
import { SEASONS, SEASON_LABEL, YEARS } from '../lib/season';
import { STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';
import type { BrowseFilters, ListStatus, MediaFormat, MediaSort, MediaStatus, Season } from '../types';

import { t, locale } from '../lib/i18n';

const FORMATS: MediaFormat[] = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT'];

function initial(sp: URLSearchParams): BrowseFilters {
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  return {
    sort: (sp.get('ordem') as MediaSort) || 'POPULARITY_DESC',
    genres: sp.getAll('genero'),
    season: (sp.get('temporada') as Season) || undefined,
    seasonYear: num('ano'),
    formats: [],
    yearFrom: num('de'),
    yearTo: num('ate'),
    search: sp.get('q') ?? '',
    tags: sp.getAll('tema'),
    streaming: sp.getAll('plataforma').map(Number),
    excludeGenres: [],
  };
}

export default function Explore() {
  const [sp] = useSearchParams();
  const [f, setF] = useState<BrowseFilters>(() => initial(sp));
  const [open, setOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ListStatus>('PLANNING');
  const [hideMine, setHideMine] = useState(false);
  const search = useDebounced(f.search ?? '', 450);
  const filters = useMemo(() => ({ ...f, search }), [f, search]);
  const q = useBrowse(filters, 30);
  const { data: genres } = useGenres();
  const entries = useList((s) => s.entries);
  const addMany = useList((s) => s.addMany);
  const toast = useUI((s) => s.toast);
  const sentinel = useRef<HTMLDivElement>(null);

  // Atualiza quando um link de outra tela muda a URL
  useEffect(() => {
    setF(initial(sp));
  }, [sp]);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.media) ?? [], [q.data]);
  const total = q.data?.pages[0]?.pageInfo.total;
  const notInList = items.filter((m) => !entries[m.id]);
  const visible = hideMine ? notInList : items;

  // Carrega mais ao chegar no fim
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  const set = <K extends keyof BrowseFilters>(k: K, v: BrowseFilters[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const reset = () => setF({ sort: 'POPULARITY_DESC', genres: [], formats: [], search: '', excludeGenres: [], streaming: [], tags: [] });
  const activeCount =
    f.genres.length + f.formats.length + (f.season ? 1 : 0) + (f.seasonYear ? 1 : 0) + (f.yearFrom || f.yearTo ? 1 : 0) + (f.status ? 1 : 0) + (f.minScore ? 1 : 0) +
    (f.excludeGenres?.length ?? 0) + (f.streaming?.length ?? 0) + (f.tags?.length ?? 0) + (f.length ? 1 : 0) + (f.country ? 1 : 0);

  const panel = (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Ordenar por')}</label>
        <select className="field" value={f.sort} onChange={(e) => set('sort', e.target.value as MediaSort)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Gêneros')}</label>
        <p className="mb-2 text-[11px] font-bold text-muted">{t('1 toque: incluir · 2 toques: excluir · 3: limpar')}</p>
        <div className="flex flex-wrap gap-1.5">
          {(genres ?? Object.keys(GENRES)).map((g) => {
            const inc = f.genres.includes(g);
            const exc = (f.excludeGenres ?? []).includes(g);
            return (
              <button
                key={g}
                className={`chip !text-xs ${inc ? 'on' : ''} ${exc ? '!border-red-400 !text-red-400 line-through' : ''}`}
                onClick={() =>
                  setF((x) => {
                    const ex = x.excludeGenres ?? [];
                    if (inc) return { ...x, genres: x.genres.filter((y) => y !== g), excludeGenres: [...ex, g] };
                    if (exc) return { ...x, excludeGenres: ex.filter((y) => y !== g) };
                    return { ...x, genres: [...x.genres, g] };
                  })
                }
              >
                {exc && '✕ '}
                {genrePt(g)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Década')}</label>
        <div className="flex flex-wrap gap-1.5">
          {DECADES.map((d) => {
            const on = f.yearFrom === d && f.yearTo === d + 9;
            return (
              <button
                key={d}
                className={`chip !text-xs ${on ? 'on' : ''}`}
                onClick={() => setF((x) => ({ ...x, yearFrom: on ? undefined : d, yearTo: on ? undefined : d + 9 }))}
              >
                {String(d).slice(2)}{t('s')}
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select className="field text-sm" value={f.yearFrom ?? ''} onChange={(e) => set('yearFrom', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">{t('De…')}</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select className="field text-sm" value={f.yearTo ?? ''} onChange={(e) => set('yearTo', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">{t('Até…')}</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Temporada')}</label>
        <div className="grid grid-cols-2 gap-2">
          <select className="field text-sm" value={f.season ?? ''} onChange={(e) => set('season', (e.target.value || undefined) as Season | undefined)}>
            <option value="">{t('Qualquer')}</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_LABEL[s].pt} {SEASON_LABEL[s].jp}
              </option>
            ))}
          </select>
          <select className="field text-sm" value={f.seasonYear ?? ''} onChange={(e) => set('seasonYear', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">{t('Ano')}</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Formato')}</label>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((fm) => (
            <button key={fm} className={`chip !text-xs ${f.formats.includes(fm) ? 'on' : ''}`} onClick={() => set('formats', toggle(f.formats, fm))}>
              {FORMAT_LABEL[fm]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Situação')}</label>
        <select className="field text-sm" value={f.status ?? ''} onChange={(e) => set('status', (e.target.value || undefined) as MediaStatus | undefined)}>
          <option value="">{t('Qualquer')}</option>
          {(Object.keys(MEDIA_STATUS_LABEL) as MediaStatus[]).map((s) => (
            <option key={s} value={s}>
              {MEDIA_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 flex justify-between text-xs font-black uppercase tracking-wider text-muted">
          {t('Nota mínima')}{' '}<span className="text-pink">{f.minScore ? `${f.minScore}+` : '—'}</span>
        </label>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={f.minScore ?? 0}
          onChange={(e) => set('minScore', Number(e.target.value) || undefined)}
          className="w-full accent-[var(--pink)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Onde assistir')}</label>
        <div className="flex flex-wrap gap-1.5">
          {STREAMING.map((p) => {
            const on = (f.streaming ?? []).includes(p.id);
            return (
              <button
                key={p.id}
                className={`chip !text-xs ${on ? 'on' : ''}`}
                style={on ? { background: p.color, borderColor: p.color } : undefined}
                onClick={() => set('streaming', toggle(f.streaming ?? [], p.id))}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] font-bold text-muted">{t('Catálogo global do AniList — no Brasil pode variar.')}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Tamanho')}</label>
        <div className="flex flex-wrap gap-1.5">
          {LENGTHS.map((l) => (
            <button key={l.id} className={`chip !text-xs ${f.length === l.id ? 'on' : ''}`} onClick={() => set('length', f.length === l.id ? undefined : l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <button
          className={`chip mt-1.5 !text-xs ${f.status === 'FINISHED' ? 'on' : ''}`}
          onClick={() => set('status', f.status === 'FINISHED' ? undefined : 'FINISHED')}
        >
          {t('✅ Só finalizados (dá pra maratonar)')}
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Temas')}</label>
        <div className="flex flex-wrap gap-1.5">
          {THEME_TAGS.map((t) => (
            <button key={t.tag} className={`chip !text-xs ${(f.tags ?? []).includes(t.tag) ? 'on' : ''}`} onClick={() => set('tags', toggle(f.tags ?? [], t.tag))}>
              {t.pt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Origem')}</label>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => (
            <button key={c.id} className={`chip !text-xs ${f.country === c.id ? 'on' : ''}`} onClick={() => set('country', f.country === c.id ? undefined : c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <button className="manga-btn ghost w-full" onClick={reset}>
        <RotateCcw size={14} />{' '}{t('Limpar filtros')}
      </button>
    </div>
  );

  return (
    <>
      <SectionTitle title={t('Explorar')} jp="探索" action={total != null && <span className="text-muted">{total.toLocaleString(locale())}{total >= 5000 ? '+' : ''}{' '}{t('animes')}</span>} />

      <div className="mb-5 flex gap-2">
        <input
          className="field flex-1 !py-3 text-base"
          placeholder={t('Buscar por título… (ex.: Frieren, Naruto)')}
          value={f.search ?? ''}
          onChange={(e) => set('search', e.target.value)}
        />
        <button className="manga-btn ghost lg:hidden" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={16} /> {activeCount > 0 && <span className="rounded-full bg-pink px-1.5 text-xs text-white">{activeCount}</span>}
        </button>
      </div>

      <div className="flex gap-8">
        <aside className="panel sticky top-24 hidden h-fit max-h-[calc(100dvh-7rem)] w-72 shrink-0 overflow-y-auto p-5 lg:block">{panel}</aside>

        {open && (
          <div className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="pop-in relative ml-auto h-full w-[86%] max-w-sm overflow-y-auto border-l-2 border-line bg-bg p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-xl">{t('Filtros')}</span>
                <button onClick={() => setOpen(false)} aria-label={t('Fechar')}>
                  <X />
                </button>
              </div>
              {panel}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex justify-end">
            <button className={`chip ${hideMine ? 'on' : ''}`} onClick={() => setHideMine((v) => !v)}>
              {t('Ocultar os que já estão na lista')}
            </button>
          </div>
          {notInList.length > 0 && (
            <div className="panel mb-5 flex flex-wrap items-center gap-3 p-3">
              <ListPlus className="text-pink" size={20} />
              <span className="text-sm font-bold">
                {t('Adicionar os')}{' '}<b className="text-pink">{notInList.length}</b>{' '}{t('desta busca que ainda não estão na lista como')}
              </span>
              <select className="field !w-auto !py-1.5 text-sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ListStatus)}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
              <button
                className="manga-btn yellow !py-1.5"
                onClick={() => {
                  const n = addMany(notInList, bulkStatus);
                  toast(t('{0} animes adicionados como "{1}"', n, STATUS_META[bulkStatus].label));
                }}
              >
                {t('Adicionar todos')}
              </button>
            </div>
          )}

          {q.error ? (
            <ErrorBox error={q.error} onRetry={() => q.refetch()} />
          ) : !q.isLoading && items.length === 0 ? (
            <EmptyState jp="空" title={t('Nada encontrado')}>
              {t('Tente tirar alguns filtros.')}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {q.isLoading ? Array.from({ length: 15 }, (_, i) => <SkeletonCard key={i} />) : visible.map((m) => <AnimeCard key={m.id} media={m} />)}
            </div>
          )}
          <div ref={sentinel} className="flex h-20 items-center justify-center">
            {q.isFetchingNextPage && <Spinner className="text-pink" />}
          </div>
        </div>
      </div>
    </>
  );
}
