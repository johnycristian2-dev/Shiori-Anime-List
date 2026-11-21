import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedBanner, BannerName } from '../components/Badges';
import { BANNERS, isPlus, setBanner, usePerks, type Banner } from '../sync/perks';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Check, Film, ImagePlus, KeyRound, Lock, Search, ShieldCheck, Trash2, Upload, UserRound, X } from 'lucide-react';
import { gql } from '../api/anilist';
import Avatar from '../components/Avatar';
import { ConfirmButton, EmptyState, SectionTitle, Spinner, useDebounced } from '../components/ui';
import { pickTitle } from '../lib/format';
import { t } from '../lib/i18n';
import { useList } from '../store/list';
import { useUI } from '../store/ui';
import {
  ageFrom,
  deleteMyAccount,
  MIN_AGE,
  openAuth,
  setBirthdate,
  setNewPassword,
  updateMyProfile,
  uploadProfileImage,
  useAccount,
  usernameAvailable,
} from '../sync/account';
import { useCloudUser } from '../sync/cloud';
import { listBlocked, unblock } from '../sync/social';
import { USERNAME_RE } from '../sync/profile';
import type { ListEntry } from '../types';

interface Char {
  id: number;
  name: { full: string };
  image: { large: string | null };
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-bold text-muted">{hint}</span>}
    </label>
  );
}

