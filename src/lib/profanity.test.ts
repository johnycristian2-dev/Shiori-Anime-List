import { describe, expect, it } from 'vitest';
import { maskProfanity } from './profanity';

describe('maskProfanity', () => {
  it('mascara palavrões e mantém o resto', () => {
    expect(maskProfanity('Que episódio foda, porra!')).toBe('Que episódio f***, p****!');
    expect(maskProfanity('Shit happens')).toBe('S*** happens');
  });
  it('não mexe em palavras parecidas', () => {
    expect(maskProfanity('Cubo, picanha e putaria não, mas computador sim')).toBe('Cubo, picanha e putaria não, mas computador sim');
  });
});
