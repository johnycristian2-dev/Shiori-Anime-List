import { create } from 'zustand';

export type SyncState = 'off' | 'idle' | 'syncing' | 'ok' | 'error';

interface Channel {
  state: SyncState;
  at?: number;
  msg?: string;
}

interface SyncStore {
  cloud: Channel;
  anilist: Channel;
  set: (ch: 'cloud' | 'anilist', v: Channel) => void;
}

/** Estado (só em memória) dos sincronizadores, pra mostrar o ícone de nuvem no topo. */
export const useSyncStatus = create<SyncStore>()((set) => ({
  cloud: { state: 'off' },
  anilist: { state: 'off' },
  set: (ch, v) => set({ [ch]: v } as Partial<SyncStore>),
}));
