import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Flame, Search } from 'lucide-react';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../../components/ui';
import { FORMAT_LABEL, genrePt } from '../../lib/labels';
import { allNames, dayNumber, norm, todayKey, useAnimeTitle, usePool, type PoolAnime } from '../../games/core';
import { animedleGuess, animedleState, gameCoverUrl, type AnimedleView } from '../../sync/games';
import { useUI } from '../../store/ui';
import { Board, LoginToPlay, NextIn, ShareButton, SITE, useNeedsLogin, useStreak, useSubmit } from '../../games/shared';
import { t } from '../../lib/i18n';

const MAX = 8;
type Hit = 'ok' | 'near' | 'no';
interface Cell {
  hit: Hit;
  arrow?: 'up' | 'down' | null;
  text: string;
}

const COLS = () => [t('Gêneros'), t('Ano'), t('Estúdio'), t('Formato'), t('Episódios'), t('Nota')];
const EMOJI: Record<Hit, string> = { ok: '🟩', near: '🟨', no: '⬛' };
const COLOR: Record<Hit, string> = {
  ok: 'bg-[#4ade80] text-black',
  near: 'bg-yellow text-black',
  no: 'bg-panel-2 text-[var(--text)]',
};

/** Texto de cada coluna vem do próprio chute (é público); a cor e a seta vêm do servidor. */
const texts = (g: PoolAnime) => [
  g.g.slice(0, 3).map(genrePt).join(', ') || '—',
  String(g.y),
  g.s ?? '—',
  FORMAT_LABEL[g.f] ?? g.f,
  g.ep ? String(g.ep) : '?',
  `${g.sc}%`,
];

