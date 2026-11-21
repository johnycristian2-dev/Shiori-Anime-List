// shiori-staff-push: chamada só pelo banco (gatilhos de denúncia, bug e pagamento).
// Confere o segredo compartilhado e manda o aviso pros aparelhos da equipe que ligaram os alertas.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SITE = 'https://shiori-anime-list.vercel.app';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método', { status: 405 });
  const { data: sec } = await db.from('app_secrets').select('name,value').in('name', ['staff_hook_secret', 'vapid_public', 'vapid_private']);
  const get = (n: string) => sec?.find((r) => r.name === n)?.value ?? '';
  const hook = get('staff_hook_secret');
  if (!hook || !same(req.headers.get('x-shiori-hook') ?? '', hook)) return new Response('não autorizado', { status: 401 });
  if (!get('vapid_public') || !get('vapid_private')) return Response.json({ sent: 0, reason: 'sem chaves' });

  const b = await req.json().catch(() => null);
  if (!b || typeof b.title !== 'string') return new Response('corpo', { status: 400 });
  const path = typeof b.url === 'string' && b.url.startsWith('/') ? b.url : '/moderacao';

  // só quem ainda é da equipe recebe (se a pessoa perdeu o cargo, o aviso para)
  const { data: subs } = await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').eq('staff', true);
  const users = [...new Set((subs ?? []).map((s) => s.user_id))];
  const staff = new Set<string>();
  if (users.length) {
    const [{ data: admins }, { data: owners }] = await Promise.all([
      db.from('admins').select('user_id').in('user_id', users),
      db.from('user_perks').select('user_id').eq('owner', true).in('user_id', users),
    ]);
    for (const r of [...(admins ?? []), ...(owners ?? [])]) staff.add(r.user_id);
  }

  webpush.setVapidDetails('mailto:shiori@shiori-anime-list.vercel.app', get('vapid_public'), get('vapid_private'));
  const payload = JSON.stringify({
    title: `🛡️ ${b.title}`.slice(0, 80),
    body: String(b.body ?? '').slice(0, 180),
    icon: `${SITE}/pwa-192.png`,
    url: `${SITE}${path}`,
    tag: `staff-${b.kind ?? 'x'}-${Date.now()}`,
  });
  let sent = 0;
  for (const s of subs ?? []) {
    if (!staff.has(s.user_id)) continue;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return Response.json({ sent });
});
