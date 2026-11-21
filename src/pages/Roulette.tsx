import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Dices, Flame, Info, Play, Sparkles } from 'lucide-react';
import { canPullToday, liveStreak, rarityOf as rarityByScore } from '../lib/gacha';
import { filtersToVars, fetchPool, useGenres } from '../api/hooks';
import { SectionTitle, Spinner } from '../components/ui';
import { FORMAT_LABEL, genrePt } from '../lib/labels';
import { entryToMedia, stripHtml, useTitle } from '../lib/format';
import { STATUS_META, useList } from '../store/list';
import { useUI } from '../store/ui';
import type { Media, MediaFormat } from '../types';
import KindSwitch from '../components/KindSwitch';
import { mediaPath } from '../lib/media';

import { t } from '../lib/i18n';
import Synopsis from '../components/Synopsis';

type Source = 'planning' | 'surprise';

const rarityOf = (m: Media) => rarityByScore(m.averageScore);

export default function Roulette() {
  const [src, setSrc] = useState<Source>('planning');
  const [genre, setGenre] = useState('');
  const [minScore, setMinScore] = useState(70);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'spinning' | 'reveal'>('idle');
  const [flash, setFlash] = useState<Media | null>(null);
  const [result, setResult] = useState<Media | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const entries = useList((s) => s.entries);
  const add = useList((s) => s.add);
  const gacha = useList((s) => s.gacha);
  const dailyPull = useList((s) => s.dailyPull);
  const [isDaily, setIsDaily] = useState(false);
  const canDaily = canPullToday(gacha);
  const streak = liveStreak(gacha);
  const toast = useUI((s) => s.toast);
  const title = useTitle();
  const { data: genres } = useGenres();

  const kind = useUI((s) => s.kind);
  const manga = kind === 'MANGA';
  const fmts: MediaFormat[] = manga ? ['MANGA', 'NOVEL'] : ['TV', 'MOVIE', 'ONA'];
  const planning = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status === 'PLANNING' && (e.type ?? 'ANIME') === kind && (!genre || e.genres.includes(genre)))
        .map(entryToMedia),
    [entries, genre, kind],
  );

  useEffect(() => () => clearInterval(timer.current), []);

  const spin = async (daily = false) => {
    setResult(null);
    setIsDaily(daily);
    let pool: Media[] = [];
    if (daily) {
      setPhase('loading');
      try {
        // Giro do dia: sempre surpresa, qualquer gênero, nota 60+, fora da sua lista
        pool = (await fetchPool(filtersToVars({ sort: 'POPULARITY_DESC', genres: [], formats: fmts, minScore: 60, type: kind }), 20)).filter(
          (m) => !entries[m.id],
        );
      } catch (e) {
        setPhase('idle');
        return toast((e as Error).message, 'err');
      }
    } else if (src === 'planning') {
      pool = planning;
      if (!pool.length) return toast(manga ? t('Sua lista "Quero ler" está vazia (ou sem esse gênero)') : t('Sua lista "Quero ver" está vazia (ou sem esse gênero)'), 'info');
    } else {
      setPhase('loading');
      try {
        pool = (
          await fetchPool(
            filtersToVars({ sort: 'POPULARITY_DESC', genres: genre ? [genre] : [], formats: fmts, minScore, type: kind }),
          )
        ).filter((m) => !entries[m.id]);
      } catch (e) {
        setPhase('idle');
        return toast((e as Error).message, 'err');
      }
      if (!pool.length) {
        setPhase('idle');
        return toast(t('Nada encontrado com esses filtros'), 'info');
      }
    }
    if (!pool.length) {
      setPhase('idle');
      return toast(t('Nada encontrado — tente de novo'), 'info');
    }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setPhase('spinning');
    let i = 0;
    clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setFlash(pool[Math.floor(Math.random() * pool.length)]);
      i++;
      if (i > 18) {
        clearInterval(timer.current);
        setFlash(null);
        setResult(winner);
        setPhase('reveal');
        if (daily) dailyPull(winner);
      }
    }, 90);
  };

  const r = result ? rarityOf(result) : null;
  const shown = phase === 'spinning' ? flash : result;
  const cover = shown?.coverImage.extraLarge ?? shown?.coverImage.large;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle title={t('Roleta')} jp="運命ガチャ" />
      <p className="-mt-2 mb-3 text-sm font-bold text-muted">{manga ? t('Não sabe o que ler? Deixa o destino escolher.') : t('Não sabe o que assistir? Deixa o destino escolher.')}</p>
      <div className="mb-5">
        <KindSwitch />
      </div>

      <div className="halftone mb-5 flex flex-wrap items-center gap-4 rounded-2xl border-[3px] border-black bg-yellow p-4 text-black shadow-[5px_5px_0_var(--shadow)]">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-display text-lg">
            <CalendarCheck size={20} />{' '}{t('Giro do dia')}{' '}<span className="font-jp text-sm">デイリー</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-black">
            <span className="inline-flex items-center gap-1">
              <Flame size={14} /> {streak}{' '}{t('dia')}{streak === 1 ? '' : t('s')}{' '}{t('seguido')}{streak === 1 ? '' : t('s')}
            </span>
            <span>{t('Recorde:')}{' '}{gacha?.bestStreak ?? 0}</span>
            <span>{t('SSR:')}{' '}{gacha?.ssr ?? 0}</span>
            <span>{t('Giros:')}{' '}{gacha?.pulls ?? 0}</span>
          </div>
        </div>
        <button className="manga-btn" onClick={() => spin(true)} disabled={!canDaily || phase === 'spinning' || phase === 'loading'}>
          {canDaily ? t('🎁 Girar o de hoje') : t('✓ Volte amanhã')}
        </button>
        {gacha?.log.length ? (
          <div className="no-scrollbar flex w-full gap-1.5 overflow-x-auto">
            {gacha.log
              .slice(-14)
              .reverse()
              .map((l) => (
                <Link key={l.day} to={`/anime/${l.mediaId}`} title={`${l.day} · ${l.title} · ${l.rarity}`} className="relative shrink-0">
                  {l.cover && <img loading="lazy" decoding="async" src={l.cover} alt="" className="h-14 w-10 rounded-md border-2 border-black object-cover" />}
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded border border-black px-1 text-[8px] font-black"
                    style={{ background: rarityByScore(l.rarity === 'SSR' ? 90 : l.rarity === 'SR' ? 80 : 0).color }}
                  >
                    {l.rarity}
                  </span>
                </Link>
              ))}
          </div>
        ) : null}
      </div>

      <div className="panel mb-6 space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${src === 'planning' ? 'on' : ''}`} onClick={() => setSrc('planning')}>
            {manga ? t('Da minha lista "Quero ler" ({0})', planning.length) : t('Da minha lista "Quero ver" ({0})', planning.length)}
          </button>
          <button className={`chip ${src === 'surprise' ? 'on' : ''}`} onClick={() => setSrc('surprise')}>
            <Sparkles size={14} />{' '}{t('Surpresa (fora da lista)')}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="field" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">{t('Qualquer gênero')}</option>
            {(genres ?? []).map((g) => (
              <option key={g} value={g}>
                {genrePt(g)}
              </option>
            ))}
          </select>
          {src === 'surprise' && (
            <label className="flex items-center gap-3 text-sm font-bold">
              {t('Nota mín.')}{' '}<span className="text-pink">{minScore}</span>
              <input type="range" min={50} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="flex-1 accent-[var(--pink)]" />
            </label>
          )}
        </div>
      </div>

      <div className="relative mx-auto mb-6 aspect-[2/3] w-64 sm:w-72">
        {shown ? (
          <div
            className={`relative h-full overflow-hidden rounded-3xl border-[3px] border-black ${phase === 'reveal' ? 'pop-in' : ''}`}
            style={{ boxShadow: phase === 'reveal' && r ? r.glow : '8px 8px 0 var(--pink)' }}
          >
            {cover && <img loading="lazy" decoding="async" src={cover} alt="" className={`h-full w-full object-cover ${phase === 'spinning' ? 'blur-[2px] saturate-150' : ''}`} />}
            {phase === 'reveal' && r && (
              <>
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
                <div className="absolute left-3 top-3 rounded-lg border-2 border-black px-2 py-1 font-display text-lg text-black -rotate-6" style={{ background: r.color }}>
                  {r.name}
                </div>
                {isDaily && (
                  <div className="absolute right-3 top-3 rounded-lg border-2 border-black bg-pink px-2 py-1 text-xs font-black text-[var(--on-pink)] rotate-3">
                    {t('Giro do dia 🎁')}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <div className="text-sm font-black" style={{ color: r.color }}>
                    {r.stars}
                  </div>
                  <div className="stroke-title font-display text-xl leading-tight">{title(shown)}</div>
                  <div className="text-xs font-bold text-white/70">
                    {[shown.format && FORMAT_LABEL[shown.format], shown.seasonYear, shown.episodes && `${shown.episodes} ep`, shown.averageScore && `★ ${shown.averageScore}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="halftone grid h-full place-items-center rounded-3xl border-[3px] border-dashed border-line">
            {phase === 'loading' ? <Spinner className="h-10 w-10 text-pink" /> : <div className="font-jp text-8xl font-black text-pink/40">?</div>}
          </div>
        )}
      </div>

      {phase === 'reveal' && result && (
        <>
          {result.description && (
            <div className="mx-auto mb-4 max-w-lg text-center">
              <Synopsis id={result.id} text={result.description} showBadge={false} className="line-clamp-3 text-sm text-muted" />
            </div>
          )}
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <button
              className="manga-btn cyan"
              onClick={() => {
                add(result, 'WATCHING');
                toast(t('Bora! {0} → {1}', title(result), STATUS_META.WATCHING.label));
              }}
            >
              <Play size={16} />{' '}{t('Vou assistir agora')}
            </button>
            {!entries[result.id] && (
              <button className="manga-btn yellow" onClick={() => { add(result, 'PLANNING'); toast(manga ? t('Adicionado em "Quero ler"') : t('Adicionado em "Quero ver"')); }}>
                {manga ? t('Quero ler') : t('Quero ver')}
              </button>
            )}
            <Link to={mediaPath(result)} className="manga-btn ghost">
              <Info size={16} />{' '}{t('Detalhes')}
            </Link>
          </div>
        </>
      )}

      <div className="text-center">
        <button className="manga-btn !px-8 !py-4 !text-lg" onClick={() => spin(false)} disabled={phase === 'spinning' || phase === 'loading'}>
          <Dices size={22} /> {phase === 'reveal' ? t('Girar de novo') : t('Girar!')}
        </button>
      </div>
    </div>
  );
}
