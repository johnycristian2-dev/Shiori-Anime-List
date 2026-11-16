import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { gql } from '../api/anilist';
import { USER_LIST_QUERY } from '../api/queries';
import AnimeCard from '../components/AnimeCard';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { compareLists } from '../lib/compare';
import { entryToMedia, pickTitle } from '../lib/format';
import { genrePt } from '../lib/labels';
import { CLOUD_ENABLED } from '../lib/supabase';
import { mediaToEntry, useList } from '../store/list';
import { useUI } from '../store/ui';
import { AL_TO_LOCAL } from '../sync/anilistSync';
import { getPublicProfile, snapshotEntries } from '../sync/profile';
import type { ListEntry, Media } from '../types';

type Source = 'anilist' | 'shiori';

async function loadTheirs(source: Source, name: string): Promise<{ label: string; list: ListEntry[] }> {
  if (source === 'shiori') {
    const p = await getPublicProfile(name);
    return { label: p.display_name || p.username, list: snapshotEntries(p.snapshot) };
  }
  type R = { MediaListCollection: { lists: { entries: { status: string; score: number; progress: number; media: Media }[] }[] } };
  const d = await gql<R>(USER_LIST_QUERY, { user: name });
  const seen = new Set<number>();
  const list = d.MediaListCollection.lists
    .flatMap((l) => l.entries)
    .filter((e) => !seen.has(e.media.id) && !!seen.add(e.media.id))
    .map((e) => mediaToEntry(e.media, AL_TO_LOCAL[e.status] ?? 'PLANNING', { score: Math.round(e.score || 0), progress: e.progress || 0 }));
  return { label: name, list };
}

