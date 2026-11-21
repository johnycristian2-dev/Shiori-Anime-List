import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  BellRing,
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  Heart,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  VolumeX,
} from 'lucide-react';
import Avatar from './Avatar';
import { ConfirmButton, EmptyState, ErrorBox, Spinner, useDebounced } from './ui';
import { timeAgo } from './Social';
import { t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { brl, useConfig } from '../sync/perks';
import { miniProfiles } from '../sync/social';
import { pushSupported, setStaffAlerts, staffAlertsOn } from '../sync/push';
import {
  accountAction,
  adminStats,
  clientErrors,
  resolveError,
  bannedTerms,
  grantPlus,
  modLog,
  moderateContent,
  muteFor,
  purgeContent,
  recentContent,
  renameUser,
  resetProfile,
  searchUsers,
  setModerator,
  setSite,
  setSupporter,
  setTerm,
  userActivity,
  type AdminUser,
  type ContentKind,
} from '../sync/admin';

/** Roda uma ação, mostra o resultado e recarrega o que precisar. */
function useAct() {
  const toast = useUI((s) => s.toast);
  const qc = useQueryClient();
  return async (fn: () => Promise<unknown>, ok: string, keys: string[][] = []) => {
    try {
      await fn();
      toast(ok);
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
}

const KIND_LABEL: Record<ContentKind, () => string> = {
  post: () => t('Post'),
  comment: () => t('Comentário'),
  message: () => t('Mensagem de chat'),
};

/* ───────────────────────── Visão geral ───────────────────────── */
export function AdminOverview({ goto }: { goto: (tab: string) => void }) {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: adminStats, refetchInterval: 60_000 });
  const act = useAct();
  if (q.isLoading) return <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const max = Math.max(1, ...s.signups_by_day.map((d) => d.n));
  const cards: { label: string; value: string | number; sub?: string; icon: typeof Users; tab?: string; alert?: boolean }[] = [
    { label: t('Usuários'), value: s.users, sub: t('+{0} hoje · +{1} na semana', s.users_24h, s.users_7d), icon: Users, tab: 'users' },
    { label: t('Ativos 24 h'), value: s.active_24h, sub: t('{0} listas mexidas na semana', s.active_lists_7d), icon: PlayCircle },
    { label: t('Denúncias abertas'), value: s.reports_open, icon: ShieldCheck, tab: 'reports', alert: s.reports_open > 0 },
    { label: t('Bugs e ideias novos'), value: s.bugs_open, icon: BellRing, tab: 'bugs', alert: s.bugs_open > 0 },
    { label: t('Posts / comentários 24 h'), value: `${s.posts_24h} / ${s.comments_24h}`, icon: MessageSquare, tab: 'content' },
    { label: t('Mensagens no chat 24 h'), value: s.chat_24h, icon: MessageSquare, tab: 'content' },
    { label: t('Partidas hoje'), value: s.games_today, icon: Gamepad2 },
    { label: t('Banidos / silenciados'), value: `${s.banned} / ${s.muted}`, icon: Ban, tab: 'users' },
    { label: t('Shiori+ ativos'), value: s.plus_active, sub: t('{0} apoiadores', s.supporters), icon: Sparkles },
    { label: t('Receita do mês'), value: brl(s.revenue_month_cents), sub: t('Total: {0}', brl(s.revenue_total_cents)), icon: Heart },
  ];
  return (
    <div className="space-y-6">
      {s.paused && (
        <div className="panel flex flex-wrap items-center gap-3 border-yellow p-4">
          <PauseCircle className="text-yellow" />
          <b className="flex-1 text-sm">{t('A comunidade está pausada: ninguém além da equipe consegue postar, comentar ou mandar mensagem.')}</b>
          <button className="manga-btn yellow !py-1.5 text-sm" onClick={() => act(() => setSite('community_paused', 'false'), t('Comunidade liberada'), [['admin-stats'], ['app-config']])}>
            {t('Liberar agora')}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.tab && goto(c.tab)}
            className={`panel p-3 text-left transition ${c.tab ? 'hover:-translate-y-0.5' : 'cursor-default'} ${c.alert ? 'border-pink' : ''}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted">
              <c.icon size={12} /> {c.label}
            </div>
            <div className="mt-1 font-display text-2xl">{c.value}</div>
            {c.sub && <div className="text-[11px] font-bold text-muted">{c.sub}</div>}
          </button>
        ))}
      </div>
      <div className="panel p-4">
        <b className="text-sm">{t('Cadastros nos últimos 14 dias')}</b>
        {s.signups_by_day.length ? (
          <div className="mt-3 flex h-28 items-end gap-1">
            {s.signups_by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                <span className="text-[10px] font-bold text-muted">{d.n}</span>
                <div className="w-full rounded-t bg-pink" style={{ height: `${(d.n / max) * 80}px`, minHeight: 3 }} />
                <span className="text-[9px] text-muted">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t('Nenhum cadastro no período.')}</p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Usuários ───────────────────────── */
const FILTERS = () =>
  [
    ['all', t('Todos')],
    ['new', t('Novos (7 dias)')],
    ['reported', t('Com denúncia')],
    ['banned', t('Banidos')],
    ['muted', t('Silenciados')],
    ['staff', t('Equipe')],
    ['plus', t('Shiori+ e apoiadores')],
  ] as const;

export function AdminUsers({ owner }: { owner: boolean }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const dq = useDebounced(q, 350);
  const list = useQuery({ queryKey: ['admin-users', dq, filter], queryFn: () => searchUsers(dq, filter) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 text-muted" size={16} />
        <input className="field !pl-9" placeholder={owner ? t('Apelido, nome, e-mail ou id') : t('Apelido, nome ou id')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS().map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <Spinner className="mx-auto mt-6 h-7 w-7 text-pink" />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState jp="無" title={t('Ninguém encontrado')} />
      ) : (
        <div className="space-y-2">
          {list.data.map((u) => (
            <UserRow key={u.user_id} u={u} owner={owner} open={open === u.user_id} onToggle={() => setOpen(open === u.user_id ? null : u.user_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'pink' | 'red' | 'yellow' | 'green' }) {
  const c = {
    muted: 'border-line text-muted',
    pink: 'border-pink text-pink',
    red: 'border-red-400 text-red-300',
    yellow: 'border-yellow text-yellow',
    green: 'border-[#4ade80] text-[#4ade80]',
  }[tone];
  return <span className={`rounded-full border-2 px-1.5 py-px text-[10px] font-black uppercase ${c}`}>{children}</span>;
}

function UserRow({ u, owner, open, onToggle }: { u: AdminUser; owner: boolean; open: boolean; onToggle: () => void }) {
  const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
  const plus = !!u.plus_until && new Date(u.plus_until) > new Date();
  const name = u.display_name || u.username || t('(sem perfil)');
  return (
    <div className={`panel overflow-hidden ${banned ? 'border-red-400/60' : ''}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left hover:bg-panel-2/50">
        <Avatar url={u.avatar_url} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-extrabold">{name}</span>
            {u.owner && <Tag tone="yellow">{t('Dono')}</Tag>}
            {u.is_mod && !u.owner && <Tag tone="pink">{t('Moderador')}</Tag>}
            {banned && <Tag tone="red">{t('Banido')}</Tag>}
            {u.muted_until && <Tag tone="red">{t('Silenciado')}</Tag>}
            {u.minor && <Tag>{t('Menor')}</Tag>}
            {plus && <Tag tone="pink">Shiori+</Tag>}
            {u.supporter && <Tag tone="green">{t('Apoiador')}</Tag>}
            {u.reports_against > 0 && <Tag tone="red">{t('{0} denúncias', u.reports_against)}</Tag>}
          </div>
          <div className="truncate text-xs font-bold text-muted">
            {u.username ? `@${u.username}` : '—'} · {t('entrou {0}', timeAgo(u.created_at))}
            {u.last_sign_in_at && ` · ${t('último acesso {0}', timeAgo(u.last_sign_in_at))}`}
            {u.email && ` · ${u.email}`}
          </div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <UserDetail u={u} owner={owner} banned={banned} plus={plus} />}
    </div>
  );
}

function UserDetail({ u, owner, banned, plus }: { u: AdminUser; owner: boolean; banned: boolean; plus: boolean }) {
  const act = useAct();
  const a = useQuery({ queryKey: ['admin-activity', u.user_id], queryFn: () => userActivity(u.user_id) });
  const [rename, setRename] = useState(u.username ?? '');
  const [reason, setReason] = useState('');
  const keys = [['admin-users'], ['admin-activity', u.user_id], ['admin-stats']];
  const staff = u.owner || (u.is_mod && !owner);
  const ban = (hours: number) => act(() => accountAction('ban', u.user_id, { hours, reason }), t('Conta banida'), keys);
  return (
    <div className="space-y-4 border-t-2 border-line p-4">
      {a.data && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
          <span>{t('{0} posts', a.data.posts)}</span>
          <span>{t('{0} comentários', a.data.comments)}</span>
          <span>{t('{0} mensagens', a.data.messages)}</span>
          <span>{t('{0} seguidores', a.data.followers)}</span>
          <span>{t('segue {0}', a.data.following)}</span>
          {u.username && u.is_public && (
            <Link to={`/u/${u.username}`} className="text-pink underline">
              {t('Ver perfil')}
            </Link>
          )}
        </div>
      )}

      {staff ? (
        <p className="text-sm font-bold text-muted">{u.owner ? t('Essa é a conta do dono.') : t('Só o dono pode agir sobre moderadores.')}</p>
      ) : (
        <>
          <input className="field text-sm" placeholder={t('Motivo (fica no registro)')} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          <Section title={t('Silenciar (chat, posts, comentários e party)')}>
            {[
              [1, t('1 hora')],
              [24, t('24 horas')],
              [168, t('7 dias')],
            ].map(([h, l]) => (
              <button key={h} className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => muteFor(u.user_id, h as number, reason), t('Silenciado'), keys)}>
                <VolumeX size={13} /> {l}
              </button>
            ))}
            {u.muted_until && (
              <button className="manga-btn !py-1 text-xs" onClick={() => act(() => muteFor(u.user_id, 0), t('Silêncio removido'), keys)}>
                {t('Tirar silêncio')}
              </button>
            )}
          </Section>
          <Section title={t('Banir (não consegue mais entrar)')}>
            {banned ? (
              <button className="manga-btn !py-1 text-xs" onClick={() => act(() => accountAction('unban', u.user_id), t('Banimento removido'), keys)}>
                {t('Desbanir')}
              </button>
            ) : (
              <>
                <button className="manga-btn ghost !py-1 text-xs" onClick={() => ban(24)}>
                  <Ban size={13} /> {t('24 horas')}
                </button>
                <button className="manga-btn ghost !py-1 text-xs" onClick={() => ban(24 * 7)}>
                  {t('7 dias')}
                </button>
                <button className="manga-btn ghost !py-1 text-xs" onClick={() => ban(24 * 30)}>
                  {t('30 dias')}
                </button>
                <ConfirmButton className="manga-btn !bg-red-500 !py-1 text-xs !text-white" onConfirm={() => ban(0)}>
                  {t('Permanente')}
                </ConfirmButton>
              </>
            )}
          </Section>
          <Section title={t('Limpar spam (apaga tudo que a pessoa mandou)')}>
            {[
              [1, t('última hora')],
              [24, t('últimas 24 h')],
              [24 * 30, t('últimos 30 dias')],
            ].map(([h, l]) => (
              <ConfirmButton
                key={h}
                className="manga-btn ghost !py-1 text-xs"
                onConfirm={() =>
                  act(async () => {
                    const r = await purgeContent(u.user_id, h as number);
                    useUI.getState().toast(t('Apagados: {0} mensagens, {1} comentários, {2} posts', r.messages, r.comments, r.posts));
                  }, t('Limpeza feita'), keys)
                }
              >
                <Trash2 size={13} /> {l}
              </ConfirmButton>
            ))}
          </Section>
          <Section title={t('Perfil')}>
            {[
              ['avatar', t('Tirar foto')],
              ['banner', t('Tirar banner')],
              ['bio', t('Apagar bio')],
              ['name', t('Apagar nome')],
              ['private', t('Tornar privado')],
            ].map(([f, l]) => (
              <button key={f} className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => resetProfile(u.user_id, [f]), t('Perfil ajustado'), keys)}>
                {l}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input className="field !w-40 !py-1 text-xs" value={rename} maxLength={20} onChange={(e) => setRename(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
              <button className="manga-btn ghost !py-1 text-xs" disabled={rename.length < 3 || rename === u.username} onClick={() => act(() => renameUser(u.user_id, rename), t('Apelido trocado'), keys)}>
                {t('Trocar apelido')}
              </button>
            </div>
          </Section>
        </>
      )}

      {owner && !u.owner && (
        <Section title={t('Só o dono')}>
          <button className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => setModerator(u.user_id, !u.is_mod), u.is_mod ? t('Não é mais moderador') : t('Agora é moderador'), keys)}>
            <UserPlus size={13} /> {u.is_mod ? t('Tirar de moderador') : t('Tornar moderador')}
          </button>
          <button className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => grantPlus(u.user_id, 30), t('+30 dias de Shiori+'), keys)}>
            <Sparkles size={13} /> {t('+30 dias de Shiori+')}
          </button>
          <button className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => grantPlus(u.user_id, 365), t('+1 ano de Shiori+'), keys)}>
            {t('+1 ano')}
          </button>
          {plus && (
            <button className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => grantPlus(u.user_id, 0), t('Shiori+ removido'), keys)}>
              {t('Tirar Shiori+')}
            </button>
          )}
          <button className="manga-btn ghost !py-1 text-xs" onClick={() => act(() => setSupporter(u.user_id, !u.supporter), u.supporter ? t('Selo removido') : t('Selo de Apoiador dado'), keys)}>
            <Heart size={13} /> {u.supporter ? t('Tirar selo de Apoiador') : t('Dar selo de Apoiador')}
          </button>
          <ConfirmButton
            className="manga-btn !bg-red-600 !py-1 text-xs !text-white"
            confirmText={t('Apaga tudo e não volta. Clique de novo')}
            onConfirm={() => act(() => accountAction('delete', u.user_id, { reason }), t('Conta apagada'), keys)}
          >
            <Trash2 size={13} /> {t('Apagar conta')}
          </ConfirmButton>
        </Section>
      )}

      {a.data && a.data.recent.length > 0 && (
        <Section title={t('Últimas publicações')}>
          <div className="w-full space-y-1.5">
            {a.data.recent.map((r) => (
              <ContentLine key={`${r.kind}-${r.id}`} kind={r.kind} id={r.id} body={r.body} hidden={r.hidden} at={r.at} place={r.room ?? null} invalidate={keys} />
            ))}
          </div>
        </Section>
      )}
      {a.data && a.data.reports.length > 0 && (
        <Section title={t('Denúncias recebidas')}>
          <div className="w-full space-y-1 text-xs">
            {a.data.reports.map((r) => (
              <div key={r.id} className="rounded bg-panel-2 p-2">
                <b>{r.reason}</b> · {r.status} · {timeAgo(r.at)} {r.details && <>— {r.details}</>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {a.data && a.data.log.length > 0 && (
        <Section title={t('Histórico de moderação')}>
          <div className="w-full space-y-1 text-xs text-muted">
            {a.data.log.map((l, i) => (
              <div key={i}>
                {timeAgo(l.at)} · <b className="text-ink">{l.action}</b> {l.details && JSON.stringify(l.details)}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted">{title}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ContentLine({ kind, id, body, hidden, at, place, user, invalidate }: { kind: ContentKind; id: number; body: string; hidden: boolean; at: string; place: string | null; user?: React.ReactNode; invalidate: string[][] }) {
  const act = useAct();
  return (
    <div className={`flex items-start gap-2 rounded-[var(--radius-sm)] bg-panel-2 p-2 text-sm ${hidden ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase text-muted">
          {KIND_LABEL[kind]()} {place && `· ${place}`} · {timeAgo(at)} {hidden && `· ${t('oculto')}`} {user}
        </div>
        <p className="whitespace-pre-line break-words">{body}</p>
      </div>
      <button className="manga-btn ghost !p-1.5" title={hidden ? t('Mostrar de novo') : t('Ocultar para todos')} onClick={() => act(() => moderateContent(kind, id, hidden ? 'show' : 'hide'), hidden ? t('Visível de novo') : t('Ocultado para todos'), invalidate)}>
        {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <ConfirmButton className="manga-btn ghost !p-1.5" confirmText="✓?" onConfirm={() => act(() => moderateContent(kind, id, 'delete'), t('Apagado'), invalidate)}>
        <Trash2 size={14} />
      </ConfirmButton>
    </div>
  );
}

/* ───────────────────────── Conteúdo ───────────────────────── */
export function AdminContent() {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [onlyHidden, setOnlyHidden] = useState(false);
  const dq = useDebounced(q, 350);
  const list = useQuery({ queryKey: ['admin-content', kind, dq, onlyHidden], queryFn: () => recentContent(kind, dq, onlyHidden ? true : null), refetchInterval: 30_000 });
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 text-muted" size={16} />
        <input className="field !pl-9" placeholder={t('Buscar texto ou apelido')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', t('Tudo')],
            ['post', t('Posts')],
            ['comment', t('Comentários')],
            ['message', t('Chat')],
          ] as const
        ).map(([id, l]) => (
          <button key={id} className={`chip ${kind === id ? 'on' : ''}`} onClick={() => setKind(id)}>
            {l}
          </button>
        ))}
        <button className={`chip ${onlyHidden ? 'on' : ''}`} onClick={() => setOnlyHidden((v) => !v)}>
          <EyeOff size={12} /> {t('Só ocultos')}
        </button>
      </div>
      {list.isLoading ? (
        <Spinner className="mx-auto mt-6 h-7 w-7 text-pink" />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState jp="静" title={t('Nada por aqui')} />
      ) : (
        <div className="space-y-1.5">
          {list.data.map((r) => (
            <ContentLine
              key={`${r.kind}-${r.id}`}
              kind={r.kind}
              id={r.id}
              body={r.body}
              hidden={r.hidden}
              at={r.created_at}
              place={r.place}
              user={r.username ? <span className="normal-case text-pink">@{r.username}</span> : null}
              invalidate={[['admin-content']]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Site (anúncio, pausa, palavras) ───────────────────────── */
export function AdminSite() {
  const act = useAct();
  const cfg = useConfig();
  const [text, setText] = useState('');
  const [kind, setKind] = useState('info');
  const [term, setTermText] = useState('');
  const terms = useQuery({ queryKey: ['banned-terms'], queryFn: bannedTerms });
  useEffect(() => {
    if (cfg.data) {
      setText(cfg.data.announcement);
      setKind(cfg.data.announcement_kind || 'info');
    }
  }, [cfg.data]);
  if (!cfg.data) return <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />;
  const paused = cfg.data.community_paused;
  const k = [['app-config'], ['admin-stats']];
  return (
    <div className="max-w-2xl space-y-5">
      <div className="panel space-y-3 p-5">
        <b className="flex items-center gap-2">
          <BellRing size={16} /> {t('Anúncio no topo do site')}
        </b>
        <textarea className="field min-h-20 text-sm" maxLength={300} placeholder={t('Ex.: Manutenção hoje às 23h. Pode ficar fora do ar por 10 minutos.')} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['info', t('Informação')],
              ['warn', t('Aviso')],
              ['alert', t('Alerta')],
            ] as const
          ).map(([id, l]) => (
            <button key={id} className={`chip ${kind === id ? 'on' : ''}`} onClick={() => setKind(id)}>
              {l}
            </button>
          ))}
          <button
            className="manga-btn ml-auto !py-1.5 text-sm"
            onClick={() =>
              act(async () => {
                await setSite('announcement_kind', kind);
                await setSite('announcement', text.trim());
              }, text.trim() ? t('Anúncio publicado') : t('Anúncio removido'), k)
            }
          >
            {text.trim() ? t('Publicar') : t('Remover anúncio')}
          </button>
        </div>
      </div>

      <div className={`panel space-y-3 p-5 ${paused ? 'border-yellow' : ''}`}>
        <b className="flex items-center gap-2">
          <PauseCircle size={16} /> {t('Pausar a comunidade')}
        </b>
        <p className="text-sm text-muted">
          {t('Para ataques de spam ou brigas: ninguém além da equipe consegue postar, comentar ou mandar mensagem enquanto estiver pausado. Listas, jogos e o resto do site continuam normais.')}
        </p>
        <button
          className={`manga-btn ${paused ? 'yellow' : '!bg-red-500 !text-white'}`}
          onClick={() => act(() => setSite('community_paused', paused ? 'false' : 'true'), paused ? t('Comunidade liberada') : t('Comunidade pausada'), k)}
        >
          {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />} {paused ? t('Liberar a comunidade') : t('Pausar agora')}
        </button>
      </div>

      <div className="panel space-y-3 p-5">
        <b className="flex items-center gap-2">
          <Ban size={16} /> {t('Palavras proibidas')}
        </b>
        <p className="text-sm text-muted">{t('Textos com essas palavras não são publicados (chat, posts, comentários e party). Já existe um filtro de ofensas embutido; aqui você soma as suas.')}</p>
        <div className="flex gap-2">
          <input className="field text-sm" value={term} maxLength={60} placeholder={t('palavra ou trecho (mín. 3 letras)')} onChange={(e) => setTermText(e.target.value)} />
          <button className="manga-btn shrink-0 !py-1.5 text-sm" disabled={term.trim().length < 3} onClick={() => act(() => setTerm(term, true), t('Palavra adicionada'), [['banned-terms']]).then(() => setTermText(''))}>
            {t('Adicionar')}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(terms.data ?? []).map((w) => (
            <button key={w} className="chip" title={t('Remover')} onClick={() => act(() => setTerm(w, false), t('Palavra removida'), [['banned-terms']])}>
              {w} ✕
            </button>
          ))}
          {terms.data?.length === 0 && <span className="text-xs text-muted">{t('Nenhuma ainda.')}</span>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Registro ───────────────────────── */
const ACTION_LABEL: Record<string, () => string> = {
  mute: () => t('silenciou'),
  unmute: () => t('tirou o silêncio de'),
  ban: () => t('baniu'),
  unban: () => t('desbaniu'),
  delete_account: () => t('apagou a conta de'),
  purge: () => t('limpou o conteúdo de'),
  reset_profile: () => t('ajustou o perfil de'),
  rename: () => t('trocou o apelido de'),
  add_mod: () => t('tornou moderador'),
  remove_mod: () => t('tirou de moderador'),
  plus: () => t('mexeu no Shiori+ de'),
  add_supporter: () => t('deu selo de apoiador a'),
  remove_supporter: () => t('tirou o selo de apoiador de'),
  hide_post: () => t('ocultou um post de'),
  show_post: () => t('mostrou de novo um post de'),
  delete_post: () => t('apagou um post de'),
  hide_comment: () => t('ocultou um comentário de'),
  show_comment: () => t('mostrou de novo um comentário de'),
  delete_comment: () => t('apagou um comentário de'),
  hide_message: () => t('ocultou uma mensagem de'),
  show_message: () => t('mostrou de novo uma mensagem de'),
  delete_message: () => t('apagou uma mensagem de'),
  add_term: () => t('proibiu a palavra'),
  remove_term: () => t('liberou a palavra'),
  site_announcement: () => t('mudou o anúncio:'),
  site_announcement_kind: () => t('mudou o tipo do anúncio:'),
  site_community_paused: () => t('mudou a pausa da comunidade:'),
};

export function AdminLog() {
  const log = useQuery({ queryKey: ['mod-log'], queryFn: () => modLog(150) });
  const ids = [...new Set((log.data ?? []).flatMap((l) => [l.actor, l.target_user]).filter(Boolean) as string[])];
  const names = useQuery({ queryKey: ['mod-log-names', ids.join(',')], queryFn: () => miniProfiles(ids), enabled: ids.length > 0 });
  const nm = (id: string | null) => (id ? (names.data?.[id] ? `@${names.data[id].username}` : id.slice(0, 8)) : '—');
  if (log.isLoading) return <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />;
  if (log.error) return <ErrorBox error={log.error} onRetry={() => log.refetch()} />;
  if (!log.data?.length) return <EmptyState jp="記録" title={t('Nenhuma ação registrada ainda')} />;
  return (
    <div className="panel divide-y-2 divide-line">
      {log.data.map((l) => (
        <div key={l.id} className="flex flex-wrap items-baseline gap-x-2 p-3 text-sm">
          <span className="text-xs font-bold text-muted">{timeAgo(l.created_at)}</span>
          <b className="text-pink">{nm(l.actor)}</b>
          <span>{ACTION_LABEL[l.action]?.() ?? l.action}</span>
          {l.target_user && <b>{nm(l.target_user)}</b>}
          {l.target && !l.target_user && <code className="rounded bg-panel-2 px-1">{l.target}</code>}
          {l.details && <span className="text-xs text-muted">{Object.entries(l.details).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>}
        </div>
      ))}
    </div>
  );
}

export function OwnerBadge() {
  return (
    <span className="badge-owner inline-flex items-center gap-1 rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase">
      <Crown size={12} /> {t('Painel do dono')}
    </span>
  );
}

/** Aba "Erros": o que quebrou no navegador das pessoas, agrupado por tipo. */
export function AdminErrors() {
  const toast = useUI((s) => s.toast);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['client-errors', done], queryFn: () => clientErrors(done) });
  const fix = async (id: number, all = false) => {
    try {
      await resolveError(id, all);
      toast(all ? t('Todos marcados como resolvidos') : t('Marcado como resolvido'));
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <div className="space-y-4">
      <StaffAlerts />
      <div className="flex flex-wrap items-center gap-2">
        <button className={`manga-btn !py-1 text-sm ${done ? 'ghost' : ''}`} onClick={() => setDone(false)}>
          {t('Abertos')}
        </button>
        <button className={`manga-btn !py-1 text-sm ${done ? '' : 'ghost'}`} onClick={() => setDone(true)}>
          {t('Resolvidos')}
        </button>
        {!done && !!q.data?.length && (
          <ConfirmButton className="manga-btn ghost ml-auto !py-1 text-sm" onConfirm={() => fix(0, true)}>
            {t('Resolver todos')}
          </ConfirmButton>
        )}
      </div>
      {q.isLoading ? (
        <Spinner className="mx-auto mt-10 h-8 w-8 text-pink" />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState jp="無事" title={done ? t('Nenhum erro resolvido ainda') : t('Nenhum erro aberto. Tudo certo!')} />
      ) : (
        <div className="panel divide-y-2 divide-line">
          {q.data.map((e) => (
            <div key={e.id} className="p-3 text-sm">
              <div className="flex items-start gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                  <div className="break-words font-bold">{e.message}</div>
                  <div className="mt-1 text-xs text-muted">
                    {t('{n}x', { n: e.count })} · {t('{n} pessoa(s)', { n: e.users })} · {timeAgo(e.last_at)} · {e.page ?? '—'} · {e.device ?? '—'}
                    {e.version ? ` · v${e.version}` : ''}
                  </div>
                </button>
                {!done && (
                  <button className="manga-btn ghost shrink-0 !px-2 !py-1 text-xs" onClick={() => fix(e.id)}>
                    {t('Resolvido')}
                  </button>
                )}
              </div>
              {open === e.id && e.stack && (
                <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-panel-2 p-2 text-[11px] leading-snug">{e.stack}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Liga os avisos de denúncia / bug / pagamento neste aparelho. */
export function StaffAlerts() {
  const toast = useUI((s) => s.toast);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    staffAlertsOn().then(setOn, () => setOn(false));
  }, []);
  if (!pushSupported()) return null;
  const flip = async () => {
    setBusy(true);
    try {
      await setStaffAlerts(!on);
      setOn(!on);
      toast(!on ? t('Avisos da equipe ligados neste aparelho') : t('Avisos da equipe desligados'));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-3">
      <BellRing size={20} className="text-pink" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <b>{t('Avisos no celular')}</b>
        <div className="text-xs text-muted">{t('Receba notificação quando chegar denúncia, bug ou pagamento.')}</div>
      </div>
      <button className={`manga-btn !py-1.5 text-sm ${on ? 'ghost' : ''}`} disabled={busy || on === null} onClick={flip}>
        {on ? t('Desligar') : t('Ligar neste aparelho')}
      </button>
    </div>
  );
}
