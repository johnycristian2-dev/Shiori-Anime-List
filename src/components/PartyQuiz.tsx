import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crown, Medal, Play, SkipForward, Square, Zap } from 'lucide-react';
import { Spinner } from './ui';
import { useUI } from '../store/ui';
import { usePool } from '../games/core';
import { pickTitle } from '../lib/format';
import {
  answerCount,
  endQuiz,
  loadAnswers,
  loadQuiz,
  nextQuestion,
  readKey,
  reveal,
  scoreboard,
  sendAnswer,
  serverOffset,
  startQuiz,
  subscribeQuiz,
  type QOption,
  type Question,
  type Quiz,
  type QuizAnswer,
} from '../sync/partyQuiz';
import { t } from '../lib/i18n';

const LETTERS = ['A', 'B', 'C', 'D'];
const COLORS = ['bg-[#ff6b9a]', 'bg-[#4dd8ff]', 'bg-yellow', 'bg-[#7cff8a]'];

function prompt(q: Question, name: (x: NonNullable<Question['about']>) => string) {
  switch (q.kind) {
    case 'cover':
      return t('Que anime é esse?');
    case 'studio':
      return t('Qual estúdio animou {0}?', name(q.about!));
    case 'year':
      return t('Em que ano estreou {0}?', name(q.about!));
    case 'popular':
      return t('Qual desses é o mais popular?');
    case 'score':
      return t('Qual desses tem a maior nota?');
  }
}

