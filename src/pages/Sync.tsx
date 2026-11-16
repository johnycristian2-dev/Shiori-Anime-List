import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Cloud, Download, FileUp, Link2, LogOut, Mail, RefreshCw, Upload } from 'lucide-react';
import { CLOUD_ENABLED } from '../lib/supabase';
import { cloud, useCloudUser } from '../sync/cloud';
import { useSyncStatus } from '../store/sync';
import PublicProfileCard from '../components/PublicProfileCard';
import { gql } from '../api/anilist';
import { PAGE_QUERY, SAVE_ENTRY_MUTATION, USER_LIST_QUERY, VIEWER_QUERY } from '../api/queries';
import { ConfirmButton, SectionTitle, Spinner } from '../components/ui';
import { parseMalXml, readMalFile, toMalXml } from '../lib/mal';
import { chunk, downloadText, sleep } from '../lib/format';
import { mediaToEntry, useList } from '../store/list';
import { useUI } from '../store/ui';
import { authorizeUrl, CLIENT_ID, useAuth, validToken, type Viewer } from '../store/auth';
import type { ListEntry, ListStatus, Media, MediaPage } from '../types';

import { t, locale } from '../lib/i18n';
import { LANGS } from '../lib/i18n';

const AL_TO_LOCAL: Record<string, ListStatus> = {
  CURRENT: 'WATCHING',
  REPEATING: 'WATCHING',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  DROPPED: 'DROPPED',
};
const LOCAL_TO_AL: Record<ListStatus, string> = {
  WATCHING: 'CURRENT',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  DROPPED: 'DROPPED',
};

