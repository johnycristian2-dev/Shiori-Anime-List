/**
 * Pendências do projeto. Ao concluir uma, troque status para 'feito'
 * (ou 'andamento' enquanto estiver trabalhando nela) — a página /roadmap atualiza sozinha.
 * Mantenha em sincronia com ROADMAP.md.
 */
export type RoadmapStatus = 'pendente' | 'andamento' | 'feito';

export interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  status: RoadmapStatus;
}

export interface RoadmapPhase {
  version: string;
  name: string;
  jp: string;
  goal: string;
  items: RoadmapItem[];
}

export const ROADMAP: RoadmapPhase[] = [
  {
    version: 'v0.3',
    name: 'Essenciais',
    jp: '基本',
    goal: 'Transformar o Shiori em algo pra usar todo dia, em qualquer aparelho.',
    items: [
      { id: 'conta', icon: '🔐', status: 'feito', title: 'Conta e sincronização entre aparelhos', desc: 'Login (Google/e-mail) e lista salva na nuvem, não só no navegador.' },
      { id: 'sync-anilist', icon: '🔄', status: 'feito', title: 'Sincronização automática com AniList', desc: 'Cada +1 ep, nota ou status vai pro AniList na hora, e mudanças de lá voltam pra cá.' },
      { id: 'push', icon: '🔔', status: 'andamento', title: 'Aviso de episódio novo', desc: 'Feito: sino de novidades + notificação com o site aberto. Falta: push com o app fechado (precisa de servidor).' },
      { id: 'listas', icon: '🗂️', status: 'feito', title: 'Listas personalizadas', desc: '"Pra ver com a namorada", "Clássicos", "Maratona de fim de semana" além dos 5 status.' },
    ],
  },
  {
    version: 'v0.4',
    name: 'Descoberta inteligente',
    jp: '発見',
    goal: 'Achar o próximo anime certo com menos esforço.',
    items: [
      { id: 'quiz', icon: '🧭', status: 'feito', title: 'Quiz "Sou iniciante"', desc: 'Perguntas rápidas (clima, tamanho, época, o que evitar, onde assiste) que montam uma lista inicial.' },
      { id: 'maratona', icon: '⏱️', status: 'feito', title: 'Planejador de maratona', desc: 'Quantas horas por dia você tem → em quantos dias termina e a ordem certa da franquia.' },
      { id: 'filtros', icon: '🎛️', status: 'feito', title: 'Filtros extras', desc: 'Onde assistir, tamanho, só finalizados, temas, origem e excluir gêneros. Dublagem PT-BR fica pendente (o AniList não tem esse dado).' },
      { id: 'personagem', icon: '🎙️', status: 'feito', title: 'Página de personagem e dublador', desc: 'Tudo que um dublador fez — "ah, é a voz da Fern!".' },
    ],
  },
  {
    version: 'v0.5',
    name: 'Social e diversão',
    jp: '仲間',
    goal: 'Compartilhar e curtir anime com os amigos.',
    items: [
      { id: 'publico', icon: '🔗', status: 'feito', title: 'Perfil público por link', desc: 'Mandar sua lista e conquistas pros amigos com um link.' },
      { id: 'watch-party', icon: '🍿', status: 'feito', title: 'Watch party', desc: 'Votação em grupo pra escolher o próximo anime pra ver juntos.' },
      { id: 'comparar', icon: '⚖️', status: 'feito', title: 'Comparar listas', desc: '% de compatibilidade com um amigo, o que só um viu e o que recomendar.' },
      { id: 'wrapped', icon: '🎁', status: 'feito', title: 'Retrospectiva do ano', desc: 'Resumo animado estilo "Wrapped" com seus números do ano.' },
      { id: 'gacha', icon: '🎰', status: 'feito', title: 'Gacha diário', desc: 'Roleta diária com streak de dias seguidos e conquistas raras escondidas.' },
    ],
  },
  {
    version: 'v0.6',
    name: 'Polimento',
    jp: '仕上げ',
    goal: 'Deixar bonito, em português e pronto pro portfólio.',
    items: [
      { id: 'temas', icon: '🎨', status: 'feito', title: 'Temas extras', desc: '15 temas prontos inspirados em animes, tema gerado a partir de qualquer anime da sua lista, rodízio diário e editor próprio.' },
      { id: 'traducao', icon: '🌐', status: 'pendente', title: 'Sinopse em português', desc: 'Tradução automática das sinopses usando a API da Claude.' },
      { id: 'testes', icon: '🧪', status: 'pendente', title: 'Testes e lint no deploy', desc: 'Testes automatizados (Vitest + Testing Library) e ESLint rodando antes de publicar.' },
    ],
  },
];

export const STATUS_LABEL: Record<RoadmapStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: '#a59fca' },
  andamento: { label: 'Em andamento', color: '#ffe14d' },
  feito: { label: 'Feito', color: '#7cff8a' },
};
