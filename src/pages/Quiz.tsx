import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ListPlus, RotateCcw, Sparkles } from 'lucide-react';
import { fetchPage, filtersToVars } from '../api/hooks';
import AnimeCard from '../components/AnimeCard';
import { SectionTitle, Spinner } from '../components/ui';
import { STREAMING, genrePt } from '../lib/labels';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import type { BrowseFilters, Media, MediaFormat } from '../types';

import { t } from '../lib/i18n';

type Level = 'novato' | 'casual' | 'otaku';
type Length = 'short' | 'medium' | 'any' | 'movie';
type Era = 'recent' | 'mid' | 'classic' | 'any';

const MOODS = [
  {
    id: 'acao',
    emoji: '🔥',

    get label() {
      return t('Ação e lutas');
    },

    genres: ['Action']
  },
  {
    id: 'aventura',
    emoji: '🗺️',

    get label() {
      return t('Aventura e magia');
    },

    genres: ['Adventure', 'Fantasy']
  },
  {
    id: 'comedia',
    emoji: '😂',

    get label() {
      return t('Rir muito');
    },

    genres: ['Comedy']
  },
  {
    id: 'romance',
    emoji: '💕',

    get label() {
      return t('Romance');
    },

    genres: ['Romance']
  },
  {
    id: 'misterio',
    emoji: '🧠',

    get label() {
      return t('Mistério e plot twist');
    },

    genres: ['Mystery', 'Psychological']
  },
  {
    id: 'terror',
    emoji: '😱',

    get label() {
      return t('Terror');
    },

    genres: ['Horror']
  },
  {
    id: 'scifi',
    emoji: '🚀',

    get label() {
      return t('Ficção científica e robôs');
    },

    genres: ['Sci-Fi', 'Mecha']
  },
  {
    id: 'leve',
    emoji: '🍵',

    get label() {
      return t('Algo leve, do dia a dia');
    },

    genres: ['Slice of Life']
  },
  {
    id: 'esporte',
    emoji: '⚽',

    get label() {
      return t('Esportes');
    },

    genres: ['Sports']
  },
  {
    id: 'drama',
    emoji: '😭',

    get label() {
      return t('Drama pra chorar');
    },

    genres: ['Drama']
  },
  {
    id: 'musica',
    emoji: '🎵',

    get label() {
      return t('Música e idols');
    },

    genres: ['Music']
  },
];

const AVOID = [
  {
    id: 'Ecchi',

    get label() {
      return t('Fanservice (ecchi)');
    }
  },
  {
    id: 'Horror',

    get label() {
      return t('Terror');
    }
  },
  {
    id: 'Romance',

    get label() {
      return t('Romance');
    }
  },
  {
    id: 'Mecha',

    get label() {
      return t('Robôs gigantes');
    }
  },
];

interface Answers {
  level?: Level;
  moods: string[];
  length?: Length;
  era?: Era;
  avoid: string[];
  streaming: number[];
}

const STEPS = ['level', 'moods', 'length', 'era', 'avoid', 'streaming'] as const;

function Option({ on, onClick, emoji, title, sub }: { on: boolean; onClick: () => void; emoji: string; title: string; sub?: string }) {
  return (
    <button
      onClick={onClick}
      className={`panel flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${
        on ? '!border-black !bg-pink text-white shadow-[4px_4px_0_var(--shadow)]' : 'hover:border-pink'
      }`}
    >
      <span className="text-3xl">{emoji}</span>
      <span>
        <span className="block font-extrabold">{title}</span>
        {sub && <span className={`block text-xs font-bold ${on ? 'text-white/80' : 'text-muted'}`}>{sub}</span>}
      </span>
    </button>
  );
}

