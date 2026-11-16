/**
 * Gera uma imagem 1080x1350 (formato de post) com seus animes de destaque.
 * As capas do AniList permitem CORS, então dá pra desenhar no canvas e exportar.
 */
import type { ListEntry } from '../types';
import type { Stats } from './profile';

import { t, locale } from './i18n';

const W = 1080;
const H = 1350;
const PINK = '#ff4f9a';
const CYAN = '#3de2ff';
const YELLOW = '#ffe14d';

/**
 * Baixa a imagem via fetch (modo CORS) em vez de <img>: assim o canvas não fica "sujo"
 * mesmo se o navegador/service worker tiver a capa em cache sem cabeçalho CORS.
 */
async function loadImg(src: string): Promise<ImageBitmap | null> {
  try {
    const url = src + (src.includes('?') ? '&' : '?') + 'shiori-card=1';
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

export async function renderShareCard(opts: {
  picks: ListEntry[];
  stats: Stats;
  nickname: string;
  rank: { name: string; jp: string };
  titleOf: (e: ListEntry) => string;
}) {
  await Promise.all([
    document.fonts.load('60px "Dela Gothic One"'),
    document.fonts.load('700 30px "M PLUS Rounded 1c"'),
    document.fonts.load('900 30px "Zen Kaku Gothic New"'),
  ]).catch(() => null);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // Fundo
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0c0a1d');
  g.addColorStop(1, '#2a1650');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,79,154,0.10)';
  for (let y = 0; y < H; y += 18) for (let x = (y / 18) % 2 ? 9 : 0; x < W; x += 18) ctx.fillRect(x, y, 2.4, 2.4);
  // Linhas de velocidade
  ctx.save();
  ctx.translate(W * 0.8, 120);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 3;
  for (let a = 0; a < Math.PI * 2; a += 0.09) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
    ctx.lineTo(Math.cos(a) * 1400, Math.sin(a) * 1400);
    ctx.stroke();
  }
  ctx.restore();

  // Logo
  ctx.save();
  ctx.translate(70, 60);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#000';
  roundRect(ctx, 6, 6, 90, 90, 20);
  ctx.fill();
  ctx.fillStyle = PINK;
  roundRect(ctx, 0, 0, 90, 90, 20);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '900 60px "Zen Kaku Gothic New"';
  ctx.textAlign = 'center';
  ctx.fillText('栞', 45, 67);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '54px "Dela Gothic One"';
  const name = opts.nickname.trim() || t('Minha lista de animes');
  ctx.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, 190, 108);
  ctx.font = '900 30px "Zen Kaku Gothic New"';
  ctx.fillStyle = PINK;
  ctx.fillText(`${opts.rank.jp}  ·  ${opts.rank.name.toUpperCase()}`, 192, 152);

  // Estatísticas
  const tiles = [
    { v: opts.stats.total, k: t('animes'), c: PINK },
    { v: opts.stats.completed, k: t('completos'), c: '#7cff8a' },
    { v: opts.stats.eps.toLocaleString(locale()), k: t('episódios'), c: CYAN },
    { v: opts.stats.mean ? opts.stats.mean.toFixed(1) : '—', k: t('nota média'), c: YELLOW },
  ];
  tiles.forEach((t, i) => {
    const x = 60 + i * 245;
    const y = 200;
    ctx.fillStyle = '#000';
    roundRect(ctx, x + 6, y + 6, 225, 120, 18);
    ctx.fill();
    ctx.fillStyle = '#1a1538';
    roundRect(ctx, x, y, 225, 120, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.fillStyle = t.c;
    ctx.font = '48px "Dela Gothic One"';
    ctx.fillText(String(t.v), x + 20, y + 66);
    ctx.fillStyle = '#a59fca';
    ctx.font = '700 24px "M PLUS Rounded 1c"';
    ctx.fillText(t.k, x + 22, y + 102);
  });

  // Capas 3x2
  const cw = 300;
  const ch = 420;
  const gap = 30;
  const top = 370;
  const imgs = await Promise.all(opts.picks.slice(0, 6).map((e) => (e.cover ? loadImg(e.cover) : Promise.resolve(null))));
  opts.picks.slice(0, 6).forEach((e, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 60 + col * (cw + gap);
    const y = top + row * (ch + gap);
    const h = ch;
    ctx.fillStyle = e.color ?? PINK;
    roundRect(ctx, x + 9, y + 9, cw, h, 18);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, cw, h, 18);
    ctx.clip();
    ctx.fillStyle = '#231c4a';
    ctx.fillRect(x, y, cw, h);
    const img = imgs[i];
    if (img) drawCover(ctx, img, x, y, cw, h);
    const fade = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, cw, h);
    ctx.fillStyle = '#fff';
    ctx.font = '800 22px "M PLUS Rounded 1c"';
    const t = opts.titleOf(e);
    ctx.fillText(t.length > 22 ? t.slice(0, 21) + '…' : t, x + 14, y + h - 18);
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    roundRect(ctx, x, y, cw, h, 18);
    ctx.stroke();
    // Número / nota
    ctx.font = '40px "Dela Gothic One"';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000';
    ctx.strokeText(`#${i + 1}`, x + 12, y + 50);
    ctx.fillStyle = '#fff';
    ctx.fillText(`#${i + 1}`, x + 12, y + 50);
    if (e.score || e.favorite) {
      const label = `${e.favorite ? '♥ ' : ''}${e.score ? `★ ${e.score}` : ''}`.trim();
      ctx.font = '900 22px "M PLUS Rounded 1c"';
      const w = ctx.measureText(label).width + 20;
      ctx.fillStyle = YELLOW;
      roundRect(ctx, x + cw - w - 12, y + 14, w, 36, 10);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + cw - w - 2, y + 40);
    }
  });

  // Rodapé
  ctx.fillStyle = '#a59fca';
  ctx.font = '700 26px "M PLUS Rounded 1c"';
  ctx.textAlign = 'center';
  ctx.fillText(t('feito com SHIORI 栞 · アニメリスト'), W / 2, H - 40);

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Falha ao gerar imagem')))), 'image/png'));
}
