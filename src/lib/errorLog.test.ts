import { describe, expect, it } from 'vitest';
import { scrub } from './errorLog';

describe('scrub (erros sem dados pessoais)', () => {
  it('esconde e-mails, tokens e JWTs', () => {
    const s = scrub('falhou pra ana.silva+x@gmail.com em /sync?access_token=abc123&x=1 com eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig');
    expect(s).not.toMatch(/ana\.silva/);
    expect(s).not.toMatch(/abc123/);
    expect(s).not.toMatch(/eyJhbGci/);
    expect(s).toContain('[email]');
    expect(s).toContain('access_token=[x]');
    expect(s).toContain('[jwt]');
  });
  it('mantém o resto da mensagem', () => {
    expect(scrub("Cannot read properties of undefined (reading 'title')")).toBe("Cannot read properties of undefined (reading 'title')");
  });
});
