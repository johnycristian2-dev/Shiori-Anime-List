import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ShieldAlert, VolumeX, X } from 'lucide-react';
import { muteUser } from '../sync/chat';
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '../components/ui';
import { timeAgo, UserLink } from '../components/Social';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useCloudUser } from '../sync/cloud';
import { amIAdmin, loadReports, REPORT_REASONS, setReportStatus } from '../sync/social';
import { BugsAdmin, ConfigAdmin } from '../components/AdminPanels';
import { AdminContent, AdminLog, AdminOverview, AdminSite, AdminUsers, OwnerBadge, AdminErrors } from '../components/OwnerPanel';
import { amIOwner } from '../sync/admin';
import { reportedContent, setChatMessageHidden, setCommentHidden, setPostHidden } from '../sync/posts';

const KIND: Record<string, () => string> = {
  profile: () => t('Perfil'),
  activity: () => t('Atividade do feed'),
  post: () => t('Post'),
  comment: () => t('Comentário'),
  message: () => t('Mensagem de chat'),
};

export default function Moderation() {
  const user = useCloudUser((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const setTab = (id: string) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  const admin = useQuery({ queryKey: ['is-admin', user?.id], queryFn: amIAdmin, enabled: !!user, staleTime: Infinity });
  const owner = useQuery({ queryKey: ['is-owner', user?.id], queryFn: amIOwner, enabled: !!user && !!admin.data, staleTime: Infinity });
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

  const isOwner = !!owner.data;
  const TABS: [string, string][] = [
    ['overview', t('Visão geral')],
    ['users', t('Usuários')],
    ['content', t('Conteúdo')],
    ['reports', t('Denúncias')],
    ['bugs', t('Bugs e ideias')],
    ['errors', t('Erros')],
    ['site', t('Site')],
    ...(isOwner ? ([['config', t('Apoio e afiliados')]] as [string, string][]) : []),
    ['log', t('Registro')],
  ];
  const tabs = (
    <div className="mb-5 flex gap-2 overflow-x-auto border-b-2 border-line pb-4">
      {TABS.map(([id, label]) => (
        <button key={id} className={`manga-btn shrink-0 !py-1.5 text-sm ${tab === id ? '' : 'ghost'}`} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );
  const title = (
    <SectionTitle title={t('Moderação')} jp="管理" action={isOwner ? <OwnerBadge /> : undefined} />
  );
  if (tab !== 'reports')
    return (
      <>
        {title}
        {tabs}
        {tab === 'overview' ? (
          <AdminOverview goto={setTab} />
        ) : tab === 'users' ? (
          <AdminUsers owner={isOwner} />
        ) : tab === 'content' ? (
          <AdminContent />
        ) : tab === 'errors' ? (
          <AdminErrors />
        ) : tab === 'site' ? (
          <AdminSite />
        ) : tab === 'log' ? (
          <AdminLog />
        ) : tab === 'bugs' ? (
          <BugsAdmin />
        ) : isOwner ? (
          <ConfigAdmin />
        ) : null}
      </>
    );

  return (
    <>
      {title}
      {tabs}
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
              {['post', 'comment', 'message'].includes(r.target_kind) && <Reported kind={r.target_kind} id={r.target_id} />}
              <div className="flex flex-wrap gap-2">
                {r.status === 'open' ? (
                  <>
                    <button className="manga-btn !py-1.5 text-sm" onClick={() => act(r.id, 'resolved')}>
                      <Check size={14} /> {t('Resolvida')}
                    </button>
                    <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => act(r.id, 'dismissed')}>
                      <X size={14} /> {t('Descartar')}
                    </button>
                    {r.target_user && (
                      <button
                        className="manga-btn ghost !py-1.5 text-sm"
                        onClick={async () => {
                          try {
                            await muteUser(r.target_user!, 24, `report:${r.id}`);
                            toast(t('Silenciado nos chats por 24 h'));
                          } catch (e) {
                            toast((e as Error).message, 'err');
                          }
                        }}
                      >
                        <VolumeX size={14} /> {t('Silenciar 24 h')}
                      </button>
                    )}
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

function Reported({ kind, id }: { kind: string; id: string | null }) {
  const toast = useUI((s) => s.toast);
  const q = useQuery({ queryKey: ['reported', kind, id], queryFn: () => reportedContent(kind, id) });
  if (q.isLoading) return <Spinner className="h-5 w-5 text-pink" />;
  if (!q.data) return <p className="text-xs font-bold text-muted">{t('O conteúdo já foi apagado.')}</p>;
  const c = q.data;
  return (
    <div className="space-y-2 rounded-[var(--radius-sm)] border-2 border-red-400/40 p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-red-300">{kind === 'post' ? t('Post denunciado') : kind === 'message' ? t('Mensagem de chat denunciada') : t('Comentário denunciado')}</div>
      <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
      <button
        className="manga-btn ghost !py-1 text-xs"
        onClick={async () => {
          try {
            if (kind === 'post') await setPostHidden(c.id, !c.hidden);
            else if (kind === 'message') await setChatMessageHidden(c.id, !c.hidden);
            else await setCommentHidden(c.id, !c.hidden);
            toast(c.hidden ? t('Visível de novo') : t('Ocultado para todos'));
            q.refetch();
          } catch (e) {
            toast((e as Error).message, 'err');
          }
        }}
      >
        {c.hidden ? t('Mostrar de novo') : t('Ocultar para todos')}
      </button>
    </div>
  );
}
