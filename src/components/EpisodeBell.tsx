import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOutsideClose } from './ui';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellRing, Check, Plus } from 'lucide-react';
import { gql } from '../api/anilist';
import { AIRING_BY_MEDIA_QUERY } from '../api/queries';
import { chunk } from '../lib/format';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { ListEntry } from '../types';

interface Aired {
  id: number;
  episode: number;
  airingAt: number;
  mediaId: number;
}

export interface NewEpisode extends Aired {
  entry: ListEntry;
  kind: 'novo' | 'estreia';
}

const WINDOW = 14 * 86400; // últimos 14 dias

/** Episódios que já saíram e você ainda não viu (Assistindo) ou estreias do que está em "Quero ver". */
export function useNewEpisodes() {
  const entries = useList((s) => s.entries);
  const seen = useUI((s) => s.seenAiring);
  const ids = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status === 'WATCHING' || e.status === 'PLANNING')
        .map((e) => e.mediaId)
        .sort((a, b) => a - b),
    [entries],
  );

  const q = useQuery({
    queryKey: ['new-episodes', ids],
    enabled: ids.length > 0,
    refetchInterval: 15 * 60 * 1000,
    refetchIntervalInBackground: true,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000);
      const out: Aired[] = [];
      for (const part of chunk(ids, 50)) {
        for (let page = 1; page <= 3; page++) {
          const d = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Aired[] } }>(AIRING_BY_MEDIA_QUERY, {
            ids: part,
            from: now - WINDOW,
            to: now,
            page,
          });
          out.push(...d.Page.airingSchedules);
          if (!d.Page.pageInfo.hasNextPage) break;
        }
      }
      return out;
    },
  });

  const items = useMemo(() => {
    const seenSet = new Set(seen);
    const best = new Map<number, NewEpisode>();
    for (const a of q.data ?? []) {
      const e = entries[a.mediaId];
      if (!e || seenSet.has(a.id)) continue;
      let kind: NewEpisode['kind'] | null = null;
      if (e.status === 'WATCHING' && a.episode > e.progress) kind = 'novo';
      else if (e.status === 'PLANNING' && a.episode === 1) kind = 'estreia';
      if (!kind) continue;
      // Um aviso por anime: o episódio mais recente
      const cur = best.get(a.mediaId);
      if (!cur || a.episode > cur.episode) best.set(a.mediaId, { ...a, entry: e, kind });
    }
    return [...best.values()].sort((x, y) => y.airingAt - x.airingAt);
  }, [q.data, entries, seen]);

  return { items, allIds: (q.data ?? []).map((a) => a.id), isLoading: q.isLoading };
}

function ago(ts: number) {
  const s = Date.now() / 1000 - ts;
  if (s < 3600) return `há ${Math.max(1, Math.floor(s / 60))}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

/** Dispara notificação do navegador (via service worker do PWA quando disponível). */
async function showNotification(title: string, body: string, tag: string, icon?: string | null) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions = { body, tag, icon: icon ?? './pwa-192.png', badge: './pwa-192.png' };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* sem suporte */
  }
}

export default function EpisodeBell() {
  const { items } = useNewEpisodes();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(box, open, close);
  useEffect(close, [pathname, close]);
  const notify = useUI((s) => s.notify);
  const notified = useUI((s) => s.notifiedAiring);
  const markNotified = useUI((s) => s.markNotified);
  const markSeen = useUI((s) => s.markSeen);
  const update = useList((s) => s.update);
  const lang = useUI((s) => s.titleLang);
  const name = (e: ListEntry) => (lang === 'english' ? e.titleEnglish ?? e.title : e.title);

  // Notifica o que ainda não foi notificado
  useEffect(() => {
    if (!notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const fresh = items.filter((i) => !notified.includes(i.id));
    if (!fresh.length) return;
    markNotified(fresh.map((i) => i.id));
    if (fresh.length > 3) {
      showNotification('Shiori 栞', `${fresh.length} episódios novos da sua lista!`, 'shiori-batch');
    } else {
      fresh.forEach((i) =>
        showNotification(
          i.kind === 'estreia' ? `Estreou: ${name(i.entry)}` : `Ep ${i.episode} de ${name(i.entry)}`,
          i.kind === 'estreia' ? 'Estava na sua lista "Quero ver" 🎉' : `Saiu ${ago(i.airingAt)} · você parou no ep ${i.entry.progress}`,
          `shiori-${i.id}`,
          i.entry.cover,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, notify]);

  const count = items.length;

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="manga-btn ghost relative !p-2"
        aria-label={count ? `${count} episódios novos` : 'Novidades'}
        title="Episódios novos"
      >
        {count ? <BellRing size={18} className="text-pink" /> : <Bell size={18} />}
        {count > 0 && (
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-black bg-yellow px-1 text-[10px] font-black text-black">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="pop-in panel fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto p-3 shadow-[6px_6px_0_var(--shadow)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display">
                Novidades <span className="font-jp text-sm text-pink">新着</span>
              </span>
              {count > 0 && (
                <button className="text-xs font-bold text-muted hover:text-pink" onClick={() => markSeen(items.map((i) => i.id))}>
                  Dispensar tudo
                </button>
              )}
            </div>
            {count === 0 ? (
              <p className="py-6 text-center text-sm font-bold text-muted">
                Nenhum episódio novo dos animes que você está assistindo. 🍵
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl bg-panel-2 p-2">
                    <Link to={`/anime/${i.mediaId}`} onClick={() => setOpen(false)}>
                      <img src={i.entry.cover ?? ''} alt="" className="h-14 w-10 rounded-md border-2 border-black object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold">{name(i.entry)}</div>
                      <div className="text-xs font-bold text-muted">
                        {i.kind === 'estreia' ? (
                          <span className="text-yellow">Estreou! · {ago(i.airingAt)}</span>
                        ) : (
                          <>
                            <span className="text-cyan">Ep {i.episode}</span> saiu {ago(i.airingAt)} · você está no {i.entry.progress}
                          </>
                        )}
                      </div>
                    </div>
                    {i.kind === 'novo' ? (
                      <button
                        className="manga-btn cyan !rounded-lg !px-2 !py-1 !text-xs"
                        onClick={() => update(i.mediaId, { progress: i.entry.progress + 1 })}
                        title="Marcar +1 episódio"
                      >
                        <Plus size={12} strokeWidth={3} /> 1
                      </button>
                    ) : (
                      <button
                        className="manga-btn yellow !rounded-lg !px-2 !py-1 !text-xs"
                        onClick={() => update(i.mediaId, { status: 'WATCHING' })}
                        title="Começar a assistir"
                      >
                        Ver
                      </button>
                    )}
                    <button className="p-1 text-muted hover:text-ink" onClick={() => markSeen([i.id])} aria-label="Dispensar">
                      <Check size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Link to="/calendario" onClick={() => setOpen(false)} className="mt-3 block text-center text-xs font-extrabold text-cyan">
              Ver calendário da semana →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
