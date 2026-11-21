// Confere a extensão antes de publicar: manifesto válido, arquivos que ele cita existem, permissões enxutas.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '../extension');
const m = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
const fail = [];
if (m.manifest_version !== 3) fail.push('manifest_version precisa ser 3');
if (!/^\d+(\.\d+){0,3}$/.test(m.version)) fail.push(`versão inválida: ${m.version}`);
if (!m.name || m.name.length > 75) fail.push('nome vazio ou com mais de 75 letras');
if (!m.description || m.description.length > 132) fail.push(`descrição precisa ter até 132 letras (tem ${m.description?.length ?? 0})`);
for (const p of Object.values(m.icons ?? {})) if (!existsSync(resolve(dir, p))) fail.push(`ícone faltando: ${p}`);
if (!existsSync(resolve(dir, m.action?.default_popup ?? 'x'))) fail.push('popup.html faltando');
const extra = (m.permissions ?? []).filter((p) => !['storage'].includes(p));
if (extra.length) fail.push(`permissões novas precisam de justificativa na loja: ${extra.join(', ')}`);
for (const f of ['src/bg.ts', 'src/crunchy.ts', 'src/site.ts', 'src/popup.ts']) if (!existsSync(resolve(dir, f))) fail.push(`faltando ${f}`);
if (fail.length) {
  console.error('[extensão] problemas:\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log(`[extensão] manifesto ok (v${m.version})`);
