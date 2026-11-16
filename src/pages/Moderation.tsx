import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ShieldAlert, X } from 'lucide-react';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { timeAgo, UserLink } from '../components/Social';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import { amIAdmin, loadReports, REPORT_REASONS, setReportStatus } from '../sync/social';

const KIND: Record<string, () => string> = {
  profile: () => t('Perfil'),
  activity: () => t('Atividade do feed'),
  post: () => t('Post'),
  message: () => t('Mensagem'),
};

export default function Moderation() {
  const user = useCloudUser((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const admin = useQuery({ queryKey: ['is-admin', user?.id], queryFn: amIAdmin, enabled: !!user, staleTime: Infinity });
  const q = useQuery({ queryKey: ['reports', status], queryFn: () => loadReports(status), enabled: !!admin.data });

  if (admin.isLoading) return <Spinner className="mx-auto mt-20 h-8 w-8 text-pink" />;
  if (!admin.data)
    return (
      <EmptyState jp="禁止" title={t('Área só para moderadores')}>
        <p className="text-sm text-muted">{t('Se você acha que deveria ter acesso, fale com o dono do site.')}</p>
      </EmptyState>
    );

  const act = async (id: number, s: 'resolved' | 'dismissed' | 'open') => {
    try {
      await setReportStatus(id, s);
      toast(s === 'resolved' ? t('Marcada como resolvida') : s === 'dismissed' ? t('Denúncia descartada') : t('Reaberta'));
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <>
      <SectionTitle title={t('Moderação')} jp="管理" />
      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ['open', t('Abertas')],
            ['resolved', t('Resolvidas')],
            ['dismissed', t('Descartadas')],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`chip ${status === id ? 'on' : ''}`} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.rows.length ? (
        <EmptyState jp="平和" title={t('Nenhuma denúncia aqui')}>
          <ShieldAlert className="mx-auto text-muted" />
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {q.data.rows.map((r) => (
            <div key={r.id} className="panel space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                <span className="chip !py-0.5 !text-[11px]">{REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason}</span>
                <span>{KIND[r.target_kind]?.() ?? r.target_kind}</span>
                {r.target_id && <span>#{r.target_id}</span>}
                <span className="ml-auto">{timeAgo(r.created_at)}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-300">{t('Denunciado')}</div>
                  <UserLink p={r.target_user ? q.data.profiles[r.target_user] : null} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted">{t('Quem denunciou')}</div>
                  <UserLink p={q.data.profiles[r.reporter]} size={32} />
                </div>
              </div>
              {r.details && <p className="rounded-[var(--radius-sm)] bg-panel-2 p-2.5 text-sm">{r.details}</p>}
              <div className="flex flex-wrap gap-2">
                {r.status === 'open' ? (
                  <>
                    <button className="manga-btn !py-1.5 text-sm" onClick={() => act(r.id, 'resolved')}>
                      <Check size={14} /> {t('Resolvida')}
                    </button>
                    <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => act(r.id, 'dismissed')}>
                      <X size={14} /> {t('Descartar')}
                    </button>
                  </>
                ) : (
                  <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => act(r.id, 'open')}>
                    {t('Reabrir')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-8 text-xs font-bold text-muted">
        {t('Para suspender uma conta: Supabase → Authentication → Users → o usuário → Ban user. Para apagar: Delete user (apaga tudo dele).')}
      </p>
    </>
  );
}
