/**
 * Conta Shiori: cadastro com e-mail e senha (ou Google), perfil com foto, banner e bio.
 * A sincronização da lista continua em cloud.ts; aqui é só identidade e perfil.
 */
import { create } from 'zustand';
import { redirectUrl, supabase } from '../lib/supabase';
import { getLang, t } from '../lib/i18n';
import { useCloudUser } from './cloud';
import { buildSnapshot, USERNAME_RE, type Profile } from './profile';

export const MIN_AGE = 13;

/** Idade completa a partir de 'AAAA-MM-DD' */
export function ageFrom(birthdate: string, now = new Date()) {
  const [y, m, d] = birthdate.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

const sb = () => {
  if (!supabase) throw new Error(t('As contas ainda não foram ativadas neste site.'));
  return supabase;
};

/** Traduz os erros mais comuns do Supabase Auth */
function friendly(e: { message?: string; code?: string } | null): Error {
  const m = e?.message ?? '';
  if (/Invalid login credentials/i.test(m)) return new Error(t('E-mail ou senha incorretos.'));
  if (/Email not confirmed/i.test(m)) return new Error(t('Confirme seu e-mail primeiro (veja sua caixa de entrada).'));
  if (/already registered|already exists/i.test(m)) return new Error(t('Esse e-mail já tem conta. Use "Entrar".'));
  if (/Password should be at least/i.test(m)) return new Error(t('A senha precisa ter pelo menos 8 caracteres.'));
  if (/not authorized|Email address .* is invalid|email.*not allowed/i.test(m)) return new Error(t('Não conseguimos enviar e-mail para esse endereço agora. Tente outro ou fale com o suporte.'));
  if (/signups not allowed|Signups not allowed/i.test(m)) return new Error(t('Cadastros estão fechados no momento.'));
  if (/email rate limit|over_email_send_rate_limit/i.test(m)) return new Error(t('O site atingiu o limite de e-mails por hora. Tente de novo daqui a uma hora (não precisa clicar de novo agora).'));
  if (/rate limit|too many/i.test(m)) return new Error(t('Muitas tentativas. Espere um pouco e tente de novo.'));
  return new Error(m || t('Algo deu errado.'));
}

export async function usernameAvailable(u: string) {
  const name = u.trim().toLowerCase();
  if (!USERNAME_RE.test(name)) return false;
  const { data, error } = await sb().rpc('username_available', { u: name });
  if (error) return true; // na dúvida, deixa o servidor decidir
  return !!data;
}

export async function signUp(p: { email: string; password: string; username: string; displayName: string; birthdate: string }) {
  const username = p.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error(t('Apelido: 3 a 20 letras minúsculas, números ou _'));
  if (p.password.length < 8) throw new Error(t('A senha precisa ter pelo menos 8 caracteres.'));
  const age = ageFrom(p.birthdate);
  if (!(age >= MIN_AGE)) throw new Error(t('Você precisa ter pelo menos {0} anos para criar uma conta.', MIN_AGE));
  if (age > 120) throw new Error(t('Confira a data de nascimento.'));
  const { data, error } = await sb().auth.signUp({
    email: p.email.trim(),
    password: p.password,
    options: {
      emailRedirectTo: redirectUrl(),
      // data de nascimento fica só nos dados privados da conta, nunca no perfil público
      data: { username, display_name: p.displayName.trim(), birthdate: p.birthdate, lang: getLang() },
    },
  });
  if (error) throw friendly(error);
  // Sem sessão = o projeto pede confirmação por e-mail
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error);
}

export async function signInGoogle() {
  const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
  if (error) throw friendly(error);
}

/** Manda um código de 6 dígitos (e um link de reserva) pra entrar sem senha */
export async function sendLoginCode(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl(), shouldCreateUser: false } });
  if (error) {
    if (/Signups not allowed for otp/i.test(error.message)) throw new Error(t('Não existe conta com esse e-mail. Crie uma conta.'));
    throw friendly(error);
  }
}

export type CodeType = 'signup' | 'email' | 'recovery';

/** Confere o código que chegou por e-mail. Se der certo, a pessoa já fica logada. */
export async function verifyCode(email: string, code: string, type: CodeType) {
  const token = code.replace(/\D/g, '');
  if (token.length < 6) throw new Error(t('Digite o código completo.'));
  const { error } = await sb().auth.verifyOtp({ email: email.trim(), token, type });
  if (error) {
    if (/expired|invalid/i.test(error.message)) throw new Error(t('Código inválido ou expirado. Peça um novo.'));
    throw friendly(error);
  }
  if (type === 'recovery') useAccount.setState({ recovery: true });
}

/** Reenvia o código certo pra cada situação */
export async function resendCode(email: string, type: CodeType) {
  if (type === 'signup') {
    const { error } = await sb().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl() } });
    if (error) throw friendly(error);
  } else if (type === 'recovery') await resetPassword(email);
  else await sendLoginCode(email);
}

export async function resetPassword(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
  if (error) throw friendly(error);
}

export async function setNewPassword(password: string) {
  if (password.length < 8) throw new Error(t('A senha precisa ter pelo menos 8 caracteres.'));
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw friendly(error);
  useAccount.setState({ recovery: false });
}

/** Data de nascimento (privada) da conta logada */
export const myBirthdate = (): string | undefined => useCloudUser.getState().user?.user_metadata?.birthdate;

export async function setBirthdate(birthdate: string) {
  const age = ageFrom(birthdate);
  if (!(age >= MIN_AGE)) throw new Error(t('Você precisa ter pelo menos {0} anos para criar uma conta.', MIN_AGE));
  const { data, error } = await sb().auth.updateUser({ data: { birthdate } });
  if (error) throw friendly(error);
  useCloudUser.setState({ user: data.user });
}

