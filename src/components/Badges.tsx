import { Crown, Heart, Sparkles } from 'lucide-react';
import { t } from '../lib/i18n';
import { isPlus, usePerks, type Banner } from '../sync/perks';

/** Selos ao lado do nome: Dono, Shiori+ e Apoiador. */
export default function Badges({ userId, size = 'sm' }: { userId?: string | null; size?: 'sm' | 'md' }) {
  const p = usePerks(userId);
  if (!p) return null;
  const cls = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-px text-[9px]';
  const ic = size === 'md' ? 12 : 10;
  const out = [];
  if (p.owner)
    out.push(
      <span key="o" title={t('Criador do Shiori')} className={`badge-owner inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-black font-black uppercase tracking-wide ${cls}`}>
        <Crown size={ic} strokeWidth={3} /> {t('Dono')}
      </span>,
    );
  if (isPlus(p) && !p.owner)
    out.push(
      <span key="p" title={t('Assinante Shiori+')} className={`badge-plus inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-black font-black ${cls}`}>
        <Sparkles size={ic} strokeWidth={3} /> Shiori+
      </span>,
    );
  if (p.supporter_since)
    out.push(
      <span key="a" title={t('Apoiou o Shiori')} className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-black bg-pink font-black text-black ${cls}`}>
        <Heart size={ic} strokeWidth={3} fill="currentColor" /> {t('Apoiador')}
      </span>,
    );
  if (!out.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-1 align-middle">{out}</span>;
}

/** Fundo animado do banner do perfil (Shiori+). */
export function AnimatedBanner({ kind }: { kind: Banner }) {
  return (
    <div className={`banner-fx banner-${kind} absolute inset-0`} aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}

export function BannerName(b: Banner) {
  return { aurora: t('Aurora'), sakura: t('Chuva de sakura'), neon: t('Neon'), ouro: t('Ouro'), galaxia: t('Galáxia') }[b];
}
