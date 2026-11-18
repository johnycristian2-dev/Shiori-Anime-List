import { useState } from 'react';
import { Info, AlertTriangle, Megaphone, X } from 'lucide-react';
import { useConfig } from '../sync/perks';
import { t } from '../lib/i18n';

const KEY = 'shiori-announcement-closed';

/** Faixa de anúncio no topo do site (texto definido no painel de moderação). */
export default function AnnouncementBar() {
  const cfg = useConfig().data;
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });
  const text = cfg?.announcement?.trim();
  if (!text || closed === text) return null;
  const kind = cfg?.announcement_kind;
  const tone = kind === 'alert' ? 'bg-red-500 text-white' : kind === 'warn' ? 'bg-yellow text-black' : 'bg-pink text-[var(--on-pink)]';
  const Icon = kind === 'alert' ? AlertTriangle : kind === 'warn' ? Megaphone : Info;
  return (
    <div className={`relative z-20 border-b-[3px] border-black ${tone}`} role="status">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm font-extrabold">
        <Icon size={16} className="shrink-0" />
        <span className="flex-1 whitespace-pre-line">{text}</span>
        <button
          className="shrink-0 rounded p-1 hover:bg-black/10"
          aria-label={t('Fechar')}
          onClick={() => {
            setClosed(text);
            try {
              localStorage.setItem(KEY, text);
            } catch {
              /* ignore */
            }
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
