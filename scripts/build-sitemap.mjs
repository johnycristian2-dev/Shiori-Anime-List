// Gera public/sitemap.xml: páginas principais + os ~600 animes do catálogo dos jogos.
import { readFileSync, writeFileSync } from 'node:fs';
const SITE = process.env.SITE_URL || 'https://shiori-anime-list.vercel.app';
const pages = ['/', '/explorar', '/calendario', '/jogos', '/liga', '/temas', '/apoiar', '/termos', '/roadmap'];
const pool = JSON.parse(readFileSync(new URL('../public/games/anime-pool.json', import.meta.url), 'utf8')).items;
const today = new Date().toISOString().slice(0, 10);
const urls = [
  ...pages.map((p) => `<url><loc>${SITE}${p}</loc><changefreq>daily</changefreq><priority>${p === '/' ? '1.0' : '0.6'}</priority></url>`),
  ...pool.map((a) => `<url><loc>${SITE}/anime/${a.id}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`),
];
writeFileSync(
  new URL('../public/sitemap.xml', import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`[sitemap] ${urls.length} endereços`);
