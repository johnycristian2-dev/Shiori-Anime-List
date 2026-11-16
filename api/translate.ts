/**
 * GET /api/translate?id=<anilistId>&lang=pt|ja
 * Traduz a sinopse de um anime do AniList usando o Vercel AI Gateway.
 * - Autenticação: token OIDC do próprio deploy (sem chave de API no código).
 * - Só traduz sinopses do AniList (recebe o id, não texto livre) → não vira tradutor aberto.
 * - A resposta fica no cache da CDN por 30 dias: cada anime é traduzido uma vez por idioma.
 */
import { getVercelOidcToken } from '@vercel/oidc';

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

// ───── Tradutor gratuito (cópia de src/lib/freeTranslate.ts: funções da Vercel não importam de src/) ─────
const TARGET: Record<string, string> = { pt: 'pt-BR', ja: 'ja' };
const MAX = 450;

/** Divide em pedaços de até MAX caracteres, sem cortar frases quando possível. */
function chunkText(text: string, max = MAX): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const p = para.trim();
    if (!p) continue;
    const sentences = p.match(/[^.!?…]+[.!?…]+["”')\]]*\s*|[^.!?…]+$/g) ?? [p];
    let cur = '';
    for (const raw of sentences) {
      let s = raw;
      // frase gigante: corta em palavras
      while (s.length > max) {
        const cut = s.lastIndexOf(' ', max) > 0 ? s.lastIndexOf(' ', max) : max;
        if (cur) {
          out.push(cur.trim());
          cur = '';
        }
        out.push(s.slice(0, cut).trim());
        s = s.slice(cut);
      }
      if ((cur + s).length > max) {
        out.push(cur.trim());
        cur = '';
      }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    out.push('\n');
  }
  if (out[out.length - 1] === '\n') out.pop();
  return out;
}

async function one(q: string, lang: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|${TARGET[lang]}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const j = await res.json();
  const text: string = j?.responseData?.translatedText ?? '';
  if (Number(j?.responseStatus) !== 200 || j?.quotaFinished || !text || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) {
    throw new Error(`mymemory: ${j?.responseDetails || 'quota'}`);
  }
  return text;
}

async function freeTranslate(text: string, lang: 'pt' | 'ja'): Promise<string> {
  if (!TARGET[lang]) throw new Error('lang');
  const parts = chunkText(text);
  const done: string[] = [];
  for (const p of parts) done.push(p === '\n' ? '\n\n' : await one(p, lang));
  return done
    .join(' ')
    .replace(/ ?\n\n ?/g, '\n\n')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    const lang = url.searchParams.get('lang') ?? '';
    if (!Number.isInteger(id) || id <= 0 || id > 10_000_000 || !LANG_NAME[lang]) return json({ error: 'bad request' }, 400);

    // 1. Sinopse original (inglês) direto do AniList
    const ask = () =>
      fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: 'query($id:Int){Media(id:$id){description(asHtml:false) title{romaji}}}', variables: { id } }),
      });
    let al = await ask();
    if (al.status === 429) {
      // AniList pediu pra esperar: tenta de novo uma vez (no máx. 3 s)
      const wait = Math.min(Number(al.headers.get('retry-after')) || 2, 3);
      await new Promise((r) => setTimeout(r, wait * 1000));
      al = await ask();
    }
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
