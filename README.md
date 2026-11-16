# Shiori 栞 — sua lista de animes sem sofrimento

Monte sua lista navegando por **tops, temporadas, gêneros, décadas e recomendações** e adicione com um toque. Os dados vêm da **API pública do AniList**. No final você exporta pro **MyAnimeList** (XML) ou envia direto pro **AniList**.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera /dist
npm test           # testes (Vitest)
```

Node 20+.

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Descobrir** `/` | Destaque rotativo, em alta, temporada atual, top de todos os tempos, populares, top por gênero, próxima temporada e atalhos por década |
| **Explorar** `/explorar` | Busca + filtros combináveis (gênero, década/ano, temporada, formato, situação, nota mínima, ordenação), rolagem infinita e "adicionar todos" |
| **Modo rápido** `/swipe` | Cartas pra arrastar: → quero ver, ↑ já vi, ← pular. Desfazer, atalhos de teclado e várias fontes (populares, top, gênero, década…) |
| **Pra você** `/pra-voce` | Recomendações calculadas a partir da sua lista. Você escolhe quais animes servem de base |
| **Minha lista** `/lista` | Abas por status, estatísticas, busca, ordenação, visão em lista ou grade, edição de status/episódios/nota |
| **Detalhe** `/anime/:id` | Sinopse, infos, próximo episódio, trailer, franquia (com "adicionar franquia") e recomendações |
| **Calendário** `/calendario` | Episódios da semana dia a dia com horário local e contagem regressiva; filtro "só da minha lista" |
| **Roleta** `/roleta` | Gacha 運命: sorteia o que assistir da sua lista "Quero ver" ou uma surpresa fora dela, com raridade R/SR/SSR pela nota |
| **Perfil** `/perfil` | Rank otaku, horas assistidas, gráficos (status, notas, gêneros, décadas), 15 conquistas, favoritos e **card PNG pra compartilhar** |
| **Estúdio** `/estudio/:id` | Todas as obras de um estúdio |
| **Sync** `/sync` | Conta na nuvem · exportar XML do MAL · importar do MAL (.xml/.xml.gz) · importar usuário do AniList · login AniList com sync automático · backup JSON · preferências e avisos |
| **Quiz** `/comecar` | 6 perguntas (clima, tamanho, época, o que evitar, onde assiste) → lista inicial com "adicionar todos" |
| **Maratona** `/maratona/:id` | Franquia na ordem de lançamento, tempo total, em quantos dias você termina (por dias da semana), adicionar na ordem ou criar lista |
| **Personagem** `/personagem/:id` | Infos, dubladores e todos os animes em que aparece (spoilers escondidos) |
| **Dublador** `/dublador/:id` | Todos os papéis, "você já ouviu essa voz em…", filtros "só da minha lista" e "só principais" |
| **Retrospectiva** `/retrospectiva` | Seu ano em anime estilo stories: episódios, horas, mês campeão, gênero do ano, mais maratonado, top 5, recorde de dias seguidos + card |
| **Comparar** `/comparar` | Compatibilidade com um amigo (usuário do AniList ou perfil Shiori), o que vocês dois amam, recomendações cruzadas e onde discordam |
| **Watch party** `/party` | Sala com código, cada um sugere e vota (3 votos), quem está online, o anfitrião revela o vencedor — tudo em tempo real *(precisa do Supabase)* |
| **Perfil público** `/u/:apelido` | Página da sua lista, números e conquistas pra mandar pros amigos *(precisa do Supabase)* |
| **Roadmap** `/roadmap` | Pendências do projeto por versão |

Na v0.3: **conta na nuvem** pra usar em vários aparelhos, **sync automático com o AniList**, **sino de episódios novos** com notificações, e **listas personalizadas** ("Pra ver com a namorada", "Clássicos"…) direto no botão + de qualquer anime.

Extras: busca global (**Ctrl+K** ou **/**), "Continuar assistindo" com botão +1 ep, "Lançando hoje", favoritos ♥ e anotações por anime, personagens e dubladores, links de streaming, status automático (começou a ver → Assistindo; último ep → Completo), "ocultar os que já estão na lista" no Explorar, páginas carregadas sob demanda e **PWA** (instalável no celular, com cache de capas).

### Temas 着せ替え (`/temas`, ou o ícone 🎨 no topo)

- **15 temas prontos**, vários inspirados em animes: Noite, Sakura, Neon City (Cyberpunk: Edgerunners), Monarca das Sombras (Solo Leveling), Caçador de Onis (Kimetsu), Expansão de Domínio (Jujutsu), Além das Muralhas (Shingeki), Grand Line (One Piece), Vila da Folha (Naruto), Poder Saiyajin (Dragon Ball), Caderno da Morte (Death Note), Unidade 01 (Evangelion), Jornada da Elfa (Frieren), Espírito da Floresta (Ghibli) e Mangá P&B.
- **Tema do seu anime:** escolha qualquer anime favorito ou que está assistindo — o site inteiro ganha as cores da capa e a arte bem suave no fundo. Também tem o botão **🎨 Usar como tema** na página de cada anime.
- **Rodízio diário:** o tema muda sozinho todo dia entre os seus favoritos.
- **Editor:** monte o seu (cores, claro/escuro, fundo, partículas) com prévia ao vivo e aviso de contraste.
- Cada tema tem fundo próprio (retícula, xadrez, tela CRT, estrelas, ondas, grade) e partículas (pétalas, brasas, poeira mágica).

Pra criar um tema novo no código, adicione um objeto em `PRESETS` (`src/lib/themes.ts`). Os testes verificam que todo tema tem texto legível.

## Idiomas e sinopses traduzidas

O site inteiro está em **Português, English e 日本語** (bandeira no topo ou em *Sync → Preferências*). Os textos ficam em `src/lib/i18n/{en,ja}.ts`, usando a frase em português como chave.

O AniList só tem sinopse em inglês. Em PT/JA ela é traduzida por `api/translate.ts`, uma Vercel Function que busca a sinopse no AniList pelo id e traduz pelo **Vercel AI Gateway** (Claude Haiku). A autenticação usa o token OIDC do próprio deploy, sem chave no front; fora da Vercel, defina `AI_GATEWAY_API_KEY`. Cada tradução fica 30 dias no cache da CDN e também no navegador. Sem a função (ex.: GitHub Pages) o site mostra o original em inglês.

## Exportar pro MyAnimeList

1. Em **Sync**, clique em **Baixar XML**.
2. No MAL, vá em **Perfil → Import**, escolha **MyAnimeList Import** e envie o arquivo.

Animes sem ID no MAL (raros, geralmente muito novos) ficam de fora, e o site avisa quantos foram.

## Conta Shiori e sincronização entre aparelhos (opcional)

Usa o [Supabase](https://supabase.com) (grátis). Sem configurar, o site funciona normalmente, com a lista salva só no navegador.

1. Crie um projeto no Supabase.
2. **SQL Editor → New query**: cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso cria a tabela, as regras de segurança (cada um só vê a própria lista) e o tempo real.
3. **Authentication → URL Configuration**: em *Site URL* e *Redirect URLs*, coloque o endereço do site (ex.: `https://shiori.vercel.app/`) e `http://localhost:5173/`.
4. (Opcional) **Authentication → Providers → Google** para o botão "Entrar com Google". O login por link no e-mail já vem ativo.
5. **Project Settings → API**: copie *Project URL* e *anon public key* para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.

