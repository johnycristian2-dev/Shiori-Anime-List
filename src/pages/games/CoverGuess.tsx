import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Dumbbell, Play, X } from 'lucide-react';
import { ErrorBox, SectionTitle, Spinner } from '../../components/ui';
import { dayNumber, isMainEntry, rng, sample, shuffle, todayKey, useAnimeTitle, usePool, type PoolAnime } from '../../games/core';
import { coverAnswer, coverRound, gameCoverUrl } from '../../sync/games';
import { useUI } from '../../store/ui';
import { Board, NextIn, ShareButton, SITE, useNeedsLogin, useSubmit } from '../../games/shared';
import { openAuth } from '../../sync/account';
import { t } from '../../lib/i18n';

const ROUNDS = 10;
const SECONDS = 15;

interface Round {
  answer: PoolAnime;
  options: PoolAnime[];
}

/** 10 rodadas: capa certa + 3 opções erradas (de preferência com algum gênero em comum). */
export function makeRounds(pool: PoolAnime[], rand: () => number): Round[] {
  const main = pool.filter(isMainEntry).sort((a, b) => b.p - a.p).slice(0, 400);
  return sample(main, ROUNDS, rand).map((answer) => {
    const similar = main.filter((a) => a.id !== answer.id && a.g.some((g) => answer.g.includes(g)));
    const wrong = sample(similar.length >= 3 ? similar : main.filter((a) => a.id !== answer.id), 3, rand);
    return { answer, options: shuffle([answer, ...wrong], rand) };
  });
}

interface Result {
  score: number;
  marks: ('hit' | 'miss')[];
}
const KEY = (day: string) => `shiori-imagem-${day}`;
const readResult = (day: string): Result | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY(day)) || 'null');
  } catch {
    return null;
  }
};

