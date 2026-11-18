/**
 * Roda em todas as frames do Crunchyroll. A frame que tem o <video> vira o "motor":
 * - manda play/pause/pulos feitos pela pessoa pro background (que grava na sala);
 * - aplica os comandos dos amigos no vídeo;
 * - mostra o chat da sala por cima do player (funciona em tela cheia).
 */
import type { ChatMsg, PortIn, PortOut, Playback } from './protocol';

const isTop = window.top === window;
const CLIENT = Math.random().toString(36).slice(2, 10);

/* ---------- URL do episódio: só a frame de cima sabe, então ela repassa pras de baixo ---------- */

let topHref = isTop ? location.href : '';
let topTitle = '';
interface EpMeta {
  series: string;
  season: number | null;
  episode: number;
}
let topMeta: EpMeta | null = null;

/** Lê série/temporada/episódio da página do Crunchyroll (JSON-LD, depois a tela, depois o título da aba). */
export function readMeta(doc: Document = document): EpMeta | null {
  // 1) dados estruturados
  for (const el of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const raw = JSON.parse(el.textContent || 'null');
      const items: Record<string, any>[] = (Array.isArray(raw) ? raw : raw?.['@graph'] ?? [raw]).filter(Boolean);
      const ep = items.find((x) => /TVEpisode|Episode/.test(String(x['@type'])));
      if (ep) {
        const series = ep.partOfSeries?.name ?? ep.partOfTVSeries?.name;
        const n = Number(ep.episodeNumber);
        const season = Number(ep.partOfSeason?.seasonNumber) || null;
        if (series && n > 0) return { series: String(series), season, episode: n };
      }
    } catch {
      /* json inválido */
    }
  }
  // 2) elementos da tela
  const seriesEl = doc.querySelector('a.show-title-link h4, [data-t="show-title-link"] h4, a.show-title-link, .current-media-parent-ref, .show-title-link');
  const h1 = doc.querySelector('h1.title, .erc-current-media-info h1, h1')?.textContent ?? '';
  const epFromH1 = h1.match(/^\s*(?:E|EP\.?|Ep\.?|Epis[óo]dio|Episode)\s*(\d+)/i);
  const seasonText = doc.querySelector('.erc-current-media-info, .current-media-wrapper')?.textContent ?? '';
  const seasonFromPage = (seasonText.match(/(?:Season|Temporada|Saison)\s*(\d+)/i) ?? [])[1];
  if (seriesEl?.textContent?.trim() && epFromH1)
    return { series: seriesEl.textContent.trim(), season: seasonFromPage ? Number(seasonFromPage) : null, episode: Number(epFromH1[1]) };
  // 3) título da aba: "Frieren Season 2 Episode 3 - ..." / "Assistir Frieren Episódio 3 - ..."
  const title = doc.title.replace(/\s*[-|–]\s*(?:Watch on |Assista na )?Crunchyroll.*$/i, '');
  let m = title.match(/^(?:Watch|Assista|Assistir)?\s*(.+?)\s+(?:Season|Temporada)\s+(\d+)\s+(?:Episode|Epis[óo]dio|Ep\.?|E)\s*(\d+)/i);
  if (m) return { series: m[1].trim(), season: Number(m[2]), episode: Number(m[3]) };
  m = title.match(/^(?:Watch|Assista|Assistir)?\s*(.+?)\s+(?:Episode|Epis[óo]dio|Ep\.?|E)\s*(\d+)\b/i);
  if (m) return { series: m[1].replace(/[\s:–-]+$/, '').trim(), season: null, episode: Number(m[2]) };
  return null;
}
const cleanTitle = () =>
  (document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title || '')
    .replace(/\s*[-|–]\s*Crunchyroll.*$/i, '')
    .replace(/^Watch\s+/i, '')
    .trim()
    .slice(0, 120);

const CR_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*crunchyroll\.com$/;

