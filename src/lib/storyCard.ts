/**
 * Card vertical 1080x1920 pra story do Instagram / status do WhatsApp:
 * foto, nível, horas assistidas, gênero favorito, top 3, o que está assistindo e os jogos.
 */
import type { ListEntry } from '../types';
import type { Stats } from './profile';
import { drawCover, loadImg, roundRect } from './shareCard';
import { genrePt } from './labels';
import { t, locale } from './i18n';

const W = 1080;
const H = 1920;
const PINK = '#cbb2ff';
const CYAN = '#3de2ff';
const YELLOW = '#ffe14d';
const GREEN = '#7cff8a';

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = 'rgba(20,16,44,0.82)') {
  ctx.fillStyle = '#000';
  roundRect(ctx, x + 7, y + 7, w, h, 26);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

export async function renderStoryCard(opts: {
  top: ListEntry[];
  watching: ListEntry[];
  stats: Stats;
  name: string;
  username: string | null;
  avatar: string | null;
  rank: { name: string; jp: string };
  titleOf: (e: ListEntry) => string;
  games: { streak: number; cover: number | null; higher: number | null };
}) {
  await Promise.all([
    document.fonts.load('60px "Dela Gothic One"'),
    document.fonts.load('700 30px "M PLUS Rounded 1c"'),
    document.fonts.load('900 30px "Zen Kaku Gothic New"'),
  ]).catch(() => null);

  const top = opts.top.slice(0, 3);
  const watching = opts.watching.slice(0, 4);
  const [bg, avatar, ...imgs] = await Promise.all([
    top[0]?.cover ? loadImg(top[0].cover) : Promise.resolve(null),
    opts.avatar ? loadImg(opts.avatar) : Promise.resolve(null),
    ...top.map((e) => (e.cover ? loadImg(e.cover) : Promise.resolve(null))),
    ...watching.map((e) => (e.cover ? loadImg(e.cover) : Promise.resolve(null))),
  ]);
  const topImgs = imgs.slice(0, top.length);
  const watchImgs = imgs.slice(top.length);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  /* fundo: capa do favorito bem desfocada + degradê */
  ctx.fillStyle = '#0c0a1d';
  ctx.fillRect(0, 0, W, H);
  if (bg) {
    ctx.save();
    ctx.filter = 'blur(48px) saturate(1.3)';
    drawCover(ctx, bg, -120, -120, W + 240, H + 240);
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,10,29,0.55)');
  g.addColorStop(0.45, 'rgba(12,10,29,0.78)');
  g.addColorStop(1, 'rgba(12,10,29,0.96)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(203,178,255,0.09)';
  for (let y = 0; y < H; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < W; x += 22) ctx.fillRect(x, y, 2.6, 2.6);

  /* topo: logo */
  ctx.textAlign = 'left';
  ctx.fillStyle = PINK;
  roundRect(ctx, 70, 90, 74, 74, 18);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.fillStyle = '#1a1240';
  ctx.font = '900 50px "Zen Kaku Gothic New"';
  ctx.textAlign = 'center';
  ctx.fillText('栞', 107, 146);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '40px "Dela Gothic One"';
  ctx.fillText('SHIORI', 166, 140);

  /* foto + nome + nível */
  const ay = 230;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, ay + 110, 110, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#231c4a';
  ctx.fill();
  ctx.clip();
  if (avatar) drawCover(ctx, avatar, W / 2 - 110, ay, 220, 220);
  else {
    ctx.fillStyle = PINK;
    ctx.font = '120px "Dela Gothic One"';
    ctx.textAlign = 'center';
    ctx.fillText((opts.name.trim()[0] ?? '?').toUpperCase(), W / 2, ay + 152);
  }
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.arc(W / 2, ay + 110, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = PINK;
  ctx.beginPath();
  ctx.arc(W / 2, ay + 110, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '72px "Dela Gothic One"';
  const name = fitText(ctx, opts.name.trim() || t('Minha lista de animes'), W - 140);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#000';
  ctx.strokeText(name, W / 2, ay + 320);
  ctx.fillText(name, W / 2, ay + 320);
  ctx.font = '900 34px "Zen Kaku Gothic New"';
  ctx.fillStyle = PINK;
  ctx.fillText(`${opts.rank.jp} · ${opts.rank.name.toUpperCase()}`, W / 2, ay + 372);

  /* números grandes */
  const s = opts.stats;
  const tiles = [
    { v: s.hours.toLocaleString(locale()), k: t('horas de anime'), c: CYAN },
    { v: String(s.completed), k: t('completos'), c: GREEN },
    { v: s.mean ? s.mean.toFixed(1) : '—', k: t('nota média'), c: YELLOW },
  ];
  tiles.forEach((tile, i) => {
    const x = 70 + i * 320;
    const y = 660;
    panel(ctx, x, y, 290, 160);
    ctx.textAlign = 'center';
    ctx.fillStyle = tile.c;
    ctx.font = '64px "Dela Gothic One"';
    ctx.fillText(tile.v, x + 145, y + 88);
    ctx.fillStyle = '#c9c2ee';
    ctx.font = '800 26px "M PLUS Rounded 1c"';
    ctx.fillText(tile.k, x + 145, y + 132);
  });

  /* gênero favorito */
  const genre = s.genres[0]?.[0];
  if (genre) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9c2ee';
    ctx.font = '800 28px "M PLUS Rounded 1c"';
    ctx.fillText(t('gênero favorito'), W / 2, 890);
    ctx.font = '62px "Dela Gothic One"';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000';
    const gtxt = genrePt(genre).toUpperCase();
    ctx.strokeText(gtxt, W / 2, 960);
    ctx.fillText(gtxt, W / 2, 960);
  }

  /* top 3 */
  ctx.textAlign = 'left';
  ctx.fillStyle = YELLOW;
  ctx.font = '40px "Dela Gothic One"';
  ctx.fillText(t('MEU TOP 3'), 70, 1050);
  const cw = 296;
  const chh = 420;
  top.forEach((e, i) => {
    const x = 70 + i * (cw + 21);
    const y = 1080;
    ctx.save();
    ctx.translate(x + cw / 2, y + chh / 2);
    ctx.rotate([-0.035, 0, 0.035][i]);
    ctx.translate(-cw / 2, -chh / 2);
    ctx.fillStyle = e.color ?? PINK;
    roundRect(ctx, 9, 9, cw, chh, 22);
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, cw, chh, 22);
    ctx.clip();
    ctx.fillStyle = '#231c4a';
    ctx.fillRect(0, 0, cw, chh);
    if (topImgs[i]) drawCover(ctx, topImgs[i]!, 0, 0, cw, chh);
    const fade = ctx.createLinearGradient(0, chh * 0.5, 0, chh);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, cw, chh);
    ctx.fillStyle = '#fff';
    ctx.font = '800 26px "M PLUS Rounded 1c"';
    ctx.fillText(fitText(ctx, opts.titleOf(e), cw - 28), 14, chh - 20);
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    roundRect(ctx, 0, 0, cw, chh, 22);
    ctx.stroke();
    // medalha
    ctx.fillStyle = ['#ffd84d', '#d9dcef', '#e6a26a'][i];
    ctx.beginPath();
    ctx.arc(34, 34, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = '34px "Dela Gothic One"';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 34, 47);
    ctx.textAlign = 'left';
    ctx.restore();
  });

  /* assistindo agora */
  let y = 1560;
  if (watching.length) {
    ctx.fillStyle = CYAN;
    ctx.font = '34px "Dela Gothic One"';
    ctx.fillText(t('ASSISTINDO AGORA'), 70, y);
    watching.forEach((e, i) => {
      const x = 70 + i * 140;
      ctx.save();
      roundRect(ctx, x, y + 22, 120, 170, 14);
      ctx.clip();
      ctx.fillStyle = '#231c4a';
      ctx.fillRect(x, y + 22, 120, 170);
      if (watchImgs[i]) drawCover(ctx, watchImgs[i]!, x, y + 22, 120, 170);
      ctx.restore();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      roundRect(ctx, x, y + 22, 120, 170, 14);
      ctx.stroke();
    });
  }

  /* jogos */
  const g2 = opts.games;
  const chips = [
    g2.streak > 0 ? `🔥 ${g2.streak} ${t('dias de Animedle')}` : null,
    g2.cover !== null ? `🖼️ ${g2.cover} ${t('na capa')}` : null,
    g2.higher !== null ? `⚡ ${g2.higher} ${t('seguidos')}` : null,
  ].filter(Boolean) as string[];
  if (chips.length) {
    const x0 = watching.length ? 660 : 70;
    let cy = y + (watching.length ? 30 : 0);
    ctx.font = '800 28px "M PLUS Rounded 1c"';
    for (const chip of chips) {
      const w = Math.min(W - 70 - x0, ctx.measureText(chip).width + 40);
      panel(ctx, x0, cy, w, 52, 'rgba(255,224,77,0.95)');
      ctx.fillStyle = '#1a1240';
      ctx.textAlign = 'left';
      ctx.fillText(fitText(ctx, chip, w - 40), x0 + 20, cy + 36);
      cy += 66;
    }
  }

  /* rodapé */
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '800 30px "M PLUS Rounded 1c"';
  ctx.fillText(t('monte a sua lista também 👇'), W / 2, H - 92);
  ctx.fillStyle = PINK;
  ctx.font = '34px "Dela Gothic One"';
  ctx.font = '30px "Dela Gothic One"';
  ctx.fillText(fitText(ctx, opts.username ? `shiori-anime-list.vercel.app/#/u/${opts.username}` : 'shiori-anime-list.vercel.app', W - 100), W / 2, H - 44);

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Falha ao gerar imagem')))), 'image/png'));
}
