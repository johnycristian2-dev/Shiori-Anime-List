# App Shiori para celular (.NET MAUI) — design

Data: 24/11/2026 · Status: aguardando aprovação

## Intenção

Ter o Shiori como **aplicativo de celular** para:
1. **Projeto da faculdade**: a tecnologia recomendada é **.NET MAUI**; o app deve seguir o site e ter **todas as funções** dele, e ser um app de celular de verdade.
2. **Mobilidade**: abrir pelo ícone, tela cheia, usar a mesma conta do site.

O dono cuida da **apresentação e da direção criativa**; o desenvolvimento fica com o Claude. Por isso o dono precisa **entender e saber explicar** cada tela, função, chamada de API e decisão — a documentação é parte da entrega, não um extra.

Prazo: **quarta-feira** (a confirmar se é 25/11 ou 02/12). O plano é ordenado para ter algo apresentável o quanto antes.

## Objetivos

- App MAUI (C#/.NET 10) que roda no **Android** (alvo principal) e no **Windows** (para demonstrar no notebook).
- **6 telas nativas** em XAML + MVVM: Login, Início, Busca, Detalhe (anime/mangá), Minha lista, Perfil.
- **Todas as outras funções do site** (calendário, explorar, swipe, roleta, maratona, retrospectiva, comparar, amigos, chat, party, liga, jogos, temas, apoiar, feedback, moderação…) acessíveis dentro do app, já logado.
- Mesma conta e mesmos dados do site (mesmo Supabase e AniList). Mudou no app, aparece no site e vice-versa.
- Documentação em português para estudo e apresentação.

## Não objetivos

- Reescrever as ~40 telas em XAML.
- iPhone (exige Mac para compilar; o projeto já fica pronto para iOS, mas não será testado).
- Publicar na Play Store.
- Watch party sincronizada com o Crunchyroll (depende da extensão do navegador).
- Notificações push nativas (Firebase/APNs) — ficam como próximo passo documentado.
- Mudanças no banco ou nas Edge Functions.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Parecer "só um site dentro de um app": as telas principais precisam ser nativas e a navegação (abas) também.
- Pedir login duas vezes (uma no nativo e outra na parte web).
- Estragar a lista do usuário: o app nunca pode sobrescrever mudanças feitas no site.
- Código que o dono não consiga explicar: nada de mágica sem comentário/documentação.

## Restrições encontradas no projeto

- **Lista do usuário** fica num único documento JSON em `user_data.doc` (por `user_id`), com `entries` indexado pelo id do AniList, `updatedAt` em cada entrada e `deleted` (lápides). O site mescla por `updatedAt`. O app deve: ler o doc → alterar só a entrada → gravar `updatedAt` novo → `upsert` (sempre relendo antes de gravar).
- **Login** do site usa Supabase Auth com PKCE; e-mail/senha, código por e-mail e Google. O Turnstile (captcha) só entra se `app_config.turnstile_site` estiver configurado — hoje não está (pendência do dono). Se for ativado, o login nativo precisará de ajuste.
- **Google dentro de WebView é bloqueado pelo Google.** No app, Google só via navegador do sistema (`WebAuthenticator`) e exige o dono adicionar `shiori://auth` nas Redirect URLs do Supabase. Fica opcional.
- **Sessão do site** fica no `localStorage` do domínio, chave `sb-ahtalxodwxzmjltbxmaz-auth-token` (formato do supabase-js v2: `access_token`, `refresh_token`, `expires_at`, `user`…).
- Ambiente local: .NET SDK 10.0.401 com workloads MAUI Android/iOS/Windows instalados (Visual Studio).

## Abordagens consideradas

| | Como | Prós | Contras |
|---|---|---|---|
| A. Híbrido puro | O site inteiro num WebView do MAUI + recursos nativos em volta | Todas as telas já | Pouco MAUI de verdade; "site dentro de app" |
| B. Nativo puro | Refazer telas em XAML/C# | MAUI de livro | ~6 telas no prazo; não cumpre "todas as funções" |
| **C. Misto (escolhida)** | Telas principais nativas + resto do site num WebView, com a mesma sessão | Todas as funções **e** MAUI de verdade para mostrar | Mais trabalho; visual nativo parecido, não idêntico |

Escolha do dono: **C**. Rede de segurança: se o prazo apertar, a parte web (A) entra primeiro e garante todas as funções; as telas nativas vão sendo entregues em cima.

## Design

### Estrutura

```
mobile/
  ShioriApp/                 projeto .NET MAUI (net10.0-android; net10.0-windows; net10.0-ios)
    App.xaml / AppShell.xaml Shell com barra de abas
    Models/                  Media, ListEntry, ListDoc, Profile, Session
    Services/
      AuthService            login/logout, guarda a sessão no SecureStorage, renova o token
      SupabaseService        REST do Supabase (user_data, profiles) com o token do usuário
      AniListService         GraphQL do AniList (em alta, busca, detalhe)
      ListService            ler/mesclar/gravar o documento da lista com segurança
      WebBridge              passa a sessão para a parte web e abre rotas do site
    ViewModels/              um por tela (CommunityToolkit.Mvvm)
    Views/                   LoginPage, HomePage, SearchPage, DetailPage, MyListPage, ProfilePage, MorePage, WebPage
    Resources/               ícone, splash, cores e fontes do Shiori
  ShioriApp.Tests/           testes das regras sem tela (mesclagem da lista, cálculo de progresso)
docs/app/                    documentação para estudo e apresentação
```

Fica dentro deste repositório (`mobile/`), sem afetar o site: o build do Vite/Vercel e o CI atuais não olham essa pasta.

### Navegação (Shell)

Abas: **Início · Buscar · Minha lista · Perfil · Mais**. Sem sessão, abre o **Login** antes das abas.

- **Mais**: lista nativa de todas as outras seções do site (com ícone e descrição). Tocar abre a `WebPage` na rota certa (`/calendario`, `/jogos`, `/party`…).
- Links dentro do detalhe nativo (personagem, estúdio, dublador) também abrem a `WebPage`.

### Telas nativas

| Tela | O que mostra / faz | De onde vêm os dados |
|---|---|---|
| Login | E-mail e senha; criar conta e esqueci a senha abrem o site | Supabase Auth (`/auth/v1/token?grant_type=password`) |
| Início | Em alta, temporada atual, "continuar assistindo" (da sua lista) | AniList GraphQL + `user_data` |
| Busca | Campo de busca, filtro anime/mangá, resultados com capa | AniList GraphQL (`Page.media(search:)`) |
| Detalhe | Capa, banner, nota, gêneros, sinopse, episódios; botão "adicionar/alterar status", progresso +1, nota, favorito | AniList GraphQL + `ListService` |
| Minha lista | Abas por status (Assistindo, Planejo, Completo, Pausado, Larguei), +1 episódio, abrir detalhe | `ListService` (`user_data.doc`) |
| Perfil | Avatar, apelido, contagens da lista, sair, abrir perfil completo/editar no site | `profiles` + `user_data` |

### Sessão compartilhada nativo ↔ web

1. Login nativo → Supabase devolve `access_token` e `refresh_token` → guardados no `SecureStorage` do celular.
2. Ao abrir a `WebPage`, o `WebBridge` carrega `https://shiori-anime-list.vercel.app`, grava a sessão no `localStorage` (mesma chave e formato do supabase-js) e recarrega na rota pedida. O site já entra logado.
3. Logout no app limpa o `SecureStorage` e o `localStorage` do WebView.

A parte web usa o **site publicado** (não uma cópia dentro do app): fica sempre atualizada a cada deploy e não precisa mudar o site. Decisão do Claude: troca o `HybridWebView` (site empacotado) pelo `WebView` com o site ao vivo, porque o empacotado quebraria o login por link de retorno e ficaria desatualizado.

### Lista sem perder dados

`ListService.UpdateEntry(mediaId, mudança)`: busca o doc atual no Supabase → aplica a mudança só naquela entrada com `updatedAt = agora` → `upsert`. Como o site mescla por `updatedAt`, a mudança do app vence só onde ela é mais nova. Testado em `ShioriApp.Tests`.

### Visual

Segue o tema escuro do site (cores, cantos e fontes tiradas do CSS do site). A direção criativa é do dono: as cores e fontes ficam centralizadas em `Resources/Styles` para ele ajustar.

### Documentação (`docs/app/`)

- `COMO-RODAR.md` — abrir no Visual Studio, rodar no emulador Android/Windows, gerar APK.
- `ARQUITETURA.md` — camadas (Views → ViewModels → Services → APIs), MVVM, Shell, por que o modelo misto.
- `TELAS.md` — cada tela: o que faz, de onde vêm os dados, arquivos envolvidos.
- `APIS.md` — cada chamada (Supabase Auth, REST, AniList GraphQL) com exemplo de requisição e resposta.
- `DECISOES.md` — decisões e alternativas descartadas (MAUI × outras, WebView ao vivo × empacotado, sessão compartilhada).
- `ROTEIRO-APRESENTACAO.md` — sugestão de ordem de demonstração e perguntas prováveis com resposta.

### Testes e verificação

- `ShioriApp.Tests` (xUnit): mesclagem da lista, mudança de progresso/status, parsing do AniList.
- Build `net10.0-android` e `net10.0-windows` sem erros.
- Rodar no Windows e no emulador Android (se o emulador estiver instalado; senão, APK para o celular do dono).

## Ordem de entrega

1. Projeto MAUI + Shell + Login + WebPage com sessão compartilhada + aba Mais → **todas as funções já acessíveis**.
2. Início, Busca e Detalhe nativos.
3. Minha lista e Perfil nativos (com gravação segura da lista).
4. Visual, ícone e splash.
5. Documentação e roteiro da apresentação.

## Fica a cargo do construtor

Nomes de classes, layout fino das telas, quais consultas GraphQL exatas, tratamento de erro e carregamento.

## Pendências do dono

- Confirmar a data da entrega.
- (Opcional) Adicionar `shiori://auth` nas Redirect URLs do Supabase para o login com Google no app.
- Revisar cores/ícone (direção criativa).
