import type { MediaFormat, MediaSort, MediaStatus } from '../types';

import { t } from './i18n';

export const GENRES: Record<string, { pt: string; jp: string }> = {
  Action: {
    get pt() {
      return t('Ação');
    },

    jp: 'アクション'
  },
  Adventure: {
    get pt() {
      return t('Aventura');
    },

    jp: '冒険'
  },
  Comedy: {
    get pt() {
      return t('Comédia');
    },

    jp: 'コメディ'
  },
  Drama: {
    get pt() {
      return t('Drama');
    },

    jp: 'ドラマ'
  },
  Ecchi: {
    get pt() {
      return t('Ecchi');
    },

    jp: 'エッチ'
  },
  Fantasy: {
    get pt() {
      return t('Fantasia');
    },

    jp: 'ファンタジー'
  },
  Horror: {
    get pt() {
      return t('Terror');
    },

    jp: 'ホラー'
  },
  'Mahou Shoujo': {
    get pt() {
      return t('Mahou Shoujo');
    },

    jp: '魔法少女'
  },
  Mecha: {
    get pt() {
      return t('Mecha');
    },

    jp: 'メカ'
  },
  Music: {
    get pt() {
      return t('Música');
    },

    jp: '音楽'
  },
  Mystery: {
    get pt() {
      return t('Mistério');
    },

    jp: 'ミステリー'
  },
  Psychological: {
    get pt() {
      return t('Psicológico');
    },

    jp: '心理'
  },
  Romance: {
    get pt() {
      return t('Romance');
    },

    jp: '恋愛'
  },
  'Sci-Fi': {
    get pt() {
      return t('Ficção científica');
    },

    jp: 'SF'
  },
  'Slice of Life': {
    get pt() {
      return t('Slice of Life');
    },

    jp: '日常'
  },
  Sports: {
    get pt() {
      return t('Esportes');
    },

    jp: 'スポーツ'
  },
  Supernatural: {
    get pt() {
      return t('Sobrenatural');
    },

    jp: '超自然'
  },
  Thriller: {
    get pt() {
      return t('Suspense');
    },

    jp: 'スリラー'
  },
};
export const HIDDEN_GENRES = ['Hentai'];
export const genrePt = (g: string) => GENRES[g]?.pt ?? g;

export const FORMAT_LABEL: Record<MediaFormat, string> = {
  get TV() {
    return t('TV');
  },

  get TV_SHORT() {
    return t('TV curto');
  },

  get MOVIE() {
    return t('Filme');
  },

  get SPECIAL() {
    return t('Especial');
  },

  get OVA() {
    return t('OVA');
  },

  get ONA() {
    return t('ONA');
  },

  get MUSIC() {
    return t('Clipe');
  }
};

export const MEDIA_STATUS_LABEL: Record<MediaStatus, string> = {
  get FINISHED() {
    return t('Finalizado');
  },

  get RELEASING() {
    return t('Em lançamento');
  },

  get NOT_YET_RELEASED() {
    return t('Ainda não lançado');
  },

  get CANCELLED() {
    return t('Cancelado');
  },

  get HIATUS() {
    return t('Em hiato');
  }
};

export const RELATION_LABEL: Record<string, string> = {
  get SEQUEL() {
    return t('Sequência');
  },

  get PREQUEL() {
    return t('Prequela');
  },

  get SIDE_STORY() {
    return t('História paralela');
  },

  get ALTERNATIVE() {
    return t('Versão alternativa');
  },

  get SPIN_OFF() {
    return t('Spin-off');
  },

  get PARENT() {
    return t('Obra principal');
  },

  get SUMMARY() {
    return t('Resumo');
  },

  get CHARACTER() {
    return t('Mesmos personagens');
  },

  get COMPILATION() {
    return t('Compilação');
  },

  get CONTAINS() {
    return t('Contém');
  },

  get SOURCE() {
    return t('Fonte');
  },

  get ADAPTATION() {
    return t('Adaptação');
  },

  get OTHER() {
    return t('Relacionado');
  }
};