function Card({ jp, title, children }: { jp: string; title: string; children: ReactNode }) {
  return (
    <section className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-2 -top-3 font-jp text-6xl font-black text-pink/10">{jp}</div>
      <h3 className="relative mb-3 font-display text-lg">{title}</h3>
      <div className="relative space-y-3 text-sm text-muted">{children}</div>
    </section>
  );
}

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-black bg-panel-2">
        <div className="h-full bg-linear-to-r from-pink to-cyan transition-all" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function Sync() {
  const entries = useList((s) => s.entries);
  const importEntries = useList((s) => s.importEntries);
  const clearAll = useList((s) => s.clearAll);
  const clearSkipped = useList((s) => s.clearSkipped);
  const skippedCount = useList((s) => s.skipped.length);
  const toast = useUI((s) => s.toast);
  const ui = useUI();
  const { token, viewer, setViewer, logout, autoSync, setAutoSync } = useAuth();
  const cloudUser = useCloudUser((s) => s.user);
  const cloudStatus = useSyncStatus((s) => s.cloud);
  const alStatus = useSyncStatus((s) => s.anilist);
  const [email, setEmail] = useState('');
  const [mailSent, setMailSent] = useState(false);
  const getDoc = useList((s) => s.getDoc);
  const mergeDoc = useList((s) => s.mergeDoc);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState<string | null>(null);
  const [prog, setProg] = useState<{ v: number; max: number; label: string } | null>(null);
  const [alUser, setAlUser] = useState('');
  const cancel = useRef(false);
  const all = Object.values(entries);

  // Carrega o perfil quando volta do login do AniList
  useEffect(() => {
    const tok = validToken();
    if (tok && !viewer) {
      gql<{ Viewer: Viewer }>(VIEWER_QUERY, {}, { token: tok })
        .then((d) => {
          setViewer(d.Viewer);
          toast(t('Conectado como {0}', d.Viewer.name));
        })
        .catch(() => {
          logout();
          toast(t('Não deu pra conectar no AniList'), 'err');
        });
    }
  }, [token, viewer, setViewer, logout, toast]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    cancel.current = false;
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
      setProg(null);
    }
  };

  const exportMal = () => {
    const { xml, exported, skipped } = toMalXml(all);
    downloadText(`shiori-mal-${new Date().toISOString().slice(0, 10)}.xml`, xml, 'application/xml');
    toast(skipped.length ? t(
      '{0} exportados · {1} sem ID no MAL ficaram de fora',
      exported,
      skipped.length
    ) : t('{0} animes exportados!', exported));
  };

  const exportJson = () => {
    downloadText(
      `shiori-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ app: 'shiori', version: 2, exportedAt: new Date().toISOString(), ...getDoc() }, null, 2),
      'application/json',
    );
  };

  const importJson = (file: File) =>
    run('json', async () => {
      const data = JSON.parse(await file.text());
      const raw = Array.isArray(data) ? data : data.entries;
      const list: ListEntry[] = Array.isArray(raw) ? raw : Object.values(raw ?? {});
      if (!list.length || !list.every((e) => typeof e.mediaId === 'number')) throw new Error(t('Backup inválido.'));
      importEntries(list, mode);
      if (data.lists) mergeDoc({ entries: {}, deleted: {}, lists: data.lists, skipped: data.skipped ?? [] });
      toast(t('{0} animes restaurados', list.length));
    });

  const importMal = (file: File) =>
    run('mal', async () => {
      const rows = parseMalXml(await readMalFile(file));
      const byMal = new Map(rows.map((r) => [r.idMal, r]));
      const found: ListEntry[] = [];
      const parts = chunk([...byMal.keys()], 50);
      for (let i = 0; i < parts.length; i++) {
        if (cancel.current) break;
        setProg({ v: i, max: parts.length, label: t('Buscando dados no AniList…') });
        const page = (await gql<{ Page: MediaPage }>(PAGE_QUERY, { idMalIn: parts[i], perPage: 50, page: 1 })).Page;
        page.media.forEach((m) => {
          const r = m.idMal ? byMal.get(m.idMal) : undefined;
          if (r) found.push(mediaToEntry(m, r.status, { score: r.score, progress: r.progress }));
        });
        await sleep(700);
      }
      importEntries(found, mode);
      const missing = rows.length - found.length;
      toast(t(
        '{0} importados do MAL{1}',
        found.length,
        missing ? t(' · {0} não encontrados', missing) : ''
      ));
    });

  const importAniList = () =>
    run('al', async () => {
      const name = alUser.trim();
      if (!name) throw new Error(t('Digite o nome de usuário do AniList.'));
      type R = { MediaListCollection: { lists: { entries: { status: string; score: number; progress: number; media: Media }[] }[] } };
      const d = await gql<R>(USER_LIST_QUERY, { user: name });
      const list = d.MediaListCollection.lists.flatMap((l) => l.entries);
      const seen = new Set<number>();
      const out = list
        .filter((e) => !seen.has(e.media.id) && seen.add(e.media.id))
        .map((e) =>
          mediaToEntry(e.media, AL_TO_LOCAL[e.status] ?? 'PLANNING', { score: Math.round(e.score || 0), progress: e.progress || 0 }),
        );
      importEntries(out, mode);
      toast(t('{0} animes importados de {1}', out.length, name));
    });

  const pushAniList = () =>
    run('push', async () => {
      const tok = validToken();
      if (!tok) throw new Error(t('Conecte sua conta do AniList primeiro.'));
      for (let i = 0; i < all.length; i++) {
        if (cancel.current) break;
        const e = all[i];
        setProg({ v: i, max: all.length, label: t('Enviando para o AniList…') });
        await gql(
          SAVE_ENTRY_MUTATION,
          { mediaId: e.mediaId, status: LOCAL_TO_AL[e.status], scoreRaw: e.score * 10, progress: e.progress },
          { token: tok },
        );
        await sleep(800);
      }
      toast(cancel.current ? t('Envio interrompido') : t('{0} animes sincronizados com o AniList!', all.length));
    });

  const fileBtn = (key: string, accept: string, onFile: (f: File) => void, label: string) => (
    <label className={`manga-btn ghost cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
      {busy === key ? <Spinner className="h-4 w-4" /> : <FileUp size={16} />} {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </label>
  );

  return (
    <>
      <SectionTitle title={t('Sincronizar')} jp="同期" />

      <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4 text-sm font-bold">
        {t('Ao importar:')}
        <button className={`chip ${mode === 'merge' ? 'on' : ''}`} onClick={() => setMode('merge')}>
          {t('Mesclar com a lista atual')}
        </button>
        <button className={`chip ${mode === 'replace' ? 'on' : ''}`} onClick={() => setMode('replace')}>
          {t('Substituir tudo')}
        </button>
      </div>

      {prog && (
        <div className="panel mb-6 space-y-3 p-4">
          <Progress value={prog.v} max={prog.max} label={prog.label} />
          <button className="manga-btn ghost !py-1.5" onClick={() => (cancel.current = true)}>
            {t('Cancelar')}
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card jp="雲" title={t('Conta Shiori (nuvem)')}>
          {!CLOUD_ENABLED ? (
            <p>
              {t(
                'Pra salvar sua lista na nuvem e usar em vários aparelhos, crie um projeto grátis no'
              )}{' '}<b>{t('Supabase')}</b>{' '}{t('e coloque as chaves em')}{' '}
              <code>{t('VITE_SUPABASE_URL')}</code>{' '}{t('e')}{' '}<code>{t('VITE_SUPABASE_ANON_KEY')}</code>{' '}{t('(passo a passo no README).')}
            </p>
          ) : cloudUser && !cloudUser.is_anonymous ? (
            <>
              <div className="flex items-center gap-2 text-ink">
                <Cloud size={18} className="text-cyan" />
                <b className="truncate">{cloudUser.email}</b>
              </div>
              <p>
                {cloudStatus.state === 'syncing'
                  ? t('Sincronizando…')
                  : cloudStatus.state === 'error'
                    ? t('Erro: {0}', cloudStatus.msg)
                    : t(
                  'Lista salva na nuvem{0}. Entre com a mesma conta em outro aparelho.',
                  cloudStatus.at ? ` · ${new Date(cloudStatus.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` : ''
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="manga-btn cyan" onClick={() => run('cloud', cloud.syncNow)} disabled={!!busy}>
                  {busy === 'cloud' ? <Spinner className="h-4 w-4" /> : <RefreshCw size={16} />}{' '}{t('Sincronizar agora')}
                </button>
                <button className="manga-btn ghost" onClick={() => run('cloud-out', cloud.signOut)}>
                  <LogOut size={16} />{' '}{t('Sair')}
                </button>
              </div>
            </>
          ) : mailSent ? (
            <p className="text-ink">
              {t('📬 Enviamos um link pra')}{' '}<b>{email}</b>{t('. Abra no aparelho que quiser conectar.')}{' '}
              <button className="font-bold text-pink" onClick={() => setMailSent(false)}>
                {t('Trocar e-mail')}
              </button>
            </p>
          ) : (
            <>
              <p>{t(
                'Entre pra salvar sua lista na nuvem e sincronizar entre celular e PC — sem senha, por link no e-mail.'
              )}</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run('mail', async () => {
                    await cloud.signInEmail(email.trim());
                    setMailSent(true);
                  });
                }}
              >
                <input className="field" type="email" required placeholder={t('seu@email.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="manga-btn shrink-0" disabled={!!busy}>
                  {busy === 'mail' ? <Spinner className="h-4 w-4" /> : <Mail size={16} />}{' '}{t('Entrar')}
                </button>
              </form>
              <button className="manga-btn ghost w-full" onClick={() => run('google', cloud.signInGoogle)}>
                {t('Entrar com Google')}
              </button>
            </>
          )}
        </Card>

        {CLOUD_ENABLED && (
          <Card jp="公開" title={t('Perfil público')}>
            <PublicProfileCard />
          </Card>
        )}

        <Card jp="輸出" title={t('Exportar pro MyAnimeList')}>
          <p>
            {t('Gera um arquivo')}{' '}<b>{t('.xml')}</b>{' '}{t('no formato do MAL. Lá no site:')}{' '}<b>{t('Perfil → Import')}</b>{' '}{t('→ escolha')}{' '}<i>{t('MyAnimeList Import')}</i>{' '}{t('e envie o arquivo.')}
          </p>
          <button className="manga-btn" disabled={!all.length} onClick={exportMal}>
            <Download size={16} />{' '}{t('Baixar XML (')}{all.length})
          </button>
        </Card>

        <Card jp="輸入" title={t('Importar do MyAnimeList')}>
          <p>
            {t('No MAL:')}{' '}<b>{t('Perfil → Export')}</b>{' '}{t('→ baixe o arquivo (.xml.gz). Envie aqui mesmo compactado.')}
          </p>
          {fileBtn('mal', '.xml,.gz,application/xml,application/gzip', importMal, t('Escolher arquivo do MAL'))}
        </Card>

        <Card jp="取込" title={t('Importar do AniList')}>
          <p>{t('Puxa a lista pública de qualquer usuário do AniList (não precisa login).')}</p>
          <div className="flex gap-2">
            <input className="field" placeholder={t('nome de usuário')} value={alUser} onChange={(e) => setAlUser(e.target.value)} />
            <button className="manga-btn cyan shrink-0" disabled={!!busy} onClick={importAniList}>
              {busy === 'al' ? <Spinner className="h-4 w-4" /> : <Upload size={16} />}{' '}{t('Importar')}
            </button>
          </div>
        </Card>

        <Card jp="連携" title={t('Conectar com AniList')}>
          {!CLIENT_ID ? (
            <p>
              {t('Pra sincronizar direto, crie um app em')}{' '}<b>{t('anilist.co/settings/developer')}</b>{' '}{t('e coloque o ID em')}{' '}<code>{t('VITE_ANILIST_CLIENT_ID')}</code>{' '}{t('(veja o README).')}
            </p>
          ) : viewer ? (
            <>
              <div className="flex items-center gap-3 text-ink">
                {viewer.avatar?.medium && <img src={viewer.avatar.medium} alt="" className="h-10 w-10 rounded-full border-2 border-black" />}
                <b>{viewer.name}</b>
                <button className="ml-auto text-muted hover:text-pink" onClick={logout} aria-label={t('Sair')}>
                  <LogOut size={16} />
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-panel-2 p-3 text-ink">
                <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} className="h-5 w-5 accent-[var(--pink)]" />
                <span>
                  <b>{t('Sincronizar automaticamente')}</b>
                  <span className="block text-xs text-muted">
                    {autoSync ? alStatus.msg ?? t('Cada mudança vai pro AniList sozinha') : t('Desligado: use o botão abaixo')}
                  </span>
                </span>
              </label>
              <p>{t('Ou envie tudo de uma vez (status, nota e episódios):')}</p>
              <button className="manga-btn cyan" disabled={!all.length || !!busy} onClick={pushAniList}>
                {busy === 'push' ? <Spinner className="h-4 w-4" /> : <Upload size={16} />}{' '}{t('Enviar')}{' '}{all.length}{' '}{t('animes')}
              </button>
            </>
          ) : (
            <>
              <p>{t('Faça login no AniList pra enviar sua lista direto, sem arquivo.')}</p>
              <a className="manga-btn cyan" href={authorizeUrl()}>
                <Link2 size={16} />{' '}{t('Conectar conta')}
              </a>
            </>
          )}
        </Card>

        <Card jp="保存" title={t('Backup')}>
          <p>{t(
            'Sua lista fica salva neste navegador. Faça backup pra levar pra outro aparelho.'
          )}</p>
          <div className="flex flex-wrap gap-2">
            <button className="manga-btn yellow" disabled={!all.length} onClick={exportJson}>
              <Download size={16} />{' '}{t('Baixar backup')}
            </button>
            {fileBtn('json', '.json,application/json', importJson, 'Restaurar')}
          </div>
        </Card>

        <Card jp="設定" title={t('Preferências')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-bold text-ink">{t('Tema')}</span>
            <button className={`chip ${ui.theme === 'noite' ? 'on' : ''}`} onClick={() => ui.setTheme('noite')}>
              {t('Noite 夜')}
            </button>
            <button className={`chip ${ui.theme === 'sakura' ? 'on' : ''}`} onClick={() => ui.setTheme('sakura')}>
              {t('Sakura 桜')}
            </button>
            <Link to="/temas" className="chip !border-cyan !text-cyan">
              {t('Mais temas →')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-bold text-ink">{t('Títulos')}</span>
            <button className={`chip ${ui.titleLang === 'romaji' ? 'on' : ''}`} onClick={() => ui.setTitleLang('romaji')}>
              {t('Romaji')}
            </button>
            <button className={`chip ${ui.titleLang === 'english' ? 'on' : ''}`} onClick={() => ui.setTitleLang('english')}>
              {t('Inglês')}
            </button>
            <button className={`chip ${ui.titleLang === 'native' ? 'on' : ''}`} onClick={() => ui.setTitleLang('native')}>
              日本語
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-bold text-ink">{t('Idioma')}</span>
            {LANGS.map((l) => (
              <button key={l.id} className={`chip ${ui.lang === l.id ? 'on' : ''}`} onClick={() => ui.setLang(l.id)}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-bold text-ink">{t('Pétalas')}</span>
            <button className={`chip ${ui.petals ? 'on' : ''}`} onClick={() => ui.setPetals(!ui.petals)}>
              {ui.petals ? t('Ligadas 🌸') : t('Desligadas')}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-bold text-ink">{t('Avisos')}</span>
            <button
              className={`chip ${ui.notify ? 'on' : ''}`}
              onClick={async () => {
                if (ui.notify) return ui.setNotify(false);
                if (typeof Notification === 'undefined') return toast(t('Seu navegador não suporta notificações'), 'err');
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                  ui.setNotify(true);
                  toast(t('Você será avisado de episódios novos 🔔'));
                } else toast(t('Permissão de notificação negada'), 'err');
              }}
            >
              <Bell size={14} /> {ui.notify ? t('Notificações ligadas') : t('Ativar notificações')}
            </button>
          </div>
          <p className="text-xs">
            {t(
              'O sino 🔔 no topo mostra episódios novos sempre. As notificações do navegador funcionam enquanto o Shiori estiver aberto (mesmo em outra aba ou minimizado). Aviso com o app fechado precisa de servidor — está no roadmap.'
            )}
          </p>
          <div className="flex flex-wrap gap-2 border-t-2 border-line pt-3">
            <button className="manga-btn ghost !py-1.5" disabled={!skippedCount} onClick={() => { clearSkipped(); toast(t('Pulados liberados no modo rápido'), 'info'); }}>
              {t('Resetar pulados (')}{skippedCount})
            </button>
            <ConfirmButton className="manga-btn ghost !py-1.5 !text-red-400" onConfirm={() => { clearAll(); toast(t('Lista apagada'), 'info'); }}>
              {t('Apagar lista')}
            </ConfirmButton>
          </div>
        </Card>
      </div>
    </>
  );
}
