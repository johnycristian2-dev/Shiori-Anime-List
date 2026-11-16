import { useParams } from 'react-router-dom';
import { useStudio } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { ErrorBox, SectionTitle, SkeletonCard, Spinner } from '../components/ui';

export default function StudioPage() {
  const id = Number(useParams().id);
  const q = useStudio(id);
  const studio = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.media.nodes) ?? [];

  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <SectionTitle
        title={studio?.name ?? 'Estúdio'}
        jp="スタジオ"
        action={studio && <span className="text-muted">{studio.media.pageInfo.total} obras</span>}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {q.isLoading ? Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} />) : items.map((m) => <AnimeCard key={m.id} media={m} />)}
      </div>
      {q.hasNextPage && (
        <div className="mt-8 text-center">
          <button className="manga-btn ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : 'Carregar mais'}
          </button>
        </div>
      )}
    </>
  );
}
