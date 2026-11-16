import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Image as ImageIcon, Pencil, Share2, UserPlus, X } from 'lucide-react';
import ProfileHeader from '../components/ProfileHeader';
import { FollowCounts } from '../components/Social';
import { openAuth, useAccount } from '../sync/account';
import { useCloudUser } from '../sync/cloud';
import AnimeCard from '../components/AnimeCard';
import { EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ACHIEVEMENTS, computeStats, rankOf, RANKS } from '../lib/profile';
import { renderShareCard } from '../lib/shareCard';
import { entryToMedia, pickTitle } from '../lib/format';
import { genrePt, GENRES } from '../lib/labels';
import { STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';
import type { ListEntry } from '../types';

import { t, locale } from '../lib/i18n';

function Bars({ data, color = 'var(--pink)' }: { data: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <div className="w-28 shrink-0 truncate font-bold">
            {d.label} {d.sub && <span className="font-jp text-[10px] text-muted">{d.sub}</span>}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded-md border-2 border-black bg-panel-2">
            <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="w-8 text-right font-black tabular-nums">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const entries = useList((s) => s.entries);
  const gacha = useList((s) => s.gacha);
  const lang = useUI((s) => s.titleLang);
  const nickname = useUI((s) => s.nickname);
  const setNickname = useUI((s) => s.setNickname);
  const toast = useUI((s) => s.toast);
  const cloudUser = useCloudUser((s) => s.user);
  const account = useAccount((s) => s.profile);
  const logged = !!cloudUser && !cloudUser.is_anonymous;
  const all = useMemo(() => Object.values(entries), [entries]);
  const stats = useMemo(() => computeStats(all), [all]);
  const rank = rankOf(stats.completed);
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (card) URL.revokeObjectURL(card.url);
    },
    [card],
  );

  const titleOf = (e: ListEntry) => pickTitle({ romaji: e.title, english: e.titleEnglish, native: e.titleNative }, lang);
  const favorites = all.filter((e) => e.favorite).sort((a, b) => b.score - a.score);
  const favEntry = (account?.favorite_id ? entries[account.favorite_id] : undefined) ?? favorites[0];
  const picks = useMemo(
    () =>
      [...all]
        .filter((e) => e.status !== 'DROPPED' && e.status !== 'PLANNING')
        .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || b.score - a.score || (b.averageScore ?? 0) - (a.averageScore ?? 0)),
    [all],
  );

  const makeCard = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard({ picks: picks.length ? picks : all, stats, nickname, rank, titleOf });
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!card) return;
    const file = new File([card.blob], 'shiori.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('Minha lista de animes') });
      else toast(t('Seu navegador não compartilha arquivos — use Baixar'), 'info');
    } catch {
      /* usuário cancelou */
    }
  };

  if (!all.length && !logged)
    return (
      <>
        <SectionTitle title={t('Perfil')} jp="プロフィール" />
        <EmptyState jp="無" title={t('Seu perfil nasce com a sua lista')}>
          {t('Adicione animes pelo')}{' '}<Link to="/swipe" className="font-bold text-pink">{t('modo rápido')}</Link>{' '}{t('e volte aqui.')}
          <div className="mt-4">
            <button className="manga-btn" onClick={() => openAuth('signup')}>
              <UserPlus size={16} /> {t('Criar conta')}
            </button>
          </div>
        </EmptyState>
      </>
    );

  const unlocked = ACHIEVEMENTS.filter((a) => a.test(stats, gacha));

  return (
    <>
      <SectionTitle title={t('Perfil')} jp="プロフィール" />

      <ProfileHeader
        name={
          logged ? (
            account?.display_name || account?.username || nickname || cloudUser?.email?.split('@')[0] || t('Meu perfil')
          ) : (
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('Seu apelido')}
              maxLength={24}
              className="w-full max-w-sm border-b-2 border-dashed border-line bg-transparent font-display text-3xl outline-none placeholder:text-muted focus:border-pink"
            />
          )
        }
        username={account?.username}
        avatar={account?.avatar_url}
        banner={account?.banner_url}
        bio={account?.bio}
        rank={rank}
        favorite={favEntry ? { id: favEntry.mediaId, title: titleOf(favEntry), cover: favEntry.cover } : null}
        actions={
          logged ? (
            <Link to="/perfil/editar" className="manga-btn ghost">
              <Pencil size={16} /> {t('Editar perfil')}
            </Link>
          ) : (
            <button className="manga-btn" onClick={() => openAuth('signup')}>
              <UserPlus size={16} /> {t('Criar conta')}
            </button>
          )
        }
      >
        <div className="mt-3 max-w-md">
          <div className="h-4 overflow-hidden rounded-full border-2 border-black bg-panel-2">
            <div className="h-full bg-linear-to-r from-pink via-yellow to-cyan" style={{ width: `${rank.pct * 100}%` }} />
          </div>
          <div className="mt-1 text-xs font-bold text-muted">
            {rank.next ? t('{0} completos para {1} {2}', rank.next.min - stats.completed, rank.next.name, rank.next.jp) : t('Rank máximo! 伝説')}
          </div>
        </div>
        {logged && cloudUser && (
          <Link to="/amigos" className="mt-3 block w-fit hover:text-pink">
            <FollowCounts userId={cloudUser.id} />
          </Link>
        )}
        {!logged && <p className="mt-3 text-sm font-bold text-muted">{t('Com uma conta você ganha foto, banner, bio e um link de perfil pra mandar pros amigos.')}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/retrospectiva" className="manga-btn ghost">
            {t('🎁 Retrospectiva do ano')}
          </Link>
          <button className="manga-btn yellow" onClick={makeCard} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <ImageIcon size={16} />}{' '}{t('Gerar card pra compartilhar')}
          </button>
        </div>
      </ProfileHeader>

      <div className={`mb-8 grid grid-cols-2 gap-3 ${stats.mangaCount ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-5'}`}>
        {[
          { k: stats.mangaCount ? t('Títulos') : t('Animes'), v: stats.total, c: 'text-pink' },
          { k: t('Completos'), v: stats.completed, c: 'text-[#7cff8a]' },
          { k: t('Episódios'), v: stats.eps.toLocaleString(locale()), c: 'text-cyan' },
          ...(stats.mangaCount ? [{ k: t('Capítulos lidos'), v: stats.chapters.toLocaleString(locale()), c: 'text-cyan' }] : []),
          { k: t('Horas (aprox.)'), v: `≈${stats.hours.toLocaleString(locale())}h`, c: 'text-yellow' },
          { k: t('Nota média'), v: stats.mean ? stats.mean.toFixed(1) : '—', c: 'text-pink' },
        ].map((s) => (
          <div key={s.k} className="panel p-4">
            <div className={`font-display text-2xl ${s.c}`}>{s.v}</div>
            <div className="text-xs font-bold text-muted">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="mb-10 grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-4 font-display">{t('Por status')}</h3>
          <div className="mb-4 flex h-6 overflow-hidden rounded-lg border-2 border-black">
            {STATUS_ORDER.map((s) => {
              const v = all.filter((e) => e.status === s).length;
              return v ? <div key={s} style={{ width: `${(v / stats.total) * 100}%`, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${v}`} /> : null;
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-black" style={{ background: STATUS_META[s].color }} />
                {STATUS_META[s].label} {all.filter((e) => e.status === s).length}
              </span>
            ))}
          </div>
          <h3 className="mb-3 mt-6 font-display">{t('Suas notas')}</h3>
          <div className="flex h-32 items-end gap-1.5">
            {stats.scores.map((v, i) => {
              const max = Math.max(1, ...stats.scores);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-muted">{v || ''}</span>
                  <div className="w-full rounded-t-md border-2 border-b-0 border-black bg-yellow" style={{ height: `${(v / max) * 90 + 2}px` }} />
                  <span className="text-xs font-black">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-display">{t('Gêneros favoritos')}</h3>
          <Bars data={stats.genres.slice(0, 8).map(([g, v]) => ({ label: genrePt(g), sub: GENRES[g]?.jp, value: v }))} />
          <h3 className="mb-4 mt-6 font-display">{t('Por década')}</h3>
          <Bars color="var(--cyan)" data={stats.decades.map(([d, v]) => ({ label: t('Anos {0}', String(d).slice(2)), value: v }))} />
        </div>
      </div>

      <SectionTitle title={t('Conquistas')} jp="実績" action={<span className="text-muted">{unlocked.length}/{ACHIEVEMENTS.length}</span>} />
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACHIEVEMENTS.map((a) => {
          const ok = a.test(stats, gacha);
          const secret = a.hidden && !ok;
          return (
            <div
              key={a.id}
              className={`panel relative p-4 text-center transition ${ok ? (a.hidden ? 'border-pink shadow-[4px_4px_0_var(--pink)]' : 'border-yellow shadow-[4px_4px_0_var(--yellow)]') : 'opacity-45 grayscale'}`}
            >
              {a.hidden && ok && <span className="absolute right-2 top-2 rounded bg-pink px-1 text-[9px] font-black text-white">{t('RARA')}</span>}
              <div className="text-3xl">{secret ? '❓' : a.icon}</div>
              <div className="mt-1 font-extrabold">{secret ? '???' : a.name}</div>
              <div className="text-[11px] font-bold text-muted">{secret ? t('Conquista secreta') : a.desc}</div>
            </div>
          );
        })}
      </div>

      <SectionTitle title={t('Ranks')} jp="階級" />
      <div className="no-scrollbar -mx-4 mb-10 flex gap-3 overflow-x-auto px-4">
        {RANKS.map((r) => (
          <div key={r.name} className={`panel shrink-0 px-4 py-3 text-center ${r.name === rank.name ? 'border-pink shadow-[4px_4px_0_var(--pink)]' : ''}`}>
            <div className="font-jp text-2xl font-black text-pink">{r.jp}</div>
            <div className="font-extrabold">{r.name}</div>
            <div className="text-[11px] font-bold text-muted">{r.min}{t('+ completos')}</div>
          </div>
        ))}
      </div>

      {favorites.length > 0 && (
        <>
          <SectionTitle title={t('Favoritos')} jp="お気に入り" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.map((e) => (
              <AnimeCard key={e.mediaId} media={entryToMedia(e)} note={e.score ? t('Sua nota: ★ {0}', e.score) : undefined} />
            ))}
          </div>
        </>
      )}

      {card && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/75 p-4" onClick={() => setCard(null)}>
          <div className="pop-in panel max-h-full w-full max-w-md overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display">{t('Seu card')}</span>
              <button onClick={() => setCard(null)} aria-label={t('Fechar')}>
                <X />
              </button>
            </div>
            <img src={card.url} alt="" className="w-full rounded-xl border-2 border-black" />
            <div className="mt-4 flex gap-2">
              <a className="manga-btn flex-1" href={card.url} download="shiori-lista.png">
                <Download size={16} />{' '}{t('Baixar')}
              </a>
              <button className="manga-btn cyan flex-1" onClick={share}>
                <Share2 size={16} />{' '}{t('Compartilhar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