export default function Animedle() {
  const pool = usePool();
  const title = useAnimeTitle();
  const toast = useUI((s) => s.toast);
  const [day] = useState(todayKey);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = useSubmit('animedle');
  const { streak, wins, played } = useStreak('animedle');
  const qc = useQueryClient();
  const needsLogin = useNeedsLogin();
  const state = useQuery({ queryKey: ['animedle', day], queryFn: animedleState, staleTime: Infinity, retry: 1, enabled: !needsLogin });

  const byId = useMemo(() => new Map((pool.data ?? []).map((a) => [a.id, a])), [pool.data]);
  const view = state.data;
  const guessed = useMemo(() => new Set(view?.guesses.map((g) => g.id) ?? []), [view]);
  const over = !!view?.done;
  const won = !!view?.won;
  const secret = view?.secret ? byId.get(view.secret) ?? null : null;

  const suggestions = useMemo(() => {
    const q = norm(term);
    if (!q || !pool.data) return [];
    return pool.data
      .filter((a) => !guessed.has(a.id) && allNames(a).some((n) => norm(n).includes(q)))
      .sort((a, b) => b.p - a.p)
      .slice(0, 8);
  }, [term, pool.data, guessed]);

  if (needsLogin) return <LoginToPlay title={t('Animedle')} jp="今日のアニメ" />;
  if (pool.error) return <ErrorBox error={pool.error} onRetry={() => pool.refetch()} />;
  if (state.error) return <ErrorBox error={state.error} onRetry={() => state.refetch()} />;
  if (!pool.data || !view)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  const guess = async (a: PoolAnime) => {
    if (over || busy || guessed.has(a.id)) return;
    setBusy(true);
    setTerm('');
    try {
      const v = await animedleGuess(a.id);
      qc.setQueryData(['animedle', day], v);
      if (v.done) submit(day, v.score ?? 0);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const rows = view.guesses
    .map((g) => ({ a: byId.get(g.id), cells: g.cells }))
    .filter((r): r is { a: PoolAnime; cells: AnimedleView['guesses'][number]['cells'] } => !!r.a)
    .map((r) => ({ a: r.a, cells: r.cells.map((c, i) => ({ hit: c.hit, arrow: c.arrow, text: texts(r.a)[i] }) as Cell) }));
  const wrong = rows.filter((r) => !r.cells.every((c) => c.hit === 'ok')).length;
  const blur = over || !view.hint ? null : wrong >= 7 ? 6 : 16;
  const guesses = view.guesses.length;
  const shareText = [
    `Animedle Shiori #${dayNumber(day)} ${won ? guesses : 'X'}/${MAX}`,
    ...rows.map((r) => r.cells.map((c) => EMOJI[c.hit]).join('')),
    SITE,
  ].join('\n');

  return (
    <>
      <SectionTitle
        title={t('Animedle')}
        jp="今日のアニメ"
        action={
          <span className="inline-flex items-center gap-1 text-sm font-black">
            <Flame size={15} className="text-orange-400" /> {streak}
          </span>
        }
      />
      <p className="-mt-2 mb-5 text-sm font-bold text-muted">
        {t('Descubra o anime do dia em até {0} chutes. Cada chute mostra o que bate com o secreto:', MAX)}{' '}
        <span className="rounded bg-[#4ade80] px-1 text-black">{t('igual')}</span>{' '}
        <span className="rounded bg-yellow px-1 text-black">{t('perto')}</span>{' '}
        {t('e as setas dizem se é mais alto ou mais baixo.')}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {blur !== null && (
            <div className="panel flex items-center gap-4 p-3">
              <img loading="lazy" decoding="async" src={gameCoverUrl(view.hint!)} alt="" className="h-24 w-16 rounded-lg border-2 border-black object-cover" style={{ filter: `blur(${blur}px)` }} />
              <div className="text-sm font-bold text-muted">{t('Dica: a capa do anime secreto (vai ficando mais nítida).')}</div>
            </div>
          )}

          {!over ? (
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-muted" size={16} />
              <input
                className="field !pl-9 !py-3"
                placeholder={t('Digite o nome de um anime… ({0} de {1})', guesses + 1, MAX)}
                disabled={busy}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && guess(suggestions[0])}
                autoFocus
              />
              {suggestions.length > 0 && (
                <div className="panel absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto p-1">
                  {suggestions.map((a) => (
                    <button key={a.id} onClick={() => guess(a)} className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-panel-2">
                      <img loading="lazy" decoding="async" src={a.c} alt="" className="h-10 w-7 rounded border border-black object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{title(a)}</span>
                      <span className="text-xs font-bold text-muted">{a.y}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : secret ? (
            <div className={`panel pop-in flex flex-wrap items-center gap-4 p-4 ${won ? 'border-[#4ade80]' : ''}`}>
              <img loading="lazy" decoding="async" src={secret.c} alt="" className="w-24 rounded-xl border-[3px] border-black" />
              <div className="min-w-[200px] flex-1">
                <div className="text-sm font-black text-muted">{won ? t('Acertou em {0}! 🎉', guesses) : t('Não foi dessa vez. Era…')}</div>
                <Link to={`/anime/${secret.id}`} className="font-display text-2xl hover:underline">
                  {title(secret)}
                </Link>
                <div className="text-xs font-bold text-muted">
                  {[secret.y, secret.s, FORMAT_LABEL[secret.f]].filter(Boolean).join(' · ')}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ShareButton text={shareText} />
                  <span className="text-xs font-bold text-muted">
                    {t('Próximo em')} <NextIn />
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {!rows.length ? (
            <EmptyState jp="謎" title={t('Qual será o anime de hoje?')}>
              {t('Comece chutando qualquer anime — as cores vão te guiando.')}
            </EmptyState>
          ) : (
            <div className="space-y-2.5">
              {rows
                .slice()
                .reverse()
                .map(({ a: r, cells }) => {
                  const right = cells.every((c) => c.hit === 'ok');
                  return (
                    <div key={r.id} className="pop-in panel p-2">
                      <div className="mb-2 flex items-center gap-2">
                        <img loading="lazy" decoding="async" src={r.c} alt="" className="h-9 w-6 rounded border border-black object-cover" />
                        <span className={`min-w-0 flex-1 truncate text-sm font-extrabold ${right && won ? 'text-[#4ade80]' : ''}`}>{title(r)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {cells.map((c, i) => (
                          <div key={i} className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg border-2 border-black px-1 py-1 text-center ${COLOR[c.hit]}`}>
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-70">{COLS()[i]}</span>
                            <span className="flex items-center gap-0.5 text-[11px] font-extrabold leading-tight">
                              <span className="line-clamp-2">{c.text}</span>
                              {c.arrow === 'up' && <ArrowUp size={13} className="shrink-0" />}
                              {c.arrow === 'down' && <ArrowDown size={13} className="shrink-0" />}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel grid grid-cols-3 gap-2 p-4 text-center">
            <div>
              <div className="font-display text-2xl">{played}</div>
              <div className="text-[10px] font-black uppercase text-muted">{t('Jogos')}</div>
            </div>
            <div>
              <div className="font-display text-2xl">{played ? Math.round((wins / played) * 100) : 0}%</div>
              <div className="text-[10px] font-black uppercase text-muted">{t('Vitórias')}</div>
            </div>
            <div>
              <div className="font-display text-2xl">{streak}</div>
              <div className="text-[10px] font-black uppercase text-muted">{t('Sequência')}</div>
            </div>
          </div>
          <Board game="animedle" day={day} format={(s) => (s ? `${MAX + 1 - s}/${MAX}` : 'X')} />
        </div>
      </div>
    </>
  );
}
