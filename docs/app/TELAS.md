# Telas do app

Caminhos relativos a `mobile/ShioriApp/` (telas e ViewModels) e `mobile/Shiori.Core/` (serviços).

## Login — nativa
- **Arquivos:** `Views/LoginPage.xaml`, `ViewModels/LoginViewModel.cs`, Core `Auth/AuthService.cs`.
- **O que faz:** e-mail e senha da mesma conta do site. "Criar conta" e "Esqueci a senha" abrem o site no navegador.
- **API:** Supabase Auth `POST /auth/v1/token?grant_type=password`.
- **Detalhes:** o botão só habilita com e-mail com "@" e senha preenchida; erros aparecem em vermelho em português ("E-mail ou senha incorretos.", "Sem conexão…"). A sessão vai para o `SecureStorage` (`Services/SecureSessionStore.cs`).

## Início — nativa (aba)
- **Atalhos no topo:** Calendário, Pra você, Swipe, Explorar e Roleta.
- **Arquivos:** `Views/HomePage.xaml`, `ViewModels/HomeViewModel.cs`, `Views/Controls/MediaCard.xaml`, Core `AniList/AniListClient.cs`, `Display/Format.cs`.
- **O que faz:** "Continuar assistindo" (o que está em Assistindo na sua lista, com +1), "Em alta" e a temporada atual (ex.: "Outono 2026"). Puxar para baixo atualiza.
- **APIs:** AniList (`TrendingAsync`, `SeasonAsync`) + Supabase `user_data` (lista). As três rodam em paralelo; se a lista falhar, o resto aparece mesmo assim.

## Buscar — nativa (aba)
- **Arquivos:** `Views/SearchPage.xaml`, `ViewModels/SearchViewModel.cs`.
- **O que faz:** busca com espera de 400 ms depois da última tecla (não faz uma requisição por letra), alternância Anime/Mangá, grade de capas. Mostra "Nada encontrado" quando não há resultado.
- **API:** AniList `SearchAsync(texto, tipo)` com ordenação `SEARCH_MATCH`.

## Detalhe — nativa
- **Arquivos:** `Views/DetailPage.xaml`, `ViewModels/DetailViewModel.cs`.
- **O que faz:** banner, capa, títulos, formato/ano/status/episódios, nota, próximo episódio ("Ep 5 em 3 dias"), gêneros, sinopse, estúdio e personagens. Bloco **Na minha lista**: escolher status (adiciona se ainda não estiver), −1/+1 episódio, nota 0–10, favoritar, remover (com confirmação).
- **APIs:** AniList `DetailAsync(id)`; cada botão da lista chama `ListService.UpdateAsync`.
- **Automações iguais às do site:** dar +1 em "Quero ver" vira "Assistindo"; chegar no último episódio vira "Completo"; marcar "Completo" preenche o progresso.
- **Liga com outras telas:** personagem e estúdio abrem as telas nativas; "Ver página completa no Shiori" abre `/anime/{id}` no site (relacionados, recomendações, reviews…).

## Minha lista — nativa (aba)
- **Arquivos:** `Views/MyListPage.xaml`, `ViewModels/MyListViewModel.cs`.
- **O que faz:** Anime/Mangá, abas por status com contagem (cores do site), itens com capa, progresso "3/12", nota e favorito, +1 rápido; toque abre o Detalhe. Recarrega toda vez que a aba aparece (pode ter mudado no site).
- **API:** Supabase `GET /rest/v1/user_data` e `POST` (upsert) ao dar +1.

## Perfil — nativa (aba)
- **Arquivos:** `Views/ProfilePage.xaml`, `ViewModels/ProfileViewModel.cs`, Core `Profile/ProfileService.cs`, `List/ListStats.cs`.
- **O que faz:** avatar, nome, @apelido, quantos títulos em cada status, total de episódios e capítulos; "Ver perfil completo" (`/u/{apelido}`), "Editar perfil" (`/perfil/editar`), "Sair da conta". Sem perfil público: botão "Criar perfil".
- **APIs:** Supabase `profiles` (filtrando por `user_id`) e `user_data`.

## Calendário — nativa
- **Arquivos:** `Views/CalendarPage.xaml`, `ViewModels/CalendarViewModel.cs`, Core `Discover/Calendar.cs`.
- **O que faz:** episódios dos próximos 7 dias agrupados por dia ("Hoje", "Amanhã", "Sexta, 27/11") **no fuso do celular**, com horário; os da sua lista ficam marcados; chave "Só os meus".
- **API:** AniList `airingSchedules` (`AiringAsync`, segue várias páginas, sem conteúdo adulto).

