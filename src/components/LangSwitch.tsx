import { useCallback, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { LANGS, t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useOutsideClose } from './ui';

/** Botão de idioma no topo: 🇧🇷 / 🇺🇸 / 🇯🇵 */
export default function LangSwitch() {
  const lang = useUI((s) => s.lang);
  const setLang = useUI((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(box, open, close);
  const cur = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <div className="relative" ref={box}>
      <button className="manga-btn ghost !px-2 !py-2 gap-1 text-xs font-black leading-none" onClick={() => setOpen((v) => !v)} aria-label={t('Idioma')} title={t('Idioma')}>
        <Languages size={16} /> {cur.short}
      </button>
      {open && (
        <div className="pop-in panel absolute right-0 top-12 z-50 w-44 p-1.5 shadow-[6px_6px_0_var(--shadow)]">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLang(l.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-panel-2 ${l.id === lang ? 'text-pink' : ''}`}
            >
              <span className="w-7 text-xs font-black text-muted">{l.short}</span>
              <span className="flex-1">{l.label}</span>
              {l.id === lang && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
