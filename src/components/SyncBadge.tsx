import { Link } from 'react-router-dom';
import { AlertTriangle, Cloud, CloudCheck, LoaderCircle } from 'lucide-react';
import { useSyncStatus, type SyncState } from '../store/sync';

const rank: Record<SyncState, number> = { off: 0, idle: 1, ok: 2, syncing: 3, error: 4 };

/** Ícone de nuvem no topo: mostra se a lista está sincronizada (nuvem e/ou AniList). */
export default function SyncBadge() {
  const cloud = useSyncStatus((s) => s.cloud);
  const anilist = useSyncStatus((s) => s.anilist);
  const worst = rank[cloud.state] >= rank[anilist.state] ? cloud : anilist;
  if (worst.state === 'off') return null;

  const parts = [
    cloud.state !== 'off' && `Nuvem: ${cloud.msg ?? cloud.state}`,
    anilist.state !== 'off' && `AniList: ${anilist.msg ?? anilist.state}`,
  ].filter(Boolean);

  return (
    <Link to="/sync" className="manga-btn ghost !p-2" title={parts.join('\n')} aria-label={parts.join('. ')}>
      {worst.state === 'syncing' ? (
        <LoaderCircle size={18} className="animate-spin text-cyan" />
      ) : worst.state === 'error' ? (
        <AlertTriangle size={18} className="text-red-400" />
      ) : worst.state === 'ok' ? (
        <CloudCheck size={18} className="text-[#7cff8a]" />
      ) : (
        <Cloud size={18} />
      )}
    </Link>
  );
}
