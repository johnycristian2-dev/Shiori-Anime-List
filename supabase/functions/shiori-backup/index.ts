// shiori-backup: cópia semanal dos dados dos usuários num bucket privado (o plano grátis não tem backup).
// Guarda as últimas 8 semanas em backups/AAAA-MM-DD.json.gz
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const TABLES = [
  'user_data', 'profiles', 'follows', 'blocks', 'posts', 'post_comments', 'post_likes', 'activities',
  'game_scores', 'leagues', 'league_members', 'league_picks', 'admins', 'reports',
];
const KEEP = 8;

async function dump(table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

Deno.serve(async () => {
  const day = new Date().toISOString().slice(0, 10);
  const name = `${day}.json.gz`;
  const { data: existing } = await db.storage.from('backups').list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (existing?.some((f) => f.name === name)) return Response.json({ skipped: true, name });

  const out: Record<string, unknown> = { at: new Date().toISOString() };
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await dump(t);
    out[t] = rows;
    counts[t] = rows.length;
  }
  const gz = new Blob([JSON.stringify(out)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(gz).arrayBuffer());
  const { error } = await db.storage.from('backups').upload(name, bytes, { contentType: 'application/gzip', upsert: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // apaga as mais antigas
  const old = (existing ?? []).filter((f) => f.name.endsWith('.json.gz')).map((f) => f.name).sort().reverse().slice(KEEP - 1);
  if (old.length) await db.storage.from('backups').remove(old);
  return Response.json({ name, bytes: bytes.length, counts, removed: old });
});
