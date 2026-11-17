// Gera a extensão em extension/dist e o zip em public/shiori-extension.zip
// Uso: node scripts/build-extension.mjs
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'extension');
const out = resolve(src, 'dist');

// as chaves são públicas (publishable); vêm do .env.local ou do ambiente da Vercel
const env = { ...process.env };
const envFile = resolve(root, '.env.local');
if (existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.warn('[extensão] VITE_SUPABASE_URL/ANON_KEY ausentes — pulando o build da extensão.');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(resolve(src, 'manifest.json'), 'utf8'));
manifest.host_permissions = manifest.host_permissions.map((h) => h.replace('__SUPABASE_HOST__', new globalThis.URL(URL).origin));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    bg: resolve(src, 'src/bg.ts'),
    crunchy: resolve(src, 'src/crunchy.ts'),
    site: resolve(src, 'src/site.ts'),
    popup: resolve(src, 'src/popup.ts'),
  },
  outdir: out,
  bundle: true,
  format: 'iife',
  target: ['chrome120', 'firefox128'],
  minify: true,
  legalComments: 'none',
  define: {
    __SUPABASE_URL__: JSON.stringify(URL),
    __SUPABASE_KEY__: JSON.stringify(KEY),
    __VERSION__: JSON.stringify(manifest.version),
  },
  logLevel: 'warning',
});

writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
cpSync(resolve(src, 'popup.html'), resolve(out, 'popup.html'));
cpSync(resolve(src, 'icons'), resolve(out, 'icons'), { recursive: true });

const zip = resolve(root, 'public/shiori-extension.zip');
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
console.log(`[extensão] v${manifest.version} → extension/dist e public/shiori-extension.zip`);
