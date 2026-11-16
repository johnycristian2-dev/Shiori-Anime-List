import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { EmptyState, ErrorBox, SectionTitle, Spinner, useDebounced } from '../components/ui';
import { ActivityItem, SocialActions, timeAgo, UserLink } from '../components/Social';
import { PostCard, PostComposer } from '../components/Posts';
import { listPosts, type Post } from '../sync/posts';
import { mediaPath } from '../lib/media';
import { t } from '../lib/i18n';
import { CLOUD_ENABLED } from '../lib/supabase';
import { useUI } from '../store/ui';
import { openAuth } from '../sync/account';
import { useCloudUser } from '../sync/cloud';
import {
  acceptRequest,
  loadFeed,
  loadNotifications,
  markAllRead,
  myConnections,
  removeFollower,
  searchProfiles,
  useSocial,
  type Activity,
  type MiniProfile,
} from '../sync/social';

type Tab = 'feed' | 'friends' | 'requests' | 'following' | 'followers' | 'alerts' | 'search';

type FeedItem = { at: string; activity?: Activity; post?: Post; author?: MiniProfile; liked?: boolean };

/** Linha do tempo: atividades automáticas + posts de quem você segue, misturados por data */
async function loadTimeline(before?: string) {
  const act = await loadFeed(before);
  const posts = await listPosts({ userIds: act.ids, before, limit: 20 });
  const items: FeedItem[] = [
    ...act.items.map((a) => ({ at: a.created_at, activity: a, author: act.profiles[a.user_id] })),
    ...posts.posts.map((p) => ({ at: p.created_at, post: p, author: posts.profiles[p.user_id], liked: posts.liked.has(p.id) })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));
  // Pagina pelo mais antigo que ainda cabe nas duas listas
  const full = act.items.length === 30 || posts.posts.length === 20;
  const cut = full ? [act.items.length === 30 ? act.items[29].created_at : '', posts.posts.length === 20 ? posts.posts[19].created_at : ''].filter(Boolean).sort().reverse()[0] : undefined;
  return { items: cut ? items.filter((i) => i.at >= cut) : items, next: cut, followingCount: act.followingCount };
}

