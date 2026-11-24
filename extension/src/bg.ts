/**
 * Background da extensão: é o único lugar que fala com o Supabase (evita a CSP do Crunchyroll).
 * Cada aba do Crunchyroll abre uma porta "shiori-room"; aqui a gente entra na sala, escuta o
 * player/chat em tempo real e repassa tudo pras abas.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { ChatMsg, PortIn, PortOut, Playback, Req, Status } from './protocol';
import { cleanSeries, normName, placeEpisode, resolveEpisode, toEntry, type AniMedia } from './anilist';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;
declare const __VERSION__: string;

const store = chrome.storage.local;
const K_ROOM = 'shiori-room';
const K_NAME = 'shiori-name';
const K_AUTO = 'shiori-autotrack';
const K_LAST = 'shiori-last-tracked';
const K_MAP = 'shiori-series-map';
const K_BLOCK = 'shiori-blocked-series';

const sb: SupabaseClient = createClient(__SUPABASE_URL__, __SUPABASE_KEY__, {
  auth: {
    storageKey: 'shiori-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: async (k) => ((await store.get(k))[k] as string | undefined) ?? null,
      setItem: async (k, v) => store.set({ [k]: v }),
      removeItem: async (k) => store.remove(k),
    },
  },
});

const ports = new Set<chrome.runtime.Port>();
let channel: RealtimeChannel | null = null;
let channelRoom: string | null = null;

const send = (p: chrome.runtime.Port, m: PortOut) => {
  try {
    p.postMessage(m);
  } catch {
    ports.delete(p);
  }
};
const broadcast = (m: PortOut) => ports.forEach((p) => send(p, m));

async function getConfig() {
  const r = await store.get([K_ROOM, K_NAME]);
  return { room: (r[K_ROOM] as string | undefined) ?? null, name: (r[K_NAME] as string | undefined) ?? null };
}

// nome do chat fica em memória pra não ler storage/perfil a cada mensagem;
// zera ao trocar de nome ou de conta
let cachedName: { userId: string; name: string } | null = null;

async function myName(userId: string) {
  if (cachedName?.userId === userId) return cachedName.name;
  const { name: saved } = await getConfig();
  if (saved) {
    cachedName = { userId, name: saved };
    return saved;
  }
  const { data, error } = await sb.from('profiles').select('username').eq('id', userId).maybeSingle();
  const name = ((data?.username as string | undefined) ?? 'Otaku').slice(0, 24);
  // se a consulta falhou, não guarda o "Otaku" padrão: tenta de novo na próxima
  if (!error) cachedName = { userId, name };
  return name;
}

async function status(): Promise<Status> {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user ?? null;
  const cfg = await getConfig();
  const extra = await store.get([K_AUTO, K_LAST]);
  return {
    version: __VERSION__,
    loggedIn: !!user,
    email: user?.email ?? null,
    name: user ? await myName(user.id) : cfg.name,
    room: cfg.room,
    autoTrack: extra[K_AUTO] !== false,
    lastTracked: (extra[K_LAST] as Status['lastTracked']) ?? null,
  };
}

function friendly(e: { message?: string; code?: string } | null) {
  const m = e?.message ?? '';
  if (/hate_terms/.test(m)) return 'Sua mensagem tem termos ofensivos e não foi enviada.';
  if (/slow_down/.test(m)) return 'Devagar! Espere alguns segundos.';
  if (/row-level security|violates/i.test(m)) return 'Você não está nessa sala (entre pelo site primeiro).';
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
  return m || 'Algo deu errado.';
}

async function serverOffset() {
  const t0 = Date.now();
  const { data, error } = await sb.rpc('server_now');
  const t1 = Date.now();
  if (error || !data) return 0;
  return new Date(data as string).getTime() - (t0 + t1) / 2;
}

async function joinRoom(code: string, userId: string, name: string) {
  const { data: room, error } = await sb.from('party_rooms').select('code').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!room) throw new Error(`A sala ${code} não existe mais.`);
  const { error: e2 } = await sb.from('party_members').insert({ code, user_id: userId, name });
  if (e2 && e2.code !== '23505') throw e2;
}

function subscribe(code: string) {
  if (channel && channelRoom === code) return;
  if (channel) sb.removeChannel(channel);
  channelRoom = code;
  const filter = `code=eq.${code}`;
  channel = sb
    .channel(`ext:${code}:${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'party_playback', filter }, (p) => {
      if ((p.new as Playback)?.code) broadcast({ type: 'playback', playback: p.new as Playback });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter }, (p) =>
      broadcast({ type: 'message', message: p.new as ChatMsg })
    )
    // o Realtime não aceita filtro em DELETE, então chegam remoções de outras salas;
    // se a linha antiga trouxer o código (REPLICA IDENTITY FULL), descarta as de fora
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'party_messages' }, (p) => {
      const old = p.old as Partial<ChatMsg>;
      if (old.id === undefined || (old.code && old.code !== channelRoom)) return;
      broadcast({ type: 'unmessage', id: old.id });
    })
    .subscribe((s) => {
      // reconectou depois de cair: manda o estado atual de novo
      if (s === 'SUBSCRIBED') ports.forEach((port) => hello(port).catch(() => {}));
    });
}

function unsubscribe() {
  if (channel) sb.removeChannel(channel);
  channel = null;
  channelRoom = null;
}

async function hello(port: chrome.runtime.Port) {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return send(port, { type: 'idle', reason: 'login' });
  const { room } = await getConfig();
  if (!room) return send(port, { type: 'idle', reason: 'room' });
  const name = await myName(user.id);
  await joinRoom(room, user.id, name);
  subscribe(room);
  const [pb, msgs, offset] = await Promise.all([
    sb.from('party_playback').select('*').eq('code', room).maybeSingle(),
    sb.from('party_messages').select('*').eq('code', room).order('created_at', { ascending: false }).limit(40),
    serverOffset(),
  ]);
  send(port, {
    type: 'init',
    me: { id: user.id, name },
    room,
    offset,
    playback: (pb.data as Playback | null) ?? null,
    messages: ((msgs.data ?? []) as ChatMsg[]).reverse(),
  });
}

/* ---------- lista automática ---------- */

