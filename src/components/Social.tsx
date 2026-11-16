import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Clock, Flag, MoreHorizontal, Trash2, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import { t, locale } from '../lib/i18n';
import { useTitle } from '../lib/format';
import { mediaPath } from '../lib/media';
import { useUI } from '../store/ui';
import { openAuth } from '../sync/account';
import { useCloudUser } from '../sync/cloud';
import {
  block,
  deleteActivity,
  follow,
  followCounts,
  getRelation,
  removeFollower,
  REPORT_REASONS,
  report,
  unblock,
  unfollow,
  type Activity,
  type MiniProfile,
  type ReportReason,
} from '../sync/social';
import Avatar from './Avatar';
import { Spinner, useOutsideClose } from './ui';

/** "há 5 min", "há 2 h", "ontem"… */
export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.max(1, Math.round(diff)), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export const displayName = (p?: MiniProfile | null) => p?.display_name || p?.username || t('Alguém');

export function UserLink({ p, size = 40, sub }: { p?: MiniProfile | null; size?: number; sub?: React.ReactNode }) {
  const inner = (
    <>
      <Avatar url={p?.avatar_url} name={displayName(p)} size={size} />
      <div className="min-w-0">
        <div className="truncate font-extrabold leading-tight">{displayName(p)}</div>
        <div className="truncate text-xs font-bold text-muted">{p ? `@${p.username}` : ''}{sub && <> · {sub}</>}</div>
      </div>
    </>
  );
  return p ? (
    <Link to={`/u/${p.username}`} className="flex min-w-0 items-center gap-2.5 hover:text-pink">
      {inner}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-2.5">{inner}</div>
  );
}

/** Seguidores · seguindo · amigos */
export function FollowCounts({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ['follow-counts', userId], queryFn: () => followCounts(userId), staleTime: 30_000 });
  if (!q.data) return null;
  const items = [
    { n: q.data.followers, l: t('seguidores') },
    { n: q.data.following, l: t('seguindo') },
    { n: q.data.friends, l: t('amigos') },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((i) => (
        <span key={i.l}>
          <b className="font-display">{i.n}</b> <span className="font-bold text-muted">{i.l}</span>
        </span>
      ))}
    </div>
  );
}

