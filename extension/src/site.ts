/** Roda no site Shiori: deixa a página saber que a extensão existe e conectar ela a uma sala. */
import type { Req, Status } from './protocol';

const ask = <T>(req: Req) =>
  new Promise<{ ok: boolean; data?: T; error?: string }>((resolve) => {
    try {
      chrome.runtime.sendMessage(req, (r) => resolve(r ?? { ok: false, error: chrome.runtime.lastError?.message }));
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });

const reply = (status: Status | null, extra: Record<string, unknown> = {}) =>
  window.postMessage({ source: 'shiori-ext', type: 'status', status, ...extra }, window.location.origin);

window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.source !== 'shiori-site') return;
  if (e.data.type === 'ping') {
    const r = await ask<Status>({ type: 'status' });
    reply(r.ok ? r.data! : null);
  } else if (e.data.type === 'connect' && typeof e.data.code === 'string') {
    const r = await ask<Status>({ type: 'setRoom', code: e.data.code, name: typeof e.data.name === 'string' ? e.data.name : undefined });
    reply(r.ok ? r.data! : null, r.ok ? {} : { error: r.error });
  }
});

document.documentElement.dataset.shioriExt = '1';
