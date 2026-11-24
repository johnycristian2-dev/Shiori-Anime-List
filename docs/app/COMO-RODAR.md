# Como rodar o app Shiori (.NET MAUI)

## O que precisa estar instalado

- **Visual Studio 2026** com a carga de trabalho **"Desenvolvimento de interface do usuário de aplicativo multiplataforma do .NET" (MAUI)** — já instala o .NET 10, o SDK do Android e o Java.
- Para testar no celular: um Android com **Opções do desenvolvedor → Depuração USB** ligada, ou só instalar o APK.
- iPhone: precisa de um Mac (não faz parte desta entrega).

## Pelo Visual Studio (mais fácil)

1. Abra `mobile/Shiori.slnx`.
2. Escolha o projeto **ShioriApp** como inicial.
3. No seletor de destino, escolha **Windows Machine** (roda no notebook) ou o seu **celular Android** conectado por USB.
4. F5.

## Pela linha de comando (pasta `mobile/`)

```bash
dotnet test Shiori.Core.Tests                                   # 103 testes das regras do app
dotnet build ShioriApp -f net10.0-windows10.0.19041.0 -t:Run    # abre no Windows
dotnet build ShioriApp -f net10.0-android -t:Run                # instala e abre no Android conectado
dotnet publish ShioriApp -f net10.0-android -c Release          # gera o APK
```

O APK fica em `mobile/ShioriApp/bin/Release/net10.0-android/publish/app.shiori.anime-Signed.apk`.
Para instalar: mande o arquivo para o celular e abra (o Android pede para permitir "instalar apps de fontes desconhecidas").

## Atalho de desenvolvimento

Só no modo Debug: a variável de ambiente `SHIORI_START` abre o app direto numa tela, sem passar pelo login (útil para apresentar ou tirar prints):

```powershell
$env:SHIORI_START = "//home"                 # Início
$env:SHIORI_START = "detail?id=154587"       # Detalhe do Frieren
$env:SHIORI_START = "//more"                 # aba Mais
$env:SHIORI_START = "calendar"               # Calendário (também: explore, swipe, roulette, foryou)
```

As telas que dependem da conta (Minha lista, Perfil) mostram "Entre na sua conta para continuar" nesse modo.

## Login

Use a mesma conta do site (e-mail e senha). Cadastro e "esqueci a senha" abrem o site no navegador.
Login com Google não está no app (o Google bloqueia login dentro de WebView; veja `DECISOES.md`).
