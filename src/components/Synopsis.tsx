import { useQuery } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { stripHtml } from '../lib/format';
import { getLang, t } from '../lib/i18n';
import { freeTranslate } from '../lib/freeTranslate';

const CACHE_KEY = 'shiori-synopsis';

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache(key: string, text: string) {
  try {
    const c = readCache();
    c[key] = text;
    // Mantém só as 300 mais recentes
    const entries = Object.entries(c).slice(-300);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* sem storage: tudo bem */
  }
}

/**
 * Sinopse no idioma do site. O AniList só tem inglês; pt e ja são traduzidos
 * pela função /api/translate (com cache na CDN e no navegador).
 */
export function useSynopsis(id: number, original: string | null | undefined) {
  const lang = getLang();
  const base = stripHtml(original);
  const key = `${id}:${lang}`;
  const q = useQuery({
    queryKey: ['synopsis', id, lang],
    enabled: lang !== 'en' && !!base,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const cached = readCache()[key];
      if (cached) return cached;
      let text = '';
      try {
        const res = await fetch(`/api/translate?id=${id}&lang=${lang}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = ((await res.json()) as { text: string }).text;
      } catch {
        // Sem a função (ex.: GitHub Pages) ou ela falhou: traduz direto do navegador
        text = await freeTranslate(base, lang as 'pt' | 'ja');
      }
      if (text) writeCache(key, text);
      return text || base;
    },
  });
  if (lang === 'en' || !base) return { text: base, translated: false, loading: false, failed: false };
  return { text: q.data ?? base, translated: !!q.data, loading: q.isLoading, failed: q.isError };
}

export default function Synopsis({
  id,
  text,
  className = '',
  showBadge = true,
}: {
  id: number;
  text: string | null | undefined;
  className?: string;
  showBadge?: boolean;
}) {
  const s = useSynopsis(id, text);
  return (
    <div>
      <p className={`${className} ${s.loading ? 'opacity-60' : ''}`}>{s.text || t('Sem sinopse.')}</p>
      {showBadge && getLang() !== 'en' && s.text && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-muted">
          <Languages size={11} />
          {s.loading ? t('Traduzindo sinopse…') : s.failed ? t('Tradução indisponível — mostrando o original em inglês') : s.translated ? t('Traduzido automaticamente') : ''}
        </div>
      )}
    </div>
  );
}