**Pra v0.5 (social):** o mesmo `schema.sql` cria as tabelas de perfil público e watch party (rode de novo se já tinha rodado antes — ele não apaga nada). Pra amigos entrarem na watch party sem conta, ative **Authentication → Sign In / Providers → Allow anonymous sign-ins**.

Como funciona: cada anime guarda a data da última edição. Ao sincronizar, vence a edição mais recente, e as remoções ficam registradas pra não "ressuscitar" em outro aparelho. Aparelhos abertos ao mesmo tempo se atualizam em tempo real.

## Sincronizar direto com o AniList (opcional)

1. Crie um app em <https://anilist.co/settings/developer>.
2. Em **Redirect URL**, coloque o endereço do site (ex.: `https://shiori.vercel.app/` ou `http://localhost:5173/`).
3. Copie `.env.example` para `.env` e preencha `VITE_ANILIST_CLIENT_ID`.
4. Em **Sync → Conectar conta**. Com **Sincronizar automaticamente** ligado, cada mudança vai pro AniList sozinha e, ao abrir o site, a lista de lá é mesclada com a daqui. Remoções feitas direto no site do AniList não voltam pra cá; remova pelo Shiori.

## Episódios novos

O sino 🔔 no topo mostra os episódios que saíram (últimos 14 dias) dos animes em **Assistindo** que você ainda não marcou, e as estreias do que está em **Quero ver**. Em **Sync → Preferências → Avisos** dá pra ligar notificações do navegador, que funcionam enquanto o Shiori estiver aberto (mesmo minimizado).

