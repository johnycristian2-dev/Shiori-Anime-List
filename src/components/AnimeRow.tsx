import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Media } from '../types';
import AnimeCard from './AnimeCard';
import { SectionTitle, SkeletonCard } from './ui';

import { t } from '../lib/i18n';

export default function AnimeRow({
  title,
  jp,
  items,
  loading,
  ranked,
  action,
  notes,
}: {
  title: string;
  jp?: string;
  items?: Media[];
  loading?: boolean;
  ranked?: boolean;
  action?: ReactNode;
  notes?: Record<number, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="mb-10">
      <SectionTitle title={title} jp={jp} action={action} />
      <div className="relative">
        <div ref={ref} className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-1">
          {loading || !items
            ? Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} small />)
            : items.map((m, i) => (
                <AnimeCard key={m.id} media={m} small rank={ranked ? i + 1 : undefined} note={notes?.[m.id]} />
              ))}
        </div>
        <button
          onClick={() => scroll(-1)}
          aria-label={t('Anterior')}
          className="manga-btn ghost absolute -left-3 top-1/2 hidden -translate-y-1/2 !p-2 md:inline-flex"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label={t('Próximo')}
          className="manga-btn ghost absolute -right-3 top-1/2 hidden -translate-y-1/2 !p-2 md:inline-flex"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
