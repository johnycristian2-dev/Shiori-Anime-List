# Decisões do projeto (e o que foi descartado)

## 1. Por que .NET MAUI
- Tecnologia recomendada pela disciplina.
- Um código C# para Android, iOS e Windows; XAML para as telas; MVVM pronto com o CommunityToolkit.
- Descartados: **Capacitor** (reaproveitaria o site inteiro, mas não seria MAUI), **React Native/Flutter** (outra linguagem, fora do pedido).

## 2. Modelo misto: telas principais nativas + resto do site dentro do app
- O site tem ~40 telas. Refazer todas em XAML levaria meses; o app precisava ter **todas as funções** e ser **app de verdade**.
- Solução: **16 telas nativas** — Login, Início, Busca, Detalhe, Minha lista, Perfil, Mais, Calendário, Explorar, Swipe, Roleta, Pra você, Personagem, Dublador, Estúdio e Perfil público. As demais abrem o **site publicado dentro do app**, já logado.
- Ficaram na parte web as que dependem de regras do servidor ou tempo real: **Jogos e Liga** (respostas validadas no servidor contra trapaça), **Chat e Watch party** (tempo real), **Amigos**, **Moderação** (papéis checados no servidor) e **Apoiar** (pagamento). Refazer essas telas não traria nada novo e arriscaria quebrar regras de segurança.
- Descartados: **só WebView** (pareceria "site dentro de app" e quase não teria MAUI) e **só nativo** (não daria para ter tudo).

## 3. Site ao vivo no WebView, e não uma cópia empacotada (HybridWebView)
- Ao vivo: cada deploy do site já aparece no app, sem gerar APK novo; o login por link de retorno do site continua funcionando.
- Empacotado: funcionaria sem internet, mas ficaria desatualizado e quebraria os retornos de login. Como o app precisa de internet de qualquer jeito (dados vêm do Supabase/AniList), não compensava.

## 4. HttpClient puro em vez do SDK do Supabase para C#
- Cada requisição fica explícita no código (fácil de explicar e testar com servidor falso).
- O SDK em C# é da comunidade e fica atrás do oficial de JavaScript.

## 5. Mesma sessão no app e na parte web
- O app guarda a resposta do login no **SecureStorage** e escreve a **mesma** resposta no `localStorage` do site, no formato que o site já entende.
- Cuidado tratado: o Supabase troca o *refresh token* a cada renovação. Por isso o app **lê a sessão do site antes de gravar a sua** e de novo a cada página carregada (`AdoptIfNewerAsync`), ficando sempre com a mais nova; se a parte web tiver outra conta, os dados do site são apagados antes. Isso foi corrigido depois da revisão de código (antes só lia ao sair, e o app podia sobrescrever um token mais novo do site).

## 6. Lista: reler antes de gravar e mexer só no que mudou
- A lista é um documento JSON único (tabela `user_data`). Gravar o documento antigo por cima apagaria o que foi feito no site.
- O app relê, muda só a entrada, grava `updatedAt` novo e preserva campos que não conhece. Mesmas automações e histórico do site (a Retrospectiva continua contando o que foi visto pelo app).

## 7. Login com Google fora do app (por enquanto)
- O Google bloqueia login dentro de WebView. Para funcionar, o app teria que abrir o navegador do sistema e voltar por um endereço `shiori://auth`, que precisa ser liberado no painel do Supabase pelo dono do projeto.
- Hoje: e-mail e senha. Quem só usa Google pode criar uma senha no site.

## 8. Fora desta versão
- **iPhone:** o projeto já compila para iOS, mas exige Mac para gerar e testar.
- **Notificações push nativas:** o site usa Web Push, que não funciona dentro do app; precisaria de Firebase (Android) e APNs (iPhone).
- **Watch party sincronizada com o Crunchyroll:** depende da extensão do navegador do computador.
- **Play Store:** gerado APK para instalar direto; publicar exige conta de desenvolvedor e regras de pagamento da loja (o Shiori Plus usa Mercado Pago).

## 9. Qualidade
- Regras sem tela ficam no `Shiori.Core` e têm **103 testes** automáticos (xUnit).
- Uma revisão independente do código encontrou 1 problema crítico e 4 importantes (sessão da parte web, erro passageiro deslogando, mensagem de sessão expirada, +1 desfazendo progresso do site, troca de conta misturando listas). Todos foram corrigidos com um teste que reproduz o problema antes da correção.
- Mensagens de erro sempre em português e com "tentar de novo"; nada de travar sem internet.
- Visual tirado do site (mesmas cores e cores de status) e centralizado em `Resources/Styles` para a direção de arte ajustar.
