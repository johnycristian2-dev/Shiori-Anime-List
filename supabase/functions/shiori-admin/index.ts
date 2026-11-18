// shiori-admin: ações que precisam da chave de serviço (banir, desbanir, apagar conta).
// Moderador: banir/desbanir quem não é da equipe. Dono: tudo, inclusive apagar conta.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  const me = auth?.user;
  if (!me) return json({ error: 'not_logged' }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const target = String(body.user ?? '');
  if (!UUID.test(target)) return json({ error: 'bad_user' }, 400);
  if (target === me.id) return json({ error: 'not_yourself' }, 400);

  const [{ data: myPerk }, { data: myMod }, { data: tPerk }, { data: tMod }] = await Promise.all([
    db.from('user_perks').select('owner').eq('user_id', me.id).maybeSingle(),
    db.from('admins').select('user_id').eq('user_id', me.id).maybeSingle(),
    db.from('user_perks').select('owner').eq('user_id', target).maybeSingle(),
    db.from('admins').select('user_id').eq('user_id', target).maybeSingle(),
  ]);
  const owner = !!myPerk?.owner;
  const mod = owner || !!myMod;
  if (!mod) return json({ error: 'not_allowed' }, 403);
  if (tPerk?.owner) return json({ error: 'not_allowed' }, 403);
  if (tMod && !owner) return json({ error: 'owner_only' }, 403);

  const log = (act: string, details: Record<string, unknown> | null) =>
    db.from('mod_log').insert({ actor: me.id, action: act, target_user: target, details });

  if (action === 'ban') {
    const hours = Number(body.hours);
    const dur = Number.isFinite(hours) && hours > 0 ? `${Math.min(Math.round(hours), 876000)}h` : '876000h';
    const { error } = await db.auth.admin.updateUserById(target, { ban_duration: dur });
    if (error) return json({ error: error.message }, 500);
    // derruba as sessões abertas
    await db.rpc('admin_signout_user', { p_user: target });
    await log('ban', { hours: hours > 0 ? hours : 'permanente', reason: String(body.reason ?? '').slice(0, 200) || null });
    return json({ ok: true });
  }
  if (action === 'unban') {
    const { error } = await db.auth.admin.updateUserById(target, { ban_duration: 'none' });
    if (error) return json({ error: error.message }, 500);
    await log('unban', null);
    return json({ ok: true });
  }
  if (action === 'delete') {
    if (!owner) return json({ error: 'owner_only' }, 403);
    await log('delete_account', { reason: String(body.reason ?? '').slice(0, 200) || null });
    const { error } = await db.auth.admin.deleteUser(target);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  return json({ error: 'bad_action' }, 400);
});
