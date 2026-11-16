import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import AnimeCard from '../components/AnimeCard';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { ACHIEVEMENTS } from '../lib/profile';
import { entryToMedia } from '../lib/format';
import { STATUS_META, STATUS_ORDER } from '../store/list';
import { getPublicProfile, snapshotEntries } from '../sync/profile';
import type { ListStatus } from '../types';

import { t, locale } from '../lib/i18n';

export default function PublicProfile() {
  const { username = '' } = useParams();
  const q = useQuery({ queryKey: ['profile', username], queryFn: () => getPublicProfile(username), retry: false });
  const [tab, setTab] = useState<ListStatus | 'FAV'>('COMPLETED');
  const list = useMemo(() => (q.data ? snapshotEntries(q.data.snapshot) : []), [q.data]);

  if (q.isLoading)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (q.error || !q.data) return <ErrorBox error={q.error ?? new Error(t('Perfil não encontrado'))} />;

  const p = q.data;
  const snap = p.snapshot;
  const name = p.display_name || p.username;
  const shown = list
    .filter((e) => (tab === 'FAV' ? e.favorite : e.status === tab))
    .sort((a, b) => b.score - a.score || (b.averageScore ?? 0) - (a.averageScore ?? 0));
  const unlocked = ACHIEVEMENTS.filter((a) => snap.achievements?.includes(a.id));

  return (
    <>
      <section className="halftone relative mb-8 overflow-hidden rounded-3xl border-[3px] border-black bg-panel p-6 shadow-[8px_8px_0_var(--pink)] sm:p-8">
        <div className="speedlines absolute inset-0 opacity-40" />
        {snap.rank && <div className="absolute -right-3 -top-6 font-jp text-[130px] font-black leading-none text-pink/15">{snap.rank.jp}</div>}
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-2xl border-[3px] border-black bg-pink font-display text-4xl text-white shadow-[4px_4px_0_#000] -rotate-3">
            {name[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl">{name}</h1>
            <div className="text-sm font-bold text-muted">@{p.username}</div>
            {snap.rank && (
              <div className="mt-1 font-jp text-lg font-black text-pink">
                {snap.rank.jp} · <span className="font-display text-ink">{snap.rank.name}</span>
              </div>
            )}
          </div>
          <Link to={`/comparar/shiori/${p.username}`} className="manga-btn">
            <Users size={16} />{' '}{t('Comparar comigo')}
          </Link>
        </div>
      </section>

      {snap.stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { k: t('Animes'), v: snap.stats.total, c: 'text-pink' },
            { k: t('Completos'), v: snap.stats.completed, c: 'text-[#7cff8a]' },
            { k: t('Episódios'), v: snap.stats.eps.toLocaleString(locale()), c: 'text-cyan' },
            { k: t('Horas (aprox.)'), v: `≈${snap.stats.hours}h`, c: 'text-yellow' },
            { k: t('Nota média'), v: snap.stats.mean || '—', c: 'text-pink' },
          ].map((s) => (
            <div key={s.k} className="panel p-4">
              <div className={`font-display text-2xl ${s.c}`}>{s.v}</div>
              <div className="text-xs font-bold text-muted">{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {unlocked.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {unlocked.map((a) => (
            <span key={a.id} title={a.desc} className={`chip cursor-default ${a.hidden ? '!border-pink' : ''}`}>
              {a.icon} {a.name}
            </span>
          ))}
        </div>
      )}

      <SectionTitle title={t('Lista de {0}', name)} jp="リスト" />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={`chip ${tab === 'FAV' ? 'on' : ''}`} onClick={() => setTab('FAV')}>
          {t('♥ Favoritos')}{' '}{list.filter((e) => e.favorite).length}
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} className={`chip ${tab === s ? 'on' : ''}`} onClick={() => setTab(s)}>
            {STATUS_META[s].label} {list.filter((e) => e.status === s).length}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((e) => (
            <AnimeCard key={e.mediaId} media={entryToMedia(e)} note={e.score ? t('Nota de {0}: ★ {1}', name, e.score) : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState jp="空" title={t('Nada aqui')} />
      )}
      {snap.updatedAt && <p className="mt-8 text-center text-xs font-bold text-muted">{t('Atualizado em')}{' '}{new Date(snap.updatedAt).toLocaleString(locale())}</p>}
    </>
  );
}
