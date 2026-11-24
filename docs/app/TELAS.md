# Telas do app

Caminhos relativos a `mobile/ShioriApp/` (telas e ViewModels) e `mobile/Shiori.Core/` (serviços).

## Login — nativa
- **Arquivos:** `Views/LoginPage.xaml`, `ViewModels/LoginViewModel.cs`, Core `Auth/AuthService.cs`.
- **O que faz:** e-mail e senha da mesma conta do site. "Criar conta" e "Esqueci a senha" abrem o site no navegador.
- **API:** Supabase Auth `POST /auth/v1/token?grant_type=password`.
- **Detalhes:** o botão só habilita com e-mail com "@" e senha preenchida; erros aparecem em vermelho em português ("E-mail ou senha incorretos.", "Sem conexão…"). A sessão vai para o `SecureStorage` (`Services/SecureSessionStore.cs`).

## Início — nativa (aba)
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
- **Liga com a web:** tocar num personagem abre `/personagem/{id}`; "Ver página completa no Shiori" abre `/anime/{id}` (relacionados, recomendações, reviews…).

## Minha lista — nativa (aba)
- **Arquivos:** `Views/MyListPage.xaml`, `ViewModels/MyListViewModel.cs`.
- **O que faz:** Anime/Mangá, abas por status com contagem (cores do site), itens com capa, progresso "3/12", nota e favorito, +1 rápido; toque abre o Detalhe. Recarrega toda vez que a aba aparece (pode ter mudado no site).
- **API:** Supabase `GET /rest/v1/user_data` e `POST` (upsert) ao dar +1.

## Perfil — nativa (aba)
- **Arquivos:** `Views/ProfilePage.xaml`, `ViewModels/ProfileViewModel.cs`, Core `Profile/ProfileService.cs`, `List/ListStats.cs`.
- **O que faz:** avatar, nome, @apelido, quantos títulos em cada status, total de episódios e capítulos; "Ver perfil completo" (`/u/{apelido}`), "Editar perfil" (`/perfil/editar`), "Sair da conta". Sem perfil público: botão "Criar perfil".
- **APIs:** Supabase `profiles` (filtrando por `user_id`) e `user_data`.

## Mais — nativa (aba) que abre a parte web
- **Arquivos:** `Views/MorePage.xaml`, `ViewModels/MoreViewModel.cs`, Core `Web/SiteSections.cs`.
- **O que faz:** lista agrupada (Descobrir, Social, Jogos, Conta, Sobre) com **todas** as funções do site que não são nativas: Explorar, Swipe, Calendário, Pra você, Roleta, Maratona, Comparar, Retrospectiva, Amigos, Chat, Watch party, Jogos, Liga, Editar perfil, Temas, Sincronizar, Apoiar, Moderação, Novidades, Feedback, Termos e Privacidade.

## Parte web (WebPage)
- **Arquivos:** `Views/WebPage.xaml(.cs)`, Core `Web/WebBridge.cs`.
- **O que faz:** abre a rota do site já logado (ver "Sessão compartilhada" em `ARQUITETURA.md`). Botão voltar do Android volta dentro do site. Links para fora (Crunchyroll, AniList…) abrem no navegador do celular. Sem internet: mensagem e "Tentar de novo".
