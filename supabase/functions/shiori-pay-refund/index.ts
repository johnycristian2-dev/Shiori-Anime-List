// shiori-pay-refund: devolve um Pix pelo Mercado Pago e tira o que ele deu.
// Quem pode: a própria pessoa até 7 dias depois da aprovação, ou um admin a qualquer momento.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const DAYS = 7;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) return json({ error: 'payments_off' }, 503);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: 'not_logged' }, 401);

  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== 'string') return json({ error: 'bad_body' }, 400);

  const { data: pay } = await db.from('payments').select('id, user_id, status, approved_at, mp_payment_id').eq('id', id).maybeSingle();
  if (!pay) return json({ error: 'not_found' }, 404);

  const { data: adm } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  const isOwner = pay.user_id === user.id;
  const inWindow = !!pay.approved_at && Date.now() - new Date(pay.approved_at).getTime() < DAYS * 86400_000;
  if (!adm && !(isOwner && inWindow)) return json({ error: 'not_allowed' }, 403);
  if (pay.status !== 'approved' || !pay.mp_payment_id) return json({ error: 'not_refundable' }, 409);

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${pay.mp_payment_id}/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `refund-${pay.id}` },
    body: '{}',
  });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    console.error('refund error', r.status, e?.message);
    return json({ error: 'mp_error' }, 502);
  }
  const { error } = await db.rpc('revoke_payment', { p_id: pay.id, p_status: 'refunded' });
  if (error) return json({ error: 'db' }, 500);
  return json({ ok: true });
});
