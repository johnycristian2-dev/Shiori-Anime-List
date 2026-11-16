import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, RotateCcw, Share2 } from 'lucide-react';
import { EmptyState, SectionTitle, Spinner } from '../components/ui';
import { yearStats, yearsWithData } from '../lib/wrapped';
import { computeStats, rankOf } from '../lib/profile';
import { renderShareCard } from '../lib/shareCard';
import { genrePt, GENRES } from '../lib/labels';
import { pickTitle } from '../lib/format';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { HistoryEvent, ListEntry } from '../types';

import { t, locale } from '../lib/i18n';

const NO_HISTORY: HistoryEvent[] = [];

const monthName = (m: number) => new Date(2000, m, 1).toLocaleString(locale(), { month: 'long' }).replace(/^./, (c) => c.toUpperCase());
const monthShort = (m: number) => new Date(2000, m, 1).toLocaleString(locale(), { month: 'narrow' });

function Slide({ bg, children, jp }: { bg: string; children: ReactNode; jp?: string }) {
  return (
    <div className={`pop-in relative flex h-full flex-col justify-center overflow-hidden p-7 sm:p-10 ${bg}`}>
      <div className="speedlines pointer-events-none absolute inset-0 opacity-40" />
      {jp && <div className="pointer-events-none absolute -right-3 -top-4 font-jp text-[110px] font-black leading-none opacity-15">{jp}</div>}
      <div className="relative">{children}</div>
    </div>
  );
}

