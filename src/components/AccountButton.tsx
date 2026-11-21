import { useCallback, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bug, Check, ChevronDown, Cloud, ExternalLink, LogIn, LogOut, Palette, Pencil, ShieldAlert, Sparkles, UserRound, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { amIAdmin, useSocial } from '../sync/social';
import { LANGS, t } from '../lib/i18n';
import { useUI } from '../store/ui';
import { openAuth, useAccount } from '../sync/account';
import { cloud, useCloudUser } from '../sync/cloud';
import Avatar from './Avatar';
import { Spinner, useOutsideClose } from './ui';

/** Canto superior direito: "Entrar" ou a foto da conta com o menu. */
export default function AccountButton() {
  const user = useCloudUser((s) => s.user);
  const profile = useAccount((s) => s.profile);
  const loading = useAccount((s) => s.loading);
  const lang = useUI((s) => s.lang);
  const setLang = useUI((s) => s.setLang);
  const nickname = useUI((s) => s.nickname);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(box, open, close);

  const logged = !!user && !user.is_anonymous;
  const unread = useSocial((s) => s.unread);
  const requests = useSocial((s) => s.requests);
  const badge = unread + requests;
  const admin = useQuery({ queryKey: ['is-admin', user?.id], queryFn: amIAdmin, enabled: logged, staleTime: Infinity });
  const name = profile?.display_name || profile?.username || nickname || user?.email?.split('@')[0] || '';

  if (!logged)
    return (
      <div className="relative flex items-center gap-1.5" ref={box}>
        <button className="manga-btn !px-3 !py-2 text-sm" onClick={() => openAuth('signin')} aria-label={t('Entrar')}>
          <LogIn size={16} /> <span className="hidden sm:inline">{t('Entrar')}</span>
        </button>
        <MiniMenu open={open} setOpen={setOpen} lang={lang} setLang={setLang} />
      </div>
    );

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border-2 border-transparent p-0.5 pr-1.5 transition hover:border-line"
        aria-label={t('Minha conta')}
        aria-expanded={open}
      >
        <span className="relative">
          {loading && !profile ? <Spinner className="h-9 w-9 p-2" /> : <Avatar url={profile?.avatar_url} name={name} size={36} />}
          {badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-black bg-pink px-1 text-[10px] font-black text-[var(--on-pink)]">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`hidden text-muted transition sm:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pop-in panel absolute right-0 top-12 z-50 w-72 overflow-hidden !p-0 shadow-[6px_6px_0_var(--shadow)]">
          <div className="relative h-20 bg-panel-2">
            {profile?.banner_url && <img loading="lazy" decoding="async" src={profile.banner_url} alt="" className="h-full w-full object-cover opacity-80" />}
            <div className="absolute inset-0 bg-linear-to-t from-panel to-transparent" />
          </div>
          <div className="relative z-10 -mt-7 flex items-end gap-3 px-4">
            <Avatar url={profile?.avatar_url} name={name} size={56} className="shadow-[3px_3px_0_#000]" />
            <div className="min-w-0 rounded-md bg-panel/85 px-1.5 py-0.5 backdrop-blur-sm">
              <div className="truncate font-display text-base leading-tight">{name}</div>
              {profile && <div className="truncate text-xs font-bold text-muted">@{profile.username}</div>}
            </div>
          </div>
          <div className="space-y-0.5 p-1.5 pt-3">
            <Item to="/perfil" icon={UserRound} label={t('Meu perfil')} onClick={close} />
            <Item to="/amigos" icon={Users} label={t('Amigos e feed')} onClick={close} badge={badge} />
            <Item to="/perfil/editar" icon={Pencil} label={t('Editar perfil')} onClick={close} />
            {profile?.is_public && <Item to={`/u/${profile.username}`} icon={ExternalLink} label={t('Ver como os outros veem')} onClick={close} />}
            <Item to="/sync" icon={Cloud} label={t('Sincronização e backup')} onClick={close} />
            <Item to="/temas" icon={Palette} label={t('Temas')} onClick={close} />
            <Item to="/apoiar" icon={Sparkles} label={t('Apoiar / Shiori+')} onClick={close} />
            <Item to="/feedback" icon={Bug} label={t('Reportar bug ou ideia')} onClick={close} />
            {admin.data && <Item to="/moderacao" icon={ShieldAlert} label={t('Moderação')} onClick={close} />}
            <LangRow lang={lang} setLang={setLang} />
            <button
              onClick={async () => {
                close();
                await cloud.signOut();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-red-300 hover:bg-panel-2"
            >
              <LogOut size={16} /> {t('Sair')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ to, icon: Icon, label, onClick, badge }: { to: string; icon: typeof UserRound; label: string; onClick: () => void; badge?: number }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-panel-2 ${isActive ? 'text-pink' : ''}`}
    >
      <Icon size={16} /> <span className="flex-1">{label}</span>
      {!!badge && <span className="rounded-full bg-pink px-1.5 text-[10px] font-black text-[var(--on-pink)]">{badge}</span>}
    </NavLink>
  );
}

function LangRow({ lang, setLang }: { lang: string; setLang: (l: 'pt' | 'en' | 'ja') => void }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          title={l.label}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold ${l.id === lang ? 'bg-panel-2 text-pink' : 'text-muted hover:bg-panel-2'}`}
        >
          {l.short} {l.id === lang && <Check size={12} />}
        </button>
      ))}
    </div>
  );
}

/** Sem conta, no celular: idioma e temas num menu pequeno (o topo não comporta tudo). */
function MiniMenu({ open, setOpen, lang, setLang }: { open: boolean; setOpen: (f: (v: boolean) => boolean) => void; lang: string; setLang: (l: 'pt' | 'en' | 'ja') => void }) {
  return (
    <>
      <button className="manga-btn ghost !p-2 sm:hidden" onClick={() => setOpen((v) => !v)} aria-label={t('Mais opções')}>
        <ChevronDown size={16} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && (
        <div className="pop-in panel absolute right-0 top-12 z-50 w-56 p-1.5 shadow-[6px_6px_0_var(--shadow)] sm:hidden">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-panel-2" onClick={() => openAuth('signup')}>
            <UserRound size={16} /> {t('Criar conta')}
          </button>
          <Link to="/temas" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-panel-2" onClick={() => setOpen(() => false)}>
            <Palette size={16} /> {t('Temas')}
          </Link>
          <LangRow lang={lang} setLang={setLang} />
        </div>
      )}
    </>
  );
}