export default function PartyQuiz({
  code,
  userId,
  myName,
  isHost,
  onlineCount,
}: {
  code: string;
  userId: string;
  myName: string;
  isHost: boolean;
  onlineCount: number;
}) {
  const toast = useUI((s) => s.toast);
  const titleLang = useUI((s) => s.titleLang);
  const name = useCallback((x: { r: string; e: string | null; n: string | null }) => pickTitle({ romaji: x.r, english: x.e, native: x.n }, titleLang), [titleLang]);
  const optLabel = (o: QOption) => o.text ?? (o.title ? name(o.title) : '?');

  const pool = usePool();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [counted, setCounted] = useState<{ round: number; n: number }>({ round: 0, n: 0 });
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Record<number, number>>({});
  const revealing = useRef(0);

  const refreshAnswers = useCallback(() => {
    loadAnswers(code)
      .then(setAnswers)
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    loadQuiz(code)
      .then(setQuiz)
      .catch(() => setQuiz(null));
    refreshAnswers();
    serverOffset().then(setOffset);
    return subscribeQuiz(
      code,
      (q) => {
        setQuiz(q);
        if (!q) setAnswers([]);
        else refreshAnswers();
      },
      refreshAnswers
    );
  }, [code, refreshAnswers]);

  // relógio + contador de respostas (a cada meio segundo durante a pergunta)
  useEffect(() => {
    if (quiz?.status !== 'question') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const round = quiz.round;
    const poll = () => answerCount(code, round).then((n) => setCounted({ round, n }));
    const id2 = setInterval(poll, 1000);
    poll();
    return () => {
      clearInterval(id);
      clearInterval(id2);
    };
  }, [quiz?.status, quiz?.round, code]);

  // contagem só vale pra rodada atual (senão a rodada nova herdaria o "todos responderam")
  const count = quiz && counted.round === quiz.round ? counted.n : 0;
  const left = quiz ? quiz.seconds - (now + offset - new Date(quiz.started_at).getTime()) / 1000 : 0;

  // anfitrião revela sozinho quando o tempo acaba ou todo mundo respondeu
  useEffect(() => {
    if (!isHost || !quiz || quiz.status !== 'question') return;
    if (revealing.current === quiz.round) return;
    if (left <= 0 || count >= Math.max(1, onlineCount)) {
      revealing.current = quiz.round;
      setTimeout(() => reveal(quiz).catch((e) => toast((e as Error).message, 'err')), left <= 0 ? 0 : 600);
    }
  }, [isHost, quiz, left, count, onlineCount, toast]);

  const board = useMemo(() => scoreboard(quiz ?? null, answers, quiz?.seconds), [quiz, answers]);
  const hostHasKeys = isHost && !!readKey(code);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  if (quiz === undefined) return null;

  /* ----- sem quiz rolando ----- */
  if (!quiz) {
    return (
      <div className="panel mb-8 flex flex-wrap items-center gap-3 p-4">
        <Zap size={20} className="text-yellow" />
        <div className="min-w-[200px] flex-1">
          <div className="font-display">{t('Quiz ao vivo')}</div>
          <div className="text-xs font-bold text-muted">
            {isHost
              ? t('10 perguntas de anime, 20 segundos cada. Acertar rápido vale mais.')
              : t('Quando o anfitrião 👑 começar, as perguntas aparecem aqui pra todo mundo.')}
          </div>
        </div>
        {isHost && (
          <button className="manga-btn yellow" disabled={busy || !pool.data} onClick={() => run(() => startQuiz(code, pool.data!))}>
            {busy ? <Spinner className="h-4 w-4" /> : <Play size={16} />} {t('Começar quiz')}
          </button>
        )}
      </div>
    );
  }

  const q = quiz.question;
  const myChoice = answers.find((a) => a.round === quiz.round && a.user_id === userId)?.choice ?? mine[quiz.round];
  const revealed = quiz.status !== 'question';
  const roundAnswers = answers.filter((a) => a.round === quiz.round);

  /* ----- fim ----- */
  if (quiz.status === 'done') {
    return (
      <div className="panel pop-in mb-8 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Medal size={20} className="text-yellow" />
          <h3 className="flex-1 font-display text-xl">{t('Resultado do quiz')}</h3>
          {isHost && (
            <>
              <button className="manga-btn yellow !py-1.5 !text-sm" disabled={busy || !pool.data} onClick={() => run(() => startQuiz(code, pool.data!))}>
                <Play size={14} /> {t('Jogar de novo')}
              </button>
              <button className="manga-btn ghost !py-1.5 !text-sm" disabled={busy} onClick={() => run(() => endQuiz(code))}>
                {t('Fechar')}
              </button>
            </>
          )}
        </div>
        {!board.length ? (
          <p className="text-sm font-bold text-muted">{t('Ninguém respondeu nada 😅')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {board.slice(0, 3).map((r, i) => (
              <div key={r.user_id} className={`rounded-2xl border-[3px] border-black p-4 text-center ${i === 0 ? 'bg-yellow text-black' : 'bg-panel-2'}`}>
                <div className="text-3xl">{['🥇', '🥈', '🥉'][i]}</div>
                <div className="truncate font-display text-lg">{r.name}</div>
                <div className="text-sm font-black">
                  {r.points} pts · {t('{0} acertos', r.hits)}
                </div>
              </div>
            ))}
            {board.slice(3).map((r, i) => (
              <div key={r.user_id} className="text-sm font-bold text-muted sm:col-span-3">
                {i + 4}. {r.name} — {r.points} pts
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ----- pergunta / revelação ----- */
  return (
    <div className="panel mb-8 overflow-hidden">
      <div className="flex items-center gap-3 border-b-2 border-black px-4 py-3">
        <Zap size={18} className="text-yellow" />
        <span className="font-display">
          {t('Pergunta {0}/{1}', quiz.round, quiz.total)}
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-black bg-panel-2">
          <div
            className={`h-full transition-[width] duration-200 ${left < 5 ? 'bg-red-500' : 'bg-pink'}`}
            style={{ width: revealed ? '0%' : `${Math.max(0, Math.min(100, (left / quiz.seconds) * 100))}%` }}
          />
        </div>
        <span className="w-8 text-right font-display tabular-nums">{revealed ? '—' : Math.max(0, Math.ceil(left))}</span>
      </div>

      <div className="grid gap-5 p-4 md:grid-cols-[1fr_240px]">
        <div>
          <div className="mb-4 flex items-center gap-4">
            {q.image && (
              <img
                src={q.image}
                alt=""
                className="h-28 w-20 shrink-0 rounded-xl border-[3px] border-black object-cover"
                style={{ filter: q.kind === 'cover' && !revealed ? 'blur(3px)' : undefined }}
              />
            )}
            <h3 className="font-display text-xl leading-tight sm:text-2xl">{prompt(q, name)}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o, k) => {
              const correct = revealed && quiz.answer === k;
              const wrongPick = revealed && myChoice === k && quiz.answer !== k;
              const who = revealed ? roundAnswers.filter((a) => a.choice === k).map((a) => a.name) : [];
              return (
                <button
                  key={k}
                  disabled={revealed || myChoice !== undefined || left <= 0}
                  onClick={() => {
                    setMine((m) => ({ ...m, [quiz.round]: k }));
                    sendAnswer(code, quiz.round, userId, myName, k).catch((e) => {
                      toast((e as Error).message, 'err');
                      setMine((m) => {
                        const n = { ...m };
                        delete n[quiz.round];
                        return n;
                      });
                    });
                  }}
                  className={`relative flex items-center gap-3 rounded-xl border-[3px] border-black p-2.5 text-left font-extrabold transition disabled:cursor-default ${
                    correct ? 'bg-[#4ade80] text-black' : wrongPick ? 'bg-red-500 text-white' : myChoice === k ? 'bg-pink text-[var(--on-pink)]' : 'bg-panel-2 hover:-translate-y-0.5'
                  } ${revealed && !correct && !wrongPick ? 'opacity-60' : ''}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-black font-display text-black ${COLORS[k]}`}>{LETTERS[k]}</span>
                  {o.c && <img src={o.c} alt="" className="h-12 w-8 shrink-0 rounded border border-black object-cover" />}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm">{optLabel(o)}</span>
                    {revealed && q.extra?.[k] && <span className="block text-[11px] font-black opacity-80">{q.extra[k]}</span>}
                    {who.length > 0 && <span className="block truncate text-[10px] font-bold opacity-80">{who.join(', ')}</span>}
                  </span>
                  {correct && <Check size={18} />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-center text-xs font-bold text-muted">
            {!revealed
              ? myChoice !== undefined
                ? t('Resposta enviada! {0} de {1} já responderam.', count, Math.max(onlineCount, count))
                : t('{0} de {1} já responderam.', count, Math.max(onlineCount, count))
              : myChoice === undefined
                ? t('Você não respondeu essa.')
                : quiz.answer === myChoice
                  ? t('Acertou! +{0} pts', board.find((b) => b.user_id === userId)?.last ?? 0)
                  : t('Errou essa 😵')}
          </div>
          {isHost && revealed && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="manga-btn" disabled={busy || !hostHasKeys} onClick={() => run(() => nextQuestion(quiz))}>
                <SkipForward size={16} /> {quiz.round >= quiz.total ? t('Ver resultado') : t('Próxima pergunta')}
              </button>
              <button className="manga-btn ghost" disabled={busy} onClick={() => run(() => endQuiz(code))}>
                <Square size={14} /> {t('Encerrar')}
              </button>
            </div>
          )}
          {isHost && !revealed && (
            <div className="mt-4 flex justify-center">
              <button className="manga-btn ghost !py-1.5 !text-sm" disabled={busy || !hostHasKeys} onClick={() => run(() => reveal(quiz))}>
                {t('Revelar agora')}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border-2 border-black bg-panel-2 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted">{t('Placar')}</div>
          {!board.length ? (
            <p className="text-xs font-bold text-muted">{t('Os pontos aparecem quando a primeira resposta for revelada.')}</p>
          ) : (
            <ol className="space-y-1">
              {board.map((r, i) => (
                <li key={r.user_id} className={`flex items-center gap-2 text-sm font-bold ${r.user_id === userId ? 'text-pink' : ''}`}>
                  <span className="w-4 text-center text-muted">{i === 0 ? <Crown size={12} className="inline text-yellow" /> : i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  {revealed && r.last > 0 && <span className="text-[10px] text-[#4ade80]">+{r.last}</span>}
                  <span className="font-display tabular-nums">{r.points}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
