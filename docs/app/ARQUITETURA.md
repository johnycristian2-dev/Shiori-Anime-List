# Arquitetura do app Shiori

## Visão geral

O app é **misto**: as telas principais são **nativas** (XAML + C#) e o resto do site abre **dentro do app**, já logado, num `WebView`.

```
┌──────────────────────────────── App MAUI (ShioriApp) ────────────────────────────────┐
│  Shell (abas):  Início │ Buscar │ Minha lista │ Perfil │ Mais                          │
│                                                                                        │
│  Views (XAML)  ──binding──▶  ViewModels (C#, MVVM)  ──chama──▶  Shiori.Core (serviços)  │
│  HomePage                    HomeViewModel                       AuthService           │
│  SearchPage                  SearchViewModel                     ListService           │
│  DetailPage                  DetailViewModel                     AniListClient         │
│  MyListPage                  MyListViewModel                     ProfileService        │
│  ProfilePage                 ProfileViewModel                    WebBridge             │
│  LoginPage / MorePage        LoginViewModel / MoreViewModel                            │
│  WebPage (site no WebView) ──────────────── sessão compartilhada ─────┘               │
└────────────────────────────────────────────────────────────────────────────────────────┘
            │ HTTPS                                    │ HTTPS
            ▼                                          ▼
   Supabase (mesmo do site)                     AniList GraphQL
   • Auth: login, renovar token                 • em alta, temporada, busca, detalhe
   • REST: user_data (lista), profiles
```

## As três camadas

| Camada | Pasta | O que faz | Exemplo |
|---|---|---|---|
| **View** | `mobile/ShioriApp/Views` | Só o desenho da tela (XAML). Não tem regra. | `DetailPage.xaml` |
| **ViewModel** | `mobile/ShioriApp/ViewModels` | Estado da tela e comandos (botões). Liga a tela aos serviços. | `DetailViewModel.IncrementCommand` |
| **Core** | `mobile/Shiori.Core` | Regras e acesso às APIs. Não conhece tela nenhuma, por isso tem testes. | `ListDocument.SetProgress` |

### MVVM em uma frase
A tela (View) mostra propriedades do ViewModel por **binding** (`{Binding ProgressText}`); quando o ViewModel muda uma propriedade marcada com `[ObservableProperty]`, a tela se atualiza sozinha; botões chamam **comandos** (`[RelayCommand]`). Isso vem do pacote **CommunityToolkit.Mvvm**.

### Injeção de dependências
`MauiProgram.cs` registra tudo:
- **Serviços** (`AuthService`, `ListService`, `AniListClient`, `ProfileService`) como **singleton**: um só para o app inteiro, assim a sessão e a lista são as mesmas em todas as telas.
- **Telas e ViewModels** como **transient**: o MAUI cria e entrega pronto (`DetailPage(DetailViewModel vm)`).

### Navegação (Shell)
`AppShell.xaml` define a rota `login` e a barra de abas. As telas por cima das abas são registradas em `AppShell.xaml.cs`:
- `detail` (Detalhe nativo, recebe `id`);
- `web` (parte web, recebe `route` e `title`).

Atalhos em `Services/Navigation.cs`: `Navigation.OpenDetailAsync(id)` e `Navigation.OpenWebAsync("/jogos", "Jogos")`.

## Fluxo ao abrir o app

1. `App.xaml.cs` chama `AuthService.RestoreAsync()` → lê a sessão do **SecureStorage** do celular.
2. Sem sessão → tela **Login**. Com sessão → aba **Início**.
3. Se a sessão acabar no meio do uso (token recusado ou "Sair"), `AuthService.SignedOut` dispara e o app volta para o Login.

## Sessão compartilhada com a parte web

O site guarda a sessão no `localStorage`, na chave `sb-ahtalxodwxzmjltbxmaz-auth-token`. O app usa **o mesmo formato** (é a resposta crua do Supabase Auth), então:

1. `WebPage` abre `https://shiori-anime-list.vercel.app/robots.txt` (página leve do mesmo domínio);
2. roda `WebBridge.BuildInjectScript(...)`: grava a sessão no `localStorage` e vai para a rota pedida → o site já abre logado;
3. ao sair da página, roda `WebBridge.ReadSessionScript` e `AuthService.AdoptIfNewerAsync(...)`: se o site renovou o token enquanto estava aberto, o app passa a usar o novo (o Supabase invalida o token antigo a cada renovação).

## A lista sem perder dados

A lista do usuário é **um documento JSON** na tabela `user_data` (coluna `doc`), o mesmo que o site usa. O site junta versões de aparelhos diferentes pela regra "em cada anime vence o `updatedAt` mais novo". O app respeita isso:

- `ListService.UpdateAsync(mudança)` sempre **relê** o documento do servidor, aplica a mudança **só na entrada alterada** com `updatedAt = agora` e grava;
- `ListDocument` guarda o JSON inteiro (`JsonObject`), então campos que o app não conhece (listas personalizadas, histórico, gacha, notas) **não se perdem**;
- remover deixa uma "lápide" em `deleted`, igual ao site, para outro aparelho não trazer o item de volta.

## Testes

`mobile/Shiori.Core.Tests` (xUnit, 73 testes) cobre o Core sem rede: um servidor falso (`FakeHandler`) responde e guarda o que o app enviou. Exemplos: senha errada vira "E-mail ou senha incorretos.", token vencido é renovado, a lista nunca apaga o que veio do site, a sinopse do AniList perde o HTML.
