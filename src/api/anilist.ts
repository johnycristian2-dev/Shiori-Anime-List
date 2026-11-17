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

// No máximo 4 requisições ao mesmo tempo: ajuda a não estourar o limite por minuto do AniList
const MAX_PARALLEL = 4;
let running = 0;
const waiting: (() => void)[] = [];
async function slot() {
  if (running < MAX_PARALLEL) {
    running++;
    return;
  }
  await new Promise<void>((r) => waiting.push(r));
  running++;
}
function release() {
  running--;
  waiting.shift()?.();
}

/** Espera um pouco, mas para na hora se a tela que pediu foi fechada */
const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const TIMEOUT_MS = 15_000;

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { token?: string | null; signal?: AbortSignal } = {},
  attempt = 0,
): Promise<T> {
  let res: Response;
  await slot();
  // tempo máximo por requisição: nada de carregar pra sempre
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: JSON.stringify({ query, variables: clean(variables) }),
      signal: timeout.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    const err = new AniListError(
      (e as Error).name === 'AbortError' ? t('O AniList demorou demais pra responder. Tente de novo.') : t('Sem conexão com o AniList. Verifique sua internet.'),
    );
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
    release();
  }

  if (res.status === 429 && attempt < 2) {
    // Limite do AniList: espera pouco (no máx. 6 s) e tenta de novo; depois mostra o erro com "Tentar de novo"
    const retry = Math.min(Number(res.headers.get('Retry-After')) || 3, 6);
    await pause(retry * 1000 + 300 * (attempt + 1), opts.signal);
    return gql<T>(query, variables, opts, attempt + 1);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    const msg: string = json?.errors?.[0]?.message ?? `Erro ${res.status} no AniList`;
    const err = new AniListError(res.status === 429 ? t('O AniList está recebendo muitos pedidos agora. Espere alguns segundos e tente de novo.') : msg);
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}
