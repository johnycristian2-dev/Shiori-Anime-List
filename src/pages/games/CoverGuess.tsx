import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Dumbbell, Play, X } from 'lucide-react';
import { ErrorBox, SectionTitle, Spinner } from '../../components/ui';
import { dayNumber, hashString, isMainEntry, rng, sample, shuffle, todayKey, useAnimeTitle, usePool, type PoolAnime } from '../../games/core';
import { Board, NextIn, ShareButton, SITE, useSubmit } from '../../games/shared';
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
  const t0 = useRef(0);
  const submit = useSubmit('imagem');

  const rounds = useMemo(
    () => (pool.data ? makeRounds(pool.data, rng(practice ? seed : hashString('imagem-' + day))) : []),
    [pool.data, practice, seed, day]
  );
  const round = rounds[i];

  // relógio da rodada
  useEffect(() => {
    if (phase !== 'play') return;
    t0.current = performance.now();
    setElapsed(0);
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

  function start(isPractice: boolean) {
    setPractice(isPractice);
    setSeed(Math.floor(Math.random() * 2 ** 31));
    setI(0);
    setScore(0);
    setMarks([]);
    setPicked(null);
    setPhase('play');
  }

  function choose(idx: number) {
    if (phase !== 'play' || !round) return;
    const e = Math.min(SECONDS, (performance.now() - t0.current) / 1000);
    const ok = idx >= 0 && round.options[idx].id === round.answer.id;
    const pts = ok ? Math.max(10, Math.round(100 * (1 - e / SECONDS))) : 0;
    const nextScore = score + pts;
    const nextMarks = [...marks, ok ? 'hit' : 'miss'] as Result['marks'];
    setPicked(idx);
    setScore(nextScore);
    setMarks(nextMarks);
    setPhase('feedback');
    setTimeout(() => {
      if (i + 1 < ROUNDS) {
        setI(i + 1);
        setPicked(null);
        setPhase('play');
      } else {
        setPhase('done');
        if (!practice) {
          const res = { score: nextScore, marks: nextMarks };
          setDaily(res);
          try {
            localStorage.setItem(KEY(day), JSON.stringify(res));
          } catch {
            /* ignore */
          }
          submit(day, nextScore, { hits: nextMarks.filter((m) => m === 'hit').length });
        }
      }
    }, 1400);
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
              <button className="manga-btn mx-auto !px-6 !py-3" onClick={() => start(false)}>
                <Play size={18} /> {t('Começar desafio de hoje')}
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
                  src={round.answer.c}
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
              {!practice && rounds.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {rounds.map((r) => (
                    <Link key={r.answer.id} to={`/anime/${r.answer.id}`} title={title(r.answer)}>
                      <img src={r.answer.c} alt="" className="h-14 w-10 rounded border-2 border-black object-cover" />
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
