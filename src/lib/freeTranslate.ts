/**
 * Tradução gratuita pelo MyMemory (https://mymemory.translated.net), sem chave.
 * Usada como reserva quando a IA (AI Gateway) não está disponível.
 * Limite: ~500 bytes por pedido, então o texto vai em pedaços por frase.
 * Sem dependências: é usado tanto no navegador quanto na função /api/translate.
 */

const TARGET: Record<string, string> = { pt: 'pt-BR', ja: 'ja' };
const MAX = 450;

/** Divide em pedaços de até MAX caracteres, sem cortar frases quando possível. */
export function chunkText(text: string, max = MAX): string[] {
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

export async function freeTranslate(text: string, lang: 'pt' | 'ja'): Promise<string> {
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
