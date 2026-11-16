# Roadmap 今後の予定 — pendências do Shiori

Marque `[x]` ao concluir e atualize o `status` correspondente em `src/lib/roadmap.ts` (a página `/roadmap` do site lê de lá).

Legenda de esforço: 🟢 pequeno · 🟡 médio · 🔴 grande

---

## v0.3 · Essenciais 基本
> Objetivo: usar todo dia, em qualquer aparelho.

- [x] 🔴 **Conta e sincronização entre aparelhos** — ✅ v0.3 (Supabase, link mágico/Google, mescla por anime, tempo real)
  - Supabase (Auth + Postgres) ou Firebase (Auth + Firestore). Tabela `list_entries(user_id, media_id, status, score, progress, favorite, notes, updated_at)`.
  - Estratégia: localStorage continua como cache offline; ao logar, mescla por `updatedAt` (o mais recente vence).
  - Arquivos: novo `src/store/cloud.ts`, ajustar `store/list.ts` pra disparar sync após cada ação.
- [x] 🟡 **Sincronização automática com AniList** — ✅ v0.3 (fila por mudança, remoção, pull ao abrir)
  - Já existe `SAVE_ENTRY_MUTATION` e login OAuth. Falta: fila com debounce (ex.: 2s) que envia só a entrada alterada.
  - Ao abrir o app: puxar `MediaListCollection` do Viewer e mesclar por `updatedAt` (AniList devolve `updatedAt` em cada entry).
  - Remoção: mutation `DeleteMediaListEntry`.
- [ ] 🔴 **Aviso de episódio novo (push)** — 🟨 parcial na v0.3: sino 🔔 + notificação com o site aberto. Falta o push com o app fechado ↓
  - Requer backend (Supabase Edge Function / Cloudflare Worker com cron) consultando `airingSchedules` dos animes "Assistindo" de cada usuário.
  - Web Push com VAPID + `pushManager.subscribe` no service worker do PWA (trocar `generateSW` por `injectManifest`).
  - Alternativa sem backend: aviso dentro do app ao abrir ("3 episódios novos desde sua última visita").
- [x] 🟡 **Listas personalizadas** — ✅ v0.3 (menu +, abas em Minha lista, emoji, sincroniza)
  - `customLists: { id, name, emoji, mediaIds[] }` no store. Entrada no `AddMenu` ("Adicionar à lista…") e abas extras em Minha lista.
  - Exportar pro MAL ignora (MAL não suporta); AniList suporta `customLists` na mutation.

## v0.4 · Descoberta inteligente 発見
> Objetivo: achar o próximo anime certo com menos esforço.

- [x] 🟡 **Quiz "Sou iniciante"** — ✅ v0.4 (`/comecar`: 6 perguntas, uma busca por gênero, ranking por posição + nota + gostos em comum)
- [x] 🟡 **Planejador de maratona** — ✅ v0.4 (`/maratona/:id`: franquia por `relations`, dias da semana, extras, desconta o que já viu, cria lista)
- [x] 🟢 **Filtros extras** — ✅ v0.4 (onde assistir via `licensedById_in`, tamanho, só finalizados, temas `tag_in`, origem, excluir gêneros)
  - [ ] Dublagem PT-BR: o AniList não tem esse dado de forma confiável → avaliar outra fonte ou marcação manual.
- [x] 🟡 **Página de personagem e dublador** — ✅ v0.4 (`/personagem/:id`, `/dublador/:id`, "você já ouviu essa voz em…", spoilers escondidos)

## v0.5 · Social e diversão 仲間
> Objetivo: compartilhar e curtir com os amigos. (Depende da conta da v0.3.)

- [x] 🟡 **Perfil público por link** — ✅ v0.5 (`/u/apelido`, foto da lista sem anotações, público/privado). Plano original: `/u/:apelido`, leitura pública da lista e conquistas, com opção de privado.
- [x] 🔴 **Watch party** — ✅ v0.5 (`/party`, código de 6 letras, convidado sem conta, 3 votos, quem está online). Plano original: sala com código, cada um sugere/vota (Supabase Realtime), resultado vira "Assistindo" pra todos.
- [x] 🟡 **Comparar listas** — ✅ v0.5 (`/comparar`, com usuário do AniList ou perfil Shiori). Plano original: compatibilidade = correlação das notas em comum + sobreposição de gêneros; listas "só você viu" / "só ele viu".
- [x] 🟡 **Retrospectiva do ano** — ✅ v0.5 (`/retrospectiva`, histórico de eventos + card). Plano original: guardar histórico de eventos (`history: {mediaId, type, at}`) pra saber o que foi visto em cada ano; telas animadas estilo stories.
- [x] 🟢 **Gacha diário** — ✅ v0.5 (giro do dia na Roleta, sequência, 5 conquistas novas sendo 3 secretas). Plano original: 1 giro grátis por dia, contador de streak, conquistas raras escondidas (ex.: tirar SSR 3 dias seguidos).

