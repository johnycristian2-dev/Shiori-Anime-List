/**
 * Background da extensão: é o único lugar que fala com o Supabase (evita a CSP do Crunchyroll).
 * Cada aba do Crunchyroll abre uma porta "shiori-room"; aqui a gente entra na sala, escuta o
 * player/chat em tempo real e repassa tudo pras abas.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { ChatMsg, PortIn, PortOut, Playback, Req, Status } from './protocol';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;
declare const __VERSION__: string;

const store = chrome.storage.local;
const K_ROOM = 'shiori-room';
const K_NAME = 'shiori-name';

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

async function myName(userId: string) {
  const { name } = await getConfig();
  if (name) return name;
  const { data } = await sb.from('profiles').select('username').eq('id', userId).maybeSingle();
  return ((data?.username as string | undefined) ?? 'Otaku').slice(0, 24);
}

async function status(): Promise<Status> {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user ?? null;
  const cfg = await getConfig();
  return {
    version: __VERSION__,
    loggedIn: !!user,
    email: user?.email ?? null,
    name: user ? await myName(user.id) : cfg.name,
    room: cfg.room,
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
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'party_messages' }, (p) =>
      broadcast({ type: 'unmessage', id: (p.old as ChatMsg).id })
    )
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

async function onPortMessage(port: chrome.runtime.Port, m: PortIn) {
  if (m.type === 'ping') return send(port, { type: 'pong' });
  if (m.type === 'hello') return hello(port);
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
      ports.forEach((p) => hello(p).catch(() => {}));
      return status();
    }
    case 'logout':
      await sb.auth.signOut();
      await store.remove([K_ROOM]);
      unsubscribe();
      broadcast({ type: 'idle', reason: 'login' });
      return status();
    case 'setRoom': {
      const code = req.code?.trim().toUpperCase() || null;
      if (code && !/^[A-Z0-9]{6}$/.test(code)) throw new Error('Código de sala inválido.');
      if (code) await store.set({ [K_ROOM]: code });
      else await store.remove(K_ROOM);
      if (req.name?.trim()) await store.set({ [K_NAME]: req.name.trim().slice(0, 24) });
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