// ───────────── Perfil ─────────────

export interface ProfileExtra {
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  favorite_id: number | null;
  share_activity: boolean;
}
export type FullProfile = Profile & Partial<ProfileExtra>;

interface AccountState {
  profile: FullProfile | null;
  loading: boolean;
  /** veio do link "esqueci a senha": pedir senha nova */
  recovery: boolean;
  /** modal de entrar/criar conta */
  modal: null | 'signin' | 'signup';
}
export const useAccount = create<AccountState>(() => ({ profile: null, loading: false, recovery: false, modal: null }));
export const openAuth = (mode: 'signin' | 'signup' = 'signin') => useAccount.setState({ modal: mode });

export async function loadMyProfile() {
  const u = useCloudUser.getState().user;
  if (!supabase || !u || u.is_anonymous) return useAccount.setState({ profile: null });
  useAccount.setState({ loading: true });
  try {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', u.id).maybeSingle();
    let profile = data as FullProfile | null;
    // Conta criada antes do gatilho (ou pelo Google): cria o perfil agora
    if (!profile) {
      const meta = u.user_metadata ?? {};
      const base = String(meta.username || meta.full_name || u.email?.split('@')[0] || 'otaku')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 16)
        .padEnd(3, '_');
      for (let i = 0; i < 5 && !profile; i++) {
        const username = i === 0 ? base : `${base.slice(0, 16)}${Math.floor(1000 + Math.random() * 9000)}`;
        const row = {
          user_id: u.id,
          username,
          display_name: meta.display_name || meta.full_name || null,
          avatar_url: meta.avatar_url || null,
          is_public: true,
          snapshot: buildSnapshot(),
        };
        const { data: created, error } = await supabase.from('profiles').insert(row).select().maybeSingle();
        if (!error) profile = created as FullProfile;
        else if (error.code !== '23505') break;
      }
    }
    useAccount.setState({ profile });
  } finally {
    useAccount.setState({ loading: false });
  }
}

export async function updateMyProfile(patch: Partial<Pick<FullProfile, 'username' | 'display_name' | 'is_public' | 'avatar_url' | 'banner_url' | 'bio' | 'favorite_id' | 'share_activity'>>) {
  const u = useCloudUser.getState().user;
  if (!u) throw new Error(t('Entre na sua conta primeiro.'));
  const clean = { ...patch };
  if (clean.username !== undefined) {
    clean.username = clean.username.trim().toLowerCase();
    if (!USERNAME_RE.test(clean.username)) throw new Error(t('Apelido: 3 a 20 letras minúsculas, números ou _'));
  }
  if (clean.bio !== undefined) clean.bio = clean.bio?.trim().slice(0, 300) || null;
  if (clean.display_name !== undefined) clean.display_name = clean.display_name?.trim().slice(0, 40) || null;
  const { data, error } = await sb()
    .from('profiles')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('user_id', u.id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error(t('Esse apelido já está em uso.'));
    throw friendly(error);
  }
  if (data) useAccount.setState({ profile: data as FullProfile });
}

/**
 * Redimensiona e converte pra WebP no navegador antes de enviar
 * (arquivo leve e sem metadados de localização da foto).
 */
async function toWebp(file: File, w: number, h: number): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error(t('Escolha um arquivo de imagem.'));
  if (file.size > 15 * 1024 * 1024) throw new Error(t('Imagem muito grande (máx. 15 MB).'));
  const bmp = await createImageBitmap(file);
  const scale = Math.max(w / bmp.width, h / bmp.height);
  const sw = w / scale;
  const sh = h / scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // redução suave, sem serrilhado
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/webp', 0.92));
}

export async function uploadProfileImage(kind: 'avatar' | 'banner', file: File) {
  const u = useCloudUser.getState().user;
  if (!u) throw new Error(t('Entre na sua conta primeiro.'));
  const blob = kind === 'avatar' ? await toWebp(file, 512, 512) : await toWebp(file, 1800, 600);
  const path = `${u.id}/${kind}-${Date.now().toString(36)}.webp`;
  const bucket = sb().storage.from('profile-images');
  const { error } = await bucket.upload(path, blob, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
  if (error) throw friendly(error);
  // apaga as imagens antigas do mesmo tipo
  const { data: old } = await bucket.list(u.id);
  const stale = (old ?? []).filter((f) => f.name.startsWith(`${kind}-`) && `${u.id}/${f.name}` !== path).map((f) => `${u.id}/${f.name}`);
  if (stale.length) await bucket.remove(stale);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Liga o perfil ao estado de login (chamado uma vez no início). */
let wired = false;
export function wireAccount() {
  if (wired || !supabase) return;
  wired = true;
  let lastId: string | undefined;
  useCloudUser.subscribe((s) => {
    const id = s.user && !s.user.is_anonymous ? s.user.id : undefined;
    if (id === lastId) return;
    lastId = id;
    if (id) {
      useAccount.setState({ modal: null });
      loadMyProfile();
    } else useAccount.setState({ profile: null });
  });
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') useAccount.setState({ recovery: true });
  });
}

/** Apaga a conta e tudo ligado a ela (LGPD). A lista local neste aparelho continua. */
export async function deleteMyAccount() {
  const u = useCloudUser.getState().user;
  if (!u) return;
  const bucket = sb().storage.from('profile-images');
  const { data: files } = await bucket.list(u.id);
  if (files?.length) await bucket.remove(files.map((f) => `${u.id}/${f.name}`));
  const { error } = await sb().rpc('delete_my_account');
  if (error) throw friendly(error);
  await sb().auth.signOut({ scope: 'local' });
  useAccount.setState({ profile: null });
}
