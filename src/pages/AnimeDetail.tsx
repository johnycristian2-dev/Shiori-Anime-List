import { Link, useParams } from 'react-router-dom';
import { CalendarClock, ExternalLink, Heart, Palette, Play, Star, Timer, Tv, Users } from 'lucide-react';
import { themeFromColor } from '../lib/themes';
import { useEffect, useState } from 'react';
import { SectionTitle } from '../components/ui';
import type { ListEntry, ListStatus, Media } from '../types';
import { useQuery } from '@tanstack/react-query';
import Avatar from '../components/Avatar';
import { useCloudUser } from '../sync/cloud';
import { friendsWithMedia } from '../sync/social';
import { activeLists } from '../store/list';
import { useMedia } from '../api/hooks';
import AnimeRow from '../components/AnimeRow';
import EntryEditor from '../components/EntryEditor';
import { ErrorBox, Spinner } from '../components/ui';
import { STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';
import { stripHtml, useTitle } from '../lib/format';
import { FORMAT_LABEL, GENRES, MEDIA_STATUS_LABEL, RELATION_LABEL, genrePt } from '../lib/labels';
import { SEASON_LABEL } from '../lib/season';

import { t, locale } from '../lib/i18n';
import Synopsis from '../components/Synopsis';
import { isManga, mangaKind, statusLabel } from '../lib/media';

export default function AnimeDetail() {
  const id = Number(useParams().id);
  const { data: m, isLoading, error, refetch } = useMedia(id);
  const title = useTitle();
  const entry = useList((s) => s.entries[id]);
  const add = useList((s) => s.add);
  const addMany = useList((s) => s.addMany);
  const toast = useUI((s) => s.toast);
  const toggleFavorite = useList((s) => s.toggleFavorite);
  const setAnimeTheme = useUI((s) => s.setAnimeTheme);

  if (isLoading)
    return (
      <div className="grid h-[60vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (error || !m) return <ErrorBox error={error ?? new Error(t('Título não encontrado'))} onRetry={() => refetch()} />;

  const manga = isManga(m);
  // Mesma franquia no mesmo tipo; o outro tipo (anime ↔ mangá) vira "Adaptações"
  const relations = m.relations.edges.filter((e) => (e.node.type ?? 'ANIME') === (m.type ?? 'ANIME'));
  const crossovers = m.relations.edges.filter((e) => (e.node.type ?? 'ANIME') !== (m.type ?? 'ANIME'));
  const authors = (m.staff?.edges ?? []).filter((e) => /story|art|original/i.test(e.role)).slice(0, 4);
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter((x): x is NonNullable<typeof x> => !!x);
  const franchise = relations.filter((r) => ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT'].includes(r.relationType)).map((r) => r.node);
  const streaming = m.externalLinks.filter((l) => l.type === 'STREAMING');
  const tags = m.tags.filter((t) => !t.isMediaSpoiler && t.rank >= 60).slice(0, 10);
  const cover = m.coverImage.extraLarge ?? m.coverImage.large;
  const accent = m.coverImage.color ?? 'var(--pink)';

  const facts = [
    m.format && { k: t('Formato'), v: manga ? mangaKind(m) : FORMAT_LABEL[m.format] },
    !manga && m.episodes && { k: t('Episódios'), v: m.episodes },
    manga && { k: t('Capítulos'), v: m.chapters ?? (m.status === 'RELEASING' ? t('Em lançamento') : '?') },
    manga && m.volumes && { k: t('Volumes'), v: m.volumes },
    m.season && m.seasonYear && { k: t('Temporada'), v: `${SEASON_LABEL[m.season].pt} ${m.seasonYear}` },
    !m.season && m.seasonYear && { k: t('Ano'), v: m.seasonYear },
    m.status && { k: t('Situação'), v: MEDIA_STATUS_LABEL[m.status] },
  ].filter(Boolean) as { k: string; v: string | number }[];

  return (
    <>
      <div className="relative -mx-4 -mt-6 mb-8 h-56 overflow-hidden sm:h-80">
        {m.bannerImage ? (
          <img src={m.bannerImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="halftone h-full w-full" style={{ background: accent }} />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/40 to-transparent" />
        <div className="speedlines absolute inset-0 opacity-40" />
      </div>

      <div className="-mt-40 flex flex-col gap-6 sm:-mt-48 md:flex-row">
        <div className="relative z-10 mx-auto w-44 shrink-0 sm:w-56 md:mx-0">
          {cover && (
            <img
              src={cover}
              alt=""
              className="w-full rounded-2xl border-[3px] border-black"
              style={{ boxShadow: `8px 8px 0 ${accent}` }}
            />
          )}
          <div className="mt-5 grid gap-2">
            {entry ? (
              <div className="panel p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-black uppercase text-muted">
                  {t('Na sua lista')}
                  <button
                    onClick={() => toggleFavorite(id)}
                    className={entry.favorite ? 'text-pink' : 'text-muted hover:text-pink'}
                    aria-label={entry.favorite ? t('Remover dos favoritos') : t('Favoritar')}
                  >
                    <Heart size={20} fill={entry.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <EntryEditor entry={entry} compact />
                <Notes entry={entry} />
                <ListChips media={m} />
              </div>
            ) : (
              STATUS_ORDER.slice(0, 3).map((s) => (
                <button
                  key={s}
                  className="manga-btn w-full"
                  style={{ background: STATUS_META[s].color, color: '#0c0a1d' }}
                  onClick={() => {
                    add(m, s);
                    toast(`${title(m)} → ${statusLabel(s, m, STATUS_META[s].label)}`);
                  }}
                >
                  {statusLabel(s, m, STATUS_META[s].label)} <span className="font-jp text-xs">{STATUS_META[s].jp}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="relative z-10 min-w-0 flex-1 md:pt-20">
          <h1 className="stroke-title font-display text-3xl leading-tight text-white sm:text-4xl">{title(m)}</h1>
          {m.title.native && <div className="mt-1 font-jp text-lg font-bold text-muted">{m.title.native}</div>}

          <div className="mt-4 flex flex-wrap gap-2">
            {m.averageScore != null && (
              <span className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-yellow px-2 py-1 text-sm font-black text-black">
                <Star size={14} fill="currentColor" /> {m.averageScore}%
              </span>
            )}
            {m.popularity != null && (
              <span className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-cyan px-2 py-1 text-sm font-black text-black">
                <Users size={14} /> {m.popularity.toLocaleString(locale())}
              </span>
            )}
            {m.genres.map((g) => (
              <Link key={g} to={`/explorar?genero=${encodeURIComponent(g)}`} className="chip">
                {genrePt(g)} {GENRES[g] && <span className="font-jp text-[10px] opacity-60">{GENRES[g].jp}</span>}
              </Link>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.k} className="panel px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted">{f.k}</div>
                <div className="truncate font-extrabold">{f.v}</div>
              </div>
            ))}
          </div>

          {m.studios.nodes.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="text-muted">{t('Estúdio:')}</span>
              {m.studios.nodes.map((st) => (
                <Link key={st.id} to={`/estudio/${st.id}`} className="chip !border-cyan !text-cyan">
                  {st.name}
                </Link>
              ))}
            </div>
          )}

          {authors.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="text-muted">{t('Autoria:')}</span>
              {authors.map((a) => (
                <span key={`${a.node.id}-${a.role}`} className="chip !border-cyan !text-cyan" title={a.role}>
                  {a.node.name.full}
                </span>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t.name} className="rounded-md bg-panel-2 px-2 py-0.5 text-[11px] font-bold text-muted">
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          {m.nextAiringEpisode && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-cyan px-3 py-2 text-sm font-bold text-cyan">
              <CalendarClock size={16} />{' '}{t('Episódio')}{' '}{m.nextAiringEpisode.episode}{' '}{t('em')}{' '}
              {new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}

          <div className="mt-5">
            <Synopsis id={m.id} text={m.description} className="whitespace-pre-line text-sm leading-relaxed text-ink/85" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {m.trailer?.site === 'youtube' && (
              <a href={`https://www.youtube.com/watch?v=${m.trailer.id}`} target="_blank" rel="noreferrer" className="manga-btn">
                <Play size={16} />{' '}{t('Trailer')}
              </a>
            )}
            <button
              className="manga-btn cyan"
              onClick={() => {
                setAnimeTheme(themeFromColor(m.coverImage.color ?? '#ff4f9a', { id: 'anime', name: title(m), image: m.bannerImage ?? cover }));
                toast(t('Tema de {0} aplicado 🎨 — volte em Temas quando quiser trocar', title(m)));
              }}
            >
              <Palette size={16} />{' '}{t('Usar como tema')}
            </button>
            {!manga && (
              <Link to={`/maratona/${m.id}`} className="manga-btn yellow">
                <Timer size={16} />{' '}{t('Planejar maratona')}
              </Link>
            )}
            {streaming.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="manga-btn ghost" style={l.color ? { boxShadow: `4px 4px 0 ${l.color}` } : undefined}>
                <Tv size={15} /> {l.site}
              </a>
            ))}
            <a href={`https://anilist.co/${manga ? 'manga' : 'anime'}/${m.id}`} target="_blank" rel="noreferrer" className="manga-btn ghost">
              <ExternalLink size={14} />{' '}{t('AniList')}
            </a>
            {m.idMal && (
              <a href={`https://myanimelist.net/${manga ? 'manga' : 'anime'}/${m.idMal}`} target="_blank" rel="noreferrer" className="manga-btn ghost">
                <ExternalLink size={14} />{' '}{t('MyAnimeList')}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <FriendsOnMedia mediaId={m.id} manga={manga} />
        {m.characters.edges.length > 0 && (
          <section className="mb-10">
            <SectionTitle title={manga ? t('Personagens') : t('Personagens e dubladores')} jp="キャラクター" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {m.characters.edges.map((c) => {
                const va = c.voiceActors[0];
                return (
                  <div key={c.node.id} className="panel flex overflow-hidden transition hover:border-pink">
                    <Link to={`/personagem/${c.node.id}`} className="flex min-w-0 flex-1 gap-2.5 hover:text-pink">
                      <img src={c.node.image.large ?? ''} alt="" loading="lazy" className="h-24 w-16 object-cover" />
                      <div className="min-w-0 py-2.5">
                        <div className="truncate text-sm font-extrabold">{c.node.name.full}</div>
                        <div className="truncate font-jp text-xs text-muted">{c.node.name.native}</div>
                        <div className={`mt-1 text-[10px] font-black uppercase ${c.role === 'MAIN' ? 'text-pink' : 'text-muted'}`}>
                          {c.role === 'MAIN' ? t('Principal') : c.role === 'SUPPORTING' ? t('Secundário') : t('Figurante')}
                        </div>
                      </div>
                    </Link>
                    {va && (
                      <Link to={`/dublador/${va.id}`} className="flex min-w-0 flex-1 justify-end gap-2.5 text-right hover:text-cyan">
                        <div className="min-w-0 py-2.5">
                          <div className="truncate text-sm font-bold">{va.name.full}</div>
                          <div className="truncate font-jp text-xs text-muted">{va.name.native}</div>
                          <div className="mt-1 text-[10px] font-black uppercase text-cyan">{t('Dublador · JP')}</div>
                        </div>
                        {va.image.large && <img src={va.image.large} alt="" loading="lazy" className="h-24 w-16 object-cover" />}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {relations.length > 0 && (
          <AnimeRow
            title={t('Da mesma franquia')}
            jp="関連作品"
            items={relations.map((r) => r.node)}
            notes={Object.fromEntries(relations.map((r) => [r.node.id, RELATION_LABEL[r.relationType] ?? r.relationType]))}
            action={
              franchise.length > 0 && (
                <button
                  onClick={() => {
                    const n = addMany(franchise, 'PLANNING');
                    toast(n ? t('{0} da franquia adicionados em "{1}"', n, statusLabel('PLANNING', m, STATUS_META.PLANNING.label)) : t('Já estão todos na lista'), n ? 'ok' : 'info');
                  }}
                >
                  {t('+ Adicionar franquia')}
                </button>
              )
            }
          />
        )}
        {crossovers.length > 0 && (
          <AnimeRow
            title={manga ? t('Virou anime') : t('Mangá, novel e adaptações')}
            jp={manga ? 'アニメ化' : '原作'}
            items={crossovers.map((r) => r.node)}
            notes={Object.fromEntries(crossovers.map((r) => [r.node.id, RELATION_LABEL[r.relationType] ?? r.relationType]))}
          />
        )}
        {recs.length > 0 && <AnimeRow title={t('Quem curtiu, também curtiu')} jp="おすすめ" items={recs} />}
      </div>
    </>
  );
}

function Notes({ entry }: { entry: ListEntry }) {
  const update = useList((s) => s.update);
  const [text, setText] = useState(entry.notes ?? '');
  useEffect(() => {
    if (text === (entry.notes ?? '')) return;
    const t = setTimeout(() => update(entry.mediaId, { notes: text }), 500);
    return () => clearTimeout(t);
  }, [text, entry.notes, entry.mediaId, update]);
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={t('Anotações (onde parei, quem indicou…)')}
      rows={2}
      className="field mt-2 resize-y text-sm"
    />
  );
}

function ListChips({ media }: { media: Media }) {
  const listsMap = useList((s) => s.lists);
  const toggleInList = useList((s) => s.toggleInList);
  const lists = activeLists(listsMap);
  if (!lists.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted">{t('Minhas listas')}</div>
      <div className="flex flex-wrap gap-1.5">
        {lists.map((l) => (
          <button key={l.id} className={`chip !px-2 !py-1 !text-xs ${l.mediaIds.includes(media.id) ? 'on' : ''}`} onClick={() => toggleInList(l.id, media)}>
            {l.emoji} {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "3 amigos seus têm isso na lista" */
function FriendsOnMedia({ mediaId, manga }: { mediaId: number; manga: boolean }) {
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const q = useQuery({ queryKey: ['friends-media', mediaId], queryFn: () => friendsWithMedia(mediaId), enabled: logged, staleTime: 60_000 });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  const scored = rows.filter((r) => r.score > 0);
  const mean = scored.length ? (scored.reduce((n, r) => n + r.score, 0) / scored.length).toFixed(1) : null;
  return (
    <section className="mb-10">
      <SectionTitle
        title={rows.length === 1 ? t('1 amigo tem na lista') : t('{0} amigos têm na lista', rows.length)}
        jp="仲間"
        action={mean && <span className="text-yellow">{t('Nota média deles: ★ {0}', mean)}</span>}
      />
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {rows.map((r) => (
          <Link key={r.user_id} to={`/u/${r.username}`} className="panel flex w-56 shrink-0 items-center gap-3 p-3 hover:border-pink">
            <Avatar url={r.avatar_url} name={r.display_name || r.username} size={44} />
            <div className="min-w-0">
              <div className="truncate font-extrabold">{r.display_name || r.username}</div>
              <div className="text-xs font-bold" style={{ color: STATUS_META[r.status as ListStatus]?.color }}>
                {statusLabel(r.status as ListStatus, { type: manga ? 'MANGA' : 'ANIME' }, STATUS_META[r.status as ListStatus]?.label ?? r.status)}
                {r.progress > 0 && r.status !== 'COMPLETED' && ` · ${manga ? t('cap.') : t('ep')} ${r.progress}`}
              </div>
              {r.score > 0 && <div className="text-xs font-black text-yellow">★ {r.score}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
