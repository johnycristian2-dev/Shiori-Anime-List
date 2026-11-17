import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Users, Star } from 'lucide-react';
import { ErrorBox, SectionTitle, Spinner } from '../../components/ui';
import { fmtMembers, todayKey, useAnimeTitle, usePool, type PoolAnime } from '../../games/core';
import { Board, localBest, ShareButton, SITE, useSubmit } from '../../games/shared';
import { t } from '../../lib/i18n';

type Mode = 'p' | 'sc';
const MAX_SCORE = 500;
const value = (a: PoolAnime, m: Mode) => (m === 'p' ? a.p : a.sc);
const show = (a: PoolAnime, m: Mode) => (m === 'p' ? fmtMembers(a.p) : `${a.sc}%`);

function pickNext(pool: PoolAnime[], mode: Mode, not: PoolAnime | null) {
  for (let i = 0; i < 50; i++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    if (!not) return a;
    if (a.id === not.id) continue;
    // evita empate e diferenças minúsculas (ficaria pura sorte)
    const diff = Math.abs(value(a, mode) - value(not, mode));
    if (mode === 'sc' ? diff >= 2 : diff >= Math.max(value(not, mode) * 0.04, 2000)) return a;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function useCountUp(target: number, run: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return setV(0);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

function Card({ a, mode, revealed, hidden, label }: { a: PoolAnime; mode: Mode; revealed: boolean; hidden: boolean; label?: string }) {
  const title = useAnimeTitle();
  const n = useCountUp(value(a, mode), revealed && hidden);
  const shown = !hidden ? show(a, mode) : revealed ? (mode === 'p' ? fmtMembers(n) : `${n}%`) : '?';
  return (
    <div className="pop-in relative overflow-hidden rounded-2xl border-[3px] border-black bg-panel">
      <img src={a.c} alt="" className="aspect-[3/4] w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <div className="line-clamp-2 text-sm font-extrabold leading-tight sm:text-base">{title(a)}</div>
        <div className="mt-1 font-display text-2xl sm:text-3xl">{shown}</div>
        <div className="text-[10px] font-black uppercase tracking-wider opacity-80">{label}</div>
      </div>
    </div>
  );
}

export default function HigherLower() {
  const pool = usePool();
  const title = useAnimeTitle();
  const [mode, setMode] = useState<Mode>('p');
  const [left, setLeft] = useState<PoolAnime | null>(null);
  const [right, setRight] = useState<PoolAnime | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'ask' | 'reveal' | 'over'>('ask');
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const [day] = useState(todayKey);
  const submit = useSubmit('maisoumenos');
  const [best, setBest] = useState(() => localBest('maisoumenos', day) ?? 0);

  const restart = useCallback(
    (m: Mode = mode) => {
      if (!pool.data) return;
      const l = pickNext(pool.data, m, null);
      setLeft(l);
      setRight(pickNext(pool.data, m, l));
      setScore(0);
      setPhase('ask');
      setLastOk(null);
    },
    [pool.data, mode]
  );

  useEffect(() => {
    if (pool.data && !left) restart();
  }, [pool.data, left, restart]);

  if (pool.error) return <ErrorBox error={pool.error} onRetry={() => pool.refetch()} />;
  if (!pool.data || !left || !right)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  const unit = mode === 'p' ? t('membros no AniList') : t('nota média');
  const answer = (higher: boolean) => {
    if (phase !== 'ask') return;
    const lv = value(left, mode);
    const rv = value(right, mode);
    const ok = rv === lv || (higher ? rv > lv : rv < lv);
    setLastOk(ok);
    setPhase('reveal');
    setTimeout(() => {
      if (ok) {
        const s = Math.min(MAX_SCORE, score + 1);
        setScore(s);
        setLeft(right);
        setRight(pickNext(pool.data!, mode, right));
        setPhase('ask');
        setLastOk(null);
      } else {
        setPhase('over');
        setBest((b) => Math.max(b, score));
        if (score > 0) submit(day, score, { mode });
      }
    }, 1300);
  };

  const shareText = `Mais ou menos · Shiori\n${mode === 'p' ? '👥 popularidade' : '⭐ nota'}: ${score} acertos seguidos 🔥\n${SITE}`;

  return (
    <>
      <SectionTitle title={t('Mais ou menos')} jp="ハイ＆ロー" />
      <div className="-mt-2 mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            ['p', t('Mais popular'), Users],
            ['sc', t('Nota maior'), Star],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            className={`chip ${mode === m ? 'active' : ''}`}
            onClick={() => {
              setMode(m);
              restart(m);
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
        <span className="ml-auto text-sm font-black">
          {t('Acertos:')} <span className="font-display text-xl text-pink">{score}</span>
          <span className="ml-3 text-muted">
            {t('Recorde hoje:')} {best}
          </span>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {phase === 'over' ? (
            <div className="panel pop-in space-y-4 p-6 text-center">
              <div className="font-jp text-5xl text-pink/40">終</div>
              <div className="font-display text-3xl">{t('{0} acertos seguidos', score)}</div>
              <p className="text-sm font-bold text-muted">
                {t('{0} tem {1} e {2} tem {3}.', title(left), show(left, mode), title(right), show(right, mode))}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button className="manga-btn" onClick={() => restart()}>
                  <RotateCcw size={16} /> {t('Jogar de novo')}
                </button>
                {score > 0 && <ShareButton text={shareText} />}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-center text-sm font-black">
                {mode === 'p' ? t('O da direita tem MAIS ou MENOS membros?') : t('O da direita tem nota MAIOR ou MENOR?')}
              </p>
              <div className="relative mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-5">
                <Card a={left} mode={mode} revealed hidden={false} label={unit} />
                <Card key={right.id} a={right} mode={mode} revealed={phase === 'reveal'} hidden label={unit} />
                <div
                  className={`absolute left-1/2 top-1/3 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border-[3px] border-black font-display text-sm ${
                    lastOk === null ? 'bg-panel' : lastOk ? 'bg-[#4ade80] text-black' : 'bg-red-500 text-white'
                  }`}
                >
                  {lastOk === null ? 'VS' : lastOk ? '✓' : '✗'}
                </div>
              </div>
              <div className="mx-auto mt-4 grid max-w-2xl grid-cols-2 gap-3">
                <button className="manga-btn cyan justify-center !py-3" disabled={phase !== 'ask'} onClick={() => answer(true)}>
                  <ArrowUp size={18} /> {mode === 'p' ? t('Mais') : t('Maior')}
                </button>
                <button className="manga-btn justify-center !py-3" disabled={phase !== 'ask'} onClick={() => answer(false)}>
                  <ArrowDown size={18} /> {mode === 'p' ? t('Menos') : t('Menor')}
                </button>
              </div>
            </>
          )}
        </div>
        <Board game="maisoumenos" day={day} format={(s) => t('{0} seguidos', s)} />
      </div>
    </>
  );
}
