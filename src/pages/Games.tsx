import { Link } from 'react-router-dom';
import { ArrowUpDown, Check, Flame, Image, Popcorn, Puzzle } from 'lucide-react';
import { SectionTitle } from '../components/ui';
import { dayNumber, todayKey } from '../games/core';
import { localBest, useStreak } from '../games/shared';
import { t } from '../lib/i18n';

function Status({ game }: { game: 'animedle' | 'imagem' | 'maisoumenos' }) {
  const best = localBest(game, todayKey());
  if (best === null) return <span className="chip cursor-default !px-2 !py-0.5 !text-[11px]">{t('Disponível hoje')}</span>;
  return (
    <span className="chip active cursor-default !px-2 !py-0.5 !text-[11px]">
      <Check size={12} /> {game === 'maisoumenos' ? t('Recorde: {0}', best) : t('Feito hoje')}
    </span>
  );
}

export default function Games() {
  const { streak } = useStreak('animedle');
  const cards = [
    {
      to: '/jogos/animedle',
      icon: Puzzle,
      jp: '今日',
      title: t('Animedle'),
      desc: t('Um anime secreto por dia. Chute e use as pistas de gênero, ano, estúdio e nota.'),
      extra: (
        <>
          <Status game="animedle" />
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-black">
              <Flame size={13} className="text-orange-400" /> {streak}
            </span>
          )}
        </>
      ),
    },
    {
      to: '/jogos/capa',
      icon: Image,
      jp: '絵',
      title: t('Adivinhe pela capa'),
      desc: t('10 capas borradas por dia. Quanto mais rápido acertar, mais pontos.'),
      extra: <Status game="imagem" />,
    },
    {
      to: '/jogos/mais-ou-menos',
      icon: ArrowUpDown,
      jp: '高低',
      title: t('Mais ou menos'),
      desc: t('Qual é mais popular? Qual tem a nota maior? Veja quantos acerta em sequência.'),
      extra: <Status game="maisoumenos" />,
    },
    {
      to: '/party',
      icon: Popcorn,
      jp: '早押し',
      title: t('Quiz ao vivo'),
      desc: t('Na watch party: o anfitrião começa e todo mundo responde junto, com placar na hora.'),
      extra: <span className="chip cursor-default !px-2 !py-0.5 !text-[11px]">{t('Com amigos')}</span>,
    },
  ];

  return (
    <>
      <SectionTitle title={t('Jogos')} jp="ゲーム" />
      <p className="-mt-2 mb-6 text-sm font-bold text-muted">
        {t('Desafio #{0} de hoje. Jogue, compartilhe e compare com quem você segue.', dayNumber())}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {cards.map(({ to, icon: Icon, jp, title, desc, extra }) => (
          <Link key={to} to={to} className="panel group relative overflow-hidden p-5 transition hover:-translate-y-0.5">
            <span className="pointer-events-none absolute -right-2 -top-4 font-jp text-7xl font-black text-pink/10">{jp}</span>
            <div className="relative flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-pink text-[var(--on-pink)]">
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-xl group-hover:text-pink">{title}</div>
                <p className="mt-1 text-sm font-bold text-muted">{desc}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">{extra}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
