import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Link2, MessageCircle, Pause, Play, Puzzle, Send, Trash2, Tv } from 'lucide-react';
import { Spinner } from './ui';
import { maskProfanity } from '../lib/profanity';
import { useUI } from '../store/ui';
import {
  clock,
  connectExtension,
  deleteMessage,
  livePosition,
  loadMessages,
  loadPlayback,
  pingExtension,
  sendMessage,
  setEpisode,
  subscribeLive,
  type ExtStatus,
  type PartyMessage,
  type Playback,
} from '../sync/partyLive';
import { t } from '../lib/i18n';

const EXT_ZIP = '/shiori-extension.zip';

function useTick(on: boolean, ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
}

function WatchPanel({ code, userId, myName, playback }: { code: string; userId: string; myName: string; playback: Playback | null }) {
  const toast = useUI((s) => s.toast);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [ext, setExt] = useState<ExtStatus | null | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  useTick(!!playback?.playing);

  useEffect(() => {
    let alive = true;
    const check = () => pingExtension().then((s) => alive && setExt(s));
    check();
    const id = setInterval(check, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setEpisode(code, userId, myName, url);
      setUrl('');
      toast(t('Episódio definido! Todo mundo pode abrir pelo botão.'));
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const connect = () => {
    connectExtension(code, myName);
    setTimeout(() => pingExtension().then(setExt), 500);
    toast(t('Extensão conectada à sala {0}', code));
  };

  const extInRoom = ext?.room === code;

  return (
    <div className="panel space-y-4 self-start p-4">
      <div className="flex items-center gap-2">
        <Tv size={18} className="text-pink" />
        <h3 className="flex-1 font-display">{t('Assistir junto no Crunchyroll')}</h3>
      </div>

      {playback?.episode_url ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-black bg-panel-2 p-3">
          <span className={`grid h-9 w-9 place-items-center rounded-full border-2 border-black ${playback.playing ? 'bg-[#7cff8a] text-black' : 'bg-panel'}`}>
            {playback.playing ? <Play size={16} /> : <Pause size={16} />}
          </span>
          <div className="min-w-[180px] flex-1">
            <div className="truncate font-extrabold">{playback.title || t('Episódio {0}', playback.episode_id ?? '')}</div>
            <div className="text-xs font-bold text-muted">
              {playback.playing ? t('Tocando') : t('Pausado')} · {clock(livePosition(playback))}
              {playback.by_name && t(' · último comando: {0}', playback.by_name)}
            </div>
          </div>
          <a href={safeCrunchy(playback.episode_url)} target="_blank" rel="noreferrer" className="manga-btn cyan w-full justify-center !py-2 sm:w-auto">
            <ExternalLink size={15} /> {t('Abrir episódio')}
          </a>
        </div>
      ) : (
        <p className="text-sm font-bold text-muted">{t('Ninguém escolheu o episódio ainda. Cole o link abaixo.')}</p>
      )}

      <form onSubmit={save} className="flex gap-2">
        <div className="relative flex-1">
          <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="field !pl-9"
            placeholder="https://www.crunchyroll.com/watch/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button className="manga-btn !px-3" disabled={busy || !url.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : t('Definir')}
        </button>
      </form>

      <div className="rounded-xl border-2 border-dashed border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Puzzle size={16} className={ext ? 'text-[#7cff8a]' : 'text-muted'} />
          <div className="min-w-0 flex-1 text-sm font-bold">
            {ext === undefined
              ? t('Procurando a extensão…')
              : !ext
                ? t('Extensão Shiori não encontrada neste navegador.')
                : !ext.loggedIn
                  ? t('Extensão instalada — clique no ícone dela e entre com sua conta.')
                  : extInRoom
                    ? t('Extensão conectada a esta sala ✓ Abra o episódio e dê play.')
                    : t('Extensão pronta. Conecte ela a esta sala:')}
          </div>
          {ext?.loggedIn && !extInRoom && (
            <button className="manga-btn yellow !py-1.5 !text-sm" onClick={connect}>
              {t('Conectar à sala')}
            </button>
          )}
          {!ext && ext !== undefined && (
            <button className="manga-btn ghost !py-1.5 !text-sm" onClick={() => setShowHelp((v) => !v)}>
              {t('Como instalar')}
            </button>
          )}
        </div>
        {(showHelp || (!ext && ext !== undefined && !playback)) && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs font-bold text-muted">
            <li>
              <a href={EXT_ZIP} download className="inline-flex items-center gap-1 text-pink underline">
                <Download size={12} /> {t('Baixe a extensão (.zip)')}
              </a>{' '}
              {t('e extraia numa pasta.')}
            </li>
            <li>{t('Chrome/Edge/Opera: abra chrome://extensions, ligue o "Modo do desenvolvedor" e clique em "Carregar sem compactação" escolhendo a pasta.')}</li>
            <li>{t('Firefox: abra about:debugging → "Este Firefox" → "Carregar extensão temporária" e escolha o manifest.json (some ao fechar o Firefox).')}</li>
            <li>{t('Clique no ícone 栞 da extensão, entre com sua conta Shiori e volte aqui para conectar à sala.')}</li>
          </ol>
        )}
      </div>
      <p className="text-[11px] font-bold text-muted">
        {t('Cada pessoa assiste na própria conta do Crunchyroll. Com a extensão, play, pause e pulos ficam iguais pra todo mundo e o chat aparece por cima do vídeo.')}
      </p>
    </div>
  );
}

function ChatPanel({ code, userId, myName, hostId, messages }: { code: string; userId: string; myName: string; hostId: string; messages: PartyMessage[] }) {
  const toast = useUI((s) => s.toast);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(code, userId, myName, text);
      setText('');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel flex h-[420px] flex-col overflow-hidden lg:h-[520px]">
      <div className="flex items-center gap-2 border-b-2 border-black px-4 py-3">
        <MessageCircle size={16} className="text-pink" />
        <h3 className="flex-1 font-display">{t('Chat da sala')}</h3>
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#7cff8a]" title={t('Ao vivo')} />
      </div>
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-3">
        {!messages.length && <p className="pt-8 text-center text-sm font-bold text-muted">{t('Diga oi pra galera 👋')}</p>}
        {messages.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`group flex ${mine ? 'justify-end' : ''}`}>
              <div className={`max-w-[85%] rounded-2xl border-2 border-black px-3 py-1.5 ${mine ? 'bg-pink text-[var(--on-pink)]' : 'bg-panel-2'}`}>
                {!mine && <div className="text-[11px] font-black text-pink">{m.name}</div>}
                <div className="whitespace-pre-wrap break-words text-sm font-semibold">{maskProfanity(m.body)}</div>
                <div className={`text-right text-[10px] font-bold ${mine ? 'opacity-70' : 'text-muted'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {(mine || hostId === userId) && (
                <button
                  className="self-center p-1 text-muted opacity-0 hover:text-red-400 group-hover:opacity-100"
                  onClick={() => deleteMessage(m.id).catch((e) => toast((e as Error).message, 'err'))}
                  aria-label={t('Apagar mensagem')}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t-2 border-black p-2">
        <input className="field" maxLength={500} placeholder={t('Mensagem…')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="manga-btn !px-3" disabled={sending || !text.trim()} aria-label={t('Enviar')}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default function PartyLive({ code, userId, myName, hostId }: { code: string; userId: string; myName: string; hostId: string }) {
  const [messages, setMessages] = useState<PartyMessage[]>([]);
  const [playback, setPlayback] = useState<Playback | null>(null);

  useEffect(() => {
    let alive = true;
    loadMessages(code).then((m) => alive && setMessages(m)).catch(() => {});
    loadPlayback(code).then((p) => alive && setPlayback(p)).catch(() => {});
    const off = subscribeLive(
      code,
      (m, ev) =>
        setMessages((list) =>
          ev === 'DELETE' ? list.filter((x) => x.id !== m.id) : list.some((x) => x.id === m.id) ? list : [...list, m].slice(-150)
        ),
      setPlayback
    );
    return () => {
      alive = false;
      off();
    };
  }, [code]);

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <WatchPanel code={code} userId={userId} myName={myName} playback={playback} />
      <ChatPanel code={code} userId={userId} myName={myName} hostId={hostId} messages={messages} />
    </div>
  );
}

/** Só deixa link https do Crunchyroll (o link vem de outros participantes da sala). */
function safeCrunchy(url: string | null | undefined) {
  return url && /^https:\/\/([a-z0-9-]+\.)*crunchyroll\.com\//i.test(url) ? url : undefined;
}
