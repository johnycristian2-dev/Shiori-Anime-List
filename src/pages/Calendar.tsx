import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useAiring } from '../api/hooks';
import AddMenu from '../components/AddMenu';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { STATUS_META, useList } from '../store/list';
import { useTitle, coverOf } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import type { AiringItem } from '../types';

import { t, locale } from '../lib/i18n';

const DAYS = [
  {
    get pt() {
      return t('Seg');
    },

    jp: '月'
  },
  {
    get pt() {
      return t('Ter');
    },

    jp: '火'
  },
  {
    get pt() {
      return t('Qua');
    },

    jp: '水'
  },
  {
    get pt() {
      return t('Qui');
    },

    jp: '木'
  },
  {
    get pt() {
      return t('Sex');
    },

    jp: '金'
  },
  {
    get pt() {
      return t('Sáb');
    },

    jp: '土'
  },
  {
    get pt() {
      return t('Dom');
    },

    jp: '日'
  },
];

function weekStart(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

export function countdown(ts: number, now: number) {
  const s = ts - now / 1000;
  if (s <= 0) return t('já saiu');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return t('em {0}d {1}h', Math.floor(h / 24), h % 24);
  return h ? t('em {0}h {1}min', h, m) : t('em {0}min', m);
}

function AiringCard({ a, now }: { a: AiringItem; now: number }) {
  const title = useTitle();
  const entry = useList((s) => s.entries[a.media.id]);
  const time = new Date(a.airingAt * 1000).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const aired = a.airingAt * 1000 < now;
  return (
    <div
      className={`panel flex gap-3 p-2.5 transition ${aired ? 'opacity-70' : ''}`}
      style={entry ? { borderColor: STATUS_META[entry.status].color } : undefined}
    >
      <Link to={`/anime/${a.media.id}`} className="shrink-0">
        <img src={coverOf(a.media)} alt="" loading="lazy" className="h-24 w-16 rounded-lg border-2 border-black object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="rounded-md bg-pink px-1.5 py-0.5 text-[var(--on-pink)]">{time}</span>
          <span className="text-cyan">{t('Ep')}{' '}{a.episode}{a.media.episodes ? `/${a.media.episodes}` : ''}</span>
          {!aired && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Clock size={11} /> {countdown(a.airingAt, now)}
            </span>
          )}
        </div>
        <Link to={`/anime/${a.media.id}`} className="mt-1 line-clamp-2 font-extrabold leading-tight hover:text-pink">
          {title(a.media)}
        </Link>
        <div className="mt-1 text-[11px] font-bold text-muted">
          {[a.media.format && FORMAT_LABEL[a.media.format], a.media.averageScore && `★ ${a.media.averageScore}`].filter(Boolean).join(' · ')}
          {entry && (
            <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] text-black" style={{ background: STATUS_META[entry.status].color }}>
              {STATUS_META[entry.status].label} · {entry.progress}{' '}{t('ep')}
            </span>
          )}
        </div>
      </div>
      <div className="self-start">
        <AddMenu media={a.media} compact />
      </div>
    </div>
  );
}

export default function Calendar() {
  const [offset, setOffset] = useState(0);
  const [onlyMine, setOnlyMine] = useState(false);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(todayIdx);
  const [now, setNow] = useState(Date.now());
  const entries = useList((s) => s.entries);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const start = useMemo(() => weekStart(offset), [offset]);
  const from = Math.floor(start.getTime() / 1000) - 1;
  const to = from + 7 * 86400 + 1;
  const q = useAiring(from, to);

  const byDay = useMemo(() => {
    const out: AiringItem[][] = Array.from({ length: 7 }, () => []);
    (q.data ?? [])
      .filter((a) => !onlyMine || (entries[a.media.id] && ['WATCHING', 'PLANNING', 'PAUSED'].includes(entries[a.media.id].status)))
      .forEach((a) => {
        const i = Math.floor((a.airingAt * 1000 - start.getTime()) / 864e5);
        if (i >= 0 && i < 7) out[i].push(a);
      });
    return out;
  }, [q.data, onlyMine, entries, start]);

  const label = `${start.toLocaleDateString(locale(), { day: '2-digit', month: 'short' })} – ${new Date(start.getTime() + 6 * 864e5).toLocaleDateString(locale(), { day: '2-digit', month: 'short' })}`;

  return (
    <>
      <SectionTitle title={t('Calendário')} jp="放送予定" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="manga-btn ghost !p-2" onClick={() => setOffset((o) => o - 1)} aria-label={t('Semana anterior')}>
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-[10rem] text-center font-display">{offset === 0 ? t('Esta semana') : label}</div>
        <button className="manga-btn ghost !p-2" onClick={() => setOffset((o) => o + 1)} aria-label={t('Próxima semana')}>
          <ChevronRight size={18} />
        </button>
        {offset !== 0 && (
          <button className="chip" onClick={() => { setOffset(0); setDay(todayIdx); }}>
            {t('Hoje')}
          </button>
        )}
        <button className={`chip ml-auto ${onlyMine ? 'on' : ''}`} onClick={() => setOnlyMine((v) => !v)}>
          {t('Só da minha lista')}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => {
          const date = new Date(start.getTime() + i * 864e5);
          const isToday = offset === 0 && i === todayIdx;
          return (
            <button
              key={d.pt}
              onClick={() => setDay(i)}
              className={`rounded-xl border-2 py-2 text-center transition ${
                day === i ? 'border-black bg-pink text-[var(--on-pink)] shadow-[3px_3px_0_var(--shadow)]' : 'border-line bg-panel hover:border-pink'
              }`}
            >
              <div className="font-jp text-lg font-black leading-none">{d.jp}</div>
              <div className="text-[10px] font-extrabold">
                {d.pt} {date.getDate()}
              </div>
              <div className={`mt-0.5 text-[10px] font-black ${day === i ? 'text-white/80' : isToday ? 'text-pink' : 'text-muted'}`}>
                {q.isLoading ? '·' : byDay[i].length}
                {isToday && ' •'}
              </div>
            </button>
          );
        })}
      </div>

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid h-40 place-items-center">
          <Spinner className="h-8 w-8 text-pink" />
        </div>
      ) : byDay[day].length === 0 ? (
        <EmptyState jp="休" title={onlyMine ? t('Nada da sua lista neste dia') : t('Nenhum episódio neste dia')}>
          {onlyMine ? t('Desligue o filtro "Só da minha lista" pra ver tudo.') : t('Tente outro dia.')}
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {byDay[day].map((a) => (
            <AiringCard key={a.id} a={a} now={now} />
          ))}
        </div>
      )}
    </>
  );
}
