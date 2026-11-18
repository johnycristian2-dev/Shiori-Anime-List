// shiori-pay: cria um Pix no Mercado Pago para Shiori+ ou doação.
// O token do Mercado Pago fica no segredo MP_ACCESS_TOKEN (Edge Functions → Secrets). Sem ele, responde 503.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const db = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Preços do Shiori+ (centavos). Mudar aqui e em src/sync/perks.ts. */
const PLANS: Record<number, number> = { 1: 790, 3: 1990, 12: 6990 };

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
  if (!user?.email) return json({ error: 'not_logged' }, 401);

  let body: { kind?: string; months?: number; amount?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_body' }, 400);
  }

  let kind: 'plus' | 'donation';
  let months: number | null = null;
  let cents: number;
  let description: string;
  if (body.kind === 'plus') {
    kind = 'plus';
    months = Number(body.months);
    if (!PLANS[months]) return json({ error: 'bad_plan' }, 400);
    cents = PLANS[months];
    description = `Shiori+ ${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else if (body.kind === 'donation') {
    kind = 'donation';
    const reais = Math.round(Number(body.amount));
    if (!Number.isFinite(reais) || reais < 2 || reais > 500) return json({ error: 'bad_amount' }, 400);
    cents = reais * 100;
    description = 'Apoio ao Shiori';
  } else return json({ error: 'bad_kind' }, 400);

  // limite simples contra abuso: no máximo 10 Pix pendentes por hora
  const { count } = await db
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return json({ error: 'too_many' }, 429);

  const expires = new Date(Date.now() + 30 * 60_000);
  const { data: row, error } = await db
    .from('payments')
    .insert({ user_id: user.id, kind, months, amount_cents: cents, expires_at: expires.toISOString() })
    .select('id')
    .single();
  if (error || !row) return json({ error: 'db' }, 500);

  // o Mercado Pago quer o fuso -03:00 no formato yyyy-MM-ddTHH:mm:ss.SSS-03:00
  const br = new Date(expires.getTime() - 3 * 3600_000).toISOString().replace('Z', '-03:00');
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': row.id },
    body: JSON.stringify({
      transaction_amount: cents / 100,
      description,
      payment_method_id: 'pix',
      payer: { email: user.email },
      external_reference: row.id,
      notification_url: `${URL_}/functions/v1/shiori-pay-webhook`,
      date_of_expiration: br,
    }),
  });
  const mp = await r.json().catch(() => null);
  const td = mp?.point_of_interaction?.transaction_data;
  if (!r.ok || !td?.qr_code) {
    await db.from('payments').update({ status: 'failed' }).eq('id', row.id);
    console.error('mp error', r.status, mp?.message ?? mp?.error);
    return json({ error: 'mp_error' }, 502);
  }
  await db
    .from('payments')
    .update({ mp_payment_id: mp.id, qr_code: td.qr_code, qr_base64: td.qr_code_base64 })
    .eq('id', row.id);
  return json({ id: row.id, qr_code: td.qr_code, qr_base64: td.qr_code_base64, amount_cents: cents, expires_at: expires.toISOString() });
});
