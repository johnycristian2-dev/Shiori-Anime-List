# Roteiro da apresentação (sugestão, ~10 min)

## 1. Abertura (1 min)
- O Shiori é um site de lista de animes/mangás com social, jogos e watch party. O objetivo foi levá-lo para o celular como **app de verdade em .NET MAUI**, com **todas as funções**.
- Mostrar o ícone 栞 e a tela de abertura.

## 2. Login (1 min)
- Entrar com a conta do site. Mostrar uma senha errada → "E-mail ou senha incorretos." (mensagens em português, tratadas no `AuthService`).
- Fechar e abrir o app: continua logado (sessão no **SecureStorage**).

## 3. Telas nativas (4 min)
1. **Início:** "Continuar assistindo" com +1; "Em alta" e "Outono 2026" vindo do **AniList (GraphQL)**.
2. **Buscar:** digitar "frieren" (busca espera você parar de digitar), alternar Anime/Mangá.
3. **Detalhe:** mudar status, dar +1, nota, favoritar. Explicar as automações iguais às do site (+1 em "Quero ver" vira "Assistindo").
4. **Prova de sincronização:** abrir o site no computador e mostrar a mesma mudança lá.
5. **Minha lista** e **Perfil:** abas por status com as cores do site, números da lista; "Ver perfil completo" abre o perfil público nativo.
6. **Descobrir (atalhos no Início):** Swipe (arrastar a carta para os lados), Roleta (girar), Calendário (episódios da semana no seu horário), Explorar (filtros) e Pra você (recomendações com "porque você curtiu…").
7. No Detalhe, tocar num personagem → dublador → outro personagem: tudo nativo.

## 4. Todas as funções do site (2 min)
- Aba **Mais**: as marcadas NATIVO abrem telas do app; Jogos, Watch party e Chat abrem dentro do app **já logado**, sem pedir senha de novo.
- Explicar em uma frase como: o app grava a sessão no `localStorage` do site antes de abrir a página.

## 5. Por dentro (2 min)
- Desenho das camadas (View → ViewModel → Core → APIs) de `ARQUITETURA.md`.
- MVVM com CommunityToolkit, injeção de dependências em `MauiProgram.cs`, navegação com Shell.
- Rodar `dotnet test` ao vivo: 103 testes passando.

## Perguntas prováveis

**"Isso não é só um site dentro do app?"**
Não: 16 telas são XAML nativo com ViewModels em C# chamando as APIs direto (Início, Busca, Detalhe, Minha lista, Perfil, Calendário, Explorar, Swipe, Roleta, Pra você, Personagem, Dublador, Estúdio, Perfil público, Mais, Login). O WebView só entra para jogos, chat, watch party, amigos, moderação e pagamentos — que dependem de regras do servidor e tempo real.

**"Como o app e o site não brigam pela lista?"**
A lista é um documento JSON. O app relê antes de gravar e só mexe no item alterado, com `updatedAt` novo; o site junta pela regra "vence o mais novo". Tem teste para isso (`Update_RefetchesBeforeWrite`).

**"E a segurança? A chave está no código."**
É a chave pública do Supabase (a mesma do site). Quem protege os dados é o RLS do banco: cada pessoa só lê e grava a própria linha, porque toda requisição leva o token do usuário.

**"Funciona sem internet?"**
Os dados vêm de APIs online, então não; mas o app não trava: mostra "Sem conexão. Toque para tentar de novo." em todas as telas.

**"Por que não tem login com Google?"**
O Google bloqueia login dentro de WebView; é preciso abrir o navegador do sistema e liberar um endereço de retorno no Supabase. Está documentado como próximo passo.

**"Roda no iPhone?"**
O projeto já tem o alvo iOS; falta um Mac para compilar e assinar.

**"O que vem depois?"**
Notificações push nativas (Firebase), login com Google, fonte do site nos títulos, publicação na Play Store.
