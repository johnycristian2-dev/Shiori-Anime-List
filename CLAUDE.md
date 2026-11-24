# Shiori 栞 — guia pro Claude Code

Site de lista de animes/mangás com social, watch party, jogos e calendário.
Produção: https://shiori-anime-list.vercel.app (deploy automático da Vercel a cada push na `main`).

## Como falar comigo (dono do projeto)
- Responda em **português do Brasil**, direto e curto. Explique o que mudou, não o passo a passo.
- Textos do site também em português simples; comentários do código em português.
- Antes de algo destrutivo no banco (apagar dados, `drop`) ou gasto de dinheiro, pergunte.

## Stack
- Vite + React 19 + TypeScript + Tailwind v4, zustand (estado), @tanstack/react-query (dados), react-router (BrowserRouter, endereços normais tipo `/anime/123`).
- PWA com vite-plugin-pwa; push em `public/push-sw.js`.
- Dados dos animes: API GraphQL do AniList (`src/api`).
- Backend: Supabase (projeto `ahtalxodwxzmjltbxmaz`): Postgres com RLS, funções `SECURITY DEFINER`, pg_cron, pg_net, Edge Functions (Deno) e Storage.
- Vercel: site estático + `api/page.ts` (edge) que injeta título/descrição/imagem (Open Graph) em `/anime/:id`, `/manga/:id` e `/u/:apelido`. Rotas em `vercel.json` (também tem os cabeçalhos de segurança/CSP).

## Comandos
```bash
npm install
npm run dev          # site local
npm test             # vitest
npm run build        # sitemap + tsc + testes + build (o mesmo que a Vercel roda; se falhar, não publica)
npm run build:ext    # extensão em extension/dist + pacote da Chrome Web Store em extension/store
node scripts/i18n-missing.mjs        # textos sem tradução EN/JA
node scripts/check-extension.mjs     # valida o manifesto da extensão
```
Local precisa de `.env.local` (veja `.env.example`). Os valores `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são públicos (chave *publishable*) e estão nas variáveis da Vercel.

CI: `.github/workflows/ci.yml` roda tipos, testes, build, traduções e extensão em todo push.

## Estrutura
- `src/pages` — telas (Moderação em `Moderation.tsx`, abas por `?tab=`).
- `src/components` — UI; `OwnerPanel.tsx`/`AdminPanels.tsx` são o painel de moderação/dono.
- `src/sync` — tudo que fala com o Supabase (`admin.ts`, `perks.ts`, `games.ts`, `push.ts`, `cloud.ts`…).
- `src/store` — zustand (`list.ts` é a lista do usuário, salva no navegador e sincroniza).
- `src/lib/i18n.ts` + `src/lib/i18n/{en,ja}.ts` — tradução. **O texto em português é a chave**: `t('Minha lista')`, placeholders posicionais `t('{0} animes', n)`. Todo texto novo precisa entrar em `en.ts` e `ja.ts` (o CI confere).
- `src/lib/errorLog.ts` — erros do navegador vão pra tabela `client_errors` (aba Erros da Moderação).
- `supabase/*.sql` — histórico do banco (aplicado via migrations). `supabase/functions/*` — Edge Functions.
- `extension/` — extensão "Shiori Watch Party" (Crunchyroll), MV3.
- `ROADMAP.md` — pendências (a página `/roadmap` lê `src/lib/roadmap.ts`).

## Regras importantes
- **Segredos nunca no código nem no chat.** Token do Mercado Pago fica em Supabase Secrets (`MP_ACCESS_TOKEN`), e o dono é quem coloca. Chaves VAPID, sal dos jogos e segredo dos avisos da equipe ficam na tabela `app_secrets` (sem acesso pelo app).
- Papéis: `is_admin()` (tabela `admins` ou dono) e `is_owner()` (`user_perks.owner`). Toda ação de moderação confere o papel **no servidor** e grava em `mod_log`.
- Jogos (Animedle, Capa, Maior ou Menor) são validados no servidor (anti-trapaça): não mover a lógica de resposta pro navegador.
- Novas tabelas: sempre `enable row level security` e políticas explícitas; funções `security definer` com `set search_path = public` e `revoke ... from public`.
- Imagens/textos de usuários passam por filtros (`has_hate_terms`, `banned_terms`, limites de tamanho).
- Edge Functions: `shiori-pay`/`shiori-pay-refund`/`shiori-admin` exigem JWT; `shiori-pay-webhook`, `game-cover`, `shiori-tick`, `shiori-staff-push`, `shiori-backup` não (fazem a própria checagem).

## Pendências que dependem do dono
- Domínio próprio; token do Mercado Pago; tag de afiliado da Amazon; chaves do Turnstile (Site Key na Moderação → Site, depois o segredo no Supabase).
- Vercel → Firewall → Bot Management → bloquear robôs de IA.
- Publicar a extensão na Chrome Web Store (pacote gerado por `npm run build:ext`).

## Ideia de próximo passo (desempenho)
A nota de desempenho mobile no Lighthouse ainda é baixa porque a página inicial espera o JS e depois o AniList. Caminho sugerido: guardar a resposta da página inicial pronta (ex.: função na Vercel com cache) e começar essa busca antes do app montar.
