/**
 * Palavrões comuns (PT/EN) são mascarados na hora de mostrar — "p***a".
 * Termos de ódio são barrados antes, no servidor (supabase/posts.sql).
 */
const WORDS = [
  'porra', 'caralho', 'merda', 'foda', 'fodase', 'foder', 'fodido', 'puta', 'puto', 'cacete', 'buceta', 'pica', 'cu', 'arrombado', 'desgraça',
  'filhodaputa', 'fdp', 'vsf', 'pqp', 'krl', 'otario', 'babaca', 'cuzao', 'bosta',
  'fuck', 'fucking', 'fucked', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'motherfucker', 'wtf',
];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SET = new Set(WORDS.map(norm));

export function maskProfanity(text: string) {
  return text.replace(/[\p{L}\p{N}]+/gu, (w) => {
    const n = norm(w);
    if (!SET.has(n) && !SET.has(n.replace(/s$/, ''))) return w;
    return w[0] + '*'.repeat(Math.max(2, w.length - 1));
  });
}
