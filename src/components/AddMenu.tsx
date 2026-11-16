import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderPlus, Plus, Trash2 } from 'lucide-react';
import type { ListStatus, Media } from '../types';
import { activeLists, STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';
import { useTitle } from '../lib/format';

const W = 216;

export default function AddMenu({ media, compact = false }: { media: Media; compact?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const entry = useList((s) => s.entries[media.id]);
  const add = useList((s) => s.add);
  const remove = useList((s) => s.remove);
  const toast = useUI((s) => s.toast);
  const title = useTitle();
  const listsMap = useList((s) => s.lists);
  const toggleInList = useList((s) => s.toggleInList);
  const createList = useList((s) => s.createList);
  const [newName, setNewName] = useState('');
  const lists = activeLists(listsMap);
  const H = Math.min(window.innerHeight * 0.75, 300 + lists.length * 36 + 60);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e.type === 'mousedown' || e.type === 'touchstart') {
        const t = e.target as Node;
        if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      }
      setPos(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + H > window.innerHeight) top = Math.max(8, r.top - H - 8);
    const left = Math.min(window.innerWidth - W - 8, Math.max(8, r.right - W));
    setPos({ top, left });
  };

  const choose = (s: ListStatus) => {
    add(media, s);
    toast(`${title(media)} → ${STATUS_META[s].label}`);
    setPos(null);
  };

  const meta = entry ? STATUS_META[entry.status] : null;

  return (
    <>
      <button
        ref={btn}
        onClick={toggle}
        aria-label={meta ? `Na lista: ${meta.label}` : 'Adicionar à lista'}
        className={compact ? 'add-fab' : 'manga-btn'}
        style={meta ? { background: meta.color, color: '#0c0a1d' } : undefined}
      >
        {meta ? <Check size={compact ? 18 : 16} strokeWidth={3} /> : <Plus size={compact ? 20 : 16} strokeWidth={3} />}
        {!compact && (meta ? meta.label : 'Adicionar')}
      </button>
      {pos &&
        createPortal(
          <div
            ref={menu}
            className="pop-in panel fixed z-[100] overflow-y-auto p-1.5 shadow-[6px_6px_0_var(--shadow)]"
            style={{ top: pos.top, left: pos.left, width: W, maxHeight: H }}
          >
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => choose(s)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-bold hover:bg-panel-2 ${
                  entry?.status === s ? 'bg-panel-2' : ''
                }`}
              >
                <span className="h-3 w-3 rounded-full border-2 border-black" style={{ background: STATUS_META[s].color }} />
                <span className="flex-1">{STATUS_META[s].label}</span>
                <span className="font-jp text-xs text-muted">{STATUS_META[s].jp}</span>
              </button>
            ))}
            {entry && (
              <button
                onClick={() => {
                  remove(media.id);
                  toast('Removido da lista', 'info');
                  setPos(null);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t-2 border-line px-2.5 py-2 text-left text-sm font-bold text-red-400 hover:bg-panel-2"
              >
                <Trash2 size={14} /> Remover
              </button>
            )}
            <div className="mt-1 border-t-2 border-line px-2.5 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-muted">Minhas listas</div>
            {lists.map((l) => {
              const on = l.mediaIds.includes(media.id);
              return (
                <button
                  key={l.id}
                  onClick={() => {
                    toggleInList(l.id, media);
                    toast(on ? `Tirado de ${l.emoji} ${l.name}` : `Adicionado a ${l.emoji} ${l.name}`, on ? 'info' : 'ok');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold hover:bg-panel-2"
                >
                  <span className={`grid h-4 w-4 place-items-center rounded border-2 border-black ${on ? 'bg-pink text-white' : 'bg-panel'}`}>
                    {on && <Check size={10} strokeWidth={4} />}
                  </span>
                  <span>{l.emoji}</span>
                  <span className="flex-1 truncate">{l.name}</span>
                </button>
              );
            })}
            <form
              className="flex items-center gap-1.5 px-1.5 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                const id = createList(newName);
                toggleInList(id, media);
                toast(`Lista "${newName.trim()}" criada`);
                setNewName('');
              }}
            >
              <FolderPlus size={14} className="shrink-0 text-muted" />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nova lista…"
                maxLength={30}
                className="min-w-0 flex-1 rounded-md bg-panel-2 px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan"
              />
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
