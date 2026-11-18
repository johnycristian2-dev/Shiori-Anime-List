import { describe, expect, it } from 'vitest';
import { crc16, pixPayload } from './perks';

describe('Pix copia e cola', () => {
  it('CRC16 confere com o exemplo do Banco Central', () => {
    const ex = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(ex)).toBe('1D3D');
  });
  it('monta o código com valor, nome e cidade sem acento', () => {
    const p = pixPayload('chave@exemplo.com', 'João Ávila', 'Erechim', 1000);
    expect(p).toContain('0014br.gov.bcb.pix0117chave@exemplo.com');
    expect(p).toContain('540510.00');
    expect(p).toContain('5910JOAO AVILA');
    expect(p).toContain('6007ERECHIM');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
});
