import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useStaff } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { cleanAniListText, fuzzyDate } from '../lib/format';
import { useList } from '../store/list';

export default function StaffPage() {
  const id = Number(useParams().id);
  const q = useStaff(id);
  const entries = useList((s) => s.entries);
  const [onlyMine, setOnlyMine] = useState(false);
  const [mainOnly, setMainOnly] = useState(false);
  const [more, setMore] = useState(false);
  const s = q.data?.pages[0];

  // Junta páginas e agrupa por anime (um dublador pode ter vários papéis no mesmo anime)
  const roles = useMemo(() => {
    const map = new Map<number, { media: NonNullable<typeof s>['characterMedia']['edges'][number]['node']; chars: string[]; main: boolean }>();
    for (const p of q.data?.pages ?? [])
      for (const e of p.characterMedia.edges) {
        if (e.node.type !== 'ANIME') continue;
        const cur = map.get(e.node.id) ?? { media: e.node, chars: [], main: false };
        e.characters.forEach((c) => !cur.chars.includes(c.name.full) && cur.chars.push(c.name.full));
        cur.main ||= e.characterRole === 'MAIN';
        map.set(e.node.id, cur);
      }
    return [...map.values()];
  }, [q.data]);

  if (q.isLoading)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (q.error || !s) return <ErrorBox error={q.error ?? new Error('Pessoa não encontrada')} onRetry={() => q.refetch()} />;

  const desc = cleanAniListText(s.description);
  const mine = roles.filter((r) => entries[r.media.id]);
  const shown = roles.filter((r) => (!onlyMine || entries[r.media.id]) && (!mainOnly || r.main));
  const facts = [
    s.languageV2 && { k: 'Idioma', v: s.languageV2 === 'Japanese' ? 'Japonês' : s.languageV2 },
    fuzzyDate(s.dateOfBirth) && { k: 'Nascimento', v: fuzzyDate(s.dateOfBirth)! },
    s.homeTown && { k: 'Cidade natal', v: s.homeTown },
    s.yearsActive[0] && { k: 'Ativo desde', v: String(s.yearsActive[0]) },
  ].filter(Boolean) as { k: string; v: string }[];

  // Um exemplo de papel por anime da sua lista: "ah, é a voz da Fern!"
  const highlights = mine.slice(0, 6);

  return (
    <>
      <div className="mb-10 flex flex-col gap-6 sm:flex-row">
        {s.image.large && (
          <img
            src={s.image.large}
            alt=""
            className="mx-auto w-44 shrink-0 rounded-2xl border-[3px] border-black shadow-[8px_8px_0_var(--cyan)] sm:mx-0 sm:w-52"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-wider text-cyan">Dublador(a) · 声優</div>
          <h1 className="stroke-title mt-1 font-display text-3xl text-white sm:text-4xl">{s.name.full}</h1>
          {s.name.native && <div className="font-jp text-xl font-bold text-muted">{s.name.native}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {s.favourites != null && (
              <span className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-pink px-2 py-1 text-sm font-black text-white">
                <Heart size={14} fill="currentColor" /> {s.favourites.toLocaleString('pt-BR')} favoritos
              </span>
            )}
            <span className="rounded-lg border-2 border-black bg-yellow px-2 py-1 text-sm font-black text-black">
              {s.characterMedia.pageInfo.total.toLocaleString('pt-BR')}
              {s.characterMedia.pageInfo.total >= 500 ? '+' : ''} papéis
            </span>
          </div>
          {highlights.length > 0 && (
            <div className="panel mt-4 p-3 text-sm">
              <div className="mb-1 font-extrabold text-cyan">Você já ouviu essa voz em:</div>
              {highlights.map((r) => (
                <div key={r.media.id} className="truncate">
                  <b>{r.chars.join(', ')}</b> <span className="text-muted">em</span>{' '}
                  <Link to={`/anime/${r.media.id}`} className="font-bold hover:text-pink">
                    {r.media.title.romaji}
                  </Link>
                </div>
              ))}
            </div>
          )}
          {facts.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.k} className="panel px-3 py-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted">{f.k}</div>
                  <div className="truncate font-extrabold">{f.v}</div>
                </div>
              ))}
            </div>
          )}
          {desc && (
            <div className="mt-4">
              <p className={`whitespace-pre-line text-sm leading-relaxed text-ink/85 ${more ? '' : 'line-clamp-4'}`}>{desc}</p>
              {desc.length > 300 && (
                <button className="mt-1 text-xs font-extrabold text-cyan" onClick={() => setMore((v) => !v)}>
                  {more ? 'Mostrar menos' : 'Ler mais'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <SectionTitle title="Papéis em animes" jp="出演作品" action={<span className="text-muted">{roles.length} carregados</span>} />
      <div className="mb-5 flex flex-wrap gap-2">
        <button className={`chip ${onlyMine ? 'on' : ''}`} onClick={() => setOnlyMine((v) => !v)}>
          Só da minha lista ({mine.length})
        </button>
        <button className={`chip ${mainOnly ? 'on' : ''}`} onClick={() => setMainOnly((v) => !v)}>
          Só papéis principais
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((r) => (
          <AnimeCard key={r.media.id} media={r.media} note={`${r.main ? '★ ' : ''}${r.chars.join(', ')}`} />
        ))}
      </div>
      {q.hasNextPage && (
        <div className="mt-8 text-center">
          <button className="manga-btn ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : 'Carregar mais papéis'}
          </button>
        </div>
      )}
    </>
  );
}
