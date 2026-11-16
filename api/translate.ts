/**
 * GET /api/translate?id=<anilistId>&lang=pt|ja
 * Traduz a sinopse de um anime do AniList usando o Vercel AI Gateway.
 * - Autenticação: token OIDC do próprio deploy (sem chave de API no código).
 * - Só traduz sinopses do AniList (recebe o id, não texto livre) → não vira tradutor aberto.
 * - A resposta fica no cache da CDN por 30 dias: cada anime é traduzido uma vez por idioma.
 */
import { getVercelOidcToken } from '@vercel/oidc';
import { freeTranslate } from '../src/lib/freeTranslate';

const MODEL = 'anthropic/claude-haiku-5.5';
const LANG_NAME: Record<string, string> = {
  pt: 'Brazilian Portuguese',
  ja: 'natural Japanese (as used on Japanese anime sites)',
};

function json(body: unknown, status = 200, cache: boolean | 'short' = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control':
        cache === 'short'
          ? 'public, max-age=86400, s-maxage=604800'
          : cache
            ? 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800'
            : 'no-store',
    },
  });
}

function clean(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function aiTranslate(original: string, lang: string): Promise<string> {
  const token = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            `Translate the anime synopsis the user sends into ${LANG_NAME[lang]}. ` +
            'Keep character names, place names and the anime title as they are (romanized), keep paragraph breaks, ' +
            'keep any "(Source: ...)" line translated naturally. Output only the translation, no notes.',
        },
        { role: 'user', content: original },
      ],
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const text: string = (await res.json())?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('empty translation');
  return text;
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    const lang = url.searchParams.get('lang') ?? '';
    if (!Number.isInteger(id) || id <= 0 || id > 10_000_000 || !LANG_NAME[lang]) return json({ error: 'bad request' }, 400);

    // 1. Sinopse original (inglês) direto do AniList
    const al = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query($id:Int){Media(id:$id){description(asHtml:false) title{romaji}}}', variables: { id } }),
    });
    if (!al.ok) return json({ error: `anilist ${al.status}` }, 502);
    const media = (await al.json())?.data?.Media;
    const original = clean(media?.description ?? '');
    if (!original) return json({ text: '' }, 200, true);

    // 2. Tradução pela IA (AI Gateway); se não der, tradutor gratuito
    let aiError = '';
    try {
      const text = await aiTranslate(original, lang);
      return json({ text, source: 'ai', model: MODEL }, 200, true);
    } catch (e) {
      aiError = String(e).slice(0, 200);
    }
    try {
      const text = await freeTranslate(original, lang as 'pt' | 'ja');
      // cache menor: quando a IA voltar, a tradução melhor substitui esta
      return json({ text, source: 'mt' }, 200, 'short');
    } catch (e) {
      return json({ error: 'translation failed', ai: aiError, mt: String(e).slice(0, 200) }, 502);
    }
  },
};
