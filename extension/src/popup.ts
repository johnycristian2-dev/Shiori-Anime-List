import type { Req, Status } from './protocol';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ask = <T>(req: Req) =>
  new Promise<T>((resolve, reject) =>
    chrome.runtime.sendMessage(req, (r) => {
      if (!r) return reject(new Error(chrome.runtime.lastError?.message || 'Sem resposta da extensão.'));
      if (r.ok) resolve(r.data as T);
      else reject(new Error(r.error));
    })
  );

function say(text: string, err = false) {
  const el = $('msg');
  el.textContent = text;
  el.className = 'msg' + (err ? ' err' : '');
  el.hidden = !text;
}

function render(s: Status) {
  $('ver').textContent = `v${s.version}`;
  $('login').hidden = s.loggedIn;
  $('logged').hidden = !s.loggedIn;
  if (s.loggedIn) {
    $('who').textContent = s.room ? `${s.email} · sala ${s.room}` : `${s.email} · sem sala`;
    ($('code') as HTMLInputElement).value = s.room ?? '';
    ($('name') as HTMLInputElement).value = s.name ?? '';
    $('leaveRoom').hidden = !s.room;
    ($('auto') as HTMLInputElement).checked = s.autoTrack;
    const last = $('last');
    last.hidden = !s.lastTracked;
    if (s.lastTracked) {
      const when = new Date(s.lastTracked.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      last.textContent = `Último marcado: ${s.lastTracked.title} · ep ${s.lastTracked.episode} (${when})`;
    }
  }
}

async function guard(btn: HTMLButtonElement, fn: () => Promise<void>) {
  btn.disabled = true;
  try {
    await fn();
  } catch (e) {
    say((e as Error).message, true);
  } finally {
    btn.disabled = false;
  }
}

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  guard($('loginBtn'), async () => {
    const s = await ask<Status>({
      type: 'login',
      email: ($('email') as HTMLInputElement).value,
      password: ($('password') as HTMLInputElement).value,
    });
    ($('password') as HTMLInputElement).value = '';
    say(s.room ? '' : 'Pronto! Agora conecte uma sala (ou clique em "Conectar à sala" no site).');
    render(s);
  });
});

$('roomForm').addEventListener('submit', (e) => {
  e.preventDefault();
  guard($('saveRoom'), async () => {
    const code = ($('code') as HTMLInputElement).value.trim().toUpperCase();
    const s = await ask<Status>({ type: 'setRoom', code: code || null, name: ($('name') as HTMLInputElement).value });
    say(code ? `Conectado à sala ${code}. Abra o episódio no Crunchyroll!` : '');
    render(s);
  });
});

$('leaveRoom').addEventListener('click', () =>
  guard($('leaveRoom') as HTMLButtonElement, async () => {
    render(await ask<Status>({ type: 'setRoom', code: null }));
    say('Você saiu da sala.');
  })
);

$('auto').addEventListener('change', async (e) => {
  const on = (e.target as HTMLInputElement).checked;
  try {
    render(await ask<Status>({ type: 'setAutoTrack', on }));
    say(on ? 'Lista automática ligada.' : 'Lista automática desligada.');
  } catch (err) {
    say((err as Error).message, true);
  }
});

$('logout').addEventListener('click', () =>
  guard($('logout') as HTMLButtonElement, async () => {
    render(await ask<Status>({ type: 'logout' }));
    say('');
  })
);

ask<Status>({ type: 'status' })
  .then(render)
  .catch((e) => say(e.message, true));
