import type { CustomList, ListEntry, SyncDoc } from '../types';

export const HISTORY_MAX = 4000;

/**
 * Mescla dois estados da lista (ex.: este aparelho × nuvem).
 * Regra: em cada anime vence a versão com updatedAt mais recente;
 * uma remoção vence se aconteceu depois da última edição.
 */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const deleted: Record<number, number> = { ...(a.deleted ?? {}) };
  for (const [k, v] of Object.entries(b.deleted ?? {})) deleted[Number(k)] = Math.max(deleted[Number(k)] ?? 0, v);

  const entries: Record<number, ListEntry> = {};
  const ids = new Set([...Object.keys(a.entries ?? {}), ...Object.keys(b.entries ?? {})].map(Number));
  for (const id of ids) {
    const ea = a.entries?.[id];
    const eb = b.entries?.[id];
    const pick = !ea ? eb! : !eb ? ea : eb.updatedAt > ea.updatedAt ? eb : ea;
    if (deleted[id] && deleted[id] >= pick.updatedAt) continue;
    entries[id] = pick;
  }

  const lists: Record<string, CustomList> = {};
  const listIds = new Set([...Object.keys(a.lists ?? {}), ...Object.keys(b.lists ?? {})]);
  for (const id of listIds) {
    const la = a.lists?.[id];
    const lb = b.lists?.[id];
    lists[id] = !la ? lb! : !lb ? la : lb.updatedAt > la.updatedAt ? lb : la;
  }

  const skipped = [...new Set([...(a.skipped ?? []), ...(b.skipped ?? [])])].filter((id) => !entries[id]);

  // Histórico: união sem repetidos, mais recentes por último, limitado
  const seen = new Set<string>();
  const history = [...(a.history ?? []), ...(b.history ?? [])]
    .filter((h) => {
      const k = `${h.m}|${h.t}|${h.at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.at - y.at)
    .slice(-HISTORY_MAX);

  // Gacha: vale o aparelho que girou mais vezes
  const gacha = !a.gacha ? b.gacha : !b.gacha ? a.gacha : b.gacha.pulls > a.gacha.pulls ? b.gacha : a.gacha;

  return { entries, deleted, lists, skipped, history, ...(gacha ? { gacha } : {}) };
}

/** Comparação barata pra evitar uploads repetidos. */
export function docSignature(d: SyncDoc) {
  const e = Object.values(d.entries)
    .map((x) => `${x.mediaId}:${x.updatedAt}`)
    .sort()
    .join(',');
  const del = Object.entries(d.deleted)
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join(',');
  const l = Object.values(d.lists)
    .map((x) => `${x.id}:${x.updatedAt}`)
    .sort()
    .join(',');
  const h = d.history?.length ? `${d.history.length}:${d.history[d.history.length - 1].at}` : '0';
  return `${e}|${del}|${l}|${[...d.skipped].sort().join(',')}|${h}|${d.gacha?.pulls ?? 0}`;
}