function Feed() {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => loadTimeline(pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.next,
    refetchInterval: 60_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['feed'] });
  const pages = q.data?.pages ?? [];
  const seen = new Set<string>();
  const items = pages
    .flatMap((p) => p.items)
    .filter((i) => {
      const k = i.post ? `p${i.post.id}` : `a${i.activity!.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return (
    <div className="space-y-3">
      <PostComposer onPosted={refresh} />
      {q.isLoading ? (
        <Center />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState jp="静か" title={pages[0]?.followingCount ? t('Nada por aqui ainda') : t('Seu feed começa quando você segue alguém')}>
          <p className="text-sm text-muted">{t('Quando seus amigos começarem, terminarem ou derem nota em algo, aparece aqui.')}</p>
        </EmptyState>
      ) : (
        <>
          {items.map((i) =>
            i.post ? (
              <PostCard key={`p${i.post.id}`} post={i.post} author={i.author} liked={!!i.liked} onChanged={refresh} />
            ) : (
              <ActivityItem key={`a${i.activity!.id}`} a={i.activity!} p={i.author} onDeleted={refresh} />
            ),
          )}
          {q.hasNextPage && (
            <button className="manga-btn ghost mx-auto flex" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : t('Carregar mais')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PeopleList({ ids, profiles, empty, extra }: { ids: string[]; profiles: Record<string, MiniProfile>; empty: string; extra?: (id: string) => React.ReactNode }) {
  if (!ids.length) return <p className="panel p-6 text-center text-sm font-bold text-muted">{empty}</p>;
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {ids.map((id) => {
        const p = profiles[id];
        return (
          <div key={id} className="panel flex flex-wrap items-center justify-between gap-3 p-3">
            <UserLink p={p} />
            <div className="flex items-center gap-2">{extra ? extra(id) : p && <SocialActions user={p} />}</div>
          </div>
        );
      })}
    </div>
  );
}

function Alerts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: loadNotifications });
  useEffect(() => {
    if (q.data?.items.some((n) => !n.read)) markAllRead().catch(() => undefined);
  }, [q.data]);
  if (q.isLoading) return <Center />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="panel p-6 text-center text-sm font-bold text-muted">{t('Nenhuma notificação por enquanto.')}</p>;
  return (
    <div className="space-y-2">
      {items.map((n) => {
        const p = n.actor ? q.data!.profiles[n.actor] : undefined;
        const post = n.post_id ? q.data!.posts[n.post_id] : undefined;
        const text =
          n.kind === 'follow'
            ? t('começou a seguir você')
            : n.kind === 'request'
              ? t('quer seguir você')
              : n.kind === 'like'
                ? t('curtiu seu post')
                : n.kind === 'comment'
                  ? t('comentou no seu post')
                  : t('aceitou seu pedido');
        return (
          <div key={n.id} className={`panel flex flex-wrap items-center gap-3 p-3 ${n.read ? '' : 'border-pink!'}`}>
            <UserLink p={p} size={36} />
            <span className="text-sm text-muted">
              {text}
              {post && (
                <>
                  {' '}
                  {post.media_id ? (
                    <Link to={mediaPath({ id: post.media_id, type: post.media?.type })} className="font-bold text-ink hover:text-pink">
                      “{post.body.slice(0, 50)}{post.body.length > 50 ? '…' : ''}”
                    </Link>
                  ) : (
                    <span className="font-bold text-ink">“{post.body.slice(0, 50)}{post.body.length > 50 ? '…' : ''}”</span>
                  )}
                </>
              )}
            </span>
            <span className="ml-auto text-[11px] font-bold text-muted">{timeAgo(n.created_at)}</span>
            {n.kind === 'request' && n.actor && (
              <RequestButtons
                id={n.actor}
                onDone={() => {
                  qc.invalidateQueries({ queryKey: ['notifications'] });
                  qc.invalidateQueries({ queryKey: ['connections'] });
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestButtons({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-2">
      <button className="manga-btn !py-1.5 text-sm" disabled={busy} onClick={() => run(() => acceptRequest(id), t('Pedido aceito!'))}>
        <Check size={14} /> {t('Aceitar')}
      </button>
      <button className="manga-btn ghost !py-1.5 text-sm" disabled={busy} onClick={() => run(() => removeFollower(id), t('Pedido recusado'))}>
        <X size={14} /> {t('Recusar')}
      </button>
    </div>
  );
}

function SearchPeople() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 400);
  const r = useQuery({ queryKey: ['people', dq], queryFn: () => searchProfiles(dq), enabled: dq.length >= 2 });
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="field !py-3 pl-10 text-base" autoFocus placeholder={t('Buscar pessoas pelo apelido ou nome…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {dq.length < 2 ? (
        <p className="text-sm text-muted">{t('Dica: mande o link do seu perfil para os amigos, eles podem seguir você direto por ele.')}</p>
      ) : r.isLoading ? (
        <Center />
      ) : (
        <PeopleList ids={(r.data ?? []).map((p) => p.user_id)} profiles={Object.fromEntries((r.data ?? []).map((p) => [p.user_id, p]))} empty={t('Ninguém encontrado com esse nome.')} />
      )}
    </div>
  );
}

const Center = () => (
  <div className="grid h-40 place-items-center">
    <Spinner className="h-8 w-8 text-pink" />
  </div>
);

export default function Friends() {
  const user = useCloudUser((s) => s.user);
  const ready = useCloudUser((s) => s.ready);
  const unread = useSocial((s) => s.unread);
  const pending = useSocial((s) => s.requests);
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('aba') as Tab) || 'feed';
  const setTab = (x: Tab) => setSp(x === 'feed' ? {} : { aba: x }, { replace: true });
  const logged = !!user && !user.is_anonymous;
  const qc = useQueryClient();
  const conns = useQuery({ queryKey: ['connections'], queryFn: myConnections, enabled: logged });

  const tabs = useMemo(
    () =>
      [
        { id: 'feed', label: t('Feed') },
        { id: 'friends', label: t('Amigos'), n: conns.data?.friends.length },
        { id: 'requests', label: t('Pedidos'), n: pending || undefined, hot: pending > 0 },
        { id: 'following', label: t('Seguindo'), n: conns.data?.following.length },
        { id: 'followers', label: t('Seguidores'), n: conns.data?.followers.length },
        { id: 'alerts', label: t('Notificações'), n: unread || undefined, hot: unread > 0 },
        { id: 'search', label: t('Buscar pessoas') },
      ] as { id: Tab; label: string; n?: number; hot?: boolean }[],
    [conns.data, pending, unread],
  );

  if (!CLOUD_ENABLED || (ready && !logged))
    return (
      <>
        <SectionTitle title={t('Amigos')} jp="仲間" />
        <EmptyState jp="仲間" title={t('Entre para seguir amigos e ver o que eles assistem')}>
          <button className="manga-btn mt-4" onClick={() => openAuth('signup')}>
            <UserPlus size={16} /> {t('Entrar ou criar conta')}
          </button>
        </EmptyState>
      </>
    );
  if (!ready) return <Center />;

  const c = conns.data;
  return (
    <>
      <SectionTitle title={t('Amigos')} jp="仲間" action={<Link to="/perfil/editar#privacidade">{t('Privacidade →')}</Link>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button key={x.id} className={`chip ${tab === x.id ? 'on' : ''}`} onClick={() => setTab(x.id)}>
            {x.id === 'alerts' && <Bell size={13} />}
            {x.id === 'search' && <Search size={13} />}
            {x.id === 'friends' && <Users size={13} />}
            {x.label}
            {x.n != null && <span className={`rounded-full px-1.5 text-[10px] font-black ${x.hot ? 'bg-pink text-[var(--on-pink)]' : 'opacity-70'}`}>{x.n}</span>}
          </button>
        ))}
      </div>

      {tab === 'feed' && <Feed />}
      {tab === 'alerts' && <Alerts />}
      {tab === 'search' && <SearchPeople />}
      {['friends', 'requests', 'following', 'followers'].includes(tab) &&
        (conns.isLoading ? (
          <Center />
        ) : conns.error ? (
          <ErrorBox error={conns.error} onRetry={() => conns.refetch()} />
        ) : c ? (
          tab === 'friends' ? (
            <PeopleList ids={c.friends} profiles={c.profiles} empty={t('Amigos são pessoas que seguem você de volta. Comece buscando alguém!')} />
          ) : tab === 'requests' ? (
            <>
              <PeopleList
                ids={c.requests}
                profiles={c.profiles}
                empty={t('Nenhum pedido pendente.')}
                extra={(id) => <RequestButtons id={id} onDone={() => qc.invalidateQueries({ queryKey: ['connections'] })} />}
              />
              {c.sent.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{t('Pedidos que você enviou')}</h3>
                  <PeopleList ids={c.sent} profiles={c.profiles} empty="" />
                </div>
              )}
            </>
          ) : tab === 'following' ? (
            <PeopleList ids={c.following} profiles={c.profiles} empty={t('Você ainda não segue ninguém.')} />
          ) : (
            <PeopleList ids={c.followers} profiles={c.profiles} empty={t('Ninguém segue você ainda. Compartilhe o link do seu perfil!')} />
          )
        ) : null)}

      <p className="mt-8 flex items-start gap-2 text-xs font-bold text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        {t('Perfis privados e de menores de 18 anos só aparecem para quem foi aceito. Você pode bloquear ou denunciar qualquer pessoa pelo menu ⋯ do perfil.')}
      </p>
    </>
  );
}
