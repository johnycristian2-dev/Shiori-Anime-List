import { useEffect, useState } from 'react';
import { Bell, BellOff, Share } from 'lucide-react';
import { Spinner } from './ui';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import { disablePush, enablePush, isIOS, isStandalone, pushEnabled, pushSupported } from '../sync/push';
import { t } from '../lib/i18n';

/** Liga/desliga o aviso de episódio novo neste aparelho. */
export default function PushToggle() {
  const user = useCloudUser((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushEnabled()
      .then(setOn)
      .catch(() => setOn(false));
  }, []);

  if (!user) return null;
  const iosNeedsInstall = isIOS() && !isStandalone();

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast(t('Avisos desligados neste aparelho.'));
      } else {
        await enablePush();
        setOn(true);
        toast(t('Pronto! Você vai ser avisado quando sair episódio novo do que está assistindo.'));
      }
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
      {on ? <Bell size={22} className="shrink-0 text-yellow" /> : <BellOff size={22} className="shrink-0 text-muted" />}
      <div className="min-w-[200px] flex-1">
        <div className="font-display">{t('Aviso de episódio novo')}</div>
        <div className="text-xs font-bold text-muted">
          {iosNeedsInstall
            ? t('No iPhone: toque em Compartilhar → "Adicionar à Tela de Início", abra o Shiori por lá e ative aqui.')
            : !pushSupported()
              ? t('Este navegador não aceita notificações.')
              : t('Uma notificação quando sair episódio novo de algo que você está assistindo.')}
        </div>
      </div>
      {iosNeedsInstall ? (
        <Share size={18} className="text-muted" />
      ) : (
        pushSupported() && (
          <button className={`manga-btn !py-2 !text-sm ${on ? 'ghost' : 'yellow'}`} disabled={busy || on === null} onClick={toggle}>
            {busy ? <Spinner className="h-4 w-4" /> : on ? t('Desligar') : t('Ativar avisos')}
          </button>
        )
      )}
    </div>
  );
}
