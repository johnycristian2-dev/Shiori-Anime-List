import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderMinus, FolderPlus, LayoutGrid, Rows3 } from 'lucide-react';
import AnimeCard from '../components/AnimeCard';
import EntryEditor from '../components/EntryEditor';
import { ConfirmButton, EmptyState, SectionTitle } from '../components/ui';
import { activeLists, LIST_EMOJIS, STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';
import { entryToMedia, pickTitle } from '../lib/format';
import { FORMAT_LABEL, genrePt } from '../lib/labels';
import type { ListEntry, ListStatus } from '../types';

type Sort = 'updated' | 'score' | 'title' | 'year' | 'added';

export default function MyList() {
  const entries = useList((s) => s.entries);
  const lang = useUI((s) => s.titleLang);
  const [tab, setTab] = useState<string>('ALL');
  const listsMap = useList((s) => s.lists);
  const lists = useMemo(() => activeLists(listsMap), [listsMap]);
  const createList = useList((s) => s.createList);
  const updateList = useList((s) => s.updateList);
  const deleteList = useList((s) => s.deleteList);
  const toggleInList = useList((s) => s.toggleInList);
  const [newList, setNewList] = useState<string | null>(null);
  const custom = tab.startsWith('L:') ? listsMap[tab.slice(2)] : undefined;
  const [sort, setSort] = useState<Sort>('updated');
  const [view, setView] = useState<'rows' | 'grid'>('rows');
  const [query, setQuery] = useState('');

  const all = useMemo(() => Object.values(entries), [entries]);
  const name = (e: ListEntry) => pickTitle({ romaji: e.title, english: e.titleEnglish, native: e.titleNative }, lang);

  const stats = useMemo(() => {
    const scored = all.filter((e) => e.score > 0);
    const genres = new Map<string, number>();
    all.forEach((e) => e.genres.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1)));
    return {
      total: all.length,
      eps: all.reduce((n, e) => n + e.progress, 0),
      mean: scored.length ? (scored.reduce((n, e) => n + e.score, 0) / scored.length).toFixed(1) : '—',
      topGenres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      by: Object.fromEntries(STATUS_ORDER.map((s) => [s, all.filter((e) => e.status === s).length])) as Record<ListStatus, number>,
    };
  }, [all]);

  const list = useMemo(() => {
    const ql = query.trim().toLowerCase();
    const out = all.filter(
      (e) =>
        (tab === 'ALL' || (tab === 'FAV' ? e.favorite : custom ? custom.mediaIds.includes(e.mediaId) : e.status === tab)) &&
        (!ql || [e.title, e.titleEnglish, e.titleNative].some((t) => t?.toLowerCase().includes(ql))),
    );
    const cmp: Record<Sort, (a: ListEntry, b: ListEntry) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      added: (a, b) => b.addedAt - a.addedAt,
      score: (a, b) => b.score - a.score || (b.averageScore ?? 0) - (a.averageScore ?? 0),
      title: (a, b) => name(a).localeCompare(name(b)),
      year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    };
    return out.sort(cmp[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, sort, query, lang, custom]);

  if (!all.length)
    return (
      <>
        <SectionTitle title="Minha lista" jp="マイリスト" />
        <EmptyState jp="空" title="Sua lista está vazia">
          Vá em <Link to="/" className="font-bold text-pink">Descobrir</Link>, use o{' '}
          <Link to="/swipe" className="font-bold text-pink">modo rápido</Link> ou{' '}
          <Link to="/sync" className="font-bold text-pink">importe do MAL/AniList</Link>.
        </EmptyState>
      </>
    );

  return (
    <>
      <SectionTitle title="Minha lista" jp="マイリスト" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Animes', v: stats.total, c: 'text-pink' },
          { k: 'Episódios vistos', v: stats.eps.toLocaleString('pt-BR'), c: 'text-cyan' },
          { k: 'Nota média', v: stats.mean, c: 'text-yellow' },
          { k: 'Gêneros favoritos', v: stats.topGenres.map(([g]) => genrePt(g)).join(', ') || '—', c: 'text-ink !text-base' },
        ].map((s) => (
          <div key={s.k} className="panel p-4">
            <div className={`truncate font-display text-2xl ${s.c}`}>{s.v}</div>
            <div className="text-xs font-bold text-muted">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={`chip ${tab === 'ALL' ? 'on' : ''}`} onClick={() => setTab('ALL')}>
          Todos <span className="opacity-70">{stats.total}</span>
        </button>
        <button className={`chip ${tab === 'FAV' ? 'on' : ''}`} onClick={() => setTab('FAV')}>
          ♥ Favoritos <span className="opacity-70">{all.filter((e) => e.favorite).length}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            className={`chip ${tab === s ? 'on' : ''}`}
            onClick={() => setTab(s)}
            style={tab === s ? { background: STATUS_META[s].color, borderColor: STATUS_META[s].color, color: '#0c0a1d' } : undefined}
          >
            {STATUS_META[s].label} <span className="opacity-70">{stats.by[s]}</span>
          </button>
        ))}
      </div>

      {/* Listas personalizadas */}
      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <span className="shrink-0 text-xs font-black uppercase tracking-wider text-muted">Listas</span>
        {lists.map((l) => (
          <button key={l.id} className={`chip ${tab === `L:${l.id}` ? 'on' : ''}`} onClick={() => setTab(`L:${l.id}`)}>
            {l.emoji} {l.name} <span className="opacity-70">{l.mediaIds.filter((id) => entries[id]).length}</span>
          </button>
        ))}
        {newList === null ? (
          <button className="chip !border-dashed" onClick={() => setNewList('')}>
            <FolderPlus size={14} /> Nova lista
          </button>
        ) : (
          <form
            className="flex shrink-0 gap-1"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!newList.trim()) return setNewList(null);
              const id = createList(newList);
              setNewList(null);
              setTab(`L:${id}`);
            }}
          >
            <input
              autoFocus
              value={newList}
              onChange={(ev) => setNewList(ev.target.value)}
              onBlur={() => !newList.trim() && setNewList(null)}
              placeholder="Ex.: Pra ver com a namorada"
              maxLength={30}
              className="field !w-56 !py-1.5 text-sm"
            />
            <button className="manga-btn !py-1.5">Criar</button>
          </form>
        )}
      </div>

      {custom && !custom.deleted && (
        <div className="panel mb-5 flex flex-wrap items-center gap-3 p-3">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border-2 border-black bg-panel-2 text-xl"
            title="Trocar emoji"
            onClick={() => updateList(custom.id, { emoji: LIST_EMOJIS[(LIST_EMOJIS.indexOf(custom.emoji) + 1) % LIST_EMOJIS.length] })}
          >
            {custom.emoji}
          </button>
          <input
            key={custom.id}
            defaultValue={custom.name}
            onBlur={(ev) => ev.target.value.trim() && updateList(custom.id, { name: ev.target.value.trim() })}
            className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none focus:text-pink"
            maxLength={30}
          />
          <span className="text-xs font-bold text-muted">Adicione animes pelo botão + de qualquer card</span>
          <ConfirmButton
            className="manga-btn ghost !py-1.5 !text-red-400"
            confirmText="Apagar mesmo?"
            onConfirm={() => {
              deleteList(custom.id);
              setTab('ALL');
            }}
          >
            Apagar lista
          </ConfirmButton>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <input className="field min-w-[12rem] flex-1" placeholder="Filtrar na lista…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="updated">Atualizados</option>
          <option value="added">Adicionados</option>
          <option value="score">Minha nota</option>
          <option value="title">Título</option>
          <option value="year">Ano</option>
        </select>
        <div className="flex rounded-xl border-2 border-line">
          <button className={`p-2.5 ${view === 'rows' ? 'text-pink' : 'text-muted'}`} onClick={() => setView('rows')} aria-label="Lista">
            <Rows3 size={18} />
          </button>
          <button className={`p-2.5 ${view === 'grid' ? 'text-pink' : 'text-muted'}`} onClick={() => setView('grid')} aria-label="Grade">
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((e) => (
            <AnimeCard key={e.mediaId} media={entryToMedia(e)} note={e.score ? `Sua nota: ★ ${e.score}` : undefined} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((e) => (
            <div key={e.mediaId} className="panel flex gap-3 p-2.5" style={{ borderLeft: `6px solid ${STATUS_META[e.status].color}` }}>
              <Link to={`/anime/${e.mediaId}`} className="shrink-0">
                {e.cover ? (
                  <img src={e.cover} alt="" loading="lazy" className="h-24 w-16 rounded-lg border-2 border-black object-cover" />
                ) : (
                  <div className="halftone h-24 w-16 rounded-lg" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/anime/${e.mediaId}`} className="line-clamp-1 font-extrabold hover:text-pink">
                  {e.favorite && <span className="text-pink">♥ </span>}
                  {name(e)}
                </Link>
                <div className="mb-2 text-xs font-bold text-muted">
                  {[e.format && FORMAT_LABEL[e.format], e.year, e.averageScore && `★ ${e.averageScore} geral`].filter(Boolean).join(' · ')}
                </div>
                <EntryEditor entry={e} compact />
                {e.notes && <p className="mt-1.5 line-clamp-2 text-xs italic text-muted">📝 {e.notes}</p>}
                {custom && (
                  <button className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-pink" onClick={() => toggleInList(custom.id, entryToMedia(e))}>
                    <FolderMinus size={12} /> Tirar de {custom.emoji} {custom.name}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
