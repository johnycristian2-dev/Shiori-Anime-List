import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightLeft, Copy, Crown, Info, LogIn, Plus, Search, Trophy, Users, X } from 'lucide-react';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { useCloudUser } from '../sync/cloud';
import { openAuth, useAccount } from '../sync/account';
import { useUI } from '../store/ui';
import { pickTitle } from '../lib/format';
import { SEASON_LABEL } from '../lib/season';
import type { Season } from '../types';
import {
  createLeague,
  drop,
  joinLeague,
  leaveLeague,
  loadCatalog,
  loadLeague,
  myLeagues,
  pick,
  standings,
  subscribeLeague,
  type CatalogAnime,
  type League as LeagueT,
  type LeagueMember,
  type PickPoints,
} from '../sync/league';
import { t } from '../lib/i18n';

const seasonName = (s: string, y: number) => `${SEASON_LABEL[s as Season]?.pt ?? s} ${y}`;
const pts = (n: number) => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });

function useCatTitle() {
  const lang = useUI((s) => s.titleLang);
  return (c: CatalogAnime) => pickTitle({ romaji: c.title.r, english: c.title.e, native: c.title.n }, lang);
}

function Rules() {
  return (
    <div className="panel p-4 text-sm font-bold text-muted">
      <div className="mb-2 flex items-center gap-2 text-[var(--text)]">
        <Info size={16} className="text-cyan" />
        <span className="font-display">{t('Como funciona')}</span>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t('Cada pessoa escala 5 animes da temporada. Um anime só pode estar em um time por vez.')}</li>
        <li>{t('Pontos: 1 a cada 1.000 membros novos que o anime ganhar no AniList + (nota ÷ 10) por semana no seu time.')}</li>
        <li>{t('Você tem 3 trocas na temporada. Tirar um anime nas primeiras 24h não gasta troca.')}</li>
        <li>{t('Os números do AniList são atualizados algumas vezes por dia. No fim da temporada, quem tiver mais pontos é o campeão.')}</li>
      </ul>
    </div>
  );
}

