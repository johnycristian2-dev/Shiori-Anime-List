import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Search, Send, Star, Trash2, X } from 'lucide-react';
import { useSearch } from '../api/hooks';
import { t } from '../lib/i18n';
import { useTitle } from '../lib/format';
import { isManga, mediaPath, unitShort } from '../lib/media';
import { maskProfanity } from '../lib/profanity';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { Media, MediaType } from '../types';
import { openAuth } from '../sync/account';
import { useCloudUser } from '../sync/cloud';
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  listComments,
  listPosts,
  myReview,
  setLike,
  setPostHidden,
  updatePost,
  type Post,
  type PostKind,
  type PostMedia,
  type PostPage,
} from '../sync/posts';
import { amIAdmin, type MiniProfile } from '../sync/social';
import Avatar from './Avatar';
import { displayName, ReportDialog, timeAgo } from './Social';
import { Spinner, useDebounced, useOutsideClose } from './ui';

export function toPostMedia(m: Media): PostMedia {
  return {
    id: m.id,
    title: m.title.romaji ?? m.title.english ?? m.title.native ?? '???',
    titleEnglish: m.title.english,
    cover: m.coverImage.large ?? m.coverImage.extraLarge,
    type: m.type ?? 'ANIME',
    country: m.countryOfOrigin ?? null,
  };
}

const KIND_LABEL: Record<PostKind, () => string> = {
  review: () => t('Review'),
  post: () => t('Post'),
  reaction: () => t('Reação'),
};

function useIsAdmin() {
  const user = useCloudUser((s) => s.user);
  return useQuery({ queryKey: ['is-admin', user?.id], queryFn: amIAdmin, enabled: !!user && !user.is_anonymous, staleTime: Infinity }).data === true;
}

/** Texto com palavrões mascarados (se a pessoa quiser) */
function Body({ text, className = '' }: { text: string; className?: string }) {
  const clean = useUI((s) => s.cleanText);
  return <p className={`whitespace-pre-line break-words ${className}`}>{clean ? maskProfanity(text) : text}</p>;
}

