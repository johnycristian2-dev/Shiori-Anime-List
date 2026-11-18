import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Badges from '../components/Badges';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, Ban, CornerUpLeft, Eye, EyeOff, Flag, Lock, MessageSquareOff, Send, ShieldAlert, Trash2, Users, VolumeX, X } from 'lucide-react';
import { useMedia } from '../api/hooks';
import Avatar from '../components/Avatar';
import { displayName, ReportDialog } from '../components/Social';
import { ErrorBox, Spinner } from '../components/ui';
import { pickTitle, useTitle, coverOf } from '../lib/format';
import { t, locale } from '../lib/i18n';
import { isManga, mediaPath, totalUnits } from '../lib/media';
import { maskProfanity } from '../lib/profanity';
import { SEASON_LABEL } from '../lib/season';
import { CLOUD_ENABLED } from '../lib/supabase';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { Season } from '../types';
import { openAuth } from '../sync/account';
import {
  authors,
  deleteMessage,
  ensureRoom,
  getRoom,
  joinRoom,
  loadMessages,
  muteUser,
  myChatStatus,
  sendMessage,
  setMessageHidden,
  type ChatMessage,
  type PresenceUser,
  type RoomMedia,
} from '../sync/chat';
import { useCloudUser } from '../sync/cloud';
import { amIAdmin, type MiniProfile } from '../sync/social';

function useRoomInfo(roomId: string) {
  const mediaId = roomId.startsWith('media:') ? Number(roomId.slice(6)) : NaN;
  const media = useMedia(mediaId);
  const title = useTitle();
  if (roomId === 'geral') return { title: t('Sala Geral'), sub: t('Papo livre sobre anime, mangá e tudo mais'), jp: '雑談', media: null as RoomMedia | null, loading: false, error: null };
  if (roomId.startsWith('season:')) {
    const [season, year] = roomId.slice(7).split('-') as [Season, string];
    return { title: t('Temporada {0} {1}', SEASON_LABEL[season]?.pt ?? season, year), sub: t('Tudo que está passando nesta temporada'), jp: '今期', media: null, loading: false, error: null };
  }
  const m = media.data;
  const rm: RoomMedia | null = m
    ? {
        id: m.id,
        title: m.title.romaji ?? m.title.english ?? '???',
        titleEnglish: m.title.english,
        cover: coverOf(m),
        type: m.type ?? 'ANIME',
        country: m.countryOfOrigin ?? null,
        total: totalUnits(m),
      }
    : null;
  return { title: m ? title(m) : '…', sub: m ? (isManga(m) ? t('Chat do mangá') : t('Chat do anime')) : '', jp: 'チャット', media: rm, loading: media.isLoading, error: media.error };
}

