/**
 * Cloudflare Turnstile (anti-robô) para cadastro, login, código por e-mail e convidado.
 * A chave pública fica em app_config.turnstile_site (Moderação → Apoio e afiliados).
 * Sem chave configurada, não faz nada (devolve undefined) e o login segue normal.
 * Na maioria das vezes passa sozinho; só aparece um quadrinho quando o Cloudflare desconfia.
 */
import { supabase } from './supabase';
import { t } from './i18n';

interface Turnstile {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let siteKey: Promise<string | null> | null = null;
function getKey() {
  siteKey ??= (async () => {
    if (!supabase) return null;
    const { data } = await supabase.from('app_config').select('value').eq('key', 'turnstile_site').maybeSingle();
    return data?.value?.trim() || null;
  })().catch(() => null);
  return siteKey;
}

let script: Promise<void> | null = null;
function loadScript() {
  script ??= new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => {
      script = null;
      rej(new Error(t('Não deu pra carregar a verificação anti-robô. Confira sua internet.')));
    };
    document.head.appendChild(s);
  });
  return script;
}

/** Pega um token novo (cada token vale uma vez só). */
export async function captchaToken(): Promise<string | undefined> {
  const key = await getKey();
  if (!key) return undefined;
  await loadScript();
  const ts = window.turnstile;
  if (!ts) throw new Error(t('Não deu pra carregar a verificação anti-robô. Confira sua internet.'));

  return new Promise<string>((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:none;place-items:center;background:rgba(0,0,0,.6);';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1538;border:3px solid #000;border-radius:16px;padding:16px;box-shadow:6px 6px 0 #000;text-align:center;color:#fff;font:700 14px sans-serif';
    box.textContent = t('Só confirmando que você não é um robô 🤖');
    const slot = document.createElement('div');
    slot.style.marginTop = '10px';
    box.appendChild(slot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    let id = '';
    const done = (fn: () => void) => {
      try {
        if (id) ts.remove(id);
      } catch {
        /* já removido */
      }
      overlay.remove();
      fn();
    };
    id = ts.render(slot, {
      sitekey: key,
      appearance: 'interaction-only',
      language: 'auto',
      callback: (tok: string) => done(() => resolve(tok)),
      'error-callback': () => done(() => reject(new Error(t('A verificação anti-robô falhou. Tente de novo.')))),
      'timeout-callback': () => done(() => reject(new Error(t('A verificação anti-robô expirou. Tente de novo.')))),
      'before-interactive-callback': () => (overlay.style.display = 'grid'),
    });
  });
}
