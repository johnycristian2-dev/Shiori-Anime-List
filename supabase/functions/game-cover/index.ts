// game-cover: entrega a capa de uma rodada dos jogos sem revelar qual anime é.
// O link tem só um código aleatório (vale 2 h); o endereço real da capa nunca chega no navegador.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!UUID.test(t)) return new Response('bad', { status: 400 });
  const { data } = await db.from('game_cover_tokens').select('cover, expires_at').eq('token', t).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return new Response('expired', { status: 404 });
  // capa menor (large) pra gastar menos banda; só aceita o CDN do AniList
  const src = String(data.cover).replace('/cover/extraLarge/', '/cover/large/');
  if (!/^https:\/\/s4\.anilist\.co\//.test(src)) return new Response('bad', { status: 400 });
  const img = await fetch(src);
  if (!img.ok) return new Response('upstream', { status: 502 });
  return new Response(img.body, {
    headers: {
      'Content-Type': img.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=7200',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
});