function Lobby() {
  const nav = useNavigate();
  const user = useCloudUser((s) => s.user);
  const profile = useAccount((s) => s.profile);
  const toast = useUI((s) => s.toast);
  const [leagues, setLeagues] = useState<LeagueT[] | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const myName = profile?.display_name || profile?.username || useUI.getState().nickname || 'Otaku';

  useEffect(() => {
    if (user) myLeagues().then(setLeagues).catch(() => setLeagues([]));
  }, [user]);

  const run = async (k: string, fn: () => Promise<LeagueT>) => {
    setBusy(k);
    try {
      const l = await fn();
      nav(`/liga/${l.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!user)
    return (
      <EmptyState jp="杯" title={t('Entre pra jogar a liga')}>
        <p className="mb-4">{t('A liga é entre amigos, então precisa de conta.')}</p>
        <button className="manga-btn mx-auto" onClick={() => openAuth('signin')}>
          <LogIn size={16} /> {t('Entrar')}
        </button>
      </EmptyState>
    );

  return (
    <div className="space-y-6">
      <p className="-mt-2 text-sm font-bold text-muted">
        {t('Fantasy de anime: monte um time com 5 animes da temporada e dispute com seus amigos quem escolheu melhor.')}
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <form
          className="panel space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run('create', () => createLeague(name, myName));
          }}
        >
          <h3 className="font-display">{t('Criar liga')}</h3>
          <input className="field" maxLength={40} placeholder={t('Nome (ex.: Liga da firma)')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="manga-btn w-full" disabled={!!busy}>
            {busy === 'create' ? <Spinner className="h-4 w-4" /> : <Plus size={16} />} {t('Criar')}
          </button>
        </form>
        <form
          className="panel space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run('join', () => joinLeague(code, myName));
          }}
        >
          <h3 className="font-display">{t('Entrar com código')}</h3>
          <input
            className="field text-center font-display tracking-[0.3em] uppercase"
            maxLength={6}
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="manga-btn cyan w-full" disabled={!!busy || code.length !== 6}>
            {busy === 'join' ? <Spinner className="h-4 w-4" /> : <Users size={16} />} {t('Entrar')}
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg">{t('Minhas ligas')}</h3>
        {leagues === null ? (
          <Spinner className="h-6 w-6" />
        ) : !leagues.length ? (
          <p className="text-sm font-bold text-muted">{t('Você ainda não está em nenhuma liga. Crie uma e mande o código pros amigos!')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {leagues.map((l) => (
              <Link key={l.id} to={`/liga/${l.id}`} className="panel flex items-center gap-3 p-4 hover:-translate-y-0.5">
                <Trophy size={20} className="text-yellow" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display">{l.name}</div>
                  <div className="text-xs font-bold text-muted">{seasonName(l.season, l.year)}</div>
                </div>
                <span className="font-display tracking-widest text-muted">{l.code}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Rules />
    </div>
  );
}

function Picker({
  catalog,
  takenBy,
  onPick,
  onClose,
}: {
  catalog: CatalogAnime[];
  takenBy: Map<number, string>;
  onPick: (c: CatalogAnime) => void;
  onClose: () => void;
}) {
  const title = useCatTitle();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return catalog.filter((c) => !n || [c.title.r, c.title.e, c.title.n].some((x) => x?.toLowerCase().includes(n)));
  }, [catalog, q]);
  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/75 p-3" onClick={onClose}>
      <div className="pop-in panel flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-black p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input className="field !pl-9" autoFocus placeholder={t('Buscar anime da temporada…')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button onClick={onClose} aria-label={t('Fechar')} className="p-1">
            <X />
          </button>
        </div>
        <div className="grid flex-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
          {list.map((c) => {
            const owner = takenBy.get(c.media_id);
            return (
              <button
                key={c.media_id}
                disabled={!!owner}
                onClick={() => onPick(c)}
                className="flex items-center gap-3 rounded-xl border-2 border-black bg-panel-2 p-2 text-left hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                {c.cover && <img src={c.cover} alt="" loading="lazy" className="h-16 w-11 rounded-md border border-black object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-extrabold">{title(c)}</span>
                  <span className="block text-[11px] font-bold text-muted">
                    {owner ? t('no time de {0}', owner) : `${(c.popularity / 1000).toFixed(0)} mil · ${c.score ? `${c.score}%` : t('sem nota ainda')}`}
                  </span>
                </span>
              </button>
            );
          })}
          {!list.length && <p className="col-span-full p-6 text-center text-sm font-bold text-muted">{t('Nada encontrado.')}</p>}
        </div>
      </div>
    </div>
  );
}

function PickCard({ p, c, mine, swaps, onDrop }: { p: PickPoints; c?: CatalogAnime; mine: boolean; swaps: number; onDrop: () => void }) {
  const title = useCatTitle();
  const fresh = Date.now() - new Date(p.picked_at).getTime() < 86_400_000;
  return (
    <div className="relative overflow-hidden rounded-xl border-[3px] border-black bg-panel-2">
      {c?.cover && <img src={c.cover} alt="" className="aspect-[3/4] w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2 text-white">
        <div className="line-clamp-2 text-xs font-extrabold leading-tight">{c ? title(c) : '?'}</div>
        <div className="font-display text-lg text-yellow">{pts(Number(p.points))} pts</div>
        <div className="text-[10px] font-bold opacity-80">
          +{(p.members_gained / 1000).toFixed(1)} mil · {p.score ?? '—'}%
        </div>
      </div>
      {mine && (
        <button
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-panel text-[var(--text)] hover:bg-red-500 hover:text-white disabled:opacity-40"
          disabled={!fresh && swaps <= 0}
          title={fresh ? t('Tirar (grátis nas primeiras 24h)') : t('Trocar (gasta 1 troca)')}
          onClick={onDrop}
        >
          <ArrowRightLeft size={13} />
        </button>
      )}
    </div>
  );
}

function LeagueRoom({ id }: { id: string }) {
  const user = useCloudUser((s) => s.user);
  const toast = useUI((s) => s.toast);
  const nav = useNavigate();
  const [data, setData] = useState<{ league: LeagueT; members: LeagueMember[]; points: PickPoints[] } | null>(null);
  const [catalog, setCatalog] = useState<CatalogAnime[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [picking, setPicking] = useState(false);

  const refresh = useCallback(() => {
    loadLeague(id)
      .then((d) => {
        setData(d);
        return loadCatalog(d.league.season, d.league.year).then(setCatalog);
      })
      .catch(setError);
  }, [id]);

  useEffect(() => {
    refresh();
    const off = subscribeLeague(id, refresh);
    const t2 = setInterval(refresh, 5 * 60_000);
    return () => {
      off();
      clearInterval(t2);
    };
  }, [id, refresh]);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.media_id, c])), [catalog]);
  if (error) return <ErrorBox error={error} onRetry={() => nav('/liga')} />;
  if (!data || !user)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  const table = standings(data.members, data.points);
  const me = table.find((m) => m.user_id === user.id);
  const takenBy = new Map(data.points.filter((p) => p.active).map((p) => [p.media_id, data.members.find((m) => m.user_id === p.user_id)?.name ?? '?']));
  const lastUpdate = catalog.reduce((m, c) => (c.updated_at > m ? c.updated_at : m), '');

  const doPick = async (c: CatalogAnime) => {
    try {
      await pick(id, c.media_id);
      toast(t('{0} entrou no seu time!', c.title.e ?? c.title.r));
      setPicking(false);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const doDrop = async (p: PickPoints) => {
    const fresh = Date.now() - new Date(p.picked_at).getTime() < 86_400_000;
    if (!confirm(fresh ? t('Tirar esse anime do time? (grátis nas primeiras 24h)') : t('Trocar esse anime? Os pontos dele ficam guardados e você gasta 1 troca.'))) return;
    try {
      await drop(p.pick_id);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl">{data.league.name}</div>
          <div className="text-sm font-bold text-muted">
            {seasonName(data.league.season, data.league.year)} · {t('{0} jogadores', data.members.length)}
            {lastUpdate && ` · ${t('AniList atualizado {0}', new Date(lastUpdate).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}`}
          </div>
        </div>
        <button
          className="manga-btn yellow"
          onClick={() =>
            navigator.clipboard
              .writeText(t('Entra na minha liga de anime no Shiori! Código: {0} — https://shiori-anime-list.vercel.app/liga', data.league.code))
              .then(() => toast(t('Convite copiado! Mande pros amigos')))
              .catch(() => toast(data.league.code, 'info'))
          }
        >
          <Copy size={16} /> <span className="font-display tracking-[0.25em]">{data.league.code}</span>
        </button>
      </div>

      {me && (
        <section className="panel p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="flex-1 font-display text-lg">{t('Meu time')}</h3>
            <span className="text-xs font-black text-muted">{t('Trocas: {0}/3', me.swaps_left)}</span>
            <span className="font-display text-xl text-yellow">{pts(me.total)} pts</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {me.active.map((p) => (
              <PickCard key={p.pick_id} p={p} c={byId.get(p.media_id)} mine swaps={me.swaps_left} onDrop={() => doDrop(p)} />
            ))}
            {Array.from({ length: 5 - me.active.length }, (_, i) => (
              <button
                key={i}
                onClick={() => setPicking(true)}
                className="grid aspect-[3/4] place-items-center rounded-xl border-[3px] border-dashed border-line text-muted hover:border-pink hover:text-pink"
              >
                <span className="text-center text-xs font-black">
                  <Plus className="mx-auto mb-1" />
                  {t('Escolher anime')}
                </span>
              </button>
            ))}
          </div>
          {me.past.length > 0 && (
            <p className="mt-3 text-xs font-bold text-muted">
              {t('Já passaram pelo time:')} {me.past.map((p) => `${byId.get(p.media_id)?.title.r ?? '?'} (${pts(Number(p.points))})`).join(' · ')}
            </p>
          )}
        </section>
      )}

      <section className="panel p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-yellow" />
          <h3 className="font-display text-lg">{t('Classificação')}</h3>
        </div>
        <ol className="space-y-2">
          {table.map((m, i) => (
            <li key={m.user_id} className={`flex items-center gap-3 rounded-xl p-2 ${m.user_id === user.id ? 'bg-pink/15' : ''}`}>
              <span className="w-6 text-center font-display text-lg text-muted">{i === 0 ? <Crown size={18} className="inline text-yellow" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">
                  {m.name}
                  {m.user_id === user.id && <span className="text-muted">{t(' (você)')}</span>}
                </span>
                <span className="mt-1 flex gap-1">
                  {m.active.map((p) => {
                    const c = byId.get(p.media_id);
                    return c?.cover ? <img key={p.pick_id} src={c.cover} alt="" title={c.title.r} className="h-9 w-6 rounded border border-black object-cover" /> : null;
                  })}
                  {!m.active.length && <span className="text-[11px] font-bold text-muted">{t('ainda montando o time')}</span>}
                </span>
              </span>
              <span className="font-display text-xl">{pts(m.total)}</span>
            </li>
          ))}
        </ol>
      </section>

      <Rules />
      <div className="text-center">
        <button
          className="text-xs font-bold text-muted underline hover:text-red-400"
          onClick={async () => {
            if (!confirm(t('Sair da liga? Seu time e seus pontos somem.'))) return;
            await leaveLeague(id, user.id).catch(() => null);
            nav('/liga');
          }}
        >
          {t('Sair da liga')}
        </button>
      </div>

      {picking && <Picker catalog={catalog} takenBy={takenBy} onPick={doPick} onClose={() => setPicking(false)} />}
    </div>
  );
}

export default function League() {
  const { id } = useParams();
  return (
    <>
      <SectionTitle title={t('Liga da temporada')} jp="リーグ" />
      {id ? <LeagueRoom id={id} /> : <Lobby />}
    </>
  );
}
