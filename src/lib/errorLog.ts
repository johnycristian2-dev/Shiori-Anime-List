/**
 * Erros que acontecem no navegador das pessoas vão pro painel de moderação (aba "Erros").
 * Sem dados pessoais: só a mensagem, onde aconteceu e o tipo de aparelho.
 * Limites daqui: no máximo 10 por visita e o mesmo erro só 1 vez por visita.
 */
import { supabase } from './supabase';

const seen = new Set<string>();
let sent = 0;

// barulho que não é do Shiori (extensões, rede caindo, aba fechando)
const IGNORE = [
  /ResizeObserver loop/i,
  /Script error\.?$/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /Failed to fetch|NetworkError|Load failed|network error/i,
  /AbortError|The user aborted/i,
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i,
];

function device() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'outro';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'outro';
  return `${br} · ${os} · ${window.innerWidth}px`;
}

/** Tira coisas que poderiam identificar alguém (e-mails, tokens) antes de mandar. */
export function scrub(s: string) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(access_token|token|key|code)=[^&\s"']+/gi, '$1=[x]')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/g, '[jwt]');
}

export function reportError(err: unknown, where?: string) {
  try {
    if (!supabase || sent >= 10) return;
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err ?? 'erro'));
    const message = scrub(`${where ? `[${where}] ` : ''}${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}`);
    if (IGNORE.some((r) => r.test(message) || r.test(e.stack ?? ''))) return;
    if (seen.has(message)) return;
    seen.add(message);
    sent++;
    void supabase.rpc('log_client_error', {
      p_message: message.slice(0, 500),
      p_stack: scrub(e.stack ?? '').slice(0, 3000),
      p_page: location.pathname.slice(0, 300),
      p_device: device(),
      p_version: import.meta.env.VITE_APP_VERSION ?? 'dev',
    });
  } catch {
    /* o registro de erro nunca pode causar outro erro */
  }
}

export function watchErrors() {
  if (import.meta.env.DEV) return;
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason, 'promise'));
}
