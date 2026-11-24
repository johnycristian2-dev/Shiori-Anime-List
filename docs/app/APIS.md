# APIs que o app usa

Todas por HTTPS com `HttpClient` (sem SDK), para cada chamada ficar visível no código.
Nada aqui é segredo: a chave do Supabase é a pública (*publishable*), a mesma do site; quem protege os dados são as políticas **RLS** do banco, que olham o token do usuário.

## 1. Supabase Auth (login) — `Shiori.Core/Auth/AuthService.cs`

Base: `https://ahtalxodwxzmjltbxmaz.supabase.co/auth/v1`. Todas levam o cabeçalho `apikey: <chave pública>`.

### Entrar
```http
POST /auth/v1/token?grant_type=password
Content-Type: application/json

{ "email": "voce@exemplo.com", "password": "••••" }
```
Resposta (200) — guardada inteira no SecureStorage e usada também pela parte web:
```json
{ "access_token": "eyJ…", "token_type": "bearer", "expires_in": 3600, "expires_at": 1795500000,
  "refresh_token": "abc123", "user": { "id": "uuid-do-usuario", "email": "voce@exemplo.com" } }
```
Erros tratados: `invalid_credentials` → "E-mail ou senha incorretos."; `email_not_confirmed` → "Confirme seu e-mail antes de entrar."; captcha → "Entre pelo site"; sem rede → "Sem conexão. Toque para tentar de novo."

### Renovar o token (automático, faltando menos de 60 s para vencer)
```http
POST /auth/v1/token?grant_type=refresh_token
{ "refresh_token": "abc123" }
```
Se o servidor **recusar** (400/401/403), a sessão acabou: o app limpa tudo e volta ao Login mostrando "Sua sessão expirou. Entre de novo.". Se for erro passageiro (5xx ou 429), a sessão é mantida e a tela mostra "O servidor está com problema. Tente de novo em instantes.".

### Sair
```http
POST /auth/v1/logout
Authorization: Bearer <access_token>
```

## 2. Supabase REST (dados) — `Shiori.Core/Supabase/SupabaseRest.cs`

Base: `https://ahtalxodwxzmjltbxmaz.supabase.co/rest/v1`. Cabeçalhos: `apikey` + `Authorization: Bearer <access_token>`.

### Ler a lista — `ListService.LoadAsync`
```http
GET /rest/v1/user_data?select=doc&user_id=eq.<uuid>
```
```json
[ { "doc": { "entries": { "154587": { "mediaId": 154587, "title": "Sousou no Frieren", "status": "WATCHING",
      "progress": 5, "score": 9, "updatedAt": 1795500000000 } }, "deleted": {}, "lists": {}, "skipped": [], "history": [] } } ]
```
Lista vazia (`[]`) = usuário novo → o app cria um documento vazio.

### Gravar a lista — `ListService.UpdateAsync`
Sempre depois de reler (veja `ARQUITETURA.md`).
```http
POST /rest/v1/user_data
Prefer: resolution=merge-duplicates,return=minimal

{ "user_id": "<uuid>", "doc": { …documento inteiro… }, "device": "app", "updated_at": "2026-11-24T05:00:00Z" }
```
`resolution=merge-duplicates` = "upsert": atualiza a linha do usuário se já existir.

### Meu perfil — `ProfileService.GetMineAsync`
```http
GET /rest/v1/profiles?select=user_id,username,display_name,avatar_url&user_id=eq.<uuid>
```

### Perfil público — `ProfileService.GetPublicAsync`
```http
GET /rest/v1/profiles?select=user_id,username,display_name,avatar_url,snapshot&username=eq.<apelido>
```
O apelido é validado antes (`^[a-z0-9_]{3,20}$`, mesma regra do site). O `snapshot` é o resumo público que o site publica (`rank`, `stats`, `entries` com nomes curtos: `t` título, `c` capa, `s` status, `sc` nota, `p` progresso, `f` favorito).

## 3. AniList GraphQL — `Shiori.Core/AniList/AniListClient.cs`

Endpoint único: `POST https://graphql.anilist.co` com `{ "query": "…", "variables": { … } }`. Não precisa de login. As consultas estão em `AniList/Queries.cs` (mesmos campos do site).

| Método | Variáveis | Ordenação |
|---|---|---|
| `TrendingAsync(type)` | `type: ANIME/MANGA` | `TRENDING_DESC` |
| `SeasonAsync(year, season)` | `season: FALL`, `year: 2026` | `POPULARITY_DESC` |
| `SearchAsync(text, type)` | `search`, `type` | `SEARCH_MATCH` |
| `DetailAsync(id)` | `id` | — (traz sinopse, estúdios, personagens, próximo episódio) |
| `BrowseAsync(filtro, página)` | `type`, `sort`, `genres`, `season`, `seasonYear`, `formats`, `country` (só os escolhidos) | o escolhido |
| `GenresAsync()` | — | lista `GenreCollection` (sem o gênero adulto) |
| `AiringAsync(de, até)` | `from`, `to` (segundos Unix), `page` | `TIME` — segue até 8 páginas de 50 |
| `CharacterAsync(id)` | `id` | animes do personagem por `POPULARITY_DESC`, com dublador japonês |
| `StaffAsync(id, página)` | `id`, `page` | personagens feitos, por popularidade |
| `StudioAsync(id, página)` | `id`, `page` | obras principais por popularidade |
| `RecommendationsAsync(ids)` | — (ids no texto da consulta, um apelido `m0…` por título) | `RATING_DESC` |

Exemplo de resposta (resumida):
```json
{ "data": { "Page": { "media": [ { "id": 154587, "title": { "romaji": "Sousou no Frieren", "english": "Frieren: Beyond Journey's End" },
  "coverImage": { "extraLarge": "https://…" }, "episodes": 28, "averageScore": 91, "genres": ["Adventure","Drama"] } ] } } }
```
Erros tratados: 429 → "O AniList pediu uma pausa…"; 404/sem dados → "Não encontrei esse título no AniList."; 5xx/sem rede → "Sem conexão…".

## 4. Site (parte web) — `Shiori.Core/Web/WebBridge.cs`

Não é API: o app abre `https://shiori-anime-list.vercel.app/<rota>` num `WebView` e troca a sessão pelo `localStorage` (chave `sb-ahtalxodwxzmjltbxmaz-auth-token`) com JavaScript:
- entrar: `localStorage.setItem(chave, sessão); location.replace(rota)`;
- ler de volta: `btoa(...localStorage.getItem(chave))` (base64 para chegar igual no Android e no Windows).