/** Escolher foto: enviar arquivo ou pegar um personagem do AniList */
function AvatarPicker({ favorites, onPick, onClose }: { favorites: ListEntry[]; onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState<number | null>(favorites[0]?.mediaId ?? null);
  const dq = useDebounced(q.trim(), 400);
  const chars = useQuery({
    queryKey: ['avatar-chars', dq, from],
    queryFn: async () => {
      if (dq) {
        const r = await gql<{ Page: { characters: Char[] } }>(
          'query($s:String){Page(perPage:24){characters(search:$s,sort:FAVOURITES_DESC){id name{full} image{large}}}}',
          { s: dq },
        );
        return r.Page.characters;
      }
      if (from) {
        const r = await gql<{ Media: { characters: { nodes: Char[] } } }>(
          'query($id:Int){Media(id:$id){characters(perPage:24,sort:[ROLE,FAVOURITES_DESC]){nodes{id name{full} image{large}}}}}',
          { id: from },
        );
        return r.Media.characters.nodes;
      }
      const r = await gql<{ Page: { characters: Char[] } }>('query{Page(perPage:24){characters(sort:FAVOURITES_DESC){id name{full} image{large}}}}');
      return r.Page.characters;
    },
  });
  return (
    <div className="panel pop-in mt-3 space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <b className="text-sm">{t('Escolha um personagem')}</b>
        <button className="manga-btn ghost !p-1.5" onClick={onClose} aria-label={t('Fechar')}>
          <X size={14} />
        </button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="field pl-9" placeholder={t('Buscar personagem (ex.: Frieren, Gojo)')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!dq && favorites.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {favorites.slice(0, 12).map((e) => (
            <button key={e.mediaId} className={`chip shrink-0 !text-xs ${from === e.mediaId ? 'on' : ''}`} onClick={() => setFrom(e.mediaId)}>
              {e.title.length > 22 ? `${e.title.slice(0, 22)}…` : e.title}
            </button>
          ))}
        </div>
      )}
      {chars.isLoading ? (
        <div className="grid h-32 place-items-center">
          <Spinner className="h-6 w-6 text-pink" />
        </div>
      ) : (
        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
          {(chars.data ?? [])
            .filter((c) => c.image.large && !c.image.large.includes('/default'))
            .map((c) => (
              <button key={c.id} className="group text-left" onClick={() => onPick(c.image.large!)} title={c.name.full}>
                <img src={c.image.large!} alt="" loading="lazy" className="aspect-square w-full rounded-[var(--radius-sm)] border-2 border-black object-cover object-top transition group-hover:-translate-y-0.5 group-hover:border-pink" />
                <span className="mt-0.5 block truncate text-[10px] font-bold text-muted">{c.name.full}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Escolher banner: imagem de um anime da sua lista */
function BannerPicker({ entries, onPick, onClose }: { entries: ListEntry[]; onPick: (url: string) => void; onClose: () => void }) {
  const ids = entries.slice(0, 50).map((e) => e.mediaId);
  const q = useQuery({
    queryKey: ['banner-pick', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const r = await gql<{ Page: { media: { id: number; bannerImage: string | null; title: { romaji: string } }[] } }>(
        'query($ids:[Int]){Page(perPage:50){media(id_in:$ids){id bannerImage title{romaji}}}}',
        { ids },
      );
      return r.Page.media.filter((m) => m.bannerImage);
    },
  });
  return (
    <div className="panel pop-in mt-3 space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <b className="text-sm">{t('Banners dos animes da sua lista')}</b>
        <button className="manga-btn ghost !p-1.5" onClick={onClose} aria-label={t('Fechar')}>
          <X size={14} />
        </button>
      </div>
      {!ids.length ? (
        <p className="text-sm text-muted">{t('Adicione animes à sua lista pra usar os banners deles.')}</p>
      ) : q.isLoading ? (
        <div className="grid h-24 place-items-center">
          <Spinner className="h-6 w-6 text-pink" />
        </div>
      ) : (
        <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
          {(q.data ?? []).map((m) => (
            <button key={m.id} className="group relative overflow-hidden rounded-[var(--radius-sm)] border-2 border-black" onClick={() => onPick(m.bannerImage!)}>
              <img src={m.bannerImage!} alt="" loading="lazy" className="aspect-[3/1] w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[11px] font-bold text-white">{m.title.romaji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileEdit() {
  const user = useCloudUser((s) => s.user);
  const ready = useCloudUser((s) => s.ready);
  const profile = useAccount((s) => s.profile);
  const loading = useAccount((s) => s.loading);
  const entries = useList((s) => s.entries);
  const titleLang = useUI((s) => s.titleLang);
  const toast = useUI((s) => s.toast);
  const nav = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [favId, setFavId] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState('');
  const [picker, setPicker] = useState<null | 'avatar' | 'banner'>(null);
  const [newPw, setNewPw] = useState('');
  const [birth, setBirth] = useState('');
  const avatarFile = useRef<HTMLInputElement>(null);
  const bannerFile = useRef<HTMLInputElement>(null);
  const dUser = useDebounced(username.trim().toLowerCase(), 450);
  const [avail, setAvail] = useState<null | boolean>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setUsername(profile.username);
    setBio(profile.bio ?? '');
    setFavId(profile.favorite_id ?? null);
    setIsPublic(profile.is_public);
  }, [profile]);

  useEffect(() => {
    if (!profile || dUser === profile.username || !USERNAME_RE.test(dUser)) return setAvail(null);
    let alive = true;
    usernameAvailable(dUser).then((ok) => alive && setAvail(ok));
    return () => {
      alive = false;
    };
  }, [dUser, profile]);

  const all = useMemo(() => Object.values(entries), [entries]);
  const sorted = useMemo(
    () => [...all].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || b.score - a.score || b.updatedAt - a.updatedAt),
    [all],
  );
  const favorites = useMemo(() => sorted.filter((e) => e.favorite || e.score >= 8), [sorted]);

  if (!ready || (loading && !profile))
    return (
      <div className="grid h-[50vh] place-items-center">
        <Spinner className="h-10 w-10 text-pink" />
      </div>
    );
  if (!user || user.is_anonymous)
    return (
      <EmptyState jp="ログイン" title={t('Entre para editar seu perfil')}>
        <button className="manga-btn mt-4" onClick={() => openAuth('signin')}>
          {t('Entrar ou criar conta')}
        </button>
      </EmptyState>
    );
  if (!profile)
    return (
      <EmptyState jp="準備中" title={t('Preparando seu perfil…')}>
        <p className="text-sm text-muted">{t('Se demorar, recarregue a página.')}</p>
      </EmptyState>
    );

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy('');
    }
  };

  const setImage = (kind: 'avatar' | 'banner', url: string | null) =>
    run(kind, () => updateMyProfile(kind === 'avatar' ? { avatar_url: url } : { banner_url: url }), url ? t('Imagem atualizada!') : t('Imagem removida'));

  const upload = (kind: 'avatar' | 'banner') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    run(kind, async () => {
      const url = await uploadProfileImage(kind, f);
      await updateMyProfile(kind === 'avatar' ? { avatar_url: url } : { banner_url: url });
    }, t('Imagem atualizada!'));
  };

  const userOk = USERNAME_RE.test(username.trim().toLowerCase());
  const dirty =
    displayName !== (profile.display_name ?? '') ||
    username !== profile.username ||
    bio !== (profile.bio ?? '') ||
    favId !== (profile.favorite_id ?? null) ||
    isPublic !== profile.is_public;
  const birthdate: string | undefined = user.user_metadata?.birthdate;
  const isGoogle = user.app_metadata?.provider === 'google';
  const shownName = displayName || username;

  return (
    <>
      <SectionTitle title={t('Editar perfil')} jp="編集" action={<Link to="/perfil">{t('Ver meu perfil →')}</Link>} />

      {!birthdate && (
        <div className="panel mb-6 flex flex-wrap items-end gap-3 border-yellow! p-4">
          <ShieldCheck className="text-yellow" />
          <div className="min-w-56 flex-1">
            <b>{t('Falta sua data de nascimento')}</b>
            <p className="text-sm text-muted">{t('Não aparece no perfil. Usamos só pra proteger quem é menor de idade.')}</p>
          </div>
          <input className="field w-auto!" type="date" max={new Date().toISOString().slice(0, 10)} value={birth} onChange={(e) => setBirth(e.target.value)} />
          <button className="manga-btn" disabled={!birth || !!busy} onClick={() => run('birth', () => setBirthdate(birth), t('Salvo!'))}>
            {t('Salvar')}
          </button>
          {birth && !(ageFrom(birth) >= MIN_AGE) && <p className="w-full text-sm font-bold text-red-400">{t('Você precisa ter pelo menos {0} anos para criar uma conta.', MIN_AGE)}</p>}
        </div>
      )}

      {/* Banner + foto */}
      <section className="mb-6 overflow-hidden rounded-[calc(var(--radius)*1.3)] border-[3px] border-black bg-panel shadow-[6px_6px_0_var(--pink)]">
        <div className="halftone relative h-40 bg-panel-2 sm:h-56">
          {profile.banner_url ? <img loading="lazy" decoding="async" src={profile.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="speedlines absolute inset-0 opacity-60" />}
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
            <button className="manga-btn !py-1.5 text-sm" onClick={() => bannerFile.current?.click()} disabled={!!busy}>
              {busy === 'banner' ? <Spinner className="h-4 w-4" /> : <Upload size={14} />} {t('Enviar banner')}
            </button>
            <button className="manga-btn ghost !bg-panel/80 !py-1.5 text-sm" onClick={() => setPicker(picker === 'banner' ? null : 'banner')}>
              <Film size={14} /> {t('De um anime')}
            </button>
            {profile.banner_url && (
              <button className="manga-btn ghost !bg-panel/80 !p-1.5" onClick={() => setImage('banner', null)} aria-label={t('Remover banner')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <input ref={bannerFile} type="file" accept="image/*" hidden onChange={upload('banner')} />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
          <div className="relative -mt-12">
            <Avatar url={profile.avatar_url} name={shownName} size={104} className="!border-[3px] shadow-[4px_4px_0_#000]" />
            {busy === 'avatar' && (
              <div className="absolute inset-0 grid place-items-center rounded-[var(--radius-sm)] bg-black/50">
                <Spinner className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            <button className="manga-btn !py-1.5 text-sm" onClick={() => avatarFile.current?.click()} disabled={!!busy}>
              <Camera size={14} /> {t('Enviar foto')}
            </button>
            <button className="manga-btn ghost !py-1.5 text-sm" onClick={() => setPicker(picker === 'avatar' ? null : 'avatar')}>
              <UserRound size={14} /> {t('Usar um personagem')}
            </button>
            {profile.avatar_url && (
              <button className="manga-btn ghost !p-1.5" onClick={() => setImage('avatar', null)} aria-label={t('Remover foto')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <input ref={avatarFile} type="file" accept="image/*" hidden onChange={upload('avatar')} />
          <p className="w-full text-[11px] font-bold text-muted">{t('Imagens enviadas são reduzidas e convertidas no seu aparelho (sem dados de localização). Não envie fotos de outras pessoas sem permissão.')}</p>
        </div>
      </section>
      <PlusBanner userId={user?.id} />
      {picker === 'avatar' && (
        <AvatarPicker
          favorites={favorites.length ? favorites : sorted}
          onClose={() => setPicker(null)}
          onPick={(url) => {
            setPicker(null);
            setImage('avatar', url);
          }}
        />
      )}
      {picker === 'banner' && (
        <BannerPicker
          entries={sorted}
          onClose={() => setPicker(null)}
          onPick={(url) => {
            setPicker(null);
            setImage('banner', url);
          }}
        />
      )}

      {/* Dados */}
      <form
        className="panel mt-6 grid gap-4 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            'save',
            () => updateMyProfile({ display_name: displayName, username, bio, favorite_id: favId, is_public: isPublic }),
            t('Perfil salvo!'),
          );
        }}
      >
        <Field label={t('Nome de exibição')}>
          <input className="field" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username} />
        </Field>
        <Field
          label={t('Apelido')}
          hint={
            !userOk ? (
              <span className="text-red-400">{t('3 a 20: letras, números ou _')}</span>
            ) : avail === false ? (
              <span className="text-red-400">{t('Já está em uso')}</span>
            ) : avail ? (
              <span className="text-[#7cff8a]">{t('✓ Disponível')}</span>
            ) : (
              t('Seu link: /u/{0}', username || '…')
            )
          }
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">@</span>
            <input className="field pl-7" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label={t('Bio')} hint={`${bio.length}/300`}>
            <textarea className="field min-h-24 resize-y" maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('Conte o que você curte assistir…')} />
          </Field>
        </div>
        <Field label={t('Anime favorito (em destaque)')}>
          <select className="field" value={favId ?? ''} onChange={(e) => setFavId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('Automático (o favorito com maior nota)')}</option>
            {sorted.map((e) => (
              <option key={e.mediaId} value={e.mediaId}>
                {e.favorite ? '♥ ' : ''}
                {pickTitle({ romaji: e.title, english: e.titleEnglish, native: e.titleNative }, titleLang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('Quem pode ver')}>
          <div className="flex gap-2">
            <button
              type="button"
              className={`chip ${isPublic ? 'on' : ''} disabled:opacity-40`}
              disabled={!!birthdate && ageFrom(birthdate) < 18}
              title={!!birthdate && ageFrom(birthdate) < 18 ? t('Indisponível para menores de 18 anos') : undefined}
              onClick={() => setIsPublic(true)}
            >
              🌐 {t('Público')}
            </button>
            <button type="button" className={`chip ${!isPublic ? 'on' : ''}`} onClick={() => setIsPublic(false)}>
              <Lock size={13} /> {t('Só eu')}
            </button>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button className="manga-btn" disabled={!dirty || !userOk || avail === false || !!busy}>
            {busy === 'save' ? <Spinner className="h-4 w-4" /> : <Check size={16} />} {t('Salvar alterações')}
          </button>
          {dirty && (
            <button
              type="button"
              className="manga-btn ghost"
              onClick={() => {
                setDisplayName(profile.display_name ?? '');
                setUsername(profile.username);
                setBio(profile.bio ?? '');
                setFavId(profile.favorite_id ?? null);
                setIsPublic(profile.is_public);
              }}
            >
              {t('Desfazer')}
            </button>
          )}
        </div>
      </form>

      {/* Privacidade */}
      <Privacy shareActivity={profile.share_activity !== false} isPublic={profile.is_public} minor={!!birthdate && ageFrom(birthdate) < 18} />

      {/* Conta */}
      <section className="panel mt-6 space-y-4 p-5">
        <h3 className="font-display text-lg">{t('Conta')}</h3>
        <div className="text-sm">
          <span className="text-muted">{t('E-mail:')}</span> <b>{user.email}</b> {isGoogle && <span className="chip ml-1 !py-0 !text-[10px]">Google</span>}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run('pw', async () => {
              await setNewPassword(newPw);
              setNewPw('');
            }, t('Senha alterada!'));
          }}
        >
          <input className="field max-w-xs" type="password" autoComplete="new-password" minLength={8} required placeholder={isGoogle ? t('Criar uma senha (opcional)') : t('Nova senha (mín. 8)')} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className="manga-btn ghost" disabled={!!busy}>
            <KeyRound size={16} /> {t('Trocar senha')}
          </button>
        </form>
        <div className="border-t-2 border-dashed border-line pt-4">
          <p className="mb-2 text-sm text-muted">{t('Excluir a conta apaga perfil, fotos e a lista na nuvem. A lista salva neste aparelho continua aqui.')}</p>
          <ConfirmButton
            className="manga-btn ghost !border-red-400 !text-red-300"
            confirmText={t('Clique de novo para excluir de vez')}
            onConfirm={() =>
              run('del', async () => {
                await deleteMyAccount();
                nav('/');
              }, t('Conta excluída.'))
            }
          >
            <Trash2 size={16} /> {t('Excluir minha conta')}
          </ConfirmButton>
        </div>
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs font-bold text-muted">
        <ImagePlus size={14} /> {t('Fotos e banners de personagens/animes vêm do AniList.')}
      </p>
    </>
  );
}

function Privacy({ shareActivity, isPublic, minor }: { shareActivity: boolean; isPublic: boolean; minor: boolean }) {
  const toast = useUI((s) => s.toast);
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: listBlocked });
  const [busy, setBusy] = useState(false);
  return (
    <section id="privacidade" className="panel mt-6 scroll-mt-24 space-y-4 p-5">
      <h3 className="font-display text-lg">{t('Privacidade e amigos')}</h3>
      {minor && (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border-2 border-cyan/50 p-2.5 text-sm font-bold text-cyan">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          {t('Como você tem menos de 18 anos, seu perfil fica privado: só quem você aceitar vê sua lista e seu feed, e você não aparece na busca de pessoas.')}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--pink)]"
          checked={shareActivity}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            try {
              await updateMyProfile({ share_activity: e.target.checked });
              toast(e.target.checked ? t('Suas atividades vão aparecer no feed') : t('Suas atividades não aparecem mais no feed'));
            } catch (err) {
              toast((err as Error).message, 'err');
            } finally {
              setBusy(false);
            }
          }}
        />
        <span>
          <b className="text-sm">{t('Mostrar o que eu assisto e leio no feed dos amigos')}</b>
          <span className="block text-xs text-muted">
            {isPublic ? t('Perfil público: quem segue você vê na hora.') : t('Perfil privado: só quem você aceitou vê.')}
          </span>
        </span>
      </label>
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{t('Pessoas bloqueadas')}</div>
        {!blocked.data?.length ? (
          <p className="text-sm text-muted">{t('Ninguém bloqueado.')}</p>
        ) : (
          <div className="space-y-2">
            {blocked.data.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-panel-2 p-2">
                <span className="truncate text-sm font-bold">@{p.username}</span>
                <button
                  className="manga-btn ghost !py-1 text-xs"
                  onClick={async () => {
                    try {
                      await unblock(p.user_id);
                      toast(t('Desbloqueado'));
                      blocked.refetch();
                    } catch (err) {
                      toast((err as Error).message, 'err');
                    }
                  }}
                >
                  {t('Desbloquear')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Banner animado (Shiori+): fica por cima da imagem do banner no perfil. */
function PlusBanner({ userId }: { userId?: string }) {
  const perks = usePerks(userId);
  const plus = isPlus(perks);
  const qc = useQueryClient();
  const toast = useUI((s) => s.toast);
  const pick = async (b: Banner | null) => {
    try {
      await setBanner(b);
      qc.invalidateQueries({ queryKey: ['perks'] });
      toast(b ? t('Banner animado aplicado ✦') : t('Banner animado removido'));
    } catch (e) {
      toast((e as Error).message.includes('plus_only') ? t('Exclusivo do Shiori+') : (e as Error).message, 'err');
    }
  };
  return (
    <section className="panel mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="badge-plus inline-flex items-center gap-1 rounded-full border-2 border-black px-2 py-0.5 text-[11px] font-black">✦ Shiori+</span>
        <b className="text-sm">{t('Banner animado')}</b>
        {!plus && (
          <Link to="/apoiar" className="ml-auto text-xs font-bold text-pink underline">
            {t('Desbloquear')}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <button disabled={!plus} onClick={() => pick(null)} className={`grid h-16 place-items-center rounded-[var(--radius-sm)] border-2 text-xs font-bold disabled:opacity-50 ${!perks?.banner ? 'border-pink' : 'border-black'}`}>
          {t('Nenhum')}
        </button>
        {BANNERS.map((b) => (
          <button key={b} disabled={!plus} onClick={() => pick(b)} title={BannerName(b)} className={`relative h-16 overflow-hidden rounded-[var(--radius-sm)] border-2 disabled:opacity-50 ${perks?.banner === b ? 'border-pink ring-2 ring-pink' : 'border-black'}`}>
            <AnimatedBanner kind={b} />
            <span className="absolute bottom-1 left-1.5 text-[10px] font-black text-white drop-shadow">{plus ? BannerName(b) : `🔒 ${BannerName(b)}`}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
