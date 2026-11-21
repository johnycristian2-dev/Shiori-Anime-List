/**
 * Prévia de link (WhatsApp, Discord, Google): /anime/:id, /manga/:id e /u/:apelido passam por aqui.
 * Devolve o mesmo index.html do site, só que com título, descrição e imagem da página no <head>.
 * O app carrega normalmente por cima; robôs que não rodam JavaScript leem as tags.
 */
export const config = { runtime: 'edge' };

interface Meta {
  title: string;
  description: string;
  image: string | null;
  url: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

async function media(kind: 'anime' | 'manga', id: number, base: string): Promise<Meta | null> {
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: `query($id:Int,$t:MediaType){Media(id:$id,type:$t){title{romaji english} description(asHtml:false) coverImage{extraLarge large} bannerImage averageScore genres seasonYear format}}`,
      variables: { id, t: kind === 'manga' ? 'MANGA' : 'ANIME' },
    }),
  });
  if (!r.ok) return null;
  const m = (await r.json())?.data?.Media;
  if (!m) return null;
  const name = m.title?.english || m.title?.romaji || 'Anime';
  const bits = [m.averageScore ? `★ ${m.averageScore}%` : null, m.seasonYear, (m.genres ?? []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');
  return {
    title: `${name} — Shiori 栞`,
    description: cut([bits, clean(m.description ?? '')].filter(Boolean).join(' — '), 200),
    image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? m.bannerImage ?? null,
    url: `${base}/${kind}/${id}`,
  };
}

async function profile(username: string, base: string): Promise<Meta | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[a-z0-9_]{3,20}$/.test(username)) return null;
  const r = await fetch(`${url}/rest/v1/rpc/profile_card`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uname: username }),
  });
  if (!r.ok) return null;
  const p = (await r.json())?.[0];
  if (!p) return null;
  const name = p.display_name || p.username;
  return {
    title: `${name} (@${p.username}) — Shiori 栞`,
    description: p.is_public ? `Veja a lista de animes, notas e conquistas de ${name} no Shiori.` : `@${p.username} está no Shiori. Monte a sua lista de animes também.`,
    image: p.is_public ? p.avatar_url : null,
    url: `${base}/u/${p.username}`,
  };
}

export default async function handler(req: Request) {
  const u = new URL(req.url);
  const base = `https://${u.host}`;
  const type = u.searchParams.get('t');
  const id = u.searchParams.get('id') ?? '';
  const htmlP = fetch(`${base}/index.html`).then((r) => r.text());

  let meta: Meta | null = null;
  try {
    if ((type === 'anime' || type === 'manga') && /^\d{1,9}$/.test(id)) meta = await media(type, Number(id), base);
    else if (type === 'u') meta = await profile(id.toLowerCase(), base);
  } catch {
    meta = null;
  }

  let html = await htmlP;
  if (meta) {
    const img = meta.image ?? `${base}/og.jpg`;
    const tags = [
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:image" content="${esc(img)}" />`,
      `<meta property="og:url" content="${esc(meta.url)}" />`,
      `<meta name="twitter:title" content="${esc(meta.title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${esc(img)}" />`,
    ].join('\n    ');
    html = html
      // tira as tags genéricas que a página específica substitui
      .replace(/\s*<meta property="og:(title|description|url|image|image:width|image:height)"[^>]*>/g, '')
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(meta.description)}" />`)
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(meta.url)}" />`)
      .replace('<!--shiori-meta-->', tags);
  }
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': meta ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' : 'public, max-age=0, s-maxage=600',
    },
  });
}
