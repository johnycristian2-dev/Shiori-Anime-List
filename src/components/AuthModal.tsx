import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { CLOUD_ENABLED } from '../lib/supabase';
import { t } from '../lib/i18n';
import { USERNAME_RE } from '../sync/profile';
import { ageFrom, MIN_AGE, resendCode, resetPassword, sendLoginCode, setNewPassword, signIn, signInGoogle, signUp, useAccount, usernameAvailable, verifyCode, type CodeType } from '../sync/account';
import { useUI } from '../store/ui';
import { Spinner, useDebounced } from './ui';

/** Login com Google só aparece depois de configurado no Supabase (VITE_GOOGLE_AUTH=1) */
const GOOGLE_ON = import.meta.env.VITE_GOOGLE_AUTH === '1';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function PasswordField({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="field pr-10"
        type={show ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink" onClick={() => setShow((v) => !v)} aria-label={show ? t('Esconder senha') : t('Mostrar senha')}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/** 6 caixinhas pro código do e-mail (aceita colar o código inteiro) */
function CodeInput({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: (v: string) => void }) {
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const set = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onDone(clean);
  };
  return (
    <label className="relative block">
      <input
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label={t('Código de 6 dígitos')}
        value={value}
        maxLength={6}
        onChange={(e) => set(e.target.value)}
      />
      <div className="pointer-events-none grid grid-cols-6 gap-2">
        {boxes.map((d, i) => (
          <span
            key={i}
            className={`grid h-14 place-items-center rounded-[var(--radius-sm)] border-2 bg-panel-2 font-display text-2xl ${i === value.length ? 'border-pink' : d ? 'border-cyan' : 'border-line'}`}
          >
            {d}
          </span>
        ))}
      </div>
    </label>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

export default function AuthModal() {
  const modal = useAccount((s) => s.modal);
  const recovery = useAccount((s) => s.recovery);
  const toast = useUI((s) => s.toast);
  const open = !!modal || recovery;
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [verify, setVerify] = useState<CodeType | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [avail, setAvail] = useState<null | boolean>(null);
  const debUser = useDebounced(username.trim().toLowerCase(), 450);

  useEffect(() => {
    if (recovery) setMode('recovery');
    else if (modal) setMode(modal);
    setError('');
    setVerify(null);
    setCode('');
  }, [modal, recovery]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const askCode = (type: CodeType) => {
    setVerify(type);
    setCode('');
    setCooldown(60);
  };

  useEffect(() => {
    if (mode !== 'signup' || !CLOUD_ENABLED || !USERNAME_RE.test(debUser)) return setAvail(null);
    let alive = true;
    usernameAvailable(debUser).then((ok) => alive && setAvail(ok));
    return () => {
      alive = false;
    };
  }, [debUser, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !recovery && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recovery]);

  if (!open) return null;
  const close = () => useAccount.setState({ modal: null });

  const run = (key: string, fn: () => Promise<void>) => async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  const age = birthdate ? ageFrom(birthdate) : NaN;
  const tooYoung = !!birthdate && !(age >= MIN_AGE);
  const userOk = USERNAME_RE.test(username.trim().toLowerCase());
  const pw = strength(password);
  const today = new Date().toISOString().slice(0, 10);

  const head: Record<Mode, { title: string; jp: string }> = {
    signin: { title: t('Entrar'), jp: 'ログイン' },
    signup: { title: t('Criar conta'), jp: '新規登録' },
    forgot: { title: t('Esqueci a senha'), jp: '再設定' },
    recovery: { title: t('Nova senha'), jp: '新しいパスワード' },
  };

  const body = !CLOUD_ENABLED ? (
    <div className="space-y-3 text-sm text-muted">
      <p className="text-ink">{t('As contas ainda não foram ativadas neste site.')}</p>
      <p>{t('Enquanto isso, sua lista fica salva neste navegador e você pode exportar/importar um backup em Sincronizar.')}</p>
    </div>
  ) : verify ? (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl">📬</div>
        <p className="mt-2 font-bold">
          {verify === 'signup'
            ? t('Falta só confirmar seu e-mail!')
            : verify === 'recovery'
              ? t('Vamos criar uma senha nova.')
              : t('Entrar sem senha')}
        </p>
        <p className="text-sm text-muted">{t('Enviamos um código de 6 dígitos para {0}. Digite aqui:', email)}</p>
      </div>
      <CodeInput
        value={code}
        onChange={setCode}
        onDone={(c) =>
          run('code', async () => {
            await verifyCode(email, c, verify);
            if (verify === 'signup') toast(t('E-mail confirmado! Bem-vindo(a) ao Shiori.'));
            else if (verify === 'email') toast(t('Pronto, você entrou!'));
          })()
        }
      />
      {busy === 'code' && (
        <div className="flex justify-center">
          <Spinner className="h-5 w-5 text-pink" />
        </div>
      )}
      <p className="text-center text-xs text-muted">{t('O e-mail também tem um botão que faz a mesma coisa. Não chegou? Olhe o spam ou as promoções.')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="manga-btn ghost !py-1.5 text-sm"
          disabled={cooldown > 0 || !!busy}
          onClick={run('resend', async () => {
            await resendCode(email, verify);
            setCooldown(60);
            toast(t('Código reenviado!'));
          })}
        >
          {cooldown > 0 ? t('Reenviar em {0}s', cooldown) : t('Reenviar código')}
        </button>
        <button
          className="manga-btn ghost !py-1.5 text-sm"
          onClick={() => {
            setVerify(null);
            setCode('');
          }}
        >
          {t('Trocar e-mail')}
        </button>
      </div>
    </div>
  ) : mode === 'recovery' ? (
    <form className="space-y-3" onSubmit={run('pw', async () => {
      await setNewPassword(password);
      toast(t('Senha alterada!'));
    })}>
      <PasswordField value={password} onChange={setPassword} placeholder={t('Nova senha (mín. 8)')} autoComplete="new-password" />
      <button className="manga-btn w-full justify-center" disabled={!!busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <KeyRound size={16} />} {t('Salvar senha')}
      </button>
    </form>
  ) : mode === 'forgot' ? (
    <form className="space-y-3" onSubmit={run('reset', async () => {
      await resetPassword(email);
      askCode('recovery');
    })}>
      <p className="text-sm text-muted">{t('Digite seu e-mail e mandamos um código pra criar uma senha nova.')}</p>
      <input className="field" type="email" required autoComplete="email" placeholder={t('seu@email.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="manga-btn w-full justify-center" disabled={!!busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <Mail size={16} />} {t('Enviar código')}
      </button>
      <button type="button" className="w-full text-center text-sm font-bold text-cyan" onClick={() => setMode('signin')}>
        {t('Voltar pra entrar')}
      </button>
    </form>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] border-2 border-line bg-panel-2 p-1">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError('');
            }}
            className={`rounded-[calc(var(--radius-sm)*0.7)] py-2 text-sm font-extrabold transition ${mode === m ? 'bg-pink text-white' : 'text-muted hover:text-ink'}`}
            style={mode === m ? { color: 'var(--on-pink, #fff)' } : undefined}
          >
            {m === 'signin' ? t('Entrar') : t('Criar conta')}
          </button>
        ))}
      </div>

      {GOOGLE_ON && (
        <>
          <button className="manga-btn ghost w-full justify-center" onClick={run('google', signInGoogle)} disabled={!!busy}>
            {busy === 'google' ? <Spinner className="h-4 w-4" /> : <GoogleIcon />} {t('Continuar com Google')}
          </button>
          <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-line" /> {t('ou com e-mail')} <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      {mode === 'signin' ? (
        <form
          className="space-y-3"
          onSubmit={run('in', async () => {
            try {
              await signIn(email, password);
            } catch (err) {
              // conta criada mas e-mail ainda não confirmado: manda outro código e pede aqui mesmo
              if (/Confirme seu e-mail|Confirm your email|メールアドレスを確認/.test((err as Error).message)) {
                await resendCode(email, 'signup').catch(() => undefined);
                askCode('signup');
                return;
              }
              throw err;
            }
          })}
        >
          <input className="field" type="email" required autoComplete="email" placeholder={t('seu@email.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField value={password} onChange={setPassword} placeholder={t('Senha')} autoComplete="current-password" />
          <button className="manga-btn w-full justify-center" disabled={!!busy}>
            {busy === 'in' ? <Spinner className="h-4 w-4" /> : <KeyRound size={16} />} {t('Entrar')}
          </button>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
            <button type="button" className="text-cyan" onClick={() => setMode('forgot')}>
              {t('Esqueci a senha')}
            </button>
            <button
              type="button"
              className="text-muted hover:text-ink"
              onClick={run('magic', async () => {
                if (!email.includes('@')) throw new Error(t('Digite seu e-mail primeiro.'));
                await sendLoginCode(email);
                askCode('email');
              })}
            >
              {t('Entrar com código por e-mail')}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={run('up', async () => {
            if (!terms) throw new Error(t('Aceite os termos para continuar.'));
            if (avail === false) throw new Error(t('Esse apelido já está em uso.'));
            const r = await signUp({ email, password, username, displayName, birthdate });
            if (r.needsConfirm) askCode('signup');
            else toast(t('Bem-vindo(a) ao Shiori, {0}!', displayName || username));
          })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-muted">{t('Apelido')}</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">@</span>
                <input
                  className="field pl-7"
                  required
                  maxLength={20}
                  autoComplete="username"
                  placeholder="nakama_01"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </div>
              <span className={`mt-1 block text-[11px] font-bold ${!username ? 'text-muted' : !userOk ? 'text-red-400' : avail === false ? 'text-red-400' : avail ? 'text-[#7cff8a]' : 'text-muted'}`}>
                {!username
                  ? t('3 a 20: letras, números ou _')
                  : !userOk
                    ? t('Mínimo de 3 caracteres')
                    : avail === false
                      ? t('Já está em uso')
                      : avail
                        ? t('✓ Disponível')
                        : t('Verificando…')}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-muted">{t('Nome de exibição')}</span>
              <input className="field" maxLength={40} placeholder={t('Como quer ser chamado')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          </div>
          <input className="field" type="email" required autoComplete="email" placeholder={t('seu@email.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <PasswordField value={password} onChange={setPassword} placeholder={t('Senha (mín. 8)')} autoComplete="new-password" />
            {password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < pw ? ['#ff5d73', '#ffb84d', '#ffe14d', '#7cff8a'][pw - 1] : 'var(--line)' }} />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-muted">{[t('Fraca'), t('Fraca'), t('Ok'), t('Boa'), t('Forte')][pw]}</span>
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-muted">{t('Data de nascimento')}</span>
            <input className="field" type="date" required max={today} min="1900-01-01" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            <span className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${tooYoung ? 'text-red-400' : 'text-muted'}`}>
              <ShieldCheck size={12} />
              {tooYoung ? t('Você precisa ter pelo menos {0} anos para criar uma conta.', MIN_AGE) : t('Não aparece no perfil. Usamos só pra proteger quem é menor de idade.')}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm font-bold">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--pink)]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              {t('Li e aceito os')}{' '}
              <a href="#/termos" target="_blank" rel="noreferrer" className="text-cyan underline">
                {t('termos de uso e privacidade')}
              </a>
              .
            </span>
          </label>
          <button className="manga-btn w-full justify-center" disabled={!!busy || tooYoung}>
            {busy === 'up' ? <Spinner className="h-4 w-4" /> : <Check size={16} />} {t('Criar minha conta')}
          </button>
        </form>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !recovery && close()}>
      <div role="dialog" aria-modal="true" aria-label={head[mode].title} className="panel pop-in relative my-8 w-full max-w-md p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-2 -top-5 font-jp text-6xl font-black text-pink/15">{head[mode].jp}</div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title font-display text-2xl">{head[mode].title}</h2>
            {mode === 'signup' && <p className="text-sm text-muted">{t('Sua lista na nuvem, perfil com foto e banner, e muito mais.')}</p>}
          </div>
          {!recovery && (
            <button className="manga-btn ghost !p-1.5" onClick={close} aria-label={t('Fechar')}>
              <X size={16} />
            </button>
          )}
        </div>
        {body}
        {error && <p className="mt-3 rounded-[var(--radius-sm)] border-2 border-red-400/60 bg-red-500/10 p-2.5 text-sm font-bold text-red-300">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