function shareDown(msg: { shiori: 'top-url'; href: string; title: string; meta: EpMeta | null }) {
  document.querySelectorAll('iframe').forEach((f) => {
    try {
      // só pros players do próprio Crunchyroll (anúncios e outros iframes não recebem nada)
      const origin = new URL(f.src, location.href).origin;
      if (CR_ORIGIN.test(origin)) f.contentWindow?.postMessage(msg, origin);
    } catch {
      /* frame sem acesso */
    }
  });
}
if (isTop) {
  const share = () => {
    topHref = location.href;
    topTitle = cleanTitle();
    topMeta = readMeta();
    shareDown({ shiori: 'top-url', href: topHref, title: topTitle, meta: topMeta });
  };
  setInterval(share, 1500);
  window.addEventListener('message', (e) => CR_ORIGIN.test(e.origin) && e.data?.shiori === 'need-url' && share());
} else {
  window.addEventListener('message', (e) => {
    if (e.data?.shiori !== 'top-url' || typeof e.data.href !== 'string') return;
    // só aceita de quem está acima na página e é do Crunchyroll
    if (e.source !== window.parent || !CR_ORIGIN.test(e.origin)) return;
    if (!/^https:\/\/([a-z0-9-]+\.)*crunchyroll\.com\//.test(e.data.href)) return;
    topHref = e.data.href;
    topTitle = String(e.data.title ?? '').slice(0, 120);
    const mm = e.data.meta;
    topMeta =
      mm && typeof mm.series === 'string' && Number(mm.episode) > 0
        ? { series: mm.series.slice(0, 200), season: Number(mm.season) || null, episode: Number(mm.episode) }
        : null;
    shareDown(e.data);
  });
  try {
    window.parent.postMessage({ shiori: 'need-url' }, '*');
  } catch {
    /* ignore */
  }
}

const episode = () => {
  const m = topHref.match(/crunchyroll\.com\/(?:[a-z-]+\/)?watch\/([A-Z0-9]+)(\/[^?#]*)?/i);
  if (!m) return { id: null, url: null };
  return { id: m[1].toUpperCase(), url: `https://www.crunchyroll.com/watch/${m[1]}${m[2] ?? ''}` };
};

/* ---------- o vídeo ---------- */

let video: HTMLVideoElement | null = null;
let boundAt = 0;

function pickVideo() {
  let best: HTMLVideoElement | null = null;
  let area = 40_000;
  document.querySelectorAll('video').forEach((v) => {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a >= area) {
      best = v;
      area = a;
    }
  });
  return best as HTMLVideoElement | null;
}

/* ---------- conversa com o background ---------- */

let port: chrome.runtime.Port | null = null;
let me: { id: string; name: string } | null = null;
let room: string | null = null;
let offset = 0;
let playback: Playback | null = null;

const post = (m: PortIn) => {
  try {
    port?.postMessage(m);
  } catch {
    port = null;
  }
};

function connect() {
  try {
    port = chrome.runtime.connect({ name: 'shiori-room' });
  } catch {
    return; // extensão foi atualizada/removida: esta aba precisa recarregar
  }
  port.onMessage.addListener(onPort);
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(() => video && connect(), 1500); // background reiniciou: reconecta
  });
  post({ type: 'hello' });
}
setInterval(() => port && post({ type: 'ping' }), 20_000);

const serverNow = () => Date.now() + offset;
const livePos = (p: Playback) =>
  p.playing ? p.position + Math.max(0, (serverNow() - new Date(p.updated_at).getTime()) / 1000) : p.position;

function onPort(m: PortOut) {
  switch (m.type) {
    case 'init':
      me = m.me;
      room = m.room;
      offset = m.offset;
      playback = m.playback;
      ui.show();
      ui.setRoom(room, me.name);
      ui.setMessages(m.messages);
      apply('init');
      break;
    case 'idle':
      room = null;
      ui.solo();
      break;
    case 'tracked':
      ui.tracked(m.token, m.completed ? `✓ ${m.title} completo! Movido pra Completos` : `✓ ${m.title} · episódio ${m.episode}${m.total ? `/${m.total}` : ''} marcado na sua lista`);
      break;
    case 'untracked':
      ui.toast(m.blocked ? `Ok, não vou mais marcar ${m.title}.` : `Desfeito: ${m.title} voltou como estava.`);
      break;
    case 'playback':
      if (m.playback.by_client === CLIENT) {
        playback = m.playback; // eco do meu comando
        break;
      }
      playback = m.playback;
      if (sameEpisode())
        ui.toast(`${m.playback.by_name ?? 'Alguém'} ${m.playback.playing ? 'deu play' : 'pausou'} em ${clock(m.playback.position)}`);
      apply('remote');
      break;
    case 'message':
      ui.addMessage(m.message);
      break;
    case 'unmessage':
      ui.removeMessage(m.id);
      break;
    case 'error':
      ui.toast(m.message, true);
      break;
  }
}

/* ---------- sincronia ---------- */

let suppressUntil = 0; // ignora os eventos que nós mesmos causamos
let lastInput = 0; // só manda comandos que vieram de clique/tecla da pessoa
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, (e) => {
    if (!ui.contains(e.target)) lastInput = Date.now();
  }, true)
);
const byUser = () => Date.now() - lastInput < 2000 || !!(navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive;

const sameEpisode = () => !playback?.episode_id || playback.episode_id === episode().id;

function apply(_why: string) {
  if (!video || !playback || !room) return;
  if (!playback.episode_id) return;
  if (!sameEpisode()) {
    ui.banner(playback);
    return;
  }
  ui.banner(null);
  const target = livePos(playback);
  suppressUntil = Date.now() + 1200;
  const tolerance = playback.playing ? 1.2 : 0.4; // pausado dá pra alinhar mais certinho
  if (Math.abs(video.currentTime - target) > tolerance && (!video.duration || target < video.duration)) video.currentTime = target;
  if (playback.playing && video.paused) {
    video.play().catch(() => ui.toast('Clique no play pra entrar no ritmo da sala ▶'));
  } else if (!playback.playing && !video.paused) video.pause();
}

let pushTimer = 0;
let lastLocalAt = 0; // comando meu ainda indo pro servidor: não corrige deriva
function onLocal(ev: Event) {
  if (!video || !room) return;
  if (Date.now() < suppressUntil) return;
  if (Date.now() - boundAt < 3000) return; // Crunchyroll pula pro ponto salvo ao carregar
  if (!byUser()) return;
  const ep = episode();
  // dar play quando a sala já está tocando o mesmo episódio = "entrar no ritmo", não mandar comando
  if (ev.type === 'play' && playback?.playing && playback.episode_id === ep.id) {
    apply('join');
    return;
  }
  lastLocalAt = Date.now();
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    if (!video) return;
    const state = {
      type: 'state' as const,
      client: CLIENT,
      playing: !video.paused,
      position: video.currentTime,
      episode_id: ep.id,
      episode_url: ep.url,
      title: topTitle || null,
    };
    playback = {
      code: room!,
      episode_url: ep.url,
      episode_id: ep.id,
      title: state.title,
      playing: state.playing,
      position: state.position,
      updated_at: new Date(serverNow()).toISOString(),
      updated_by: me?.id ?? null,
      by_name: me?.name ?? null,
      by_client: CLIENT,
    };
    ui.banner(null);
    post(state);
  }, 300);
}