type Undo = { entry: ReturnType<typeof toEntry>; prev: Record<string, unknown> | null; title: string; series: string };
const undos = new Map<string, Undo>();
const doneKeys = new Set<string>(); // episódio já marcado nesta sessão do navegador

async function chainFor(series: string, season: number | null, episode: number) {
  const key = normName(cleanSeries(series));
  const saved = ((await store.get(K_MAP))[K_MAP] ?? {}) as Record<string, { chain: AniMedia[]; at: number }>;
  const hit = saved[key];
  // cache de 3 dias (episódios novos mudam a contagem das temporadas em andamento)
  if (hit && Date.now() - hit.at < 3 * 86_400_000) {
    const placed = placeEpisode(hit.chain, season, episode);
    if (placed) return placed;
  }
  const r = await resolveEpisode(series, season, episode);
  if (!r) return null;
  const slim = r.chain.map((c) => ({ ...c, relations: { edges: [] } }));
  const keys = Object.keys(saved);
  if (keys.length > 60) delete saved[keys[0]];
  saved[key] = { chain: slim, at: Date.now() };
  await store.set({ [K_MAP]: saved });
  return { media: r.media, episode: r.episode };
}

async function onWatched(port: chrome.runtime.Port, m: Extract<PortIn, { type: 'watched' }>) {
  const { data } = await sb.auth.getSession();
  if (!data.session?.user) return;
  const cfg = await store.get([K_AUTO, K_BLOCK]);
  if (cfg[K_AUTO] === false) return;
  const blocked = (cfg[K_BLOCK] ?? []) as string[];
  if (blocked.includes(normName(cleanSeries(m.series)))) return;
  if (doneKeys.has(m.key)) return;
  doneKeys.add(m.key);
  const placed = await chainFor(m.series, m.season, m.episode);
  if (!placed) return send(port, { type: 'error', message: `Não achei "${cleanSeries(m.series)}" no AniList pra atualizar sua lista.` });
  const entry = toEntry(placed.media);
  const { data: res, error } = await sb.rpc('scrobble_episode', { p_entry: entry, p_episode: placed.episode });
  if (error) {
    doneKeys.delete(m.key);
    return send(port, { type: 'error', message: friendly(error) });
  }
  const r = res as { changed: boolean; entry: { progress: number; status: string; episodes: number | null }; prev: Record<string, unknown> | null };
  if (!r.changed) return;
  const token = Math.random().toString(36).slice(2, 10);
  const title = placed.media.title.english ?? placed.media.title.romaji ?? entry.title;
  undos.set(token, { entry, prev: r.prev, title, series: m.series });
  await store.set({ [K_LAST]: { title, episode: r.entry.progress, at: Date.now() } });
  send(port, { type: 'tracked', token, title, episode: r.entry.progress, total: placed.media.episodes, completed: r.entry.status === 'COMPLETED' });
}

