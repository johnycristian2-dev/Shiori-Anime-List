import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePersonalRecs } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { EmptyState, ErrorBox, SectionTitle, SkeletonCard } from '../components/ui';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import { pickTitle } from '../lib/format';
import type { ListEntry } from '../types';

import { t } from '../lib/i18n';

const MAX_SEEDS = 10;

function weight(e: ListEntry) {
  if (e.status === 'DROPPED') return 0;
  const base = e.score ? e.score / 10 : e.status === 'COMPLETED' ? 0.7 : e.status === 'WATCHING' ? 0.65 : 0.45;
  return Math.max(0.2, base);
}

export default function Recommendations() {
  const entries = useList((s) => s.entries);
  const lang = useUI((s) => s.titleLang);
  const all = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status !== 'DROPPED')
        .sort((a, b) => b.score - a.score || weight(b) - weight(a) || b.updatedAt - a.updatedAt),
    [entries],
  );
  const [picked, setPicked] = useState<number[] | null>(null);
  const seedIds = picked ?? all.slice(0, 8).map((e) => e.mediaId);
  const seeds = seedIds.map((id) => entries[id]).filter(Boolean).map((e) => ({ id: e.mediaId, weight: weight(e) }));
  const q = usePersonalRecs(seeds);

  const recs = (q.data ?? []).filter((r) => !entries[r.media.id]).slice(0, 40);
  const nameOf = (id: number) => (entries[id] ? pickTitle({ romaji: entries[id].title, english: entries[id].titleEnglish, native: null }, lang) : '');

  const toggleSeed = (id: number) => {
    const cur = picked ?? seedIds;
    if (cur.includes(id)) setPicked(cur.filter((x) => x !== id));
    else if (cur.length < MAX_SEEDS) setPicked([...cur, id]);
  };

  if (!all.length)
    return (
      <>
        <SectionTitle title={t('Pra você')} jp="おすすめ" />
        <EmptyState jp="推" title={t('Adicione alguns animes primeiro')}>
          {t('As recomendações usam o que está na sua lista. Comece pelo')}{' '}
          <Link to="/swipe" className="font-bold text-pink">
            {t('modo rápido')}
          </Link>{' '}
          {t('ou')}{' '}
          <Link to="/" className="font-bold text-pink">
            {t('Descobrir')}
          </Link>.
        </EmptyState>
      </>
    );

  return (
    <>
      <SectionTitle title={t('Pra você')} jp="おすすめ" />
      <div className="panel mb-6 p-4">
        <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">
          {t('Baseado em (')}{seedIds.length}/{MAX_SEEDS}{t(') — toque pra escolher')}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {all.slice(0, 40).map((e) => (
            <button key={e.mediaId} className={`chip !text-xs ${seedIds.includes(e.mediaId) ? 'on' : ''}`} onClick={() => toggleSeed(e.mediaId)}>
              {e.score > 0 && <span>★{e.score}</span>}
              <span className="max-w-[10rem] truncate">{nameOf(e.mediaId)}</span>
            </button>
          ))}
        </div>
      </div>

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {q.isLoading || q.isFetching && !q.data
            ? Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} />)
            : recs.map((r) => (
                <AnimeCard
                  key={r.media.id}
                  media={r.media}
                  note={t('Porque você curtiu {0}', r.because.slice(0, 2).map(nameOf).join(' e '))}
                />
              ))}
        </div>
      )}
      {!q.isLoading && q.data && recs.length === 0 && (
        <EmptyState jp="無" title={t('Sem novidades')}>
          {t('Você já tem tudo que foi recomendado! Escolha outros animes base.')}
        </EmptyState>
      )}
    </>
  );
}