/** Botão Seguir (ou Pedido enviado / Seguindo / Amigos) + menu com bloquear e denunciar */
export function SocialActions({ user, onBlocked }: { user: MiniProfile; onBlocked?: () => void }) {
  const me = useCloudUser((s) => s.user);
  const logged = !!me && !me.is_anonymous;
  const self = me?.id === user.user_id;
  const qc = useQueryClient();
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenu(false), []);
  useOutsideClose(box, menu, close);
  const rel = useQuery({ queryKey: ['relation', user.user_id], queryFn: () => getRelation(user.user_id), enabled: logged && !self });

  if (self) return null;
  if (!logged)
    return (
      <button className="manga-btn" onClick={() => openAuth('signin')}>
        <UserPlus size={16} /> {t('Seguir')}
      </button>
    );

  const r = rel.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['relation', user.user_id] });
    qc.invalidateQueries({ queryKey: ['follow-counts', user.user_id] });
    qc.invalidateQueries({ queryKey: ['connections'] });
  };
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const friends = r?.following === 'accepted' && r.followsMe === 'accepted';
  let main;
  if (!r) main = <Spinner className="h-5 w-5 text-pink" />;
  else if (r.blocked)
    main = (
      <button className="manga-btn ghost" disabled={busy} onClick={() => act(() => unblock(user.user_id), t('Desbloqueado'))}>
        <Ban size={16} /> {t('Desbloquear')}
      </button>
    );
  else if (r.following === 'none')
    main = (
      <button
        className="manga-btn"
        disabled={busy}
        onClick={() =>
          act(async () => {
            const st = await follow(user.user_id);
            toast(st === 'pending' ? t('Pedido enviado para {0}', displayName(user)) : t('Agora você segue {0}', displayName(user)));
          })
        }
      >
        <UserPlus size={16} /> {r.followsMe === 'accepted' ? t('Seguir de volta') : t('Seguir')}
      </button>
    );
  else
    main = (
      <button
        className="manga-btn ghost group"
        disabled={busy}
        title={t('Clique para deixar de seguir')}
        onClick={() => act(() => unfollow(user.user_id), r.following === 'pending' ? t('Pedido cancelado') : t('Você deixou de seguir {0}', displayName(user)))}
      >
        {r.following === 'pending' ? <Clock size={16} /> : friends ? <UserCheck size={16} /> : <Check size={16} />}
        <span className="group-hover:hidden">{r.following === 'pending' ? t('Pedido enviado') : friends ? t('Amigos') : t('Seguindo')}</span>
        <span className="hidden group-hover:inline">{r.following === 'pending' ? t('Cancelar pedido') : t('Deixar de seguir')}</span>
      </button>
    );

  return (
    <div className="relative flex items-center gap-2" ref={box}>
      {r?.followsMe === 'accepted' && !friends && <span className="chip !py-0.5 !text-[11px]">{t('Segue você')}</span>}
      {main}
      <button className="manga-btn ghost !p-2" onClick={() => setMenu((v) => !v)} aria-label={t('Mais opções')}>
        <MoreHorizontal size={18} />
      </button>
      {menu && (
        <div className="pop-in panel absolute right-0 top-12 z-50 w-56 p-1.5 shadow-[6px_6px_0_var(--shadow)]">
          {r?.followsMe !== 'none' && r && (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-panel-2"
              onClick={() => {
                close();
                act(() => removeFollower(user.user_id), t('Removido dos seus seguidores'));
              }}
            >
              <UserMinus size={15} /> {t('Remover dos meus seguidores')}
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-panel-2"
            onClick={() => {
              close();
              setReporting(true);
            }}
          >
            <Flag size={15} /> {t('Denunciar')}
          </button>
          {!r?.blocked && (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-300 hover:bg-panel-2"
              onClick={() => {
                close();
                act(async () => {
                  await block(user.user_id);
                  onBlocked?.();
                }, t('{0} foi bloqueado. Vocês não se veem mais no Shiori.', displayName(user)));
              }}
            >
              <Ban size={15} /> {t('Bloquear')}
            </button>
          )}
        </div>
      )}
      {reporting && <ReportDialog user={user} kind="profile" onClose={() => setReporting(false)} />}
    </div>
  );
}

export function ReportDialog({ user, kind, targetId, onClose }: { user: MiniProfile; kind: 'profile' | 'activity'; targetId?: string; onClose: () => void }) {
  const toast = useUI((s) => s.toast);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="panel pop-in w-full max-w-md space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title font-display text-xl">{t('Denunciar')}</h2>
            <p className="text-sm text-muted">{t('A denúncia é anônima: {0} não fica sabendo quem denunciou.', displayName(user))}</p>
          </div>
          <button className="manga-btn ghost !p-1.5" onClick={onClose} aria-label={t('Fechar')}>
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button key={r.id} className={`chip justify-start !text-sm ${reason === r.id ? 'on' : ''}`} onClick={() => setReason(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <textarea className="field min-h-20 text-sm" maxLength={500} placeholder={t('Detalhes (opcional)')} value={details} onChange={(e) => setDetails(e.target.value)} />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--pink)]" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
          {t('Bloquear também')}
        </label>
        {reason === 'minor_safety' && <p className="rounded-[var(--radius-sm)] border-2 border-yellow/60 p-2 text-xs font-bold text-yellow">{t('Se alguém estiver em perigo agora, ligue 190. Denúncias de abuso infantil também podem ser feitas no Disque 100.')}</p>}
        <button
          className="manga-btn w-full justify-center"
          disabled={!reason || busy}
          onClick={async () => {
            if (!reason) return;
            setBusy(true);
            try {
              await report({ targetUser: user.user_id, kind, targetId, reason, details });
              if (alsoBlock) await block(user.user_id);
              toast(t('Denúncia enviada. Obrigado por ajudar a manter o Shiori seguro.'));
              onClose();
            } catch (e) {
              toast((e as Error).message, 'err');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner className="h-4 w-4" /> : <Flag size={16} />} {t('Enviar denúncia')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Uma linha do feed: "Fulano terminou Frieren" */
export function ActivityItem({ a, p, onDeleted }: { a: Activity; p?: MiniProfile; onDeleted?: () => void }) {
  const me = useCloudUser((s) => s.user);
  const title = useTitle();
  const toast = useUI((s) => s.toast);
  const [reporting, setReporting] = useState(false);
  const mine = me?.id === a.user_id;
  const manga = a.media.type === 'MANGA';
  const name = title({ title: { romaji: a.media.title, english: a.media.titleEnglish ?? null, native: null }, countryOfOrigin: a.media.country });
  const verb =
    a.kind === 'done'
      ? manga
        ? t('terminou de ler')
        : t('terminou')
      : a.kind === 'score'
        ? t('deu nota ★ {0} para', a.value ?? '')
        : a.kind === 'progress'
          ? manga
            ? t('leu até o cap. {0} de', a.value ?? '')
            : t('assistiu até o ep. {0} de', a.value ?? '')
          : a.status === 'WATCHING'
            ? manga
              ? t('começou a ler')
              : t('começou a ver')
            : a.status === 'COMPLETED'
              ? manga
                ? t('já leu')
                : t('já viu')
              : manga
                ? t('quer ler')
                : t('quer ver');
  return (
    <div className="panel flex gap-3 p-3">
      <Link to={p ? `/u/${p.username}` : '#'} className="shrink-0">
        <Avatar url={p?.avatar_url} name={displayName(p)} size={40} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <Link to={p ? `/u/${p.username}` : '#'} className="font-extrabold hover:text-pink">
            {mine ? t('Você') : displayName(p)}
          </Link>{' '}
          <span className="text-muted">{verb}</span>{' '}
          <Link to={mediaPath({ id: a.media_id, type: a.media.type })} className="font-extrabold hover:text-pink">
            {name}
          </Link>
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] font-bold text-muted">
          <span>{timeAgo(a.created_at)}</span>
          {mine ? (
            <button
              className="inline-flex items-center gap-1 hover:text-red-300"
              onClick={async () => {
                try {
                  await deleteActivity(a.id);
                  onDeleted?.();
                } catch (e) {
                  toast((e as Error).message, 'err');
                }
              }}
            >
              <Trash2 size={11} /> {t('Apagar')}
            </button>
          ) : (
            p && (
              <button className="inline-flex items-center gap-1 hover:text-red-300" onClick={() => setReporting(true)}>
                <Flag size={11} /> {t('Denunciar')}
              </button>
            )
          )}
        </div>
      </div>
      <Link to={mediaPath({ id: a.media_id, type: a.media.type })} className="shrink-0">
        {a.media.cover ? <img src={a.media.cover} alt="" loading="lazy" className="h-16 w-11 rounded-md border-2 border-black object-cover" /> : <div className="halftone h-16 w-11 rounded-md" />}
      </Link>
      {reporting && p && <ReportDialog user={p} kind="activity" targetId={String(a.id)} onClose={() => setReporting(false)} />}
    </div>
  );
}
