import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, Lightbulb, MessageCircle } from 'lucide-react';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { allBugs, saveConfig, updateBug, useConfig, type AppConfig, type BugRow } from '../sync/perks';
import { EmptyState, ErrorBox, Spinner } from './ui';
import { timeAgo } from './Social';

const KIND_ICON = { bug: Bug, ideia: Lightbulb, outro: MessageCircle };
export const BUG_STATUS: Record<BugRow['status'], () => string> = {
  open: () => t('Novo'),
  doing: () => t('Em andamento'),
  done: () => t('Resolvido'),
  dismissed: () => t('Arquivado'),
};

export function BugsAdmin() {
  const [status, setStatus] = useState<BugRow['status']>('open');
  const q = useQuery({ queryKey: ['bugs-admin', status], queryFn: () => allBugs(status) });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(BUG_STATUS) as BugRow['status'][]).map((s) => (
          <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
            {BUG_STATUS[s]()}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState jp="無事" title={t('Nada por aqui')} />
      ) : (
        <div className="space-y-3">
          {q.data.map((b) => (
            <BugCard key={b.id} b={b} onDone={() => q.refetch()} />
          ))}
        </div>
      )}
    </>
  );
}

function BugCard({ b, onDone }: { b: BugRow; onDone: () => void }) {
  const toast = useUI((s) => s.toast);
  const [reply, setReply] = useState(b.reply ?? '');
  const Icon = KIND_ICON[b.kind];
  const save = async (status: BugRow['status']) => {
    try {
      await updateBug(b.id, { status, reply: reply.trim() || null });
      toast(t('Salvo'));
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <div className="panel space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
        <span className="chip !py-0.5 !text-[11px]">
          <Icon size={12} /> {b.kind}
        </span>
        {b.page && <span className="truncate">{b.page}</span>}
        <span className="ml-auto">{timeAgo(b.created_at)}</span>
      </div>
      <p className="whitespace-pre-line break-words text-sm">{b.message}</p>
      {b.device && <p className="truncate text-[10px] text-muted">{b.device}</p>}
      <textarea className="field min-h-16 text-sm" placeholder={t('Resposta pra pessoa (opcional)')} value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="manga-btn !py-1.5 text-sm" onClick={() => save('done')}>{t('Resolvido')}</button>
        <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => save('doing')}>{t('Em andamento')}</button>
        <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => save('dismissed')}>{t('Arquivar')}</button>
      </div>
    </div>
  );
}

export function ConfigAdmin() {
  const toast = useUI((s) => s.toast);
  const qc = useQueryClient();
  const cfg = useConfig();
  const [form, setForm] = useState<AppConfig | null>(null);
  useEffect(() => {
    if (cfg.data && !form) setForm(cfg.data);
  }, [cfg.data, form]);
  if (!form) return <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />;
  const save = async () => {
    try {
      await saveConfig('amazon_tag', form.amazon_tag.trim());
      await saveConfig('kofi_url', form.kofi_url.trim());
      await saveConfig('apoiase_url', form.apoiase_url.trim());
      await saveConfig('payments_on', form.payments_on ? 'true' : 'false');
      qc.invalidateQueries({ queryKey: ['app-config'] });
      toast(t('Configuração salva'));
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const field = (k: 'amazon_tag' | 'kofi_url' | 'apoiase_url', label: string, ph: string, help: string) => (
    <label className="block">
      <span className="text-sm font-extrabold">{label}</span>
      <input className="field mt-1" value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      <span className="mt-1 block text-xs text-muted">{help}</span>
    </label>
  );
  return (
    <div className="panel max-w-xl space-y-4 p-5">
      {field('amazon_tag', t('Tag de afiliado da Amazon'), 'seunome-20', t('Do painel do Associados Amazon. Vazio = botão "Comprar" escondido.'))}
      {field('kofi_url', t('Link do Ko-fi'), 'https://ko-fi.com/...', t('Opcional. Aparece na página Apoiar.'))}
      {field('apoiase_url', t('Link do Apoia.se'), 'https://apoia.se/...', t('Opcional. Aparece na página Apoiar.'))}
      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input type="checkbox" checked={form.payments_on} onChange={(e) => setForm({ ...form, payments_on: e.target.checked })} />
        {t('Pagamentos via Pix ligados (Shiori+ e doação)')}
      </label>
      <p className="text-xs text-muted">
        {t('Só ligue depois de colocar o token do Mercado Pago no segredo MP_ACCESS_TOKEN do Supabase (Edge Functions → Secrets).')}
      </p>
      <button className="manga-btn" onClick={save}>{t('Salvar')}</button>
    </div>
  );
}