function Ring({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="url(#g)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <defs>
        <linearGradient id="g">
          <stop offset="0" stopColor="var(--pink)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Picker() {
  const nav = useNavigate();
  const [source, setSource] = useState<Source>('anilist');
  const [name, setName] = useState('');
  return (
    <div className="mx-auto max-w-xl">
      <p className="-mt-2 mb-5 text-sm font-bold text-muted">Veja o quanto seus gostos batem com os de um amigo, o que vocês dois amam e o que um deveria indicar pro outro.</p>
      <div className="panel space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${source === 'anilist' ? 'on' : ''}`} onClick={() => setSource('anilist')}>
            Usuário do AniList
          </button>
          <button className={`chip ${source === 'shiori' ? 'on' : ''}`} onClick={() => setSource('shiori')} disabled={!CLOUD_ENABLED}>
            Perfil Shiori {!CLOUD_ENABLED && '(precisa da conta)'}
          </button>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) nav(`/comparar/${source}/${encodeURIComponent(name.trim())}`);
          }}
        >
          <input className="field" placeholder={source === 'anilist' ? 'nome no AniList' : 'apelido no Shiori'} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="manga-btn shrink-0">
            <Users size={16} /> Comparar
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Compare() {
  const { source, name } = useParams<{ source: Source; name: string }>();
  const entries = useList((s) => s.entries);
  const lang = useUI((s) => s.titleLang);
  const nick = useUI((s) => s.nickname) || 'Você';
  const mine = useMemo(() => Object.values(entries), [entries]);
  const q = useQuery({
    queryKey: ['compare', source, name],
    queryFn: () => loadTheirs(source!, name!),
    enabled: !!source && !!name,
  });
  const r = useMemo(() => (q.data ? compareLists(mine, q.data.list) : null), [mine, q.data]);
  const t = (e: ListEntry) => pickTitle({ romaji: e.title, english: e.titleEnglish, native: e.titleNative }, lang);

  if (!source || !name)
    return (
      <>
        <SectionTitle title="Comparar listas" jp="相性診断" />
        <Picker />
      </>
    );

  if (!mine.length)
    return (
      <>
        <SectionTitle title="Comparar listas" jp="相性診断" />
        <EmptyState jp="空" title="Sua lista está vazia">
          Adicione alguns animes (ou <Link to="/sync" className="font-bold text-pink">importe do MAL/AniList</Link>) pra comparar.
        </EmptyState>
      </>
    );

  if (q.isLoading)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (q.error || !q.data || !r)
    return (
      <>
        <SectionTitle title="Comparar listas" jp="相性診断" action={<Link to="/comparar">Trocar</Link>} />
        <ErrorBox error={q.error ?? new Error('Não deu pra carregar a lista')} onRetry={() => q.refetch()} />
      </>
    );

  const them = q.data.label;

  return (
    <>
      <SectionTitle title="Comparar listas" jp="相性診断" action={<Link to="/comparar">Comparar com outra pessoa</Link>} />

      <section className="halftone relative mb-8 flex flex-wrap items-center gap-6 overflow-hidden rounded-3xl border-[3px] border-black bg-panel p-6 shadow-[8px_8px_0_var(--pink)]">
        <div className="absolute -right-2 -top-6 font-jp text-[120px] font-black leading-none text-pink/10">{r.jp}</div>
        <div className="relative grid place-items-center">
          <Ring value={r.score} />
          <div className="absolute text-center">
            <div className="font-display text-4xl">{r.score}%</div>
          </div>
        </div>
        <div className="relative flex-1">
          <div className="text-sm font-black text-muted">
            {nick} × {them}
          </div>
          <div className="font-display text-3xl text-pink">{r.label}</div>
          <div className="font-jp text-xl font-black">{r.jp}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-md bg-panel-2 px-2 py-1">{r.shared.length} vistos em comum</span>
            <span className="rounded-md bg-panel-2 px-2 py-1">{r.scoredCount} com nota dos dois</span>
            <span className="rounded-md bg-panel-2 px-2 py-1">gêneros {Math.round(r.genreSim * 100)}% parecidos</span>
          </div>
          {r.scoredCount < 3 && <p className="mt-2 text-xs font-bold text-muted">Deem nota a mais animes em comum pra um resultado mais preciso.</p>}
        </div>
      </section>

      <div className="mb-10 grid gap-5 md:grid-cols-2">
        {[
          { who: nick === 'Você' ? 'Seus gêneros' : `Gêneros de ${nick}`, list: r.myGenres },
          { who: `Gêneros de ${them}`, list: r.theirGenres },
        ].map((side) => {
          const max = Math.max(1, ...side.list.slice(0, 6).map(([, v]) => v));
          return (
            <div key={side.who} className="panel p-5">
              <h3 className="mb-3 font-display">{side.who}</h3>
              <div className="space-y-2">
                {side.list.slice(0, 6).map(([g, v]) => (
                  <div key={g} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate font-bold">{genrePt(g)}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded border-2 border-black bg-panel-2">
                      <div className="h-full bg-pink" style={{ width: `${(v / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {r.bothLove.length > 0 && (
        <>
          <SectionTitle title="Vocês dois amam" jp="共通の推し" />
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {r.bothLove.slice(0, 12).map((p) => (
              <AnimeCard key={p.me.mediaId} media={entryToMedia(p.me)} note={`Você ★${p.me.score} · ${them} ★${p.them.score}`} />
            ))}
          </div>
        </>
      )}

      <SectionTitle title={`${them} recomenda pra você`} jp="おすすめ" />
      {r.forMe.length ? (
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {r.forMe.slice(0, 18).map((e) => (
            <AnimeCard key={e.mediaId} media={entryToMedia(e)} note={e.score ? `Nota de ${them}: ★ ${e.score}` : `Favorito de ${them}`} />
          ))}
        </div>
      ) : (
        <p className="mb-10 text-sm font-bold text-muted">Você já viu tudo que {them} amou. 👀</p>
      )}

      <SectionTitle title={`Pra você indicar pra ${them}`} jp="布教" />
      {r.forThem.length ? (
        <div className="panel mb-10 divide-y-2 divide-line">
          {r.forThem.slice(0, 10).map((e) => (
            <Link key={e.mediaId} to={`/anime/${e.mediaId}`} className="flex items-center gap-3 p-2.5 hover:bg-panel-2">
              {e.cover && <img src={e.cover} alt="" className="h-12 w-9 rounded border-2 border-black object-cover" />}
              <span className="min-w-0 flex-1 truncate font-bold">{t(e)}</span>
              {e.score > 0 && <span className="rounded border-2 border-black bg-yellow px-1.5 text-xs font-black text-black">★ {e.score}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mb-10 text-sm font-bold text-muted">Dê nota 8+ aos seus favoritos pra aparecerem aqui.</p>
      )}

      {r.disagree.length > 0 && (
        <>
          <SectionTitle title="Onde vocês brigariam" jp="論争" />
          <div className="panel divide-y-2 divide-line">
            {r.disagree.slice(0, 8).map((p) => (
              <Link key={p.me.mediaId} to={`/anime/${p.me.mediaId}`} className="flex items-center gap-3 p-2.5 hover:bg-panel-2">
                {p.me.cover && <img src={p.me.cover} alt="" className="h-12 w-9 rounded border-2 border-black object-cover" />}
                <span className="min-w-0 flex-1 truncate font-bold">{t(p.me)}</span>
                <span className="text-xs font-black">
                  <span className="text-pink">Você ★{p.me.score}</span> vs <span className="text-cyan">★{p.them.score}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