## Deploy

- **Vercel / Netlify:** importe o repositório. Build `npm run build` e pasta `dist`. Adicione `VITE_ANILIST_CLIENT_ID` nas variáveis de ambiente.
- **GitHub Pages:** o workflow `.github/workflows/deploy.yml` já está pronto. Ative Pages → Source: *GitHub Actions* e (opcional) crie o secret `VITE_ANILIST_CLIENT_ID`.

O app usa `HashRouter` e `base: './'`, então funciona em qualquer subpasta sem configurar rotas.

## Estrutura

```
src/
  api/
    anilist.ts      cliente GraphQL (trata limite 429 com retry)
    queries.ts      todas as queries/mutations
    hooks.ts        hooks do React Query (descobrir, explorar, detalhe, recomendações)
  store/
    list.ts         sua lista (zustand + localStorage) e metadados de status
    ui.ts           tema, idioma de título, toasts
    auth.ts         token OAuth do AniList
  lib/
    labels.ts       traduções (gêneros, formatos, relações, ordenações)
    season.ts       temporada atual/próxima
    mal.ts          exportar/importar XML do MAL
    format.ts       utilitários (título, html, download)
    profile.ts      ranks, estatísticas e conquistas
    shareCard.ts    gera o card PNG (canvas)
  components/       Layout, SearchModal, AnimeCard, AnimeRow, AddMenu, EntryEditor, ui
  pages/            Discover, Explore, Swipe, Calendar, Recommendations, Roulette, Profile, MyList, AnimeDetail, Studio, Sync
  index.css         tema (variáveis CSS) + estilo "mangá"
```

### Como estender

- **Novo tema:** adicione um bloco `[data-theme='nome']` em `index.css` com as variáveis e inclua o nome em `Theme` (`store/ui.ts`).
- **Nova vitrine no Descobrir:** adicione um alias em `DISCOVER_QUERY` e uma `<AnimeRow>` em `Discover.tsx`.
- **Nova conquista:** adicione um item em `ACHIEVEMENTS` (`lib/profile.ts`).
- **Nova fonte no modo rápido:** inclua em `SOURCES` e em `buildFilters` (`Swipe.tsx`).
- **Novo campo na lista** (ex.: favorito, tags): adicione em `ListEntry` (`types.ts`) e suba a `version` do persist em `store/list.ts`.

## Roadmap

As pendências estão em **[ROADMAP.md](ROADMAP.md)** (com dicas de implementação) e dentro do próprio site em **Mais → Roadmap**. Pra marcar uma como feita, troque o `status` em `src/lib/roadmap.ts`.

Dados: [AniList API](https://docs.anilist.co). Projeto pessoal, sem afiliação com AniList ou MyAnimeList.
