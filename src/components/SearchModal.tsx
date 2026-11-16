import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useSearch } from '../api/hooks';
import { useDebounced, Spinner } from './ui';
import AddMenu from './AddMenu';
import { useTitle } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import { STATUS_META, useList } from '../store/list';

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [sel, setSel] = useState(0);
  const debounced = useDebounced(term, 300);
  const q = useSearch(debounced);
  const nav = useNavigate();
  const title = useTitle();
  const input = useRef<HTMLInputElement>(null);
  const entries = useList((s) => s.entries);
  const items = q.data?.media ?? [];

  useEffect(() => {
    if (open) {
      setTerm('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setSel(0), [debounced]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    nav(path);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(items.length, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      if (items[sel]) go(`/anime/${items[sel].id}`);
      else if (term.trim()) go(`/explorar?q=${encodeURIComponent(term.trim())}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/70 p-3 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in panel w-full max-w-xl overflow-hidden shadow-[8px_8px_0_var(--pink)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
          <Search className="text-pink" size={20} />
          <input
            ref={input}
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar anime… (romaji, inglês ou japonês)"
            className="flex-1 bg-transparent text-lg font-bold outline-none placeholder:text-muted"
          />
          {q.isFetching && <Spinner className="h-4 w-4 text-pink" />}
          <button onClick={onClose} aria-label="Fechar" className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {debounced.trim().length < 2 ? (
            <div className="p-6 text-center text-sm font-bold text-muted">
              Digite pelo menos 2 letras · <span className="font-jp">検索</span>
            </div>
          ) : !q.isLoading && items.length === 0 ? (
            <div className="p-6 text-center text-sm font-bold text-muted">Nada encontrado 😢</div>
          ) : (
            items.map((m, i) => {
              const e = entries[m.id];
              return (
                <div
                  key={m.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(`/anime/${m.id}`)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 ${sel === i ? 'bg-panel-2' : ''}`}
                >
                  <img src={m.coverImage.large ?? ''} alt="" className="h-16 w-11 rounded-md border-2 border-black object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{title(m)}</div>
                    <div className="truncate text-xs font-bold text-muted">
                      {[m.format && FORMAT_LABEL[m.format], m.seasonYear, m.averageScore && `★ ${m.averageScore}`].filter(Boolean).join(' · ')}
                      {m.title.native && <span className="ml-2 font-jp">{m.title.native}</span>}
                    </div>
                    {e && (
                      <span className="mt-0.5 inline-block rounded px-1.5 text-[10px] font-black text-black" style={{ background: STATUS_META[e.status].color }}>
                        {STATUS_META[e.status].label}
                      </span>
                    )}
                  </div>
                  <div onClick={(ev) => ev.stopPropagation()}>
                    <AddMenu media={m} compact />
                  </div>
                </div>
              );
            })
          )}
          {debounced.trim().length >= 2 && (
            <button
              onMouseEnter={() => setSel(items.length)}
              onClick={() => go(`/explorar?q=${encodeURIComponent(term.trim())}`)}
              className={`mt-1 flex w-full items-center justify-between rounded-xl p-3 text-sm font-extrabold text-cyan ${sel === items.length ? 'bg-panel-2' : ''}`}
            >
              Ver todos os resultados em Explorar <CornerDownLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
