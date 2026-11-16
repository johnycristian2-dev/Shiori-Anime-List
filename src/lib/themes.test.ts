import { describe, expect, it } from 'vitest';
import { contrast, hexToHsl, hslToHex, pickOfTheDay, PRESETS, themeFromColor } from './themes';

describe('temas', () => {
  it('hsl ida e volta', () => {
    const [h, s, l] = hexToHsl('#ff4f9a');
    expect(hslToHex(h, s, l)).toBe('#ff4f9a');
  });

  it('todos os temas prontos têm texto legível no fundo', () => {
    for (const t of PRESETS) {
      expect(contrast(t.colors.ink, t.colors.bg), t.id).toBeGreaterThanOrEqual(7);
      expect(contrast(t.colors.ink, t.colors.panel), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tema gerado da cor do anime é legível (escuro e claro)', () => {
    for (const color of ['#e4a15d', '#1a1a1a', '#50e4ff', '#ff0000', '#ffffff']) {
      for (const dark of [true, false]) {
        const t = themeFromColor(color, { id: 'x', name: 'x', dark });
        expect(contrast(t.colors.ink, t.colors.bg), `${color} ${dark}`).toBeGreaterThanOrEqual(7);
        expect(contrast(t.colors.pink, t.colors.bg), `${color} ${dark} accent`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('item do dia é estável', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(pickOfTheDay(items, '2026-11-16')).toBe(pickOfTheDay(items, '2026-11-16'));
    expect(pickOfTheDay([], '2026-11-16')).toBeUndefined();
  });

  it('ids únicos', () => {
    expect(new Set(PRESETS.map((t) => t.id)).size).toBe(PRESETS.length);
  });
});