// ───────────── Escrever ─────────────
function MediaPicker({ onPick, type }: { onPick: (m: PostMedia) => void; type: MediaType }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 350);
  const r = useSearch(dq, type);
  const title = useTitle();
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-3 text-muted" />
      <input className="field pl-9 text-sm" placeholder={type === 'MANGA' ? t('De qual mangá/webtoon? (busque)') : t('De qual anime? (busque)')} value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.trim().length >= 2 && (
        <div className="panel absolute inset-x-0 top-12 z-40 max-h-64 overflow-y-auto p-1 shadow-[6px_6px_0_var(--shadow)]">
          {r.isLoading ? (
            <Spinner className="mx-auto my-3 h-5 w-5 text-pink" />
          ) : (
            (r.data?.media ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-sm font-bold hover:bg-panel-2"
                onClick={() => {
                  onPick(toPostMedia(m));
                  setQ('');
                }}
              >
                <img src={m.coverImage.large ?? ''} alt="" className="h-10 w-7 rounded object-cover" />
                <span className="truncate">{title(m)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Caixa de publicar. Na página de um título, `media` vem fixo (review, reação ou post).
 * No feed, dá pra escolher o título (opcional pro post livre).
 */
export function PostComposer({ media, onPosted }: { media?: (PostMedia & { total?: number | null }) | null; onPosted?: () => void }) {
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const toast = useUI((s) => s.toast);
  const kindPref = useUI((s) => s.kind);
  const entry = useList((s) => (media ? s.entries[media.id] : undefined));
  const [kind, setKind] = useState<PostKind>(media ? 'review' : 'post');
  const [picked, setPicked] = useState<PostMedia | null>(null);
  const target = media ?? picked;
  const [body, setBody] = useState('');
  const [score, setScore] = useState(entry?.score || 0);
  const [spoiler, setSpoiler] = useState(false);
  const [episode, setEpisode] = useState<number>(entry?.progress || 1);
  const [busy, setBusy] = useState(false);
  const existing = useQuery({ queryKey: ['my-review', target?.id], queryFn: () => myReview(target!.id), enabled: logged && !!target && kind === 'review' });
  const editing = kind === 'review' ? existing.data : null;

  useEffect(() => {
    if (editing) {
      setBody(editing.body);
      setScore(editing.score ?? 0);
      setSpoiler(editing.spoiler);
    }
  }, [editing]);

  if (!logged)
    return (
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm font-bold text-muted">
        {t('Entre para escrever reviews, posts e reações.')}
        <button className="manga-btn !py-1.5" onClick={() => openAuth('signin')}>
          {t('Entrar')}
        </button>
      </div>
    );

  const manga = target ? isManga(target) : kindPref === 'MANGA';
  const unit = manga ? t('cap.') : t('ep');
  const needsMedia = kind !== 'post';
  const ready = body.trim().length >= (kind === 'review' ? 10 : 1) && (!needsMedia || !!target) && (kind !== 'review' || score > 0);

  const submit = async () => {
    setBusy(true);
    try {
      if (editing) await updatePost(editing.id, { body, score, spoiler });
      else await createPost({ kind, body, media: target, score, spoiler: kind === 'reaction' ? true : spoiler, episode: kind === 'reaction' ? episode : null });
      toast(editing ? t('Review atualizada!') : t('Publicado!'));
      if (!editing) {
        setBody('');
        setSpoiler(false);
      }
      existing.refetch();
      onPosted?.();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['review', 'reaction', 'post'] as PostKind[]).map((k) => (
          <button key={k} type="button" className={`chip !text-xs ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {k === 'review' ? t('★ Review') : k === 'reaction' ? (manga ? t('💬 Reação ao capítulo') : t('💬 Reação ao episódio')) : t('✏️ Post livre')}
          </button>
        ))}
      </div>

      {!media && (
        target ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-panel-2 p-2 text-sm font-bold">
            {target.cover && <img src={target.cover} alt="" className="h-10 w-7 rounded object-cover" />}
            <span className="flex-1 truncate">{target.titleEnglish || target.title}</span>
            <button type="button" className="text-muted hover:text-ink" onClick={() => setPicked(null)} aria-label={t('Remover')}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <MediaPicker onPick={setPicked} type={kindPref} />
        )
      )}

      {kind === 'review' && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs font-black uppercase tracking-wider text-muted">{t('Nota')}</span>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`grid h-8 w-8 place-items-center rounded-[calc(var(--radius-sm)*0.6)] border-2 text-sm font-black transition ${n <= score ? 'border-black bg-yellow text-black' : 'border-line text-muted hover:border-yellow'}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {kind === 'reaction' && (
        <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {manga ? t('Sobre o capítulo') : t('Sobre o episódio')}
          <input type="number" min={0} max={media?.total ?? 100000} className="field !w-24 !py-1.5" value={episode} onChange={(e) => setEpisode(Math.max(0, Number(e.target.value) || 0))} />
          <span className="text-xs text-muted">{t('Quem estiver antes do {0} {1} vê com aviso de spoiler.', unit, episode)}</span>
        </label>
      )}

      <textarea
        className="field min-h-24 resize-y text-sm"
        maxLength={2000}
        placeholder={
          kind === 'review'
            ? t('O que achou? Conte sem pressa (mín. 10 letras).')
            : kind === 'reaction'
              ? t('O que você sentiu nesse episódio?')
              : t('Compartilhe uma recomendação, teoria, meme…')
        }
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {kind !== 'reaction' ? (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4 accent-[var(--pink)]" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
            {t('Tem spoiler')}
          </label>
        ) : (
          <span className="text-xs font-bold text-muted">{t('Reações sempre ficam escondidas pra quem não chegou lá.')}</span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted">{body.length}/2000</span>
          <button className="manga-btn !py-1.5" disabled={!ready || busy} onClick={submit}>
            {busy ? <Spinner className="h-4 w-4" /> : <Send size={14} />} {editing ? t('Salvar review') : t('Publicar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────── Comentários ─────────────
function Comments({ post, onCount }: { post: Post; onCount: (d: number) => void }) {
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const toast = useUI((s) => s.toast);
  const admin = useIsAdmin();
  const q = useQuery({ queryKey: ['comments', post.id], queryFn: () => listComments(post.id) });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<{ p: MiniProfile; id: number } | null>(null);
  return (
    <div className="mt-3 space-y-2 border-t-2 border-dashed border-line pt-3">
      {q.isLoading && <Spinner className="h-5 w-5 text-pink" />}
      {(q.data?.comments ?? []).map((c) => {
        const p = q.data!.profiles[c.user_id];
        const canDelete = logged && (c.user_id === user!.id || post.user_id === user!.id || admin);
        return (
          <div key={c.id} className="flex gap-2">
            <Link to={p ? `/u/${p.username}` : '#'} className="shrink-0">
              <Avatar url={p?.avatar_url} name={displayName(p)} size={28} />
            </Link>
            <div className="min-w-0 flex-1 rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <Link to={p ? `/u/${p.username}` : '#'} className="font-extrabold hover:text-pink">
                  {displayName(p)}
                </Link>
                <span className="font-bold text-muted">{timeAgo(c.created_at)}</span>
                <span className="ml-auto flex gap-2 text-muted">
                  {logged && c.user_id !== user!.id && p && (
                    <button onClick={() => setReporting({ p, id: c.id })} aria-label={t('Denunciar')} className="hover:text-red-300">
                      <Flag size={12} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      aria-label={t('Apagar')}
                      className="hover:text-red-300"
                      onClick={async () => {
                        try {
                          await deleteComment(c.id);
                          onCount(-1);
                          q.refetch();
                        } catch (e) {
                          toast((e as Error).message, 'err');
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              </div>
              <Body text={c.body} className="text-sm" />
            </div>
          </div>
        );
      })}
      {logged ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            try {
              await addComment(post.id, text);
              setText('');
              onCount(1);
              q.refetch();
            } catch (err) {
              toast((err as Error).message, 'err');
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="field !py-2 text-sm" maxLength={500} placeholder={t('Escreva um comentário…')} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="manga-btn !px-3 !py-2" disabled={busy || !text.trim()} aria-label={t('Enviar')}>
            <Send size={14} />
          </button>
        </form>
      ) : (
        <button className="text-sm font-bold text-cyan" onClick={() => openAuth('signin')}>
          {t('Entre para comentar')}
        </button>
      )}
      {reporting && <ReportDialog user={reporting.p} kind="comment" targetId={String(reporting.id)} onClose={() => setReporting(null)} />}
    </div>
  );
}

// ───────────── Um post ─────────────
export function PostCard({ post: initial, author, liked: likedInit, showMedia = true, onChanged }: { post: Post; author?: MiniProfile; liked: boolean; showMedia?: boolean; onChanged?: () => void }) {
  const [post, setPost] = useState(initial);
  const [liked, setLiked] = useState(likedInit);
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenu(false), []);
  useOutsideClose(box, menu, close);
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const mine = logged && user!.id === post.user_id;
  const admin = useIsAdmin();
  const toast = useUI((s) => s.toast);
  const title = useTitle();
  const myEntry = useList((s) => (post.media_id ? s.entries[post.media_id] : undefined));
  useEffect(() => setPost(initial), [initial]);

  const m = post.media;
  const manga = m ? isManga(m) : false;
  // Proteção de spoiler pelo seu progresso: reação ao ep. 12 fica borrada se você está no ep. 8
  const behind = post.kind === 'reaction' && post.episode != null && !mine && (!myEntry || (myEntry.status !== 'COMPLETED' && myEntry.progress < post.episode));
  const hide = (post.spoiler || behind) && !reveal && !mine;
  const mediaName = m ? title({ title: { romaji: m.title, english: m.titleEnglish ?? null, native: null }, countryOfOrigin: m.country }) : '';

  const toggleLike = async () => {
    if (!logged) return openAuth('signin');
    const on = !liked;
    setLiked(on);
    setPost((p) => ({ ...p, like_count: p.like_count + (on ? 1 : -1) }));
    try {
      await setLike(post.id, on);
    } catch (e) {
      setLiked(!on);
      setPost((p) => ({ ...p, like_count: p.like_count + (on ? -1 : 1) }));
      toast((e as Error).message, 'err');
    }
  };

  return (
    <article className={`panel p-4 ${post.hidden ? 'opacity-60' : ''}`}>
      <header className="flex items-start gap-3">
        <Link to={author ? `/u/${author.username}` : '#'} className="shrink-0">
          <Avatar url={author?.avatar_url} name={displayName(author)} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link to={author ? `/u/${author.username}` : '#'} className="font-extrabold hover:text-pink">
              {displayName(author)}
            </Link>
            <span className="chip !px-2 !py-0 !text-[10px]">{KIND_LABEL[post.kind]()}</span>
            {post.kind === 'reaction' && post.episode != null && (
              <span className="text-xs font-black text-cyan">
                {unitShort(m)} {post.episode}
              </span>
            )}
            {post.hidden && <span className="text-xs font-black text-red-300">{t('Oculto pela moderação')}</span>}
          </div>
          <div className="text-[11px] font-bold text-muted">
            {timeAgo(post.created_at)}
            {post.updated_at !== post.created_at && ` · ${t('editado')}`}
          </div>
        </div>
        {post.score != null && (
          <span className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-yellow px-2 py-0.5 text-sm font-black text-black">
            <Star size={13} fill="currentColor" /> {post.score}
          </span>
        )}
        <div className="relative" ref={box}>
          <button className="rounded-lg p-1 text-muted hover:bg-panel-2 hover:text-ink" onClick={() => setMenu((v) => !v)} aria-label={t('Mais opções')}>
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="pop-in panel absolute right-0 top-8 z-30 w-48 p-1.5 shadow-[6px_6px_0_var(--shadow)]">
              {mine && post.kind !== 'reaction' && (
                <MenuBtn icon={Pencil} label={t('Editar')} onClick={() => { close(); setEditing(true); setDraft(post.body); }} />
              )}
              {(mine || admin) && (
                <MenuBtn
                  icon={Trash2}
                  label={t('Apagar')}
                  danger
                  onClick={async () => {
                    close();
                    try {
                      await deletePost(post.id);
                      toast(t('Post apagado'));
                      onChanged?.();
                    } catch (e) {
                      toast((e as Error).message, 'err');
                    }
                  }}
                />
              )}
              {admin && !mine && (
                <MenuBtn
                  icon={post.hidden ? Eye : EyeOff}
                  label={post.hidden ? t('Mostrar de novo') : t('Ocultar (moderação)')}
                  onClick={async () => {
                    close();
                    try {
                      await setPostHidden(post.id, !post.hidden);
                      setPost((p) => ({ ...p, hidden: !p.hidden }));
                    } catch (e) {
                      toast((e as Error).message, 'err');
                    }
                  }}
                />
              )}
              {logged && !mine && author && <MenuBtn icon={Flag} label={t('Denunciar')} onClick={() => { close(); setReporting(true); }} />}
            </div>
          )}
        </div>
      </header>

      {showMedia && m && (
        <Link to={mediaPath({ id: m.id, type: m.type })} className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-panel-2 p-2 text-sm font-bold hover:text-pink">
          {m.cover && <img src={m.cover} alt="" loading="lazy" className="h-12 w-8 rounded object-cover" />}
          <span className="truncate">{mediaName}</span>
        </Link>
      )}

      <div className="relative mt-3">
        {editing ? (
          <div className="space-y-2">
            <textarea className="field min-h-24 text-sm" maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex gap-2">
              <button
                className="manga-btn !py-1.5 text-sm"
                onClick={async () => {
                  try {
                    const p = await updatePost(post.id, { body: draft });
                    setPost(p);
                    setEditing(false);
                  } catch (e) {
                    toast((e as Error).message, 'err');
                  }
                }}
              >
                {t('Salvar')}
              </button>
              <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => setEditing(false)}>
                {t('Cancelar')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Body text={post.body} className={`text-sm leading-relaxed ${hide ? 'pointer-events-none select-none blur-md' : ''}`} />
            {hide && (
              <div className="absolute inset-0 grid place-items-center">
                <button className="manga-btn yellow !py-1.5 text-sm" onClick={() => setReveal(true)}>
                  <Eye size={14} />
                  {behind
                    ? myEntry
                      ? t('Spoiler do {0} {1} — você está no {0} {2}. Mostrar?', manga ? t('cap.') : t('ep'), post.episode ?? '', myEntry.progress)
                      : t('Spoiler do {0} {1}. Mostrar?', manga ? t('cap.') : t('ep'), post.episode ?? '')
                    : t('Tem spoiler. Mostrar?')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="mt-3 flex items-center gap-4 text-sm font-bold text-muted">
        <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 transition hover:text-pink ${liked ? 'text-pink' : ''}`} aria-pressed={liked}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {post.like_count}
        </button>
        <button onClick={() => setOpen((v) => !v)} className={`inline-flex items-center gap-1.5 hover:text-cyan ${open ? 'text-cyan' : ''}`}>
          <MessageCircle size={16} /> {post.comment_count}
        </button>
      </footer>
      {open && <Comments post={post} onCount={(d) => setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count + d) }))} />}
      {reporting && author && <ReportDialog user={author} kind="post" targetId={String(post.id)} onClose={() => setReporting(false)} />}
    </article>
  );
}

function MenuBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-panel-2 ${danger ? 'text-red-300' : ''}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

// ───────────── Lista ─────────────
export function PostList({
  queryKey,
  load,
  showMedia = true,
  empty,
}: {
  queryKey: unknown[];
  load: (before?: string) => Promise<PostPage>;
  showMedia?: boolean;
  empty: React.ReactNode;
}) {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => load(pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => (last.posts.length >= 20 ? last.posts[last.posts.length - 1].created_at : undefined),
  });
  if (q.isLoading) return <Spinner className="mx-auto my-6 h-7 w-7 text-pink" />;
  if (q.error) return <p className="panel p-4 text-sm font-bold text-red-300">{(q.error as Error).message}</p>;
  const items = (q.data?.pages ?? []).flatMap((p) => p.posts.map((post) => ({ post, author: p.profiles[post.user_id], liked: p.liked.has(post.id) })));
  if (!items.length) return <>{empty}</>;
  return (
    <div className="space-y-3">
      {items.map(({ post, author, liked }) => (
        <PostCard key={post.id} post={post} author={author} liked={liked} showMedia={showMedia} onChanged={() => qc.invalidateQueries({ queryKey })} />
      ))}
      {q.hasNextPage && (
        <button className="manga-btn ghost mx-auto flex" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : t('Carregar mais')}
        </button>
      )}
    </div>
  );
}

/** Seção "Reviews e reações" da página de um anime/mangá */
export function MediaPosts({ media }: { media: Media }) {
  const qc = useQueryClient();
  const pm = { ...toPostMedia(media), total: isManga(media) ? media.chapters : media.episodes };
  const key = ['posts', 'media', media.id];
  return (
    <div className="space-y-4">
      <PostComposer media={pm} onPosted={() => qc.invalidateQueries({ queryKey: key })} />
      <PostList
        queryKey={key}
        load={(before) => listPosts({ mediaId: media.id, before })}
        showMedia={false}
        empty={<p className="panel p-6 text-center text-sm font-bold text-muted">{t('Ninguém escreveu ainda. Seja a primeira review!')}</p>}
      />
    </div>
  );
}