async function onUntrack(port: chrome.runtime.Port, token: string, block: boolean) {
  const u = undos.get(token);
  if (!u) return;
  undos.delete(token);
  const { error } = await sb.rpc('scrobble_episode', { p_entry: u.entry, p_episode: 0, p_undo: u.prev ?? {} });
  if (error) return send(port, { type: 'error', message: friendly(error) });
  if (block) {
    const list = (((await store.get(K_BLOCK))[K_BLOCK] ?? []) as string[]).concat(normName(cleanSeries(u.series)));
    await store.set({ [K_BLOCK]: [...new Set(list)].slice(-200) });
  }
  send(port, { type: 'untracked', title: u.title, blocked: block });
}

async function onPortMessage(port: chrome.runtime.Port, m: PortIn) {
  if (m.type === 'ping') return send(port, { type: 'pong' });
  if (m.type === 'hello') return hello(port);
  if (m.type === 'watched') return onWatched(port, m);
  if (m.type === 'untrack') return onUntrack(port, m.token, false);
  if (m.type === 'block') return onUntrack(port, m.token, true);
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  const { room } = await getConfig();
  if (!user || !room) return send(port, { type: 'idle', reason: user ? 'room' : 'login' });
  const name = await myName(user.id);
  if (m.type === 'chat') {
    const body = m.body.trim().slice(0, 500);
    if (!body) return;
    const { error } = await sb.from('party_messages').insert({ code: room, user_id: user.id, name, body });
    if (error) send(port, { type: 'error', message: friendly(error) });
  } else if (m.type === 'state') {
    const { error } = await sb.from('party_playback').upsert({
      code: room,
      playing: m.playing,
      position: Math.max(0, Math.min(86399, m.position)),
      episode_id: m.episode_id,
      episode_url: m.episode_url,
      title: m.title,
      updated_by: user.id,
      by_name: name,
      by_client: m.client,
    });
    if (error) send(port, { type: 'error', message: friendly(error) });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'shiori-room') return;
  ports.add(port);
  port.onMessage.addListener((m: PortIn) =>
    onPortMessage(port, m).catch((e) => send(port, { type: 'error', message: friendly(e) }))
  );
  port.onDisconnect.addListener(() => {
    ports.delete(port);
    if (!ports.size) unsubscribe();
  });
});

async function handle(req: Req): Promise<unknown> {
  switch (req.type) {
    case 'status':
      return status();
    case 'login': {
      const { error } = await sb.auth.signInWithPassword({ email: req.email.trim(), password: req.password });
      if (error) throw new Error(friendly(error));
      cachedName = null;
      ports.forEach((p) => hello(p).catch(() => {}));
      return status();
    }
    case 'logout':
      await sb.auth.signOut();
      await store.remove([K_ROOM]);
      cachedName = null;
      unsubscribe();
      broadcast({ type: 'idle', reason: 'login' });
      return status();
    case 'setAutoTrack':
      await store.set({ [K_AUTO]: req.on });
      return status();
    case 'setRoom': {
      const code = req.code?.trim().toUpperCase() || null;
      if (code && !/^[A-Z0-9]{6}$/.test(code)) throw new Error('Código de sala inválido.');
      if (code) await store.set({ [K_ROOM]: code });
      else await store.remove(K_ROOM);
      if (req.name?.trim()) {
        await store.set({ [K_NAME]: req.name.trim().slice(0, 24) });
        cachedName = null;
      }
      unsubscribe();
      if (code) ports.forEach((p) => hello(p).catch((e) => send(p, { type: 'error', message: friendly(e) })));
      else broadcast({ type: 'idle', reason: 'room' });
      return status();
    }
  }
}

chrome.runtime.onMessage.addListener((req: Req, _sender, reply) => {
  handle(req)
    .then((data) => reply({ ok: true, data }))
    .catch((e) => reply({ ok: false, error: friendly(e) }));
  return true;
});
