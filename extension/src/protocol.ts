/** Mensagens trocadas entre o Crunchyroll (content script), o popup, o site e o background. */

export interface Playback {
  code: string;
  episode_url: string | null;
  episode_id: string | null;
  title: string | null;
  playing: boolean;
  position: number;
  updated_at: string;
  updated_by: string | null;
  by_name: string | null;
  by_client: string | null;
}
export interface ChatMsg {
  id: number;
  code: string;
  user_id: string;
  name: string;
  body: string;
  kind: 'msg' | 'sys';
  created_at: string;
}
export interface Status {
  version: string;
  loggedIn: boolean;
  email: string | null;
  name: string | null;
  room: string | null;
}

/** content script → background (pela porta "shiori-room") */
export type PortIn =
  | { type: 'hello' }
  | { type: 'ping' }
  | { type: 'chat'; body: string }
  | { type: 'state'; client: string; playing: boolean; position: number; episode_id: string | null; episode_url: string | null; title: string | null };

/** background → content script */
export type PortOut =
  | { type: 'init'; me: { id: string; name: string }; room: string; offset: number; playback: Playback | null; messages: ChatMsg[] }
  | { type: 'idle'; reason: 'login' | 'room' }
  | { type: 'playback'; playback: Playback }
  | { type: 'message'; message: ChatMsg }
  | { type: 'unmessage'; id: number }
  | { type: 'error'; message: string }
  | { type: 'pong' };

/** popup / site → background (runtime.sendMessage) */
export type Req =
  | { type: 'status' }
  | { type: 'login'; email: string; password: string }
  | { type: 'logout' }
  | { type: 'setRoom'; code: string | null; name?: string };
