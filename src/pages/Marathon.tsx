import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Clock, FolderPlus, ListPlus, Search } from 'lucide-react';
import { useSearch } from '../api/hooks';
import { EmptyState, ErrorBox, SectionTitle, Spinner, useDebounced } from '../components/ui';
import { fetchFranchise, planMarathon } from '../lib/marathon';
import { FORMAT_LABEL } from '../lib/labels';
import { useTitle, coverOf } from '../lib/format';
import { STATUS_META, useList } from '../store/list';
import { useUI } from '../store/ui';

import { t, locale } from '../lib/i18n';

/** Segunda a domingo, com a inicial no idioma atual (2024-01-01 foi segunda). */
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
  d,
  get l() {
    return new Date(2024, 0, d === 0 ? 7 : d).toLocaleDateString(locale(), { weekday: 'narrow' });
  },
}));

const fmtDate = (d: Date) => d.toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
const fmtHours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
};

function Picker() {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 300);
  const q = useSearch(debounced);
  const nav = useNavigate();
  const title = useTitle();
  return (
    <div className="mx-auto max-w-xl">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pink" size={18} />
        <input className="field !py-3 !pl-10 text-base" autoFocus placeholder={t('Qual franquia? (ex.: Shingeki, Monogatari…)')} value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {q.isFetching && <Spinner className="mx-auto h-6 w-6 text-pink" />}
      <div className="space-y-2">
        {(q.data?.media ?? []).map((m) => (
          <button key={m.id} onClick={() => nav(`/maratona/${m.id}`)} className="panel flex w-full items-center gap-3 p-2 text-left hover:border-pink">
            <img src={coverOf(m)} alt="" className="h-14 w-10 rounded-md border-2 border-black object-cover" />
            <div className="min-w-0">
              <div className="truncate font-extrabold">{title(m)}</div>
              <div className="text-xs font-bold text-muted">{[m.format && FORMAT_LABEL[m.format], m.seasonYear].filter(Boolean).join(' · ')}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Marathon() {
  const id = Number(useParams().id);
  const title = useTitle();
  const entries = useList((s) => s.entries);
  const addMany = useList((s) => s.addMany);
  const add = useList((s) => s.add);
  const createList = useList((s) => s.createList);
  const toggleInList = useList((s) => s.toggleInList);
  const toast = useUI((s) => s.toast);
  const [minutes, setMinutes] = useState(120);
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [extras, setExtras] = useState(false);
  const [skipSeen, setSkipSeen] = useState(true);

  const q = useQuery({
    queryKey: ['franchise', id],
    queryFn: () => fetchFranchise(id),
    enabled: Number.isFinite(id),
    staleTime: 1000 * 60 * 60,
  });

  const result = useMemo(() => {
    if (!q.data) return null;
    const watched = skipSeen ? Object.fromEntries(Object.values(entries).map((e) => [e.mediaId, e.status === 'COMPLETED' ? e.episodes ?? e.progress : e.progress])) : {};
    return planMarathon(q.data, { minutesPerDay: minutes, weekdays, includeExtras: extras, watched });
  }, [q.data, minutes, weekdays, extras, skipSeen, entries]);

  if (!Number.isFinite(id))
    return (
      <>
        <SectionTitle title={t('Planejador de maratona')} jp="一気見" />
        <p className="-mt-2 mb-6 text-sm font-bold text-muted">{t(
          'Escolha um anime: eu monto a franquia na ordem certa e calculo quando você termina.'
        )}</p>
        <Picker />
      </>
    );

  if (q.isLoading)
    return (
      <div className="grid h-[50vh] place-items-center text-center">
        <div>
          <Spinner className="mx-auto h-10 w-10 text-pink" />
          <p className="mt-3 text-sm font-bold text-muted">{t('Montando a franquia (prequelas, sequências, filmes)…')}</p>
        </div>
      </div>
    );
  if (q.error || !q.data || !result) return <ErrorBox error={q.error ?? new Error(t('Não deu pra montar a franquia'))} onRetry={() => q.refetch()} />;

  const root = q.data.find((m) => m.id === id) ?? q.data[0];
  const counted = result.plan.filter((p) => !p.skipped);
  const extrasCount = q.data.filter((m) => !m.main).length;

  const addAll = () => {
    const medias = counted.map((p) => p.media);
    const n = addMany(medias, 'PLANNING');
    const first = counted.find((p) => entries[p.media.id]?.status !== 'COMPLETED');
    if (first && entries[first.media.id]?.status !== 'WATCHING') add(first.media, 'WATCHING');
    toast(t(
      '{0} adicionados · {1}',
      n,
      first ? t('{0} em Assistindo', title(first.media)) : ''
    ));
  };

  const makeList = () => {
    const listId = createList(`Maratona: ${title(root)}`.slice(0, 30), '🏃');
    counted.forEach((p) => toggleInList(listId, p.media));
    toast(t('Lista da maratona criada em Minha lista'));
  };

  return (
    <>
      <SectionTitle title={t('Planejador de maratona')} jp="一気見" action={<Link to="/maratona">{t('Trocar anime')}</Link>} />

      <div className="mb-6 flex items-center gap-4">
        {coverOf(root) && <img src={coverOf(root)} alt="" className="h-24 w-16 rounded-lg border-2 border-black object-cover" />}
        <div>
          <div className="font-display text-2xl">{title(root)}</div>
          <div className="text-sm font-bold text-muted">
            {q.data.filter((m) => m.main).length}{' '}{t('na linha principal ·')}{' '}{extrasCount}{' '}{t('extras')}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel space-y-5 p-5">
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-black uppercase tracking-wider text-muted">
              {t('Tempo por dia')}{' '}<span className="text-pink">{fmtHours(minutes)}</span>
            </label>
            <input type="range" min={20} max={480} step={10} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full accent-[var(--pink)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted">{t('Dias que você assiste')}</label>
            <div className="flex gap-1.5">
              {WEEK.map((w) => {
                const on = weekdays.includes(w.d);
                return (
                  <button
                    key={w.d}
                    onClick={() => setWeekdays((x) => (on ? (x.length > 1 ? x.filter((d) => d !== w.d) : x) : [...x, w.d]))}
                    className={`h-10 flex-1 rounded-lg border-2 font-black ${on ? 'border-black bg-pink text-[var(--on-pink)]' : 'border-line bg-panel-2 text-muted'}`}
                  >
                    {w.l}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="chip !text-xs" onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}>
                {t('Todo dia')}
              </button>
              <button className="chip !text-xs" onClick={() => setWeekdays([0, 6])}>
                {t('Só fim de semana')}
              </button>
              <button className="chip !text-xs" onClick={() => setWeekdays([1, 2, 3, 4, 5])}>
                {t('Dias úteis')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`chip ${extras ? 'on' : ''}`} onClick={() => setExtras((v) => !v)} disabled={!extrasCount}>
              {t('Incluir extras (')}{extrasCount})
            </button>
            <button className={`chip ${skipSeen ? 'on' : ''}`} onClick={() => setSkipSeen((v) => !v)}>
              {t('Descontar o que já vi')}
            </button>
          </div>
        </div>

        <div className="halftone relative overflow-hidden rounded-2xl border-[3px] border-black bg-cyan p-5 text-black shadow-[6px_6px_0_var(--shadow)]">
          <div className="absolute -right-2 -top-5 font-jp text-8xl font-black text-black/10">完走</div>
          <div className="relative grid grid-cols-2 gap-3">
            <div>
              <div className="font-display text-xl leading-tight sm:text-3xl">{result.totalEpisodes}</div>
              <div className="text-xs font-black uppercase">{t('episódios')}</div>
            </div>
            <div>
              <div className="font-display text-xl leading-tight sm:text-3xl">{fmtHours(result.totalMinutes)}</div>
              <div className="text-xs font-black uppercase">{t('no total')}</div>
            </div>
            <div>
              <div className="font-display text-xl leading-tight sm:text-3xl">{result.calendarDays}</div>
              <div className="text-xs font-black uppercase">{t('dias de calendário')}</div>
            </div>
            <div>
              <div className="font-display text-xl leading-tight sm:text-3xl">{result.totalEpisodes ? fmtDate(result.endDate) : '—'}</div>
              <div className="text-xs font-black uppercase">{t('você termina')}</div>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <button className="manga-btn" onClick={addAll} disabled={!counted.length}>
              <ListPlus size={16} />{' '}{t('Adicionar na ordem')}
            </button>
            <button className="manga-btn ghost" onClick={makeList} disabled={!counted.length}>
              <FolderPlus size={16} />{' '}{t('Criar lista da maratona')}
            </button>
          </div>
        </div>
      </div>

      {!counted.length && (
        <EmptyState jp="完" title={t('Nada pra maratonar')}>
          {t(
            'Você já viu tudo dessa franquia, ou os títulos ainda não têm número de episódios.'
          )}
        </EmptyState>
      )}

      <div className="relative space-y-3 border-l-[3px] border-dashed border-line pl-5">
        {result.plan.map((p, i) => {
          const e = entries[p.media.id];
          return (
            <div key={p.media.id} className={`panel relative flex gap-3 p-2.5 ${p.skipped ? 'opacity-55' : ''} ${p.media.main ? '' : 'border-dashed'}`}>
              <span className="absolute -left-[33px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 border-black bg-pink text-[10px] font-black text-[var(--on-pink)]">
                {i + 1}
              </span>
              <Link to={`/anime/${p.media.id}`} className="shrink-0">
                <img src={coverOf(p.media)} alt="" loading="lazy" className="h-20 w-14 rounded-lg border-2 border-black object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/anime/${p.media.id}`} className="line-clamp-1 font-extrabold hover:text-pink">
                  {title(p.media)}
                </Link>
                <div className="text-xs font-bold text-muted">
                  {[p.media.format && FORMAT_LABEL[p.media.format], p.media.startDate.year, !p.media.main && 'extra'].filter(Boolean).join(' · ')}
                  {e && (
                    <span className="ml-2 rounded px-1.5 text-[10px] font-black text-black" style={{ background: STATUS_META[e.status].color }}>
                      {STATUS_META[e.status].label}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
                  {p.skipped === 'visto' ? (
                    <span className="text-[#7cff8a]">{t('✓ Já visto')}</span>
                  ) : p.skipped === 'sem-episodios' ? (
                    <span className="text-yellow">{t('Em lançamento / sem nº de episódios')}</span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {p.episodes}{' '}{t('ep ×')}{' '}{p.minutesPerEp}{t('min =')}{' '}{fmtHours(p.totalMinutes)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-cyan">
                        <CalendarCheck size={12} /> {p.startDay === p.endDay ? fmtDate(p.startDate) : `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
