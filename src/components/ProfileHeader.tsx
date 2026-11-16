import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { t } from '../lib/i18n';
import Avatar from './Avatar';

export interface HeaderFavorite {
  id: number;
  title: string;
  cover: string | null;
}

/** Cabeçalho de perfil: banner, foto, nome, @apelido, bio, rank e anime favorito. */
export default function ProfileHeader({
  name,
  username,
  avatar,
  banner,
  bio,
  rank,
  favorite,
  actions,
  children,
}: {
  name: ReactNode;
  username?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bio?: string | null;
  rank?: { name: string; jp: string };
  favorite?: HeaderFavorite | null;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const initialName = typeof name === 'string' ? name : username;
  return (
    <section className="relative mb-8 overflow-hidden rounded-[calc(var(--radius)*1.3)] border-[3px] border-black bg-panel shadow-[8px_8px_0_var(--pink)]">
      {/* Banner */}
      <div className="halftone relative h-36 overflow-hidden bg-panel-2 sm:h-52">
        {banner ? (
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="speedlines absolute inset-0 opacity-60" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-panel via-transparent to-transparent" />
        {rank && <div className="absolute -right-3 -top-6 font-jp text-[120px] font-black leading-none text-white/15 mix-blend-overlay">{rank.jp}</div>}
      </div>

      <div className="relative px-5 pb-6 sm:px-8">
        <div className="-mt-14 flex flex-wrap items-end gap-4 sm:-mt-16">
          <Avatar url={avatar} name={initialName} size={112} className="!border-[3px] shadow-[5px_5px_0_#000] max-sm:!h-24 max-sm:!w-24" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="section-title truncate font-display text-3xl leading-tight">{name}</h1>
            {username && <div className="text-sm font-bold text-muted">@{username}</div>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 pb-1">{actions}</div>}
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            {rank && (
              <div className="font-jp text-lg font-black text-pink">
                {rank.jp} · <span className="font-display text-ink">{rank.name}</span>
              </div>
            )}
            {bio && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-ink/85">{bio}</p>}
            {children}
          </div>
          {favorite && (
            <Link to={`/anime/${favorite.id}`} className="group flex items-center gap-3 self-start rounded-[var(--radius-sm)] border-2 border-line bg-panel-2 p-2 pr-4 transition hover:border-pink">
              {favorite.cover && <img src={favorite.cover} alt="" className="h-16 w-11 rounded-md border-2 border-black object-cover" />}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-pink">
                  <Heart size={11} fill="currentColor" /> {t('Anime favorito')}
                </div>
                <div className="max-w-48 truncate text-sm font-extrabold group-hover:text-pink">{favorite.title}</div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