async function buildSuggestions(a: Answers, inList: (id: number) => boolean) {
  const yearFrom = a.era === 'recent' ? 2018 : a.era === 'mid' ? 2000 : undefined;
  const yearTo = a.era === 'mid' ? 2017 : a.era === 'classic' ? 1999 : undefined;
  const formats: MediaFormat[] = a.length === 'movie' ? ['MOVIE'] : ['TV', 'ONA', 'MOVIE'];
  const length = a.length === 'short' || a.length === 'medium' ? a.length : undefined;
  const moods = MOODS.filter((m) => a.moods.includes(m.id));
  const genres = [...new Set(moods.flatMap((m) => m.genres))].filter((g) => !a.avoid.includes(g));

  const results = await Promise.all(
    genres.map((g) => {
      const f: BrowseFilters = {
        sort: a.level === 'otaku' ? 'SCORE_DESC' : 'POPULARITY_DESC',
        genres: [g],
        excludeGenres: a.avoid.filter((x) => x !== g),
        formats,
        length,
        yearFrom,
        yearTo,
        streaming: a.streaming,
        minScore: a.level === 'novato' ? 72 : 68,
      };
      return fetchPage(filtersToVars(f), 1, 15).then((p) => ({ genre: g, media: p.media }));
    }),
  );

  const map = new Map<number, { media: Media; score: number; why: Set<string> }>();
  for (const r of results) {
    r.media.forEach((m, i) => {
      if (inList(m.id)) return;
      const item = map.get(m.id) ?? { media: m, score: 0, why: new Set<string>() };
      // Bom ranking na busca + nota + aparecer em vários gostos
      item.score += (15 - i) + (m.averageScore ?? 60) / 10;
      item.why.add(genrePt(r.genre));
      map.set(m.id, item);
    });
  }
  return [...map.values()]
    .map((x) => ({ ...x, score: x.score * (1 + (x.why.size - 1) * 0.6) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ moods: [], avoid: [], streaming: [] });
  const [res, setRes] = useState<{ media: Media; why: Set<string> }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const entries = useList((s) => s.entries);
  const addMany = useList((s) => s.addMany);
  const toast = useUI((s) => s.toast);
  const key = STEPS[step];

  const canNext =
    (key === 'level' && a.level) ||
    (key === 'moods' && a.moods.length > 0) ||
    (key === 'length' && a.length) ||
    (key === 'era' && a.era) ||
    key === 'avoid' ||
    key === 'streaming';

  const finish = async () => {
    setLoading(true);
    try {
      setRes(await buildSuggestions(a, (id) => !!entries[id]));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const toggle = <T,>(arr: T[], v: T, max = 99) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v]);

  if (res)
    return (
      <>
        <SectionTitle title={t('Sua lista inicial')} jp="おすすめ" />
        <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
          <Sparkles className="text-yellow" />
          <span className="flex-1 text-sm font-bold">
            {res.length}{' '}{t(
              'animes escolhidos pra você. Marque o que já viu no + de cada card, ou adicione tudo de uma vez.'
            )}
          </span>
          <button
            className="manga-btn yellow"
            onClick={() => {
              const n = addMany(
                res.map((r) => r.media).filter((m) => !entries[m.id]),
                'PLANNING',
              );
              toast(t('{0} animes adicionados em "Quero ver"', n));
            }}
          >
            <ListPlus size={16} />{' '}{t('Adicionar todos em "Quero ver"')}
          </button>
          <button
            className="manga-btn ghost"
            onClick={() => {
              setRes(null);
              setStep(0);
            }}
          >
            <RotateCcw size={16} />{' '}{t('Refazer')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {res.map((r) => (
            <AnimeCard key={r.media.id} media={r.media} note={t('Porque você curte {0}', [...r.why].slice(0, 2).join(' e '))} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm font-bold text-muted">
          {t('Quer mais? Use o')}{' '}<Link to="/swipe" className="text-pink">{t('Modo rápido')}</Link>{' '}{t('ou veja')}{' '}
          <Link to="/pra-voce" className="text-pink">{t('Pra você')}</Link>{' '}{t('depois de adicionar alguns.')}
        </p>
      </>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle title={t('Por onde começar?')} jp="はじめよう" />
      <div className="mb-6 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-black bg-panel-2">
          <div className="h-full bg-linear-to-r from-pink to-cyan transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="text-xs font-black text-muted">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <div key={step} className="pop-in">
        {key === 'level' && (
          <>
            <h2 className="mb-4 font-display text-xl">{t('Quanto de anime você já viu?')}</h2>
            <div className="grid gap-3">
              <Option on={a.level === 'novato'} onClick={() => setA({ ...a, level: 'novato' })} emoji="🌱" title={t('Quase nada')} sub={t('Quero os clássicos que todo mundo recomenda')} />
              <Option on={a.level === 'casual'} onClick={() => setA({ ...a, level: 'casual' })} emoji="📺" title={t('Alguns')} sub={t('Já vi os famosos, quero mais do que gosto')} />
              <Option on={a.level === 'otaku'} onClick={() => setA({ ...a, level: 'otaku' })} emoji="🎌" title={t('Muito, sou otaku')} sub={t('Me mostre os mais bem avaliados')} />
            </div>
          </>
        )}
        {key === 'moods' && (
          <>
            <h2 className="mb-1 font-display text-xl">{t('O que você quer sentir?')}</h2>
            <p className="mb-4 text-sm font-bold text-muted">{t('Escolha até 3.')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MOODS.map((m) => (
                <Option key={m.id} on={a.moods.includes(m.id)} onClick={() => setA({ ...a, moods: toggle(a.moods, m.id, 3) })} emoji={m.emoji} title={m.label} />
              ))}
            </div>
          </>
        )}
        {key === 'length' && (
          <>
            <h2 className="mb-4 font-display text-xl">{t('Quanto tempo você tem?')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option on={a.length === 'short'} onClick={() => setA({ ...a, length: 'short' })} emoji="⚡" title={t('Pouco')} sub={t('Até 13 episódios')} />
              <Option on={a.length === 'medium'} onClick={() => setA({ ...a, length: 'medium' })} emoji="📅" title={t('Uma temporada')} sub={t('14 a 26 episódios')} />
              <Option on={a.length === 'any'} onClick={() => setA({ ...a, length: 'any' })} emoji="🏃" title={t('Pode ser longo')} sub={t('Topo maratona de 100+ eps')} />
              <Option on={a.length === 'movie'} onClick={() => setA({ ...a, length: 'movie' })} emoji="🎬" title={t('Prefiro filmes')} sub={t('Uma sessão e pronto')} />
            </div>
          </>
        )}
        {key === 'era' && (
          <>
            <h2 className="mb-4 font-display text-xl">{t('De que época?')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option on={a.era === 'recent'} onClick={() => setA({ ...a, era: 'recent' })} emoji="✨" title={t('Recentes')} sub={t('De 2018 pra cá, animação moderna')} />
              <Option on={a.era === 'mid'} onClick={() => setA({ ...a, era: 'mid' })} emoji="💿" title={t('2000 a 2017')} sub={t('A era de ouro de muita gente')} />
              <Option on={a.era === 'classic'} onClick={() => setA({ ...a, era: 'classic' })} emoji="📼" title={t('Clássicos')} sub={t('Antes de 2000')} />
              <Option on={a.era === 'any'} onClick={() => setA({ ...a, era: 'any' })} emoji="🎲" title={t('Tanto faz')} />
            </div>
          </>
        )}
        {key === 'avoid' && (
          <>
            <h2 className="mb-1 font-display text-xl">{t('Tem algo que você NÃO quer?')}</h2>
            <p className="mb-4 text-sm font-bold text-muted">{t('Opcional.')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AVOID.map((x) => (
                <Option key={x.id} on={a.avoid.includes(x.id)} onClick={() => setA({ ...a, avoid: toggle(a.avoid, x.id) })} emoji="🚫" title={x.label} />
              ))}
            </div>
          </>
        )}
        {key === 'streaming' && (
          <>
            <h2 className="mb-1 font-display text-xl">{t('Onde você assiste?')}</h2>
            <p className="mb-4 text-sm font-bold text-muted">{t(
              'Opcional — deixe em branco pra ver tudo. O catálogo do Brasil pode variar.'
            )}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {STREAMING.map((p) => (
                <Option key={p.id} on={a.streaming.includes(p.id)} onClick={() => setA({ ...a, streaming: toggle(a.streaming, p.id) })} emoji="📡" title={p.name} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button className="manga-btn ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || loading}>
          <ArrowLeft size={16} />{' '}{t('Voltar')}
        </button>
        <button className="manga-btn" onClick={next} disabled={!canNext || loading}>
          {loading ? <Spinner className="h-4 w-4" /> : step === STEPS.length - 1 ? <Sparkles size={16} /> : <ArrowRight size={16} />}
          {step === STEPS.length - 1 ? t('Ver sugestões') : t('Próximo')}
        </button>
      </div>
    </div>
  );
}
