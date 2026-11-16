import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Info, Layers, Plus } from 'lucide-react';
import { useAiring, useBrowse, useDiscover, useGenres, useMangaDiscover } from '../api/hooks';
import KindSwitch from '../components/KindSwitch';
import { entryPath, MANGA_CATS, mediaPath, totalUnits } from '../lib/media';
import AnimeRow from '../components/AnimeRow';
import AddMenu from '../components/AddMenu';
import { ErrorBox, SectionTitle } from '../components/ui';
import { currentSeason, nextSeason, SEASON_LABEL } from '../lib/season';
import { DECADES, GENRES, genrePt } from '../lib/labels';
import { stripHtml, useTitle } from '../lib/format';
import type { Media, MediaType } from '../types';
import { STATUS_META, useList } from '../store/list';
import { useUI } from '../store/ui';

import { t, locale } from '../lib/i18n';
import Synopsis from '../components/Synopsis';

function Hero({ items }: { items?: Media[] }) {
  const [i, setI] = useState(0);
  const title = useTitle();
  const list = (items ?? []).filter((m) => m.bannerImage).slice(0, 5);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 7000);
    return () => clearInterval(t);
  }, [list.length]);

  if (!list.length) return <div className="skeleton mb-10 h-[340px] rounded-3xl sm:h-[420px]" />;
  const m = list[i % list.length];

  return (
    <section className="relative mb-12 overflow-hidden rounded-3xl border-[3px] border-black shadow-[8px_8px_0_var(--pink)]">
      <img key={m.id} src={m.bannerImage!} alt="" className="pop-in absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-r from-black/95 via-black/70 to-black/20" />
      <div className="speedlines absolute inset-0 opacity-60" />
      <div className="relative flex min-h-[340px] flex-col justify-end gap-4 p-6 sm:min-h-[420px] sm:p-10">
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border-2 border-black bg-yellow px-2.5 py-1 text-xs font-black text-black -rotate-2">
          <Flame size={14} />{' '}{t('EM ALTA #')}{(i % list.length) + 1} <span className="font-jp">トレンド</span>
        </span>
        <h1 className="stroke-title max-w-3xl font-display text-3xl leading-tight text-white sm:text-5xl">{title(m)}</h1>
        {m.title.native && <div className="font-jp text-lg font-bold text-white/70">{m.title.native}</div>}
        <Synopsis id={m.id} text={m.description} showBadge={false} className="line-clamp-3 max-w-2xl text-sm font-medium text-white/80 sm:text-base" />
        <div className="flex flex-wrap gap-2">
          {m.genres.slice(0, 4).map((g) => (
            <span key={g} className="rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white">
              {genrePt(g)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddMenu media={m} />
          <Link to={mediaPath(m)} className="manga-btn ghost">
            <Info size={16} />{' '}{t('Detalhes')}
          </Link>
          <div className="ml-auto flex gap-1.5">
            {list.map((x, j) => (
              <button
                key={x.id}
                onClick={() => setI(j)}
                aria-label={t('Destaque {0}', j + 1)}
                className={`h-2.5 rounded-full border border-black transition-all ${j === i % list.length ? 'w-8 bg-pink' : 'w-2.5 bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuizBanner() {
  const empty = useList((s) => Object.keys(s.entries).length === 0);
  if (!empty) return null;
  return (
    <section className="panel halftone relative mb-10 flex flex-wrap items-center gap-4 overflow-hidden p-5">
      <div className="absolute -right-2 -top-4 font-jp text-7xl font-black text-pink/15">はじめよう</div>
      <div className="relative flex-1">
        <h2 className="font-display text-xl">{t('Novo por aqui?')}</h2>
        <p className="text-sm font-bold text-muted">{t('Responda 6 perguntas rápidas e ganhe uma lista inicial feita pra você.')}</p>
      </div>
      <Link to="/comecar" className="manga-btn relative">
        {t('Fazer o quiz')}
      </Link>
    </section>
  );
}

function ContinueWatching({ type = 'ANIME' }: { type?: MediaType }) {
  const entries = useList((s) => s.entries);
  const update = useList((s) => s.update);
  const toast = useUI((s) => s.toast);
  const lang = useUI((s) => s.titleLang);
  const list = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => e.status === 'WATCHING' && (e.type ?? 'ANIME') === type)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12),
    [entries, type],
  );
  const manga = type === 'MANGA';
  if (!list.length) return null;
  return (
    <section className="mb-10">
      <SectionTitle title={manga ? t('Continuar lendo') : t('Continuar assistindo')} jp={manga ? '読書中' : '視聴中'} action={<Link to="/lista">{t('Minha lista →')}</Link>} />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
        {list.map((e) => {
          const name = lang === 'english' ? e.titleEnglish ?? e.title : e.title;
          const total = totalUnits(e);
          const pct = total ? (e.progress / total) * 100 : 0;
          return (
            <div key={e.mediaId} className="panel flex w-72 shrink-0 snap-start gap-3 p-2.5" style={{ borderColor: STATUS_META.WATCHING.color }}>
              <Link to={entryPath(e)} className="shrink-0">
                <img src={e.cover ?? ''} alt="" loading="lazy" className="h-24 w-16 rounded-lg border-2 border-black object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={entryPath(e)} className="line-clamp-2 text-sm font-extrabold leading-tight hover:text-pink">
                  {name}
                </Link>
                <div className="mt-auto">
                  <div className="mb-1 text-xs font-black text-muted">
                    {manga ? t('Cap.') : t('Ep')} {e.progress}
                    {total ? ` / ${total}` : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-black bg-panel-2">
                      <div className="h-full bg-cyan" style={{ width: `${pct}%` }} />
                    </div>
                    <button
                      className="manga-btn cyan !rounded-lg !px-2 !py-1 !text-xs"
                      onClick={() => {
                        update(e.mediaId, { progress: e.progress + 1 });
                        if (total && e.progress + 1 >= total) toast(t('{0} completo! 完了 🎉', name));
                      }}
                    >
                      <Plus size={12} strokeWidth={3} /> {manga ? t('1 cap.') : t('1 ep')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AiringToday() {
  const [range] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const from = Math.floor(d.getTime() / 1000);
    return { from, to: from + 86400 };
  });
  const q = useAiring(range.from, range.to);
  const items = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0)).slice(0, 20),
    [q.data],
  );
  if (!q.isLoading && !items.length) return null;
  return (
    <AnimeRow
      title={t('Lançando hoje')}
      jp="今日の放送"
      items={items.map((a) => a.media)}
      loading={q.isLoading}
      notes={Object.fromEntries(
        items.map((a) => [a.media.id, `Ep ${a.episode} · ${new Date(a.airingAt * 1000).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`]),
      )}
      action={<Link to="/calendario">{t('Calendário →')}</Link>}
    />
  );
}

function GenreSpotlight({ type = 'ANIME' }: { type?: MediaType }) {
  const { data: genres } = useGenres();
  const [genre, setGenre] = useState('Action');
  const filters = useMemo(() => ({ sort: 'POPULARITY_DESC' as const, genres: [genre], formats: [], type }), [genre, type]);
  const q = useBrowse(filters, 20);
  const items = q.data?.pages[0]?.media;

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2">
        {(genres ?? Object.keys(GENRES)).map((g) => (
          <button key={g} onClick={() => setGenre(g)} className={`chip ${g === genre ? 'on' : ''}`}>
            {genrePt(g)}
            {GENRES[g] && <span className="font-jp text-[10px] opacity-70">{GENRES[g].jp}</span>}
          </button>
        ))}
      </div>
      <AnimeRow
        title={t('Top de {0}', genrePt(genre))}
        jp={GENRES[genre]?.jp ?? 'ジャンル'}
        items={items}
        loading={q.isLoading}
        ranked
        action={<Link to={`/explorar?genero=${encodeURIComponent(genre)}${type === 'MANGA' ? '&tipo=manga' : ''}`}>{t('Ver tudo →')}</Link>}
      />
    </div>
  );
}

function MangaDiscover() {
  const { data, isLoading, error, refetch } = useMangaDiscover();
  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  const cats = MANGA_CATS.filter((c) => c.id !== 'all');
  return (
    <>
      <Hero items={data?.trending.media} />
      <ContinueWatching type="MANGA" />

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => (
          <Link
            key={c.id}
            to={`/explorar?tipo=manga&cat=${c.id}`}
            className="panel group relative overflow-hidden p-4 transition hover:-translate-y-1 hover:border-pink"
          >
            <div className="font-display text-xl">{c.label}</div>
            <div className="text-xs font-bold text-muted">{t('Ver tudo →')}</div>
            <div className="absolute -bottom-3 -right-1 font-jp text-4xl font-black text-pink/15 transition group-hover:text-pink/30">{c.jp}</div>
          </Link>
        ))}
      </div>

      <AnimeRow title={t('Em alta agora')} jp="トレンド" items={data?.trending.media} loading={isLoading} action={<Link to="/explorar?tipo=manga&ordem=TRENDING_DESC">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Em lançamento')} jp="連載中" items={data?.releasing.media} loading={isLoading} action={<Link to="/explorar?tipo=manga&situacao=RELEASING">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Manhwa em alta')} jp="만화" items={data?.manhwa.media} loading={isLoading} action={<Link to="/explorar?tipo=manga&cat=manhwa&ordem=TRENDING_DESC">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Webtoons populares')} jp="縦読み" items={data?.webtoon.media} loading={isLoading} ranked action={<Link to="/explorar?tipo=manga&cat=webtoon">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Mangás mais bem avaliados')} jp="殿堂入り" items={data?.top.media} loading={isLoading} ranked action={<Link to="/explorar?tipo=manga&cat=manga&ordem=SCORE_DESC">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Light novels populares')} jp="ラノベ" items={data?.novels.media} loading={isLoading} action={<Link to="/explorar?tipo=manga&cat=novel">{t('Ver tudo →')}</Link>} />

      <SectionTitle title={t('Por gênero')} jp="ジャンル" />
      <GenreSpotlight type="MANGA" />
    </>
  );
}

export default function Discover() {
  const kind = useUI((s) => s.kind);
  return (
    <>
      <div className="mb-5 flex justify-center sm:justify-start">
        <KindSwitch />
      </div>
      {kind === 'MANGA' ? <MangaDiscover /> : <AnimeDiscover />}
    </>
  );
}

function AnimeDiscover() {
  const { data, isLoading, error, refetch } = useDiscover();
  const cur = currentSeason();
  const nxt = nextSeason();

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;

  return (
    <>
      <Hero items={data?.trending.media} />
      <QuizBanner />
      <ContinueWatching />
      <AiringToday />

      <AnimeRow title={t('Em alta agora')} jp="トレンド" items={data?.trending.media} loading={isLoading} action={<Link to="/explorar?ordem=TRENDING_DESC">{t('Ver tudo →')}</Link>} />
      <AnimeRow
        title={t('Temporada: {0} {1}', SEASON_LABEL[cur.season].pt, cur.year)}
        jp={`${SEASON_LABEL[cur.season].jp}アニメ`}
        items={data?.season.media}
        loading={isLoading}
        action={<Link to={`/explorar?temporada=${cur.season}&ano=${cur.year}`}>{t('Ver tudo →')}</Link>}
      />

      {/* Chamada para o modo rápido */}
      <section className="halftone relative mb-12 overflow-hidden rounded-3xl border-[3px] border-black bg-cyan p-6 text-black shadow-[8px_8px_0_var(--shadow)] sm:p-8">
        <div className="absolute -right-4 -top-6 font-jp text-[120px] font-black leading-none text-black/10">速攻</div>
        <h2 className="relative font-display text-2xl sm:text-3xl">{t('Monte sua lista em minutos')}</h2>
        <p className="relative mt-2 max-w-xl font-bold">
          {t(
            'Arraste pra direita = quero ver. Pra cima = já vi. Pra esquerda = pular. Perfeito pra montar a lista de uma vez.'
          )}
        </p>
        <Link to="/swipe" className="manga-btn relative mt-4">
          <Layers size={16} />{' '}{t('Abrir modo rápido')}
        </Link>
      </section>

      <AnimeRow title={t('Top de todos os tempos')} jp="殿堂入り" items={data?.top.media} loading={isLoading} ranked action={<Link to="/explorar?ordem=SCORE_DESC">{t('Ver tudo →')}</Link>} />
      <AnimeRow title={t('Mais populares')} jp="人気" items={data?.popular.media} loading={isLoading} ranked action={<Link to="/explorar">{t('Ver tudo →')}</Link>} />

      <SectionTitle title={t('Por gênero')} jp="ジャンル" />
      <GenreSpotlight />

      <AnimeRow
        title={t('Próxima temporada: {0} {1}', SEASON_LABEL[nxt.season].pt, nxt.year)}
        jp="来期"
        items={data?.upcoming.media}
        loading={isLoading}
        action={<Link to={`/explorar?temporada=${nxt.season}&ano=${nxt.year}`}>{t('Ver tudo →')}</Link>}
      />

      <SectionTitle title={t('Viaje no tempo')} jp="年代" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {DECADES.map((d) => (
          <Link
            key={d}
            to={`/explorar?de=${d}&ate=${d + 9}&ordem=SCORE_DESC`}
            className="panel group relative overflow-hidden p-4 transition hover:-translate-y-1 hover:border-pink"
          >
            <div className="font-display text-3xl">{String(d).slice(2)}{t('s')}</div>
            <div className="text-xs font-bold text-muted">
              {d}–{d + 9}
            </div>
            <div className="absolute -bottom-3 -right-1 font-jp text-5xl font-black text-pink/15 transition group-hover:text-pink/30">
              {d}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
