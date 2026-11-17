import { lazy, type ComponentType } from 'react';

const KEY = 'shiori-reloaded-at';

/** Recarrega a página uma vez (no máx. a cada 20 s, pra nunca entrar em loop). */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 20_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sem storage: recarrega mesmo assim */
  }
  window.location.reload();
  return true;
}

const isChunkError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i.test(
    String((e as Error)?.message ?? e),
  );

/**
 * Igual ao React.lazy, mas aguenta atualização do site:
 * se o arquivo da página sumiu (versão nova publicada), tenta de novo e, se precisar, recarrega sozinho.
 */
export function lazyPage<T extends ComponentType<object>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (e) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (e2) {
        if (isChunkError(e2) || isChunkError(e)) reloadOnce();
        throw e2;
      }
    }
  });
}

/** O Vite avisa quando um arquivo pré-carregado falha (mesmo caso: versão nova). */
export function watchPreloadErrors() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });
}
