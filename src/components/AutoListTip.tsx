import { useEffect, useState } from 'react';
import { Download, Tv, X } from 'lucide-react';
import { pingExtension } from '../sync/partyLive';
import { t } from '../lib/i18n';

/** Convite pra extensão que atualiza a lista sozinha (some se já tiver a extensão ou se fechar). */
export default function AutoListTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('shiori-tip-autolist') === 'off') return;
    pingExtension().then((s) => setShow(!s));
  }, []);
  if (!show) return null;
  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-3 border-cyan p-4">
      <Tv size={22} className="shrink-0 text-cyan" />
      <div className="min-w-[200px] flex-1">
        <div className="font-display">{t('Sua lista pode se atualizar sozinha')}</div>
        <div className="text-xs font-bold text-muted">
          {t('Com a extensão Shiori, cada episódio que você termina no Crunchyroll é marcado aqui automaticamente.')}
        </div>
      </div>
      <a href="/shiori-extension.zip" download className="manga-btn cyan !py-2 !text-sm">
        <Download size={15} /> {t('Baixar extensão')}
      </a>
      <button
        className="p-1 text-muted hover:text-ink"
        aria-label={t('Fechar')}
        onClick={() => {
          localStorage.setItem('shiori-tip-autolist', 'off');
          setShow(false);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
