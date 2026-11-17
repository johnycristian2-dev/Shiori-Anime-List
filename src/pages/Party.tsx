import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Crown, Play, Plus, RotateCcw, Search, Trash2, Trophy, X } from 'lucide-react';
import { useSearch } from '../api/hooks';
import { EmptyState, ErrorBox, SectionTitle, Spinner, useDebounced } from '../components/ui';
import { CLOUD_ENABLED } from '../lib/supabase';
import { rarityOf } from '../lib/gacha';
import { entryToMedia, useTitle, coverOf } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import {
  addItem,
  closeVoting,
  createRoom,
  joinRoom,
  loadParty,
  MAX_VOTES,
  removeItem,
  reopenVoting,
  setVote,
  subscribeParty,
  tally,
  type PartyState,
} from '../sync/party';

import { t } from '../lib/i18n';
import PartyLive from '../components/PartyLive';
import PartyQuiz from '../components/PartyQuiz';

function useMyName() {
  const nickname = useUI((s) => s.nickname);
  const setNickname = useUI((s) => s.setNickname);
  return [nickname, setNickname] as const;
}

function Lobby() {
  const nav = useNavigate();
  const [myName, setMyName] = useMyName();
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useUI((s) => s.toast);

  const run = async (k: string, fn: () => Promise<string>) => {
    if (!myName.trim()) return toast(t('Digite seu nome primeiro'), 'info');
    setBusy(k);
    try {
      nav(`/party/${await fn()}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <p className="-mt-2 text-sm font-bold text-muted">
        {t(
          'Crie uma sala, mande o código pros amigos, votem no anime da noite e assistam juntos no Crunchyroll com chat ao vivo 🍿'
        )}
      </p>
      <div className="panel p-5">
        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Seu nome na sala')}</label>
        <input className="field" maxLength={24} placeholder={t('Ex.: Jotas')} value={myName} onChange={(e) => setMyName(e.target.value)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <form
          className="panel space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run('create', () => createRoom(roomName, myName));
          }}
        >
          <h3 className="font-display">{t('Criar sala')}</h3>
          <input className="field" maxLength={40} placeholder={t('Nome (ex.: Sexta do anime)')} value={roomName} onChange={(e) => setRoomName(e.target.value)} />
          <button className="manga-btn w-full" disabled={!!busy}>
            {busy === 'create' ? <Spinner className="h-4 w-4" /> : <Plus size={16} />}{' '}{t('Criar')}
          </button>
        </form>
        <form
          className="panel space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run('join', () => joinRoom(code, myName));
          }}
        >
          <h3 className="font-display">{t('Entrar com código')}</h3>
          <input
            className="field text-center font-display tracking-[0.3em] uppercase"
            maxLength={6}
            placeholder={t('ABC123')}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="manga-btn cyan w-full" disabled={!!busy || code.length !== 6}>
            {busy === 'join' ? <Spinner className="h-4 w-4" /> : <Play size={16} />}{' '}{t('Entrar')}
          </button>
        </form>
      </div>
      <p className="text-center text-xs font-bold text-muted">{t('Não precisa de conta: quem não estiver logado entra como convidado.')}</p>
    </div>
  );
}

function AddPanel({ code, myName, existing }: { code: string; myName: string; existing: Set<number> }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 300);
  const q = useSearch(debounced);
  const entries = useList((s) => s.entries);
  const toast = useUI((s) => s.toast);
  const title = useTitle();
  const planning = Object.values(entries)
    .filter((e) => e.status === 'PLANNING' && !existing.has(e.mediaId))
    .slice(0, 12);

  const add = async (m: Parameters<typeof addItem>[1]) => {
    try {
      await addItem(code, m, myName);
      toast(t('{0} sugerido!', title(m)));
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="panel space-y-3 p-4">
      <h3 className="font-display">{t('Sugerir anime')}</h3>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input className="field !pl-9" placeholder={t('Buscar…')} value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {(q.data?.media ?? []).slice(0, 6).map((m) => (
        <button
          key={m.id}
          disabled={existing.has(m.id)}
          onClick={() => add(m)}
          className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-panel-2 disabled:opacity-40"
        >
          <img src={coverOf(m)} alt="" className="h-11 w-8 rounded border border-black object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{title(m)}</span>
          {existing.has(m.id) ? <Check size={16} /> : <Plus size={16} className="text-pink" />}
        </button>
      ))}
      {planning.length > 0 && (
        <>
          <div className="pt-1 text-[10px] font-black uppercase tracking-wider text-muted">{t('Da sua lista "Quero ver"')}</div>
          <div className="flex flex-wrap gap-1.5">
            {planning.map((e) => (
              <button key={e.mediaId} className="chip !px-2 !py-1 !text-xs" onClick={() => add(entryToMedia(e))}>
                + {e.title.length > 24 ? e.title.slice(0, 23) + '…' : e.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Room({ code }: { code: string }) {
  const user = useCloudUser((s) => s.user);
  const [myName] = useMyName();
  const [state, setState] = useState<PartyState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useUI((s) => s.toast);
  const title = useTitle();
  const add = useList((s) => s.add);
  const nav = useNavigate();

  const refresh = useCallback(() => {
    loadParty(code)
      .then(setState)
      .catch(setError);
  }, [code]);

  // Garante que eu sou membro (link direto) e carrega
  useEffect(() => {
    joinRoom(code, myName || 'Otaku')
      .then(refresh)
      .catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!user) return;
    return subscribeParty(code, { id: user.id, name: myName || 'Otaku' }, refresh, setOnline);
  }, [code, user, myName, refresh]);

  const ranked = useMemo(() => (state ? tally(state.items, state.votes) : []), [state]);
  if (error) return <ErrorBox error={error} onRetry={() => nav('/party')} />;
  if (!state || !user)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  const isHost = state.room.host === user.id;
  const myVotes = state.votes.filter((v) => v.user_id === user.id).map((v) => v.media_id);
  const nameOf = (id: string) => state.members.find((m) => m.user_id === id)?.name ?? '?';
  const link = `${window.location.origin}${window.location.pathname}#/party/${code}`;
  const existing = new Set(state.items.map((i) => i.media_id));
  const winner = state.room.status === 'done' ? state.room.winner : null;
  const r = winner ? rarityOf(winner.averageScore) : null;

  const vote = async (mediaId: number, on: boolean) => {
    if (on && myVotes.length >= MAX_VOTES) return toast(t('Você só tem {0} votos — tire um pra mudar', MAX_VOTES), 'info');
    try {
      await setVote(code, mediaId, on);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const doClose = async () => {
    setBusy(true);
    try {
      await closeVoting(state);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="font-display text-2xl">{state.room.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {state.members.map((m) => (
              <span key={m.user_id} className="chip cursor-default !px-2 !py-0.5 !text-xs">
                <span className={`h-2 w-2 rounded-full ${online.includes(m.user_id) ? 'bg-[#7cff8a]' : 'bg-line'}`} />
                {m.user_id === state.room.host && <Crown size={11} className="text-yellow" />}
                {m.name}
                {m.user_id === user.id && t(' (você)')}
              </span>
            ))}
          </div>
        </div>
        <button
          className="manga-btn yellow"
          onClick={() =>
            navigator.clipboard
              .writeText(link)
              .then(() => toast(t('Link copiado! Mande pros amigos')))
              .catch(() => toast(t('Código: {0}', code), 'info'))
          }
        >
          <Copy size={16} /> <span className="font-display tracking-[0.25em]">{code}</span>
        </button>
      </div>

      {winner && r && (
        <section
          className="pop-in relative mb-8 flex flex-wrap items-center gap-6 overflow-hidden rounded-3xl border-[3px] border-black bg-panel p-6"
          style={{ boxShadow: r.glow }}
        >
          <div className="absolute -right-2 -top-6 font-jp text-[120px] font-black leading-none text-pink/10">決定</div>
          {coverOf(winner) && <img src={coverOf(winner)} alt="" className="w-32 rounded-xl border-[3px] border-black" />}
          <div className="relative flex-1">
            <div className="flex items-center gap-2 text-sm font-black text-yellow">
              <Trophy size={16} />{' '}{t('O anime da vez é…')}
            </div>
            <div className="font-display text-3xl">{title(winner)}</div>
            <div className="text-sm font-bold text-muted">
              {[winner.format && FORMAT_LABEL[winner.format], winner.seasonYear, winner.episodes && `${winner.episodes} ep`].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="manga-btn cyan"
                onClick={() => {
                  add(winner, 'WATCHING');
                  toast(t('Adicionado como Assistindo — bom anime! 🍿'));
                }}
              >
                <Play size={16} />{' '}{t('Vou assistir')}
              </button>
              <Link to={`/anime/${winner.id}`} className="manga-btn ghost">
                {t('Detalhes')}
              </Link>
              {isHost && (
                <button className="manga-btn ghost" onClick={() => reopenVoting(code).then(refresh)}>
                  <RotateCcw size={16} />{' '}{t('Reabrir votação')}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <PartyQuiz
        code={code}
        userId={user.id}
        myName={state.members.find((m) => m.user_id === user.id)?.name || myName || 'Otaku'}
        isHost={isHost}
        onlineCount={online.length}
      />
      <PartyLive code={code} userId={user.id} myName={state.members.find((m) => m.user_id === user.id)?.name || myName || 'Otaku'} hostId={state.room.host} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg">
              {t('Votação')}{' '}<span className="font-jp text-sm text-pink">投票</span>
            </h3>
            <span className="text-xs font-black text-muted">
              {t('Seus votos:')}{' '}{myVotes.length}/{MAX_VOTES}
            </span>
          </div>
          {!ranked.length ? (
            <EmptyState jp="空" title={t('Ninguém sugeriu nada ainda')}>
              {t('Use o painel ao lado pra sugerir o primeiro anime.')}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {ranked.map(({ item, votes }, k) => {
                const mine = myVotes.includes(item.media_id);
                const voters = state.votes.filter((v) => v.media_id === item.media_id).map((v) => nameOf(v.user_id));
                const pct = state.votes.length ? (votes / Math.max(...ranked.map((x) => x.votes), 1)) * 100 : 0;
                return (
                  <div key={item.media_id} className={`panel relative overflow-hidden p-2.5 ${winner?.id === item.media_id ? 'border-yellow' : ''}`}>
                    <div className="absolute inset-y-0 left-0 bg-pink/10 transition-all" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center gap-3">
                      <span className="w-6 text-center font-display text-lg text-muted">{k + 1}</span>
                      <Link to={`/anime/${item.media_id}`}>
                        <img src={coverOf(item.media)} alt="" className="h-16 w-11 rounded-md border-2 border-black object-cover" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-extrabold">{title(item.media)}</div>
                        <div className="truncate text-xs font-bold text-muted">
                          {t('sugerido por')}{' '}{item.added_name ?? '?'}
                          {voters.length > 0 && t(' · votos: {0}', voters.join(', '))}
                        </div>
                      </div>
                      <span className="font-display text-2xl">{votes}</span>
                      {state.room.status === 'voting' && (
                        <button
                          className={`manga-btn !rounded-lg !px-3 !py-2 ${mine ? '' : 'ghost'}`}
                          onClick={() => vote(item.media_id, !mine)}
                          aria-label={mine ? t('Tirar voto') : t('Votar')}
                        >
                          {mine ? <Check size={16} /> : '+1'}
                        </button>
                      )}
                      {(isHost || item.added_by === user.id) && state.room.status === 'voting' && (
                        <button className="p-1 text-muted hover:text-red-400" onClick={() => removeItem(code, item.media_id).then(refresh)} aria-label={t('Remover')}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {isHost && state.room.status === 'voting' && ranked.length > 0 && (
            <button className="manga-btn mt-5 w-full !py-3" onClick={doClose} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Trophy size={18} />}{' '}{t('Encerrar e revelar o vencedor')}
            </button>
          )}
          {!isHost && state.room.status === 'voting' && (
            <p className="mt-4 text-center text-xs font-bold text-muted">{t('Quando todos votarem, o anfitrião 👑 encerra a votação.')}</p>
          )}
        </div>
        {state.room.status === 'voting' && <AddPanel code={code} myName={myName || 'Otaku'} existing={existing} />}
      </div>
    </>
  );
}

export default function Party() {
  const { code } = useParams();
  const nav = useNavigate();
  return (
    <>
      <SectionTitle
        title={t('Watch party')}
        jp="鑑賞会"
        action={
          code && (
            <button className="inline-flex items-center gap-1" onClick={() => nav('/party')}>
              <X size={14} />{' '}{t('Sair da sala')}
            </button>
          )
        }
      />
      {!CLOUD_ENABLED ? (
        <EmptyState jp="雲" title={t('Precisa da conta Shiori')}>
          {t(
            'A watch party usa o Supabase pra juntar todo mundo em tempo real. Veja o passo a passo no README (seção "Conta Shiori").'
          )}
        </EmptyState>
      ) : code ? (
        <Room code={code.toUpperCase()} />
      ) : (
        <Lobby />
      )}
    </>
  );
}
