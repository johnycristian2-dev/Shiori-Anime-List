import { BookOpen, Tv } from 'lucide-react';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';

/** Alterna o site entre anime e leitura (mangá, manhwa, webtoon, light novel). */
export default function KindSwitch({ className = '' }: { className?: string }) {
  const kind = useUI((s) => s.kind);
  const setKind = useUI((s) => s.setKind);
  return (
    <div role="tablist" aria-label={t('Tipo')} className={`inline-flex rounded-[var(--radius-sm)] border-2 border-line bg-panel-2 p-1 ${className}`}>
      {(
        [
          ['ANIME', Tv, t('Anime')],
          ['MANGA', BookOpen, t('Mangá & Webtoon')],
        ] as const
      ).map(([k, Icon, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={kind === k}
          onClick={() => setKind(k)}
          className={`flex items-center gap-1.5 rounded-[calc(var(--radius-sm)*0.7)] px-3 py-1.5 text-sm font-extrabold transition ${kind === k ? 'bg-pink' : 'text-muted hover:text-ink'}`}
          style={kind === k ? { color: 'var(--on-pink, #fff)' } : undefined}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}
