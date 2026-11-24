# Shiori — app de celular (.NET MAUI)

- `ShioriApp/` — o app (telas XAML, ViewModels, serviços do aparelho).
- `Shiori.Core/` — regras sem tela: login, lista, AniList (testável).
- `Shiori.Core.Tests/` — testes xUnit do Core.

Comandos (nesta pasta):

```bash
dotnet test Shiori.Core.Tests
dotnet build ShioriApp -f net10.0-windows10.0.19041.0 -t:Run   # roda no Windows
dotnet publish ShioriApp -f net10.0-android -c Release        # gera o APK
```

Documentação completa: `../docs/app/`.
