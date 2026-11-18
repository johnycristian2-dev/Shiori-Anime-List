import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Users, Star } from 'lucide-react';
import { ErrorBox, SectionTitle, Spinner } from '../../components/ui';
import { fmtMembers, todayKey, useAnimeTitle, usePool, type PoolAnime } from '../../games/core';
import { Board, localBest, LoginToPlay, ShareButton, SITE, useNeedsLogin, useSubmit } from '../../games/shared';
import { hlAnswer, hlStart } from '../../sync/games';
import { useUI } from '../../store/ui';
import { t } from '../../lib/i18n';

type Mode = 'p' | 'sc';
const MAX_SCORE = 500;
const fmt = (v: number, m: Mode) => (m === 'p' ? fmtMembers(v) : `${v}%`);

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

function Card({ a, mode, value, revealed, hidden, label }: { a: PoolAnime; mode: Mode; value: number | null; revealed: boolean; hidden: boolean; label?: string }) {
  const title = useAnimeTitle();
  const n = useCountUp(value ?? 0, revealed && hidden && value !== null);
  const shown = !hidden ? fmt(value ?? 0, mode) : revealed && value !== null ? fmt(n, mode) : '?';
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
  const toast = useUI((s) => s.toast);
  const [mode, setMode] = useState<Mode>('p');
  const [left, setLeft] = useState<PoolAnime | null>(null);
  const [right, setRight] = useState<PoolAnime | null>(null);
  // os números vêm do servidor (o da direita só depois de responder)
  const [leftValue, setLeftValue] = useState(0);
  const [rightValue, setRightValue] = useState<number | null>(null);
  const [run, setRun] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'ask' | 'reveal' | 'over'>('ask');
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [day] = useState(todayKey);
  const submit = useSubmit('maisoumenos');
  const [best, setBest] = useState(() => localBest('maisoumenos', day) ?? 0);
  const needsLogin = useNeedsLogin();
  const byId = useCallback((id: number) => pool.data?.find((a) => a.id === id) ?? null, [pool.data]);

  const restart = useCallback(
    async (m: Mode = mode) => {
      if (!pool.data) return;
      setBusy(true);
      try {
        const r = await hlStart(m);
        setRun(r.run);
        setLeft(byId(r.left));
        setLeftValue(r.left_value);
        setRight(byId(r.right));
        setRightValue(null);
        setScore(0);
        setPhase('ask');
        setLastOk(null);
      } catch (e) {
        toast((e as Error).message, 'err');
      } finally {
        setBusy(false);
      }
    },
    [pool.data, mode, byId, toast]
  );

  useEffect(() => {
    if (pool.data && !left && !busy && !needsLogin) restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.data, needsLogin]);

  if (needsLogin) return <LoginToPlay title={t('Mais ou menos')} jp="ハイ＆ロー" />;
  if (pool.error) return <ErrorBox error={pool.error} onRetry={() => pool.refetch()} />;
  if (!pool.data || !left || !right)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );

  const unit = mode === 'p' ? t('membros no AniList') : t('nota média');
  const answer = async (higher: boolean) => {
    if (phase !== 'ask' || !run || busy) return;
    setBusy(true);
    try {
      const r = await hlAnswer(run, higher);
      setRightValue(r.right_value);
      setLastOk(r.ok);
      setPhase('reveal');
      setTimeout(() => {
        if (r.ok && r.next) {
          setScore(r.score);
          setLeft(right);
          setLeftValue(r.right_value);
          setRight(byId(r.next));
          setRightValue(null);
          setPhase('ask');
          setLastOk(null);
        } else {
          setPhase('over');
          setBest((b) => Math.max(b, r.score));
          if (r.score > 0) submit(day, r.score);
        }
        setBusy(false);
      }, 1300);
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
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
                {t('{0} tem {1} e {2} tem {3}.', title(left), fmt(leftValue, mode), title(right), fmt(rightValue ?? 0, mode))}
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
                <Card a={left} mode={mode} value={leftValue} revealed hidden={false} label={unit} />
                <Card key={right.id} a={right} mode={mode} value={rightValue} revealed={phase === 'reveal'} hidden label={unit} />
                <div
                  className={`absolute left-1/2 top-1/3 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border-[3px] border-black font-display text-sm ${
                    lastOk === null ? 'bg-panel' : lastOk ? 'bg-[#4ade80] text-black' : 'bg-red-500 text-white'
                  }`}
                >
                  {lastOk === null ? 'VS' : lastOk ? '✓' : '✗'}
                </div>
              </div>
              <div className="mx-auto mt-4 grid max-w-2xl grid-cols-2 gap-3">
                <button className="manga-btn cyan justify-center !py-3" disabled={phase !== 'ask' || busy} onClick={() => answer(true)}>
                  <ArrowUp size={18} /> {mode === 'p' ? t('Mais') : t('Maior')}
                </button>
                <button className="manga-btn justify-center !py-3" disabled={phase !== 'ask' || busy} onClick={() => answer(false)}>
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