/* ---------- lista automática ---------- */

let watched = 0; // segundos assistidos de verdade (sem contar pulos)
let lastT = -1;
let sentFor = '';
function onTime() {
  const v = video;
  if (!v || v.seeking) return;
  const t = v.currentTime;
  if (lastT >= 0 && !v.paused) {
    const d = t - lastT;
    if (d > 0 && d < 4 * Math.max(1, v.playbackRate)) watched += d;
  }
  lastT = t;
  const dur = v.duration;
  // vídeos curtos são anúncios/trailers
  if (!dur || !isFinite(dur) || dur < 120) return;
  const meta = topMeta ?? (isTop ? readMeta() : null);
  if (!meta) return;
  const key = `${episode().id ?? topHref}#${meta.episode}`;
  if (sentFor === key) return;
  // chegou perto do fim (créditos) e assistiu pelo menos 40% do episódio
  if (t >= dur * 0.85 && watched >= dur * 0.4) {
    sentFor = key;
    if (!port) connect();
    post({ type: 'watched', series: meta.series, season: meta.season, episode: meta.episode, key });
  }
}

function bind(v: HTMLVideoElement) {
  if (video === v) return;
  video?.removeEventListener('play', onLocal);
  video?.removeEventListener('pause', onLocal);
  video?.removeEventListener('seeked', onLocal);
  video?.removeEventListener('timeupdate', onTime);
  video = v;
  watched = 0;
  lastT = -1;
  v.addEventListener('timeupdate', onTime);
  boundAt = Date.now();
  v.addEventListener('play', onLocal);
  v.addEventListener('pause', onLocal);
  v.addEventListener('seeked', onLocal);
  if (!port) connect();
  else setTimeout(() => apply('rebind'), 1500);
}

