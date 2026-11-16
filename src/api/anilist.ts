import { t } from '../lib/i18n';
/**
 * Cliente mínimo da API GraphQL do AniList (https://docs.anilist.co).
 * Pública, gratuita e sem chave. Tem limite de requisições por minuto,
 * então tratamos o 429 esperando e tentando de novo.
 */
const ENDPOINT = 'https://graphql.anilist.co';

export class AniListError extends Error {
  status?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clean(vars: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(vars).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { token?: string | null; signal?: AbortSignal } = {},
  attempt = 0,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: JSON.stringify({ query, variables: clean(variables) }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const err = new AniListError(t('Sem conexão com o AniList. Verifique sua internet.'));
    throw err;
  }

  if (res.status === 429 && attempt < 3) {
    const retry = Number(res.headers.get('Retry-After')) || 10;
    await sleep(retry * 1000 + 300);
    return gql<T>(query, variables, opts, attempt + 1);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    const msg: string = json?.errors?.[0]?.message ?? `Erro ${res.status} no AniList`;
    const err = new AniListError(res.status === 429 ? t('Muitas requisições — aguarde um pouco.') : msg);
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}