export default function CoverGuess() {
  const pool = usePool();
  const title = useAnimeTitle();
  const toast = useUI((s) => s.toast);
  const [day] = useState(todayKey);
  const [practice, setPractice] = useState(false);
  const [seed, setSeed] = useState(0);
  const [daily, setDaily] = useState<Result | null>(() => readResult(day));
  const [phase, setPhase] = useState<'intro' | 'play' | 'feedback' | 'done'>(() => (readResult(day) ? 'done' : 'intro'));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [marks, setMarks] = useState<Result['marks']>([]);
  const [elapsed, setElapsed] = useState(0);
  // desafio do dia: a rodada vem do servidor (opções + link da capa que não diz qual é)
  const [live, setLive] = useState<{ options: number[]; img: string; answer?: number } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const t0 = useRef(0);
  const submit = useSubmit('imagem');
  const needsLogin = useNeedsLogin();

  const rounds = useMemo(() => (pool.data && practice ? makeRounds(pool.data, rng(seed)) : []), [pool.data, practice, seed]);
  const byId = useMemo(() => new Map((pool.data ?? []).map((a) => [a.id, a])), [pool.data]);
  const round: Round | null = practice
    ? rounds[i] ?? null
    : live
      ? {
          answer: (live.answer ? byId.get(live.answer) : undefined) ?? ({ id: -1, c: '' } as PoolAnime),
          options: live.options.map((id) => byId.get(id)).filter(Boolean) as PoolAnime[],
        }
      : null;
  const imgSrc = practice ? round?.answer.c : live ? gameCoverUrl(live.img) : undefined;

  // relógio da rodada
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const e = (performance.now() - t0.current) / 1000;
      setElapsed(e);
      if (e >= SECONDS) choose(-1);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, i]);

  if (pool.error) return <ErrorBox error={pool.error} onRetry={() => pool.refetch()} />;
  if (!pool.data)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  function finishDaily(res: Result, ans: number[]) {
    setDaily(res);
    setAnswers(ans);
    setPhase('done');
    try {
      localStorage.setItem(KEY(day), JSON.stringify(res));
    } catch {
      /* ignore */
    }
  }

  async function nextLive() {
    const r = await coverRound();
    if (r.done) {
      finishDaily({ score: r.score, marks: r.marks }, r.answers ?? []);
      return;
    }
    setI(r.i ?? 0);
    setScore(r.score);
    setMarks(r.marks);
    setPicked(null);
    setLive({ options: r.options ?? [], img: r.img ?? '' });
    t0.current = performance.now() - (r.elapsed ?? 0) * 1000;
    setElapsed(r.elapsed ?? 0);
    setPhase('play');
  }

  async function start(isPractice: boolean) {
    setPractice(isPractice);
    setI(0);
    setScore(0);
    setMarks([]);
    setPicked(null);
    if (isPractice) {
      setSeed(Math.floor(Math.random() * 2 ** 31));
      t0.current = performance.now();
      setElapsed(0);
      setPhase('play');
      return;
    }
    setBusy(true);
    try {
      await nextLive();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function choose(idx: number) {
    if (phase !== 'play' || !round || busy) return;
    if (practice) {
      const e = Math.min(SECONDS, (performance.now() - t0.current) / 1000);
      const ok = idx >= 0 && round.options[idx].id === round.answer.id;
      const pts = ok ? Math.max(10, Math.round(100 * (1 - e / SECONDS))) : 0;
      setPicked(idx);
      setScore(score + pts);
      setMarks([...marks, ok ? 'hit' : 'miss']);
      setPhase('feedback');
      setTimeout(() => {
        if (i + 1 < ROUNDS) {
          setI(i + 1);
          setPicked(null);
          t0.current = performance.now();
          setElapsed(0);
          setPhase('play');
        } else setPhase('done');
      }, 1400);
      return;
    }
    // desafio do dia: quem confere e cronometra é o servidor
    setBusy(true);
    setPicked(idx);
    try {
      const r = await coverAnswer(idx >= 0 ? round.options[idx].id : -1);
      setLive((l) => (l ? { ...l, answer: r.answer } : l));
      setScore(r.score);
      setMarks(r.marks);
      setAnswers((a) => [...a, r.answer]);
      setPhase('feedback');
      setTimeout(async () => {
        if (r.done) {
          finishDaily({ score: r.score, marks: r.marks }, [...answers, r.answer]);
          submit(day, r.score);
        } else {
          try {
            await nextLive();
          } catch (e) {
            toast((e as Error).message, 'err');
          }
        }
        setBusy(false);
      }, 1400);
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  }

  const blur = phase === 'play' ? Math.max(0, 28 * (1 - elapsed / SECONDS)) : 0;
  const shown = practice ? { score, marks } : daily ?? { score, marks };
  const shareText = `Adivinhe a capa · Shiori #${dayNumber(day)}\n${shown.marks.map((m) => (m === 'hit' ? '🟩' : '🟥')).join('')}  ${shown.score}/1000\n${SITE}`;

  return (
    <>
      <SectionTitle title={t('Adivinhe pela capa')} jp="ぼかし当て" />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {phase === 'intro' && (
            <div className="panel space-y-4 p-6 text-center">
              <div className="font-jp text-6xl text-pink/40">絵</div>
              <p className="mx-auto max-w-md text-sm font-bold text-muted">
                {t('{0} capas borradas que vão ficando nítidas. Quanto mais rápido acertar, mais pontos (até 100 por capa). O desafio é o mesmo pra todo mundo hoje e só a primeira tentativa vale pro ranking.', ROUNDS)}
              </p>
              {needsLogin ? (
                <button className="manga-btn mx-auto !px-6 !py-3" onClick={() => openAuth('signin')}>
                  <Play size={18} /> {t('Entre pra jogar o desafio de hoje')}
                </button>
              ) : (
                <button className="manga-btn mx-auto !px-6 !py-3" disabled={busy} onClick={() => start(false)}>
                  <Play size={18} /> {t('Começar desafio de hoje')}
                </button>
              )}
              <button className="manga-btn ghost mx-auto" onClick={() => start(true)}>
                <Dumbbell size={16} /> {t('Treinar com outras capas')}
              </button>
            </div>
          )}

          {(phase === 'play' || phase === 'feedback') && round && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-black">
                <span>
                  {i + 1}/{ROUNDS}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-black bg-panel-2">
                  <div className="h-full bg-pink transition-[width] duration-100" style={{ width: `${Math.max(0, 100 - (elapsed / SECONDS) * 100)}%` }} />
                </div>
                <span className="font-display text-lg text-pink">{score}</span>
                {practice && <span className="chip cursor-default !px-2 !py-0.5 !text-[10px]">{t('treino')}</span>}
              </div>
              <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border-[3px] border-black bg-panel">
                <img
                  src={imgSrc}
                  alt=""
                  draggable={false}
                  className="aspect-[3/4] w-full select-none object-cover"
                  style={{ filter: `blur(${blur}px)`, transform: 'scale(1.08)' }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {round.options.map((o, k) => {
                  const right = o.id === round.answer.id;
                  const state = phase === 'feedback' ? (right ? 'bg-[#4ade80] text-black' : picked === k ? 'bg-red-500 text-white' : 'opacity-50') : '';
                  return (
                    <button
                      key={o.id}
                      disabled={phase !== 'play'}
                      onClick={() => choose(k)}
                      className={`manga-btn ghost justify-start !py-3 text-left !text-sm ${state}`}
                    >
                      {phase === 'feedback' && right ? <Check size={16} /> : phase === 'feedback' && picked === k ? <X size={16} /> : null}
                      <span className="line-clamp-2">{title(o)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="panel pop-in space-y-4 p-6 text-center">
              <div className="text-sm font-black text-muted">{practice ? t('Treino') : t('Desafio #{0}', dayNumber(day))}</div>
              <div className="font-display text-4xl">
                {shown.score}
                <span className="text-lg text-muted">/1000</span>
              </div>
              <div className="text-2xl tracking-widest">{shown.marks.map((m) => (m === 'hit' ? '🟩' : '🟥')).join('')}</div>
              {!practice && answers.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {answers.map((id) => byId.get(id)).filter(Boolean).map((a) => (
                    <Link key={a!.id} to={`/anime/${a!.id}`} title={title(a!)}>
                      <img src={a!.c} alt="" className="h-14 w-10 rounded border-2 border-black object-cover" />
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {!practice && <ShareButton text={shareText} />}
                <button className="manga-btn ghost" onClick={() => start(true)}>
                  <Dumbbell size={16} /> {t('Treinar com outras capas')}
                </button>
              </div>
              <div className="text-xs font-bold text-muted">
                {t('Próximo desafio em')} <NextIn />
              </div>
            </div>
          )}
        </div>
        <Board game="imagem" day={day} format={(s) => String(s)} />
      </div>
    </>
  );
}
