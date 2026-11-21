// Lista textos t('...') do código que ainda não têm tradução em inglês ou japonês.
// Uso: node scripts/i18n-missing.mjs [--json]   (sai com código 1 se faltar algo e --strict)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../src');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'i18n') walk(p); }
    else if (/\.(tsx?|mts)$/.test(f) && !/\.test\./.test(f)) files.push(p);
  }
})(root);

const keys = new Map();
const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(re)) {
    if (m[1] === '`' && m[2].includes('${')) continue;
    const k = m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
    if (!keys.has(k)) keys.set(k, f.slice(root.length + 1));
  }
}
function dict(name) {
  const s = readFileSync(join(root, 'lib/i18n', name), 'utf8');
  const out = new Set();
  const r = /^\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*:/gm;
  for (const m of s.matchAll(r)) out.add(m[2].replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'));
  return out;
}
const en = dict('en.ts'), ja = dict('ja.ts');
const miss = { en: [], ja: [] };
for (const [k, f] of keys) {
  if (!en.has(k)) miss.en.push([k, f]);
  if (!ja.has(k)) miss.ja.push([k, f]);
}
if (process.argv.includes('--json')) console.log(JSON.stringify(miss, null, 1));
else {
  console.log(`[i18n] ${keys.size} textos · faltando EN: ${miss.en.length} · JA: ${miss.ja.length}`);
  for (const l of ['en', 'ja']) for (const [k, f] of miss[l]) console.log(`  ${l}  ${f}  ${JSON.stringify(k)}`);
}
if (process.argv.includes('--strict') && (miss.en.length || miss.ja.length)) process.exit(1);
