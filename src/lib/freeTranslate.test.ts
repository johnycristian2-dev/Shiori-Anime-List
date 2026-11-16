import { describe, expect, it } from 'vitest';
import { chunkText } from './freeTranslate';

describe('chunkText', () => {
  it('mantém textos curtos inteiros', () => {
    expect(chunkText('Hello. World.')).toEqual(['Hello. World.']);
  });
  it('respeita parágrafos', () => {
    expect(chunkText('One.\n\nTwo.')).toEqual(['One.', '\n', 'Two.']);
  });
  it('nunca passa do limite e não perde texto', () => {
    const s = 'This is a fairly long sentence about a hero. '.repeat(40) + 'x'.repeat(30) + ' ' + 'word '.repeat(200);
    const parts = chunkText(s, 100);
    expect(parts.every((p) => p.length <= 100)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ').trim()).toBe(s.replace(/\s+/g, ' ').trim());
  });
});
