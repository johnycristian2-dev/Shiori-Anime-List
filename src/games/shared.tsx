import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, LogIn, Share2, Trophy } from 'lucide-react';
import { openAuth } from '../sync/account';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { useCloudUser } from '../sync/cloud';
import { dayBoard, myHistory, type GameId } from '../sync/games';
import { useUI } from '../store/ui';
import { shiftDay, todayKey } from './core';
import { t } from '../lib/i18n';

/* ---------- histórico local (funciona sem conta) ---------- */

const HKEY = 'shiori-games-history';
type Hist = Partial<Record<GameId, Record<string, number>>>;
const readHist = (): Hist => {
  try {
    return JSON.parse(localStorage.getItem(HKEY) || '{}');
  } catch {
    return {};
  }
};
export function recordLocal(game: GameId, day: string, score: number) {
  const h = readHist();
  const g = (h[game] ??= {});
  g[day] = Math.max(g[day] ?? 0, score);
  try {
    localStorage.setItem(HKEY, JSON.stringify(h));
  } catch {
    /* sem espaço */
  }
}
export const localBest = (game: GameId, day: string) => readHist()[game]?.[day] ?? null;

/** Sequência de dias seguidos com vitória (score > 0), juntando o local com o da conta. */
export function useStreak(game: GameId) {
  const user = useCloudUser((s) => s.user);
  const q = useQuery({ queryKey: ['game-history', game, user?.id], queryFn: () => myHistory(game, user!.id), enabled: !!user });
  const days: Record<string, number> = { ...(readHist()[game] ?? {}) };
  q.data?.forEach((r) => (days[r.day] = Math.max(days[r.day] ?? 0, r.score)));
  let day = todayKey();
  if (!(days[day] > 0)) day = shiftDay(day, -1);
  let streak = 0;
  while (days[day] > 0) {
    streak++;
    day = shiftDay(day, -1);
  }
  const played = Object.keys(days).length;
  const wins = Object.values(days).filter((s) => s > 0).length;
  return { streak, played, wins };
}

/** Salva o resultado (local + conta) e atualiza o ranking. */
export function useSubmit(game: GameId) {
  const qc = useQueryClient();
  const toast = useUI((s) => s.toast);
  // A pontuação já foi gravada pelo servidor; aqui só guarda no aparelho (sequência) e atualiza o ranking.
  return async (day: string, score: number, _detail?: Record<string, unknown>) => {
    void toast;
    recordLocal(game, day, score);
    qc.invalidateQueries({ queryKey: ['game-board', game, day] });
    qc.invalidateQueries({ queryKey: ['game-history', game] });
  };
}

/* ---------- ranking do dia ---------- */

export function Board({ game, day, format }: { game: GameId; day: string; format: (score: number) => string }) {
  const user = useCloudUser((s) => s.user);
  const q = useQuery({ queryKey: ['game-board', game, day], queryFn: () => dayBoard(game, day), enabled: !!user, refetchInterval: 30_000 });
  if (!user)
    return (
      <div className="panel p-4 text-sm font-bold text-muted">
        <Trophy size={16} className="mb-1 text-yellow" />
        {t('Entre na sua conta pra entrar no ranking com seus amigos.')}
      </div>
    );
  // maior pontuação primeiro; empate = quem fez antes
  const rows = (q.data ?? []).slice().sort((a, b) => b.score - a.score || a.updated_at.localeCompare(b.updated_at));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-yellow" />
        <h3 className="flex-1 font-display">{t('Ranking de hoje')}</h3>
        <span className="text-[11px] font-bold text-muted">{t('você + quem você segue')}</span>
      </div>
      {q.isLoading ? (
        <Spinner className="h-5 w-5" />
      ) : !rows.length ? (
        <p className="text-sm font-bold text-muted">{t('Ninguém jogou hoje ainda. Seja o primeiro!')}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold ${r.user_id === user.id ? 'bg-pink/15' : ''}`}
            >
              <span className="w-5 text-center font-display text-muted">{i === 0 ? <Crown size={14} className="inline text-yellow" /> : i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.user_id === user.id && <span className="text-muted">{t(' (você)')}</span>}
              </span>
              <span className="font-display">{format(r.score)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] font-bold text-muted">
        {t('Siga seus amigos em')}{' '}
        <Link to="/amigos" className="text-pink underline">
          {t('Amigos')}
        </Link>{' '}
        {t('pra ver a pontuação deles aqui.')}
      </p>
    </div>
  );
}

/* ---------- utilidades de tela ---------- */

/** Contagem regressiva até o próximo desafio (meia-noite de Brasília). */
export function NextIn() {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const left = 86_400 - (brt.getHours() * 3600 + brt.getMinutes() * 60 + brt.getSeconds());
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className="font-display tabular-nums">
      {hh}:{mm}:{ss}
    </span>
  );
}

export function ShareButton({ text }: { text: string }) {
  const toast = useUI((s) => s.toast);
  const share = async () => {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('Resultado copiado! Cole no grupo 😎'));
      }
    } catch {
      /* cancelado */
    }
  };
  return (
    <button className="manga-btn yellow" onClick={share}>
      <Share2 size={16} /> {t('Compartilhar')}
    </button>
  );
}

export const SITE = 'shiori-anime-list.vercel.app';

/** Os jogos valendo ranking precisam de conta (o servidor confere cada jogada). */
export function useNeedsLogin() {
  const user = useCloudUser((s) => s.user);
  const ready = useCloudUser((s) => s.ready);
  return ready && (!user || user.is_anonymous);
}
export function LoginToPlay({ title, jp }: { title: string; jp: string }) {
  return (
    <div className="panel mx-auto max-w-md space-y-4 p-6 text-center">
      <div className="font-jp text-5xl text-pink/40">{jp}</div>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-sm font-bold text-muted">{t('Entre na sua conta pra jogar. É grátis e o servidor guarda seu resultado e seu ranking com os amigos.')}</p>
      <button className="manga-btn mx-auto" onClick={() => openAuth('signin')}>
        <LogIn size={16} /> {t('Entrar ou criar conta')}
      </button>
    </div>
  );
}