function timeShort(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Message({
  m,
  author,
  reply,
  mine,
  admin,
  myProgress,
  manga,
  grouped,
  onReply,
  onReport,
  onRemoved,
}: {
  m: ChatMessage;
  author?: MiniProfile;
  reply?: { m: ChatMessage; author?: MiniProfile };
  mine: boolean;
  admin: boolean;
  myProgress: number | null;
  manga: boolean;
  grouped: boolean;
  onReply: () => void;
  onReport: () => void;
  onRemoved: () => void;
}) {
  const clean = useUI((s) => s.cleanText);
  const toast = useUI((s) => s.toast);
  const [reveal, setReveal] = useState(false);
  const behind = m.episode != null && (myProgress == null || myProgress < m.episode);
  const hide = !mine && !reveal && (behind || (m.spoiler && m.episode == null));
  const unit = manga ? t('cap.') : t('ep');
  const text = clean ? maskProfanity(m.body) : m.body;
  const act = async (fn: () => Promise<void>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <div className={`group relative flex gap-2.5 rounded-[var(--radius-sm)] px-2 hover:bg-panel-2/60 ${grouped ? 'py-0.5' : 'mt-2 py-1'} ${m.hidden ? 'opacity-50' : ''}`}>
      <div className="w-9 shrink-0">
        {!grouped && (
          <Link to={author ? `/u/${author.username}` : '#'}>
            <Avatar url={author?.avatar_url} name={displayName(author)} size={36} />
          </Link>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2 text-sm">
            <Link to={author ? `/u/${author.username}` : '#'} className={`font-extrabold hover:underline ${mine ? 'text-pink' : ''}`}>
              {displayName(author)}
            </Link>
            <Badges userId={author?.user_id} />
            <span className="text-[10px] font-bold text-muted">{timeShort(m.created_at)}</span>
          </div>
        )}
        {reply && (
          <div className="mb-0.5 truncate border-l-2 border-pink/60 pl-2 text-xs text-muted">
            <CornerUpLeft size={11} className="mr-1 inline" />
            <b>{displayName(reply.author)}</b>: {reply.m.body.slice(0, 80)}
          </div>
        )}
        <div className="relative">
          <p className={`whitespace-pre-line break-words text-sm leading-relaxed ${hide ? 'select-none blur-sm' : ''}`}>{text}</p>
          {hide && (
            <button className="absolute inset-0 flex items-center gap-1.5 text-xs font-black text-yellow" onClick={() => setReveal(true)}>
              <Eye size={13} />
              {m.episode != null
                ? myProgress != null
                  ? t('Spoiler do {0} {1} (você está no {2}) · mostrar', unit, m.episode, myProgress)
                  : t('Spoiler do {0} {1} · mostrar', unit, m.episode)
                : t('Spoiler · mostrar')}
            </button>
          )}
          {!hide && m.episode != null && <span className="text-[10px] font-black text-yellow">⚠ {t('spoiler até o {0} {1}', unit, m.episode)}</span>}
        </div>
      </div>
      <div className="absolute -top-3 right-2 hidden gap-0.5 rounded-lg border-2 border-line bg-panel p-0.5 shadow group-hover:flex">
        <IconBtn icon={CornerUpLeft} label={t('Responder')} onClick={onReply} />
        {!mine && author && <IconBtn icon={Flag} label={t('Denunciar')} onClick={onReport} />}
        {(mine || admin) && <IconBtn icon={Trash2} label={t('Apagar')} onClick={() => act(async () => { await deleteMessage(m.id); onRemoved(); })} />}
        {admin && !mine && (
          <>
            <IconBtn icon={m.hidden ? Eye : EyeOff} label={m.hidden ? t('Mostrar de novo') : t('Ocultar para todos')} onClick={() => act(() => setMessageHidden(m.id, !m.hidden))} />
            <IconBtn icon={VolumeX} label={t('Silenciar 24 h')} onClick={() => act(() => muteUser(m.user_id, 24, 'chat'), t('{0} silenciado por 24 h', displayName(author)))} />
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick }: { icon: typeof Flag; label: string; onClick: () => void }) {
  return (
    <button className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-ink" title={label} aria-label={label} onClick={onClick}>
      <Icon size={14} />
    </button>
  );
}

export default function ChatRoom() {
  const roomId = decodeURIComponent(useParams().roomId ?? 'geral');
  const info = useRoomInfo(roomId);
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const toast = useUI((s) => s.toast);
  const lang = useUI((s) => s.titleLang);
  const entry = useList((s) => (info.media ? s.entries[info.media.id] : undefined));
  const myProgress = info.media ? (entry ? (entry.status === 'COMPLETED' ? Infinity : entry.progress) : null) : null;
  const manga = info.media ? isManga(info.media) : false;
  const admin = useQuery({ queryKey: ['is-admin', user?.id], queryFn: amIAdmin, enabled: logged, staleTime: Infinity }).data === true;
  const status = useQuery({ queryKey: ['chat-status', user?.id], queryFn: myChatStatus, enabled: logged });
  const room = useQuery({ queryKey: ['room', roomId], queryFn: () => getRoom(roomId), enabled: CLOUD_ENABLED });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MiniProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const [online, setOnline] = useState<{ users: PresenceUser[]; guests: number }>({ users: [], guests: 0 });
  const [text, setText] = useState('');
  const [spoilerEp, setSpoilerEp] = useState<number | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<{ p: MiniProfile; id: number } | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const scrollDown = useCallback((smooth = false) => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setNewBelow(0);
  }, []);

  // Carrega as últimas mensagens e entra no tempo real
  useEffect(() => {
    if (!CLOUD_ENABLED) return;
    let alive = true;
    setLoading(true);
    setMessages([]);
    loadMessages(roomId)
      .then((r) => {
        if (!alive) return;
        setMessages(r.messages);
        setProfiles((p) => ({ ...p, ...r.profiles }));
        setHasMore(r.messages.length === 50);
        setLoading(false);
        requestAnimationFrame(() => scrollDown());
      })
      .catch((e) => alive && (setError(e), setLoading(false)));
    const leave = joinRoom(roomId, {
      onInsert: async (m) => {
        const ps = await authors([m.user_id]).catch(() => ({}));
        setProfiles((p) => ({ ...p, ...ps }));
        setMessages((arr) => (arr.some((x) => x.id === m.id) ? arr : [...arr, m]));
        if (atBottom.current) requestAnimationFrame(() => scrollDown(true));
        else setNewBelow((n) => n + 1);
      },
      onUpdate: (m) => setMessages((arr) => arr.map((x) => (x.id === m.id ? m : x))),
      onDelete: (id) => setMessages((arr) => arr.filter((x) => x.id !== id)),
      onPresence: (users, guests) => setOnline({ users, guests }),
    });
    return () => {
      alive = false;
      leave();
    };
  }, [roomId, scrollDown, user?.id]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const loadOlder = async () => {
    const el = list.current;
    const before = messages[0]?.created_at;
    if (!before) return;
    const prevHeight = el?.scrollHeight ?? 0;
    const r = await loadMessages(roomId, before);
    setProfiles((p) => ({ ...p, ...r.profiles }));
    setMessages((arr) => [...r.messages, ...arr]);
    setHasMore(r.messages.length === 50);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (!room.data) {
        await ensureRoom(roomId, info.media ? pickTitle({ romaji: info.media.title, english: info.media.titleEnglish ?? null, native: null }, lang) : info.title, info.media);
        room.refetch();
      }
      const m = await sendMessage(roomId, body, { spoiler, episode: info.media ? spoilerEp : null, replyTo: replyTo?.id });
      setMessages((arr) => (arr.some((x) => x.id === m.id) ? arr : [...arr, m]));
      setText('');
      setReplyTo(null);
      setSpoiler(false);
      setSpoilerEp(null);
      requestAnimationFrame(() => scrollDown(true));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSending(false);
    }
  };

  if (!CLOUD_ENABLED) return <ErrorBox error={new Error(t('As contas ainda não foram ativadas neste site.'))} />;
  if (info.error) return <ErrorBox error={info.error} />;

  const canWrite = logged && !status.data?.minor && !status.data?.mutedUntil;
  const unit = manga ? t('cap.') : t('ep');

  return (
    <div className="mx-auto flex h-[calc(100dvh-14rem)] max-w-4xl flex-col xl:h-[calc(100dvh-10rem)]">
      {/* Cabeçalho da sala */}
      <div className="panel mb-3 flex items-center gap-3 p-3">
        <Link to="/chat" className="rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-ink" aria-label={t('Voltar')}>
          <ArrowLeft size={18} />
        </Link>
        {info.media?.cover ? (
          <Link to={mediaPath(info.media)}>
            <img src={info.media.cover} alt="" className="h-12 w-9 rounded-md border-2 border-black object-cover" />
          </Link>
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-sm)] border-2 border-black bg-pink font-jp text-lg font-black text-[var(--on-pink)]">{info.jp.slice(0, 2)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg leading-tight">{info.title}</h1>
          <div className="truncate text-xs font-bold text-muted">{info.sub}</div>
        </div>
        <div className="flex items-center gap-1.5" title={online.users.map((u) => u.display_name || u.username).join(', ')}>
          <div className="hidden -space-x-2 sm:flex">
            {online.users.slice(0, 5).map((u) => (
              <Avatar key={u.user_id} url={u.avatar_url} name={u.display_name || u.username} size={26} className="!border-panel" />
            ))}
          </div>
          <span className="flex items-center gap-1 rounded-full bg-panel-2 px-2 py-1 text-xs font-black">
            <span className="h-2 w-2 rounded-full bg-[#7cff8a]" />
            <Users size={12} /> {online.users.length + online.guests}
          </span>
        </div>
      </div>

      {/* Mensagens */}
      <div className="panel relative flex min-h-0 flex-1 flex-col !p-0">
        <div
          ref={list}
          className="min-h-0 flex-1 overflow-y-auto p-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (atBottom.current) setNewBelow(0);
          }}
        >
          {hasMore && (
            <button className="manga-btn ghost mx-auto mb-2 flex !py-1 text-xs" onClick={loadOlder}>
              {t('Carregar mensagens anteriores')}
            </button>
          )}
          {loading ? (
            <Spinner className="mx-auto mt-10 h-7 w-7 text-pink" />
          ) : error ? (
            <ErrorBox error={error} />
          ) : !messages.length ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="font-jp text-5xl font-black text-pink/30">{info.jp}</div>
                <p className="mt-2 text-sm font-bold text-muted">{t('Ninguém falou nada ainda. Comece a conversa!')}</p>
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = !!prev && prev.user_id === m.user_id && !m.reply_to && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 3 * 60_000;
              const r = m.reply_to ? byId.get(m.reply_to) : undefined;
              return (
                <Message
                  key={m.id}
                  m={m}
                  author={profiles[m.user_id]}
                  reply={r ? { m: r, author: profiles[r.user_id] } : undefined}
                  mine={logged && m.user_id === user!.id}
                  admin={admin}
                  myProgress={myProgress === Infinity ? 1e9 : myProgress}
                  manga={manga}
                  grouped={grouped}
                  onReply={() => setReplyTo(m)}
                  onReport={() => profiles[m.user_id] && setReporting({ p: profiles[m.user_id], id: m.id })}
                  onRemoved={() => setMessages((arr) => arr.filter((x) => x.id !== m.id))}
                />
              );
            })
          )}
        </div>
        {newBelow > 0 && (
          <button className="manga-btn absolute bottom-3 left-1/2 -translate-x-1/2 !py-1 text-xs" onClick={() => scrollDown(true)}>
            <ArrowDown size={13} /> {newBelow === 1 ? t('1 mensagem nova') : t('{0} mensagens novas', newBelow)}
          </button>
        )}
      </div>

      {/* Escrever */}
      <div className="mt-3">
        {!logged ? (
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3 text-sm font-bold text-muted">
            {t('Entre para participar do chat.')}
            <button className="manga-btn !py-1.5" onClick={() => openAuth('signin')}>
              {t('Entrar')}
            </button>
          </div>
        ) : status.data?.minor ? (
          <div className="panel flex items-start gap-2 p-3 text-sm font-bold text-cyan">
            <Lock size={16} className="mt-0.5 shrink-0" />
            {t('Para sua segurança, quem tem menos de 18 anos pode ler os chats públicos, mas não escrever neles.')}
          </div>
        ) : status.data?.mutedUntil ? (
          <div className="panel flex items-start gap-2 p-3 text-sm font-bold text-red-300">
            <MessageSquareOff size={16} className="mt-0.5 shrink-0" />
            {t('Você foi silenciado pela moderação até {0}.', new Date(status.data.mutedUntil).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }))}
          </div>
        ) : (
          <div className="panel space-y-2 p-2.5">
            {replyTo && (
              <div className="flex items-center gap-2 rounded-lg bg-panel-2 px-2 py-1 text-xs">
                <CornerUpLeft size={12} className="text-pink" />
                <span className="min-w-0 flex-1 truncate">
                  {t('Respondendo a')} <b>{displayName(profiles[replyTo.user_id])}</b>: {replyTo.body}
                </span>
                <button onClick={() => setReplyTo(null)} aria-label={t('Cancelar')}>
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                className="field max-h-32 min-h-[2.75rem] flex-1 resize-none !py-2.5 text-sm"
                rows={1}
                maxLength={500}
                placeholder={t('Mensagem… (Enter envia, Shift+Enter pula linha)')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="manga-btn !h-11 !px-3.5" disabled={!text.trim() || sending || !canWrite} onClick={send} aria-label={t('Enviar')}>
                {sending ? <Spinner className="h-4 w-4" /> : <Send size={16} />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
              {info.media ? (
                <>
                  <button
                    className={`chip !py-0.5 !text-[11px] ${spoilerEp != null ? 'on' : ''}`}
                    onClick={() => setSpoilerEp((v) => (v == null ? Math.max(1, entry?.progress || 1) : null))}
                  >
                    ⚠ {spoilerEp != null ? t('Spoiler até o {0}', unit) : t('Marcar spoiler')}
                  </button>
                  {spoilerEp != null && (
                    <input
                      type="number"
                      min={0}
                      max={info.media.total ?? 100000}
                      className="field !w-20 !py-0.5 text-xs"
                      value={spoilerEp}
                      onChange={(e) => setSpoilerEp(Math.max(0, Number(e.target.value) || 0))}
                      aria-label={t('Episódio do spoiler')}
                    />
                  )}
                </>
              ) : (
                <button className={`chip !py-0.5 !text-[11px] ${spoiler ? 'on' : ''}`} onClick={() => setSpoiler((v) => !v)}>
                  ⚠ {t('Tem spoiler')}
                </button>
              )}
              <span className="ml-auto">{text.length}/500</span>
            </div>
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-muted">
          <ShieldAlert size={12} />
          {t('Respeito sempre. Marque spoilers. Nunca passe telefone, endereço ou redes pessoais. Passe o mouse numa mensagem pra denunciar.')}
          {admin && (
            <span className="ml-auto inline-flex items-center gap-1 text-pink">
              <Ban size={11} /> {t('Você é moderador aqui')}
            </span>
          )}
        </p>
      </div>
      {reporting && <ReportDialog user={reporting.p} kind="message" targetId={String(reporting.id)} onClose={() => setReporting(null)} />}
    </div>
  );
}
