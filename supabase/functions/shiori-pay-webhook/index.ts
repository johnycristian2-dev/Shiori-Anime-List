// shiori-pay-webhook: o Mercado Pago avisa aqui quando um Pix muda de status.
// Não confiamos no corpo do aviso: buscamos o pagamento direto na API do Mercado Pago e só então liberamos.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) return new Response('off', { status: 200 });
  const u = new URL(req.url);
  let id = u.searchParams.get('data.id') ?? u.searchParams.get('id');
  let topic = u.searchParams.get('type') ?? u.searchParams.get('topic');
  if (req.method === 'POST') {
    const b = await req.json().catch(() => null);
    id = b?.data?.id ?? id;
    topic = b?.type ?? b?.topic ?? topic;
  }
  if (!id || !/^\d+$/.test(String(id)) || (topic && topic !== 'payment')) return new Response('ignored', { status: 200 });

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return new Response('lookup failed', { status: 500 });
  const mp = await r.json();
  const ref = String(mp.external_reference ?? '');
  const { data: pay } = await db.from('payments').select('id, amount_cents, status, mp_payment_id').eq('id', ref).maybeSingle();
  if (!pay) return new Response('unknown', { status: 200 });
  if (pay.mp_payment_id && String(pay.mp_payment_id) !== String(mp.id)) return new Response('mismatch', { status: 200 });

  if (mp.status === 'approved') {
    if (Math.round(Number(mp.transaction_amount) * 100) !== pay.amount_cents) return new Response('amount', { status: 200 });
    const { error } = await db.rpc('apply_payment', { p_id: pay.id, p_mp_id: Number(mp.id) });
    if (error) return new Response('apply failed', { status: 500 });
  } else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(mp.status) && pay.status !== 'approved') {
    await db.from('payments').update({ status: mp.status }).eq('id', pay.id);
  }
  return new Response('ok', { status: 200 });
});