## Explorar — nativa
- **Arquivos:** `Views/ExplorePage.xaml`, `ViewModels/ExploreViewModel.cs`.
- **O que faz:** filtros de tipo (anime/mangá), ordem (populares, nota, em alta, novos), gênero, temporada, ano, formato e país (Japão, Coreia, China); grade que carrega mais ao rolar; "Limpar filtros".
- **API:** AniList `Page.media` com os filtros (`BrowseAsync`) e `GenreCollection` (`GenresAsync`).

## Swipe — nativa
- **Arquivos:** `Views/SwipePage.xaml(.cs)`, `ViewModels/FunViewModels.cs` (`SwipeViewModel`), Core `Discover/Roulette.cs` (`SwipeDeck`).
- **O que faz:** um título por vez; arrastar para a direita = **Quero ver**, esquerda = **Pular** (não aparece mais, igual ao site), botão **Já vi** = Completo. A carta segue o dedo, mostra o selo e sai animada. Fontes: Em alta, Populares, Melhor nota, gêneros, Mangá, Manhwa.

## Roleta — nativa
- **Arquivos:** `Views/RoulettePage.xaml(.cs)`, `RouletteViewModel`, Core `Discover/Roulette.cs`.
- **O que faz:** sorteia um título da sua lista **Quero ver** (com animação); "Vou assistir!" muda para Assistindo.

## Pra você — nativa
- **Arquivos:** `Views/ForYouPage.xaml`, `ForYouViewModel`, Core `Discover/Recommender.cs`.
- **O que faz:** recomendações da comunidade do AniList a partir dos títulos com melhor nota na sua lista, com "Porque você curtiu X"; o botão + adiciona em Quero ver.
- **Regra (igual ao site):** peso da semente = nota/10 (ou 0,7 completo, 0,65 assistindo, 0,45 outros; mínimo 0,2; dropado = 0); pontuação = soma de log2(1 + votos) × peso; esconde o que já está na lista ou foi pulado.
- **API:** AniList `Media.recommendations` de até 10 títulos numa requisição (apelidos `m0`, `m1`…).

## Personagem, Dublador e Estúdio — nativas
- **Arquivos:** `Views/CharacterPage.xaml`, `StaffPage.xaml`, `StudioPage.xaml`, `ViewModels/PeopleViewModels.cs`.
- **Personagem:** foto, nomes, aniversário, idade, gênero, descrição; em quais animes aparece (papel) e quem dubla — toque no dublador abre a página dele.
- **Dublador:** foto, dados e a grade de personagens que fez (com a capa do anime no canto; cada um abre sua tela).
- **Estúdio:** obras principais, das mais populares, carregando mais ao rolar.
- **Como chegar:** no Detalhe, tocando num personagem ou no estúdio.

## Perfil público — nativa
- **Arquivos:** `Views/PublicProfilePage.xaml`, `ViewModels/PublicProfileViewModel.cs`, Core `Profile/ProfileService.cs` (`GetPublicAsync`).
- **O que faz:** avatar, nome, rank, números (títulos, completos, episódios, horas, nota média), favoritos, vendo agora e melhores completos. Conquistas, seguir e comentários abrem no site.
- **API:** Supabase `profiles` com o `snapshot` (resumo público que o site publica; a lista privada de ninguém é lida).

## Mais — nativa (aba) que abre a parte web
- **Arquivos:** `Views/MorePage.xaml`, `ViewModels/MoreViewModel.cs`, Core `Web/SiteSections.cs`.
- **O que faz:** lista agrupada (Descobrir, Social, Jogos, Conta, Sobre) com **todas** as funções do site. As marcadas **NATIVO** (Explorar, Swipe, Calendário, Pra você, Roleta) abrem telas do app; as outras (Maratona, Comparar, Retrospectiva, Amigos, Chat, Watch party, Jogos, Liga, Editar perfil, Temas, Sincronizar, Apoiar, Moderação, Novidades, Feedback, Termos, Privacidade) abrem o site já logado.

## Parte web (WebPage)
- **Arquivos:** `Views/WebPage.xaml(.cs)`, Core `Web/WebBridge.cs`.
- **O que faz:** abre a rota do site já logado (ver "Sessão compartilhada" em `ARQUITETURA.md`). Botão voltar do Android volta dentro do site. Links para fora (Crunchyroll, AniList…) abrem no navegador do celular. Sem internet: mensagem e "Tentar de novo".
