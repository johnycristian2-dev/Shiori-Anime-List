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
import type { FullProfile } from '../sync/account';
import ProfileHeader from '../components/ProfileHeader';
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

  const p = q.data as FullProfile;
  const snap = p.snapshot;
  const name = p.display_name || p.username;
  const shown = list
    .filter((e) => (tab === 'FAV' ? e.favorite : e.status === tab))
    .sort((a, b) => b.score - a.score || (b.averageScore ?? 0) - (a.averageScore ?? 0));
  const fav = list.find((e) => e.mediaId === p.favorite_id) ?? list.filter((e) => e.favorite).sort((a, b) => b.score - a.score)[0];
  const unlocked = ACHIEVEMENTS.filter((a) => snap.achievements?.includes(a.id));

  return (
    <>
      <ProfileHeader
        name={name}
        username={p.username}
        avatar={p.avatar_url}
        banner={p.banner_url}
        bio={p.bio}
        rank={snap.rank}
        favorite={fav ? { id: fav.mediaId, title: fav.title, cover: fav.cover } : null}
        actions={
          <Link to={`/comparar/shiori/${p.username}`} className="manga-btn">
            <Users size={16} />{' '}{t('Comparar comigo')}
          </Link>
        }
      />

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