// procura o vídeo sempre (o Crunchyroll troca o elemento ao mudar de episódio)
let lastEp: string | null = null;
setInterval(() => {
  const v = pickVideo();
  if (v) bind(v);
  const ep = episode().id;
  if (ep !== lastEp) {
    lastEp = ep;
    watched = 0;
    lastT = -1;
    boundAt = Date.now();
    setTimeout(() => apply('episode'), 1500);
  }
}, 1000);

// correção de deriva: se alguém ficou pra trás (buffer), alinha
setInterval(() => {
  if (!video || !playback?.playing || !sameEpisode() || video.paused || video.seeking) return;
  if (Date.now() < suppressUntil || Date.now() - lastLocalAt < 2500) return;
  if (Math.abs(video.currentTime - livePos(playback)) > 2.5) {
    suppressUntil = Date.now() + 1200;
    video.currentTime = livePos(playback);
  }
}, 2000);

function clock(s: number) {
  const v = Math.max(0, Math.floor(s));
  const h = Math.floor(v / 3600);
  const mm = String(Math.floor((v % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(v % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* ---------- interface por cima do vídeo (Shadow DOM, não mexe no CSS do site) ---------- */

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
.bubble { pointer-events: auto; position: absolute; right: 18px; bottom: 90px; width: 46px; height: 46px; border-radius: 50%;
  background: #cbb2ff; color: #1a1240; border: 3px solid #000; font-size: 20px; font-weight: 900; cursor: pointer;
  box-shadow: 3px 3px 0 #000; display: grid; place-items: center; opacity: .9; }
.bubble:hover { opacity: 1; transform: translateY(-1px); }
.badge { position: absolute; top: -6px; right: -6px; background: #ff5e8a; color: #fff; border: 2px solid #000; border-radius: 999px;
  font-size: 11px; padding: 0 5px; font-weight: 900; }
.panel { pointer-events: auto; position: absolute; right: 18px; bottom: 146px; width: 300px; max-width: calc(100vw - 36px);
  height: min(60vh, 460px); display: none; flex-direction: column; background: rgba(20,16,40,.92); color: #f3efff;
  border: 3px solid #000; border-radius: 16px; box-shadow: 4px 4px 0 #000; overflow: hidden; backdrop-filter: blur(6px); }
.panel.open { display: flex; }
.head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 2px solid #000; background: rgba(203,178,255,.15); font-size: 13px; font-weight: 800; }
.head .dot { width: 8px; height: 8px; border-radius: 50%; background: #7cff8a; }
.head .code { margin-left: auto; letter-spacing: .2em; color: #cbb2ff; }
.head button { all: unset; cursor: pointer; padding: 0 4px; font-size: 16px; color: #aaa; }
.list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.msg { max-width: 88%; padding: 6px 10px; border-radius: 14px; border: 2px solid #000; background: rgba(255,255,255,.08); font-size: 13px; line-height: 1.35; word-break: break-word; white-space: pre-wrap; }
.msg.me { align-self: flex-end; background: #cbb2ff; color: #1a1240; }
.msg b { display: block; font-size: 11px; color: #cbb2ff; }
.empty { margin: auto; color: #aaa; font-size: 13px; }
form { display: flex; gap: 6px; padding: 8px; border-top: 2px solid #000; }
input { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 2px solid #000; background: rgba(0,0,0,.35); color: #fff; font-size: 13px; outline: none; }
input:focus { border-color: #cbb2ff; }
form button { padding: 0 12px; border-radius: 10px; border: 2px solid #000; background: #cbb2ff; color: #1a1240; font-weight: 900; cursor: pointer; }
.toasts { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; }
.toast { background: rgba(20,16,40,.92); color: #fff; border: 2px solid #000; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; box-shadow: 2px 2px 0 #000; animation: in .2s ease-out; }
.toast.err { background: #b3261e; }
.toast.track { pointer-events: auto; border-radius: 16px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; max-width: 92vw; background: rgba(20,16,44,.95); border-color: #7cff8a; }
.toast.track button { all: unset; cursor: pointer; font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 999px; border: 2px solid #000; background: #cbb2ff; color: #1a1240; }
.toast.track button.ghost { background: transparent; color: #cfc8f5; border-color: #554d80; }
.solo .bubble, .solo .panel { display: none !important; }
.banner { pointer-events: auto; position: absolute; top: 60px; left: 50%; transform: translateX(-50%); display: none; gap: 10px; align-items: center;
  background: #ffe066; color: #1a1240; border: 3px solid #000; border-radius: 14px; padding: 8px 12px; font-size: 13px; font-weight: 800; box-shadow: 3px 3px 0 #000; max-width: 90vw; }
.banner.on { display: flex; }
.banner a { background: #1a1240; color: #fff; padding: 5px 10px; border-radius: 8px; text-decoration: none; white-space: nowrap; }
@keyframes in { from { opacity: 0; transform: translateY(-6px); } }
`;

const ui = (() => {
  let host: HTMLDivElement | null = null;
  let root: ShadowRoot;
  let panel: HTMLDivElement, list: HTMLDivElement, badge: HTMLSpanElement, toasts: HTMLDivElement, bannerEl: HTMLDivElement, codeEl: HTMLSpanElement, input: HTMLInputElement;
  let unread = 0;
  const msgs: ChatMsg[] = [];

  function build() {
    host = document.createElement('div');
    host.id = 'shiori-watch-party';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap">
        <div class="toasts"></div>
        <div class="banner"><span class="btxt"></span><a target="_top" class="bgo">Ir pro episódio</a></div>
        <div class="panel">
          <div class="head"><span class="dot"></span><span class="who">Shiori</span><span class="code"></span><button class="close" title="Fechar">×</button></div>
          <div class="list"><div class="empty">Diga oi pra galera 👋</div></div>
          <form><input maxlength="500" placeholder="Mensagem…" /><button>➤</button></form>
        </div>
        <button class="bubble" title="Chat da sala (Shiori)">栞<span class="badge" hidden>0</span></button>
      </div>`;
    panel = root.querySelector('.panel')!;
    list = root.querySelector('.list')!;
    badge = root.querySelector('.badge')!;
    toasts = root.querySelector('.toasts')!;
    bannerEl = root.querySelector('.banner')!;
    codeEl = root.querySelector('.code')!;
    input = root.querySelector('input')!;
    root.querySelector('.bubble')!.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        unread = 0;
        badge.hidden = true;
        list.scrollTop = list.scrollHeight;
        input.focus();
      }
    });
    root.querySelector('.close')!.addEventListener('click', () => panel.classList.remove('open'));
    root.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      post({ type: 'chat', body });
      input.value = '';
    });
    // não deixa o player pegar as teclas (espaço pausaria o vídeo)
    for (const ev of ['keydown', 'keyup', 'keypress']) host.addEventListener(ev, (e) => e.stopPropagation());
    mount();
    document.addEventListener('fullscreenchange', mount);
  }

  function mount() {
    if (!host) return;
    const fs = document.fullscreenElement;
    const parent = fs && fs.tagName !== 'IFRAME' && fs.tagName !== 'VIDEO' ? fs : document.body || document.documentElement;
    if (host.parentElement !== parent) parent.appendChild(host);
  }

  function render(m: ChatMsg) {
    const el = document.createElement('div');
    el.className = 'msg' + (m.user_id === me?.id ? ' me' : '');
    el.dataset.id = String(m.id);
    if (m.user_id !== me?.id) {
      const b = document.createElement('b');
      b.textContent = m.name;
      el.appendChild(b);
    }
    el.appendChild(document.createTextNode(m.body));
    return el;
  }

  return {
    contains: (t: EventTarget | null) => !!host && t instanceof Node && (t === host || host.contains(t)),
    show() {
      if (!host) build();
      host!.style.display = '';
      root.querySelector('.wrap')!.classList.remove('solo');
    },
    /** sem sala: só avisos (lista automática), sem o botão do chat */
    solo() {
      if (!host) build();
      host!.style.display = '';
      root.querySelector('.wrap')!.classList.add('solo');
    },
    tracked(token: string, text: string) {
      if (!host) this.solo();
      const el = document.createElement('div');
      el.className = 'toast track';
      const span = document.createElement('span');
      span.textContent = text;
      const undo = document.createElement('button');
      undo.textContent = 'Desfazer';
      undo.onclick = () => {
        post({ type: 'untrack', token });
        el.remove();
      };
      const block = document.createElement('button');
      block.className = 'ghost';
      block.textContent = 'Anime errado / não marcar este';
      block.onclick = () => {
        post({ type: 'block', token });
        el.remove();
      };
      el.append(span, undo, block);
      toasts.appendChild(el);
      setTimeout(() => el.remove(), 12_000);
    },
    hide() {
      if (host) host.style.display = 'none';
    },
    setRoom(code: string, name: string) {
      codeEl.textContent = code;
      root.querySelector('.who')!.textContent = name;
    },
    setMessages(all: ChatMsg[]) {
      msgs.splice(0, msgs.length, ...all);
      list.replaceChildren(...(all.length ? all.map(render) : [Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Diga oi pra galera 👋' })]));
      list.scrollTop = list.scrollHeight;
    },
    addMessage(m: ChatMsg) {
      if (msgs.some((x) => x.id === m.id)) return;
      msgs.push(m);
      list.querySelector('.empty')?.remove();
      list.appendChild(render(m));
      while (list.children.length > 150) list.firstElementChild?.remove();
      list.scrollTop = list.scrollHeight;
      if (!panel.classList.contains('open') && m.user_id !== me?.id) {
        unread++;
        badge.textContent = String(unread);
        badge.hidden = false;
        this.toast(`${m.name}: ${m.body.slice(0, 80)}`);
      }
    },
    removeMessage(id: number) {
      list.querySelector(`[data-id="${id}"]`)?.remove();
    },
    toast(text: string, err = false) {
      if (!host) return;
      const el = document.createElement('div');
      el.className = 'toast' + (err ? ' err' : '');
      el.textContent = text;
      toasts.appendChild(el);
      while (toasts.children.length > 3) toasts.firstElementChild?.remove();
      setTimeout(() => el.remove(), 3800);
    },
    banner(p: Playback | null) {
      if (!host) return;
      if (!p || !p.episode_url) return bannerEl.classList.remove('on');
      root.querySelector('.btxt')!.textContent = `A sala está em outro episódio${p.title ? `: ${p.title}` : ''}`;
      (root.querySelector('.bgo') as HTMLAnchorElement).href = /^https:\/\/([a-z0-9-]+\.)*crunchyroll\.com\//i.test(p.episode_url) ? p.episode_url : '#';
      bannerEl.classList.add('on');
    },
  };
})();
