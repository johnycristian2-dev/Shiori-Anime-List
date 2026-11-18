-- ═══════════════ Manutenção no plano gratuito ═══════════════
-- (aplicado em partes; aqui fica o registro)

-- endurecimento (search_path, permissões, pg_net fora do public, auth.uid() 1x por consulta, índices): ver migração shiori_hardening

-- backups semanais num bucket privado
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;

-- domingo 03:17 (Brasília) → função shiori-backup
select cron.unschedule('shiori-backup') where exists (select 1 from cron.job where jobname = 'shiori-backup');
select cron.schedule('shiori-backup', '17 6 * * 0',
  $$ select net.http_post(url := 'https://ahtalxodwxzmjltbxmaz.supabase.co/functions/v1/shiori-backup',
       headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000) $$);