export default function Wrapped() {
  const entries = useList((s) => s.entries);
  const history = useList((s) => s.history ?? NO_HISTORY);
  const lang = useUI((s) => s.titleLang);
  const nickname = useUI((s) => s.nickname);
  const toast = useUI((s) => s.toast);
  const years = useMemo(() => yearsWithData(Object.values(entries), history), [entries, history]);
  const [year, setYear] = useState(years[0]);
  const [i, setI] = useState(0);
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const s = useMemo(() => yearStats(entries, history, year), [entries, history, year]);
  const name = (e: ListEntry) => pickTitle({ romaji: e.title, english: e.titleEnglish, native: e.titleNative }, lang);

  useEffect(() => setI(0), [year]);
  useEffect(
    () => () => {
      if (card) URL.revokeObjectURL(card.url);
    },
    [card],
  );

  const slides: ReactNode[] = useMemo(() => {
    if (s.isEmpty) return [];
    const out: ReactNode[] = [];
    out.push(
      <Slide bg="bg-pink text-[var(--on-pink)]" jp="年間">
        <div className="font-jp text-lg font-black opacity-80">{year}年 まとめ</div>
        <h2 className="stroke-title mt-2 break-words font-display text-4xl leading-none sm:text-5xl">{t('Sua retrospectiva')}{' '}{year}</h2>
        <p className="mt-4 text-lg font-extrabold">{nickname ? `${nickname}, ` : ''}{t('bora ver seu ano em anime? 👉')}</p>
      </Slide>,
    );
    out.push(
      <Slide bg="bg-cyan text-black" jp="視聴">
        <div className="text-lg font-black">{t('Você assistiu')}</div>
        <div className="font-display text-7xl leading-none sm:text-8xl">{s.eps.toLocaleString(locale())}</div>
        <div className="text-2xl font-black">{t('episódios')}</div>
        <p className="mt-4 text-lg font-bold">
          {t('Isso dá uns')}{' '}<b>{s.hours.toLocaleString(locale())}{' '}{t('horas')}</b>
          {s.hours >= 2 && <>{' '}{t('— o mesmo que ver uns')}{' '}{Math.round(s.hours / 2)}{' '}{t('filmes seguidos 🍿')}</>}.
        </p>
      </Slide>,
    );
    if (s.bestMonth != null) {
      const max = Math.max(...s.months, 1);
      out.push(
        <Slide bg="bg-yellow text-black" jp="月">
          <div className="text-lg font-black">{t('Seu mês mais otaku foi')}</div>
          <div className="font-display text-5xl sm:text-6xl">{monthName(s.bestMonth)}</div>
          <div className="mt-6 flex h-36 items-end gap-1.5">
            {s.months.map((v, m) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-md border-2 border-b-0 border-black ${m === s.bestMonth ? 'bg-pink' : 'bg-black/20'}`}
                  style={{ height: `${(v / max) * 120 + 2}px` }}
                />
                <span className="text-xs font-black">{monthShort(m)}</span>
              </div>
            ))}
          </div>
        </Slide>,
      );
    }
    if (s.genres.length) {
      const [g] = s.genres[0];
      out.push(
        <Slide bg="bg-bg-2 text-ink" jp={GENRES[g]?.jp ?? 'ジャンル'}>
          <div className="text-lg font-black text-muted">{t('Seu gênero do ano')}</div>
          <div className="font-display text-6xl text-pink">{genrePt(g)}</div>
          <div className="mt-6 space-y-2">
            {s.genres.slice(1, 4).map(([x], k) => (
              <div key={x} className="font-display text-2xl">
                <span className="text-muted">#{k + 2}</span> {genrePt(x)}
              </div>
            ))}
          </div>
        </Slide>,
      );
    }
    if (s.mostWatched?.entry) {
      const e = s.mostWatched.entry;
      out.push(
        <Slide bg="bg-pink text-[var(--on-pink)]" jp="一気見">
          <div className="text-lg font-black">{t('O anime que você mais maratonou')}</div>
          <div className="mt-4 flex items-center gap-5">
            {e.cover && <img src={e.cover} alt="" className="w-28 rounded-xl border-[3px] border-black shadow-[5px_5px_0_#000] sm:w-36" />}
            <div className="min-w-0">
              <div className="break-words font-display text-2xl leading-tight sm:text-3xl">{name(e)}</div>
              <div className="mt-2 text-xl font-black">{s.mostWatched.eps}{' '}{t('episódios')}</div>
            </div>
          </div>
        </Slide>,
      );
    }
    if (s.topRated.length) {
      out.push(
        <Slide bg="bg-bg-2 text-ink" jp="殿堂">
          <div className="mb-4 text-lg font-black text-muted">{t('Seu top')}{' '}{s.topRated.length}{' '}{t('do ano')}</div>
          <div className="space-y-2.5">
            {s.topRated.map((e, k) => (
              <div key={e.mediaId} className="flex items-center gap-3">
                <span className="w-8 font-display text-2xl text-pink">#{k + 1}</span>
                {e.cover && <img src={e.cover} alt="" className="h-14 w-10 rounded-md border-2 border-black object-cover" />}
                <span className="min-w-0 flex-1 truncate font-extrabold">{name(e)}</span>
                <span className="rounded-md border-2 border-black bg-yellow px-1.5 font-black text-black">★ {e.score}</span>
              </div>
            ))}
          </div>
        </Slide>,
      );
    }
    out.push(
      <Slide bg="bg-cyan text-black" jp="記録">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="font-display text-5xl">{s.completed.length}</div>
            <div className="font-black">{t('animes completos')}</div>
          </div>
          <div>
            <div className="font-display text-5xl">{s.addedCount}</div>
            <div className="font-black">{t('novos na lista')}</div>
          </div>
          <div>
            <div className="font-display text-5xl">{s.activeDays}</div>
            <div className="font-black">{t('dias assistindo')}</div>
          </div>
          <div>
            <div className="font-display text-5xl">{s.longestStreak}</div>
            <div className="font-black">{t('dias seguidos (recorde)')}</div>
          </div>
        </div>
      </Slide>,
    );
    const rank = rankOf(computeStats(Object.values(entries)).completed);
    out.push(
      <Slide bg="bg-yellow text-black" jp={rank.jp}>
        <div className="text-lg font-black">{t('Você fecha')}{' '}{year}{' '}{t('como')}</div>
        <div className="font-display text-6xl">{rank.name}</div>
        <div className="font-jp text-3xl font-black">{rank.jp}</div>
        <p className="mt-4 font-bold">{t('Obrigado por assistir com o Shiori 栞. Que')}{' '}{year + 1}{' '}{t('venha com muito anime!')}</p>
      </Slide>,
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, lang, nickname, entries]);

  const makeCard = async () => {
    setBusy(true);
    try {
      const picks = s.topRated.length ? [...s.topRated, ...s.completed.filter((e) => !s.topRated.includes(e))] : s.completed;
      const blob = await renderShareCard({
        picks: picks.length ? picks : Object.values(entries),
        stats: { ...computeStats(s.completed), eps: s.eps, total: s.addedCount, completed: s.completed.length },
        nickname: `Retrospectiva ${year}`,
        rank: { name: nickname || t('Meu ano em anime'), jp: `${year}年` },
        titleOf: name,
      });
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!card) return;
    const file = new File([card.blob], `retrospectiva-${year}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('Minha retrospectiva {0}', year) });
      else toast(t('Seu navegador não compartilha arquivos — use Baixar'), 'info');
    } catch {
      /* cancelado */
    }
  };

  const last = slides.length - 1;

  return (
    <div className="mx-auto max-w-lg">
      <SectionTitle
        title={t('Retrospectiva')}
        jp="年間まとめ"
        action={
          <select className="field !w-auto !py-1.5" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />

      {s.isEmpty ? (
        <EmptyState jp="空" title={t('Nada registrado em {0}', year)}>
          {t(
            'Marque episódios e complete animes durante o ano — a retrospectiva se monta sozinha. Comece pelo'
          )}{' '}
          <Link to="/swipe" className="font-bold text-pink">
            {t('modo rápido')}
          </Link>.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex gap-1">
            {slides.map((_, k) => (
              <button key={k} onClick={() => setI(k)} className={`h-1.5 flex-1 rounded-full ${k <= i ? 'bg-pink' : 'bg-line'}`} aria-label={t('Slide {0}', k + 1)} />
            ))}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border-[3px] border-black shadow-[8px_8px_0_var(--shadow)]">
            <div key={i} className="h-full">
              {slides[i]}
            </div>
            <button className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI((x) => Math.max(0, x - 1))} aria-label={t('Anterior')} />
            <button className="absolute inset-y-0 right-0 w-2/3" onClick={() => setI((x) => Math.min(last, x + 1))} aria-label={t('Próximo')} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button className="manga-btn ghost !p-2" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label={t('Anterior')}>
              <ChevronLeft size={18} />
            </button>
            {i === last ? (
              <div className="flex gap-2">
                <button className="manga-btn ghost" onClick={() => setI(0)}>
                  <RotateCcw size={16} />{' '}{t('Ver de novo')}
                </button>
                <button className="manga-btn yellow" onClick={makeCard} disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4" /> : <ImageIcon size={16} />}{' '}{t('Gerar card')}
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold text-muted">{t('Toque na tela pra avançar')}</span>
            )}
            <button className="manga-btn ghost !p-2" onClick={() => setI((x) => Math.min(last, x + 1))} disabled={i === last} aria-label={t('Próximo')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {card && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/75 p-4" onClick={() => setCard(null)}>
          <div className="pop-in panel max-h-full w-full max-w-md overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <img src={card.url} alt="" className="w-full rounded-xl border-2 border-black" />
            <div className="mt-4 flex gap-2">
              <a className="manga-btn flex-1" href={card.url} download={`retrospectiva-${year}.png`}>
                <Download size={16} />{' '}{t('Baixar')}
              </a>
              <button className="manga-btn cyan flex-1" onClick={share}>
                <Share2 size={16} />{' '}{t('Compartilhar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
