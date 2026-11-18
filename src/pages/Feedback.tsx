import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bug, Lightbulb, MessageCircle, Send } from 'lucide-react';
import { EmptyState, SectionTitle } from '../components/ui';
import { timeAgo } from '../components/Social';
import { BUG_STATUS } from '../components/AdminPanels';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import { myBugs, sendBug, type BugKind } from '../sync/perks';

export default function Feedback() {
  const user = useCloudUser((s) => s.user);
  const logged = !!user && !user.is_anonymous;
  const toast = useUI((s) => s.toast);
  const [kind, setKind] = useState<BugKind>('bug');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = useQuery({ queryKey: ['my-bugs', user?.id], queryFn: myBugs, enabled: logged });
  const from = typeof document !== 'undefined' ? document.referrer : '';

  const KINDS: { id: BugKind; label: string; icon: typeof Bug; ph: string }[] = [
    { id: 'bug', label: t('Bug'), icon: Bug, ph: t('O que aconteceu? Em qual página? O que você esperava que acontecesse?') },
    { id: 'ideia', label: t('Ideia'), icon: Lightbulb, ph: t('Conta a sua ideia pro Shiori') },
    { id: 'outro', label: t('Outro'), icon: MessageCircle, ph: t('Pode falar') },
  ];
  const cur = KINDS.find((k) => k.id === kind)!;

  const send = async () => {
    setBusy(true);
    try {
      await sendBug(kind, msg, from || window.location.href);
      setMsg('');
      toast(t('Recebido! Obrigado por ajudar a melhorar o Shiori.'));
      mine.refetch();
    } catch (e) {
      const m = (e as Error).message;
      toast(m.includes('too_many') ? t('Muitos envios em pouco tempo. Tente mais tarde.') : m, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle title={t('Reportar bug ou sugerir')} jp="報告" />
      {!logged ? (
        <EmptyState jp="入る" title={t('Entre na sua conta para enviar')}>
          <p className="text-sm text-muted">{t('Assim a gente consegue te responder.')}</p>
        </EmptyState>
      ) : (
        <div className="panel max-w-2xl space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k.id} className={`manga-btn !py-1.5 text-sm ${kind === k.id ? '' : 'ghost'}`} onClick={() => setKind(k.id)}>
                <k.icon size={15} /> {k.label}
              </button>
            ))}
          </div>
          <textarea className="field min-h-36" placeholder={cur.ph} value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{t('Enviamos junto o tipo do seu aparelho/navegador pra ajudar a achar o bug.')}</span>
            <button className="manga-btn shrink-0" disabled={busy || msg.trim().length < 5} onClick={send}>
              <Send size={16} /> {t('Enviar')}
            </button>
          </div>
        </div>
      )}

      {logged && !!mine.data?.length && (
        <>
          <h2 className="mb-3 mt-8 font-display text-xl">{t('Seus envios')}</h2>
          <div className="max-w-2xl space-y-3">
            {mine.data.map((b) => (
              <div key={b.id} className="panel p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted">
                  <span className={`chip !py-0.5 !text-[11px] ${b.status === 'done' ? 'on' : ''}`}>{BUG_STATUS[b.status]()}</span>
                  <span className="ml-auto">{timeAgo(b.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm">{b.message}</p>
                {b.reply && (
                  <p className="mt-2 rounded-[var(--radius-sm)] border-l-4 border-pink bg-panel-2 p-2.5 text-sm">
                    <b>{t('Resposta')}:</b> {b.reply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
