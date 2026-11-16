import { t } from './i18n';
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

    get name() {
      return t('Essenciais');
    },

    jp: '基本',

    get goal() {
      return t('Transformar o Shiori em algo pra usar todo dia, em qualquer aparelho.');
    },

    items: [
      {
        id: 'conta',
        icon: '🔐',
        status: 'feito',

        get title() {
          return t('Conta e sincronização entre aparelhos');
        },

        get desc() {
          return t('Login (Google/e-mail) e lista salva na nuvem, não só no navegador.');
        }
      },
      {
        id: 'sync-anilist',
        icon: '🔄',
        status: 'feito',

        get title() {
          return t('Sincronização automática com AniList');
        },

        get desc() {
          return t(
            'Cada +1 ep, nota ou status vai pro AniList na hora, e mudanças de lá voltam pra cá.'
          );
        }
      },
      {
        id: 'push',
        icon: '🔔',
        status: 'andamento',

        get title() {
          return t('Aviso de episódio novo');
        },

        get desc() {
          return t(
            'Feito: sino de novidades + notificação com o site aberto. Falta: push com o app fechado (precisa de servidor).'
          );
        }
      },
      {
        id: 'listas',
        icon: '🗂️',
        status: 'feito',

        get title() {
          return t('Listas personalizadas');
        },

        get desc() {
          return t(
            '"Pra ver com a namorada", "Clássicos", "Maratona de fim de semana" além dos 5 status.'
          );
        }
      },
    ]
  },
  {
    version: 'v0.4',

    get name() {
      return t('Descoberta inteligente');
    },

    jp: '発見',

    get goal() {
      return t('Achar o próximo anime certo com menos esforço.');
    },

    items: [
      {
        id: 'quiz',
        icon: '🧭',
        status: 'feito',

        get title() {
          return t('Quiz "Sou iniciante"');
        },

        get desc() {
          return t(
            'Perguntas rápidas (clima, tamanho, época, o que evitar, onde assiste) que montam uma lista inicial.'
          );
        }
      },
      {
        id: 'maratona',
        icon: '⏱️',
        status: 'feito',

        get title() {
          return t('Planejador de maratona');
        },

        get desc() {
          return t(
            'Quantas horas por dia você tem → em quantos dias termina e a ordem certa da franquia.'
          );
        }
      },
      {
        id: 'filtros',
        icon: '🎛️',
        status: 'feito',

        get title() {
          return t('Filtros extras');
        },

        get desc() {
          return t(
            'Onde assistir, tamanho, só finalizados, temas, origem e excluir gêneros. Dublagem PT-BR fica pendente (o AniList não tem esse dado).'
          );
        }
      },
      {
        id: 'personagem',
        icon: '🎙️',
        status: 'feito',

        get title() {
          return t('Página de personagem e dublador');
        },

        get desc() {
          return t('Tudo que um dublador fez — "ah, é a voz da Fern!".');
        }
      },
    ]
  },
  {
    version: 'v0.5',

    get name() {
      return t('Social e diversão');
    },

    jp: '仲間',

    get goal() {
      return t('Compartilhar e curtir anime com os amigos.');
    },

    items: [
      {
        id: 'publico',
        icon: '🔗',
        status: 'feito',

        get title() {
          return t('Perfil público por link');
        },

        get desc() {
          return t('Mandar sua lista e conquistas pros amigos com um link.');
        }
      },
      {
        id: 'watch-party',
        icon: '🍿',
        status: 'feito',

        get title() {
          return t('Watch party');
        },

        get desc() {
          return t('Votação em grupo pra escolher o próximo anime pra ver juntos.');
        }
      },
      {
        id: 'comparar',
        icon: '⚖️',
        status: 'feito',

        get title() {
          return t('Comparar listas');
        },

        get desc() {
          return t('% de compatibilidade com um amigo, o que só um viu e o que recomendar.');
        }
      },
      {
        id: 'wrapped',
        icon: '🎁',
        status: 'feito',

        get title() {
          return t('Retrospectiva do ano');
        },

        get desc() {
          return t('Resumo animado estilo "Wrapped" com seus números do ano.');
        }
      },
      {
        id: 'gacha',
        icon: '🎰',
        status: 'feito',

        get title() {
          return t('Gacha diário');
        },

        get desc() {
          return t('Roleta diária com streak de dias seguidos e conquistas raras escondidas.');
        }
      },
    ]
  },
  {
    version: 'v0.6',

    get name() {
      return t('Polimento');
    },

    jp: '仕上げ',

    get goal() {
      return t('Deixar bonito, em português e pronto pro portfólio.');
    },

    items: [
      {
        id: 'temas',
        icon: '🎨',
        status: 'feito',

        get title() {
          return t('Temas extras');
        },

        get desc() {
          return t(
            '15 temas com fonte, sombras, efeito de título, camadas e partículas próprias; tema do seu anime, rodízio diário e editor completo.'
          );
        }
      },
      {
        id: 'traducao',
        icon: '🌐',
        status: 'feito',

        get title() {
          return t('Português, English e 日本語');
        },

        get desc() {
          return t('Site inteiro em 3 idiomas e sinopses traduzidas automaticamente (com cache por anime).');
        }
      },
      {
        id: 'testes',
        icon: '🧪',
        status: 'pendente',

        get title() {
          return t('Testes e lint no deploy');
        },

        get desc() {
          return t(
            'Testes automatizados (Vitest + Testing Library) e ESLint rodando antes de publicar.'
          );
        }
      },
    ]
  },
  {
    version: 'v0.7',

    get name() {
      return t('Comunidade');
    },

    jp: '仲間',

    get goal() {
      return t('Login, perfil caprichado e um lugar pra conversar sobre anime com segurança.');
    },

    items: [
      {
        id: 'perfil',
        icon: '🪪',
        status: 'feito',

        get title() {
          return t('Perfil de verdade');
        },

        get desc() {
          return t('Foto, banner, bio, anime favorito em destaque e vitrine de conquistas.');
        }
      },
      {
        id: 'conquistas',
        icon: '🏆',
        status: 'andamento',

        get title() {
          return t('Conquistas no perfil');
        },

        get desc() {
          return t('Medalhas visíveis pra todo mundo, raridade e progresso das secretas.');
        }
      },
      {
        id: 'posts',
        icon: '📝',
        status: 'pendente',

        get title() {
          return t('Postagens e reviews');
        },

        get desc() {
          return t('Escrever review, post curto ou reação a episódio, com curtidas e comentários.');
        }
      },
      {
        id: 'seguir',
        icon: '👥',
        status: 'feito',

        get title() {
          return t('Seguir e feed');
        },

        get desc() {
          return t('Seguir amigos e ver no feed o que eles adicionaram, terminaram e avaliaram.');
        }
      },
      {
        id: 'chat',
        icon: '💬',
        status: 'pendente',

        get title() {
          return t('Comunidade com chats');
        },

        get desc() {
          return t('Salas por anime e por temporada, com chat em tempo real e aviso de spoiler.');
        }
      },
      {
        id: 'idade',
        icon: '🔞',
        status: 'andamento',

        get title() {
          return t('Verificação de idade');
        },

        get desc() {
          return t('Faixa etária no cadastro, conteúdo adulto escondido por padrão e regras pra menores (ECA Digital / LGPD).');
        }
      },
      {
        id: 'moderacao',
        icon: '🛡️',
        status: 'andamento',

        get title() {
          return t('Moderação e segurança');
        },

        get desc() {
          return t('Denúncias, bloqueio, filtro de palavrões e termos de uso + privacidade.');
        }
      },
    ]
  },
];

export const STATUS_LABEL: Record<RoadmapStatus, { label: string; color: string }> = {
  pendente: {
    get label() {
      return t('Pendente');
    },

    color: '#a59fca'
  },
  andamento: {
    get label() {
      return t('Em andamento');
    },

    color: '#ffe14d'
  },
  feito: {
    get label() {
      return t('Feito');
    },

    color: '#7cff8a'
  },
};
