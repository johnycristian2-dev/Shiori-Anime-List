import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Media } from '../types';
import { STATUS_META, useList } from '../store/list';
import { useTitle } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import AddMenu from './AddMenu';
import { isManga, mangaKind, mediaPath, statusLabel, unitShort } from '../lib/media';

export default function AnimeCard({
  media,
  small = false,
  rank,
  note,
}: {
  media: Media;
  small?: boolean;
  rank?: number;
  note?: string;
}) {
  const title = useTitle();
  const entry = useList((s) => s.entries[media.id]);
  const cover = media.coverImage.extraLarge ?? media.coverImage.large;
  const manga = isManga(media);
  const meta = [
    manga ? mangaKind(media) : media.format ? FORMAT_LABEL[media.format] : null,
    media.seasonYear,
    manga ? (media.chapters ? `${media.chapters} ${unitShort(media)}` : null) : media.episodes ? `${media.episodes} ep` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`group relative ${small ? 'w-36 shrink-0 snap-start sm:w-40' : 'w-full'}`}>
      <Link to={mediaPath(media)} className="block" title={title(media)}>
        <div
          className="card-frame relative aspect-[2/3] overflow-hidden rounded-xl bg-panel-2"
          style={{ '--accent': media.coverImage.color ?? 'var(--pink)' } as CSSProperties}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="halftone h-full w-full" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/10 to-transparent" />
          {media.averageScore != null && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border-2 border-black bg-yellow px-1.5 py-0.5 text-[11px] font-black text-black">
              <Star size={11} fill="currentColor" /> {media.averageScore}
            </span>
          )}
          {rank != null && <span className="rank-badge">#{rank}</span>}
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            {entry && (
              <span
                className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-black uppercase text-black"
                style={{ background: STATUS_META[entry.status].color }}
              >
                {statusLabel(entry.status, entry, STATUS_META[entry.status].label)}
              </span>
            )}
            {meta && <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{meta}</div>}
            <h3 className="line-clamp-2 text-sm font-extrabold leading-tight text-white">{title(media)}</h3>
            {note && <div className="mt-1 line-clamp-1 text-[10px] font-bold text-cyan">{note}</div>}
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <AddMenu media={media} compact />
      </div>
    </div>
  );
}