## v0.6 · Polimento 仕上げ
> Objetivo: bonito, em português e pronto pro portfólio.

- [x] 🟢 **Temas extras** — ✅ v0.6/v0.7 (`/temas`: 15 prontos, cada um com fonte própria, cantos, sombras mangá/neon/suave, efeito de título glitch/neon/pincel/pop 3D, camadas CRT/vinheta/papel/filme/hexágonos e 10 tipos de partículas; tema do seu anime, rodízio diário, editor completo)
- [x] 🟡 **Idiomas + sinopses traduzidas** — ✅ site em Português, English e 日本語 (`src/lib/i18n`); sinopses traduzidas por `api/translate.ts` (Vercel Function → AI Gateway, sem chave no front) com cache na CDN e no navegador por `mediaId`.
- [ ] 🟢 **Testes e lint no deploy** — Vitest + Testing Library pros stores e `lib/` (mal.ts, profile.ts), ESLint, e rodar ambos no workflow antes do build.

## v0.7 · Leitura 読書
- [x] 🔴 **Mangá, manhwa, manhua, webtoon e light novel** — ✅ seletor Anime | Mangá & Webtoon em Descobrir, Explorar, Modo rápido, Roleta, Minha lista e busca; categorias (webtoon = tag *Long Strip* do AniList); páginas `/manga/:id` com capítulos, volumes e autoria; progresso por capítulo; "Lendo / Quero ler"; sync e importação do AniList e do MAL com mangá; exportação separada pro MAL.
- [x] 🟡 **E-mail com código** — ✅ confirmação, login sem senha e senha nova por código de 6 dígitos digitado no próprio site, com reenviar; modelos PT/EN/JA em `supabase/email-templates/` e guia em `docs/EMAIL.md`.

## v0.7 · Comunidade 仲間
> Objetivo: login, perfil caprichado e um lugar pra conversar sobre anime com segurança.

- [x] 🔴 **Conta e perfil de verdade** — ✅ botão Entrar/Criar conta no canto superior direito (e-mail + senha, link mágico, esqueci a senha, Google opcional), apelido único verificado na hora, `/perfil/editar` com foto e banner (envio com redução/WebP no aparelho ou personagem/banner do AniList), bio, anime favorito, público/privado, troca de senha e excluir conta (LGPD), página `/termos`.
- [ ] 🟡 **Conquistas no perfil** — medalhas públicas, raridade (% de usuários que têm) e progresso das secretas.
- [x] 🟡 **Postagens e reviews** — ✅ review com nota (uma por título, editável), reação por episódio/capítulo com spoiler escondido pelo seu progresso, post livre; curtidas e comentários com notificação; filtro de palavrões (mascara) e termos de ódio barrados no servidor; moderador oculta posts (`supabase/posts.sql`).
- [x] 🟡 **Seguir, amigos e feed** — ✅ seguir (perfil privado/menor = pedido), amigos = seguem um ao outro, feed automático do que assistem/leem, notificações em tempo real, "amigos que têm na lista" na página do título, busca de pessoas (`/amigos`).
- [ ] 🔴 **Comunidade com chats** — salas por anime e por temporada (Supabase Realtime), aviso/ocultação de spoiler.
- [~] 🔴 **Verificação de idade** — ✅ data de nascimento obrigatória no cadastro (mín. 13 anos, guardada só nos dados privados da conta). Falta: data/faixa etária no cadastro, conteúdo adulto (gênero Hentai/Ecchi, `isAdult`) escondido por padrão, restrições pra menores; estudar ECA Digital (Lei 15.211/2025) e LGPD antes de abrir chats.
- [~] 🔴 **Moderação e segurança** — ✅ bloquear, denunciar (anônimo), limite de ações por minuto, tela `/moderacao` para administradores, menores com perfil privado e fora da busca. ✅ filtro de palavrões e de termos de ódio nos posts. Falta: aplicar nos chats.

---

### Concluído ✅
- v0.1 — Descobrir, Explorar, Modo rápido, Pra você, Minha lista, Detalhe, Sync (MAL/AniList/backup)
- v0.2 — Calendário, Roleta, Perfil + conquistas + card, Estúdio, busca global, favoritos/notas, personagens, streaming, PWA
- v0.3 — Conta na nuvem (Supabase), sync automático AniList, sino de episódios novos + notificações, listas personalizadas, testes com Vitest no deploy
- v0.4 — Quiz pra iniciantes, planejador de maratona, filtros extras (streaming, tamanho, temas, origem, excluir gêneros), páginas de personagem e dublador
- v0.5 — Perfil público, comparar listas, watch party em tempo real, retrospectiva do ano, gacha diário com conquistas secretas
- v0.6 — Sistema de temas completo (fontes, efeitos, camadas, partículas), site em 3 idiomas, sinopses traduzidas
