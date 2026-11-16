import { Heart, Minus, Plus, Trash2 } from 'lucide-react';
import type { ListEntry, ListStatus } from '../types';
import { STATUS_META, STATUS_ORDER, useList } from '../store/list';
import { useUI } from '../store/ui';

import { t } from '../lib/i18n';

export default function EntryEditor({ entry, compact = false }: { entry: ListEntry; compact?: boolean }) {
  const update = useList((s) => s.update);
  const remove = useList((s) => s.remove);
  const toast = useUI((s) => s.toast);
  const toggleFavorite = useList((s) => s.toggleFavorite);
  const id = entry.mediaId;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'sm:gap-3'}`}>
      <select
        value={entry.status}
        onChange={(e) => update(id, { status: e.target.value as ListStatus })}
        className="field !w-auto !py-1.5 text-sm"
        style={{ borderColor: STATUS_META[entry.status].color }}
        aria-label={t('Status')}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-xl border-2 border-line bg-panel-2 px-1 py-0.5">
        <button className="rounded-lg p-1 hover:bg-panel" onClick={() => update(id, { progress: entry.progress - 1 })} aria-label={t('Menos um episódio')}>
          <Minus size={14} />
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-extrabold tabular-nums">
          {entry.progress}
          <span className="text-muted">/{entry.episodes ?? '?'}</span>{' '}{t('ep')}
        </span>
        <button className="rounded-lg p-1 hover:bg-panel" onClick={() => update(id, { progress: entry.progress + 1 })} aria-label={t('Mais um episódio')}>
          <Plus size={14} />
        </button>
      </div>

      <select
        value={entry.score}
        onChange={(e) => update(id, { score: Number(e.target.value) })}
        className="field !w-auto !py-1.5 text-sm"
        aria-label={t('Nota')}
      >
        <option value={0}>{t('Nota —')}</option>
        {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
          <option key={n} value={n}>
            ★ {n}
          </option>
        ))}
      </select>

      <button
        className={`rounded-lg p-2 hover:bg-panel-2 ${entry.favorite ? 'text-pink' : 'text-muted'}`}
        onClick={() => toggleFavorite(id)}
        aria-label={entry.favorite ? t('Remover dos favoritos') : t('Favoritar')}
      >
        <Heart size={16} fill={entry.favorite ? 'currentColor' : 'none'} />
      </button>
      <button
        className="rounded-lg p-2 text-red-400 hover:bg-panel-2"
        onClick={() => {
          remove(id);
          toast(t('Removido da lista'), 'info');
        }}
        aria-label={t('Remover')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
