import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Viewer {
  id: number;
  name: string;
  avatar?: { medium: string };
}

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  viewer: Viewer | null;
  /** Enviar cada mudança pro AniList automaticamente */
  autoSync: boolean;
  setAutoSync: (v: boolean) => void;
  setToken: (token: string, expiresAt: number) => void;
  setViewer: (v: Viewer | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      viewer: null,
      autoSync: true,
      setAutoSync: (autoSync) => set({ autoSync }),
      setToken: (token, expiresAt) => set({ token, expiresAt }),
      setViewer: (viewer) => set({ viewer }),
      logout: () => set({ token: null, expiresAt: null, viewer: null }),
    }),
    { name: 'shiori-auth' },
  ),
);

export const CLIENT_ID = import.meta.env.VITE_ANILIST_CLIENT_ID as string | undefined;

export const authorizeUrl = () =>
  `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID ?? '')}&response_type=token`;

/**
 * O AniList devolve o token no hash: #access_token=...&expires_in=...
 * Como usamos HashRouter, capturamos isso antes do app montar.
 */
export function captureOAuthToken() {
  const h = window.location.hash;
  if (!h.startsWith('#access_token=')) return;
  const p = new URLSearchParams(h.slice(1));
  const token = p.get('access_token');
  const exp = Number(p.get('expires_in') || 0);
  if (token) useAuth.getState().setToken(token, exp ? Date.now() + exp * 1000 : Date.now() + 365 * 864e5);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/sync`);
}

export function validToken() {
  const { token, expiresAt } = useAuth.getState();
  return token && (!expiresAt || expiresAt > Date.now()) ? token : null;
}
