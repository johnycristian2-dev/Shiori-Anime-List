import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useCharacter } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { cleanAniListText, fuzzyDate } from '../lib/format';
import { useList } from '../store/list';

import { t, locale } from '../lib/i18n';

const ROLE: Record<string, () => string> = { MAIN: () => t('Principal'), SUPPORTING: () => t('Secundário'), BACKGROUND: () => t('Figurante') };

export default function CharacterPage() {
  const id = Number(useParams().id);
  const { data: c, isLoading, error, refetch } = useCharacter(id);
  const entries = useList((s) => s.entries);
  const [more, setMore] = useState(false);

  if (isLoading)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (error || !c) return <ErrorBox error={error ?? new Error(t('Personagem não encontrado'))} onRetry={() => refetch()} />;

  const desc = cleanAniListText(c.description);
  // Dubladores únicos (o mesmo costuma aparecer em várias temporadas)
  const vas = new Map<number, (typeof c.media.edges)[number]['voiceActors'][number]>();
  c.media.edges.forEach((e) => e.voiceActors.forEach((v) => vas.set(v.id, v)));
  const seen = c.media.edges.filter((e) => entries[e.node.id]).length;
  const facts = [
    c.gender && { k: t('Gênero'), v: c.gender === 'Female' ? 'Feminino' : c.gender === 'Male' ? 'Masculino' : c.gender },
    c.age && { k: t('Idade'), v: c.age },
    fuzzyDate(c.dateOfBirth) && { k: t('Aniversário'), v: fuzzyDate(c.dateOfBirth)! },
    c.bloodType && { k: t('Tipo sanguíneo'), v: c.bloodType },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <>
      <div className="mb-10 flex flex-col gap-6 sm:flex-row">
        {c.image.large && (
          <img
            src={c.image.large}
            alt=""
            className="mx-auto w-44 shrink-0 rounded-2xl border-[3px] border-black shadow-[8px_8px_0_var(--pink)] sm:mx-0 sm:w-52"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-wider text-pink">{t('Personagem · キャラクター')}</div>
          <h1 className="stroke-title mt-1 font-display text-3xl text-white sm:text-4xl">{c.name.full}</h1>
          {c.name.native && <div className="font-jp text-xl font-bold text-muted">{c.name.native}</div>}
          {c.name.alternative.filter(Boolean).length > 0 && (
            <div className="mt-1 text-xs font-bold text-muted">{t('Também:')}{' '}{c.name.alternative.filter(Boolean).join(', ')}</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.favourites != null && (
              <span className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-pink px-2 py-1 text-sm font-black text-white">
                <Heart size={14} fill="currentColor" /> {c.favourites.toLocaleString(locale())}{' '}{t('favoritos')}
              </span>
            )}
            {seen > 0 && (
              <span className="rounded-lg border-2 border-black bg-cyan px-2 py-1 text-sm font-black text-black">
                {t('Está em')}{' '}{seen}{' '}{t('anime')}{seen > 1 ? t('s') : ''}{' '}{t('da sua lista')}
              </span>
            )}
          </div>
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
              <p className={`whitespace-pre-line text-sm leading-relaxed text-ink/85 ${more ? '' : 'line-clamp-5'}`}>{desc}</p>
              {desc.length > 400 && (
                <button className="mt-1 text-xs font-extrabold text-cyan" onClick={() => setMore((v) => !v)}>
                  {more ? t('Mostrar menos') : t('Ler mais')}
                </button>
              )}
              <p className="mt-1 text-[11px] font-bold text-muted">{t('Spoilers marcados pelo AniList foram escondidos.')}</p>
            </div>
          )}
        </div>
      </div>

      {vas.size > 0 && (
        <section className="mb-10">
          <SectionTitle title={t('Dublagem japonesa')} jp="声優" />
          <div className="flex flex-wrap gap-3">
            {[...vas.values()].map((v) => (
              <Link key={v.id} to={`/dublador/${v.id}`} className="panel flex items-center gap-3 p-2 pr-4 transition hover:border-pink">
                {v.image.large && <img src={v.image.large} alt="" className="h-16 w-12 rounded-lg object-cover" />}
                <div>
                  <div className="font-extrabold">{v.name.full}</div>
                  <div className="font-jp text-xs text-muted">{v.name.native}</div>
                  <div className="text-[10px] font-black uppercase text-cyan">{t('Ver outros papéis →')}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SectionTitle title={t('Aparece em')} jp="登場作品" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {c.media.edges.map((e) => (
          <AnimeCard key={e.node.id} media={e.node} note={ROLE[e.characterRole]?.() ?? e.characterRole} />
        ))}
      </div>
    </>
  );
}