export const SORT_OPTIONS: { value: MediaSort; label: string }[] = [
  {
    value: 'POPULARITY_DESC',

    get label() {
      return t('Mais populares');
    }
  },
  {
    value: 'SCORE_DESC',

    get label() {
      return t('Melhor nota');
    }
  },
  {
    value: 'TRENDING_DESC',

    get label() {
      return t('Em alta agora');
    }
  },
  {
    value: 'FAVOURITES_DESC',

    get label() {
      return t('Mais favoritados');
    }
  },
  {
    value: 'START_DATE_DESC',

    get label() {
      return t('Mais recentes');
    }
  },
  {
    value: 'START_DATE',

    get label() {
      return t('Mais antigos');
    }
  },
  {
    value: 'TITLE_ROMAJI',

    get label() {
      return t('Título (A–Z)');
    }
  },
];

export const DECADES = [1970, 1980, 1990, 2000, 2010, 2020];

/** Plataformas (ids do AniList). O catálogo é global: no Brasil pode variar. */
export const STREAMING = [
  {
    id: 10,

    get name() {
      return t('Netflix');
    },

    color: '#e50914'
  },
  {
    id: 5,

    get name() {
      return t('Crunchyroll');
    },

    color: '#f47521'
  },
  {
    id: 21,

    get name() {
      return t('Prime Video');
    },

    color: '#00a8e1'
  },
  {
    id: 118,

    get name() {
      return t('Disney+');
    },

    color: '#113ccf'
  },
  {
    id: 211,

    get name() {
      return t('Max');
    },

    color: '#5822b4'
  },
  {
    id: 20,

    get name() {
      return t('HIDIVE');
    },

    color: '#00baff'
  },
];

export const LENGTHS = [
  {
    id: 'short',

    get label() {
      return t('Curto (até 13 ep)');
    }
  },
  {
    id: 'medium',

    get label() {
      return t('Médio (14–26 ep)');
    }
  },
  {
    id: 'long',

    get label() {
      return t('Longo (27+ ep)');
    }
  },
] as const;

export const COUNTRIES = [
  {
    id: 'JP',

    get label() {
      return t('Japão 🇯🇵');
    }
  },
  {
    id: 'CN',

    get label() {
      return t('China 🇨🇳');
    }
  },
  {
    id: 'KR',

    get label() {
      return t('Coreia 🇰🇷');
    }
  },
] as const;

/** Tags temáticas do AniList, com nome em português. */
export const THEME_TAGS: { tag: string; pt: string }[] = [
  {
    tag: 'Isekai',

    get pt() {
      return t('Isekai');
    }
  },
  {
    tag: 'Reincarnation',

    get pt() {
      return t('Reencarnação');
    }
  },
  {
    tag: 'School',

    get pt() {
      return t('Escola');
    }
  },
  {
    tag: 'Super Power',

    get pt() {
      return t('Superpoderes');
    }
  },
  {
    tag: 'Martial Arts',

    get pt() {
      return t('Artes marciais');
    }
  },
  {
    tag: 'Revenge',

    get pt() {
      return t('Vingança');
    }
  },
  {
    tag: 'Survival',

    get pt() {
      return t('Sobrevivência');
    }
  },
  {
    tag: 'Time Loop',

    get pt() {
      return t('Loop temporal');
    }
  },
  {
    tag: 'Detective',

    get pt() {
      return t('Detetive');
    }
  },
  {
    tag: 'Military',

    get pt() {
      return t('Militar');
    }
  },
  {
    tag: 'Post-Apocalyptic',

    get pt() {
      return t('Pós-apocalíptico');
    }
  },
  {
    tag: 'Mythology',

    get pt() {
      return t('Mitologia');
    }
  },
  {
    tag: 'Found Family',

    get pt() {
      return t('Família escolhida');
    }
  },
  {
    tag: 'Coming of Age',

    get pt() {
      return t('Amadurecimento');
    }
  },
  {
    tag: 'Iyashikei',

    get pt() {
      return t('Iyashikei (relaxante)');
    }
  },
  {
    tag: 'Tragedy',

    get pt() {
      return t('Tragédia');
    }
  },
  {
    tag: 'Idol',

    get pt() {
      return t('Idols');
    }
  },
];
