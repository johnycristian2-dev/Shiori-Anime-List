# Visual do app — onde mudar cada coisa

Tudo foi tirado do site (`src/index.css`, tema escuro), para app e site parecerem o mesmo produto.

## Cores — `Colors.xaml`

| Nome | Cor | Onde aparece |
|---|---|---|
| `Bg` | `#0c0a1d` | fundo de todas as telas |
| `Panel` | `#1a1538` | cartões, barra de abas |
| `Line` | `#2e2660` | bordas, botões secundários, etiquetas |
| `Ink` | `#f5f1ff` | texto principal |
| `Muted` | `#a59fca` | texto secundário, abas não selecionadas |
| `Pink` | `#cbb2ff` | cor de destaque: botões, aba ativa, ícone |
| `OnPink` | `#1a1240` | texto em cima do rosa |
| `Cyan` | `#3de2ff` | próximo episódio |
| `Yellow` | `#ffe14d` | notas (★) |
| `Danger` | `#ff6b6b` | erros, remover, sair |
| `Status*` | cores dos status | iguais às do site (Assistindo, Quero ver…) |

Trocar uma cor aqui muda o app inteiro. O bloco "Nomes do template" no fim do arquivo só repassa a paleta para os estilos padrão do MAUI.

## Estilos — `Shiori.xaml`

`Display` (títulos grandes), `SectionTitle`, `Caption` (rótulos em caixa alta), `Muted`, `Card` (cartões com borda), `Chip` (etiquetas arredondadas), `Ghost` (botão-link) e `Square` (botões +1/−1).

## Fonte de destaque

O site usa **Dela Gothic One** nos títulos. O app usa o apelido de fonte `Display` (hoje apontando para Open Sans Semibold). Para usar a mesma fonte do site:

1. Baixe `DelaGothicOne-Regular.ttf` em fonts.google.com (licença OFL, pode ser incluída no app).
2. Coloque em `Resources/Fonts/`.
3. Em `MauiProgram.cs`, troque `fonts.AddFont("OpenSans-Semibold.ttf", "Display");` por `fonts.AddFont("DelaGothicOne-Regular.ttf", "Display");`.

## Ícone e abertura

- `Resources/AppIcon/appicon.svg` — fundo do ícone (rosa `#cbb2ff`).
- `Resources/AppIcon/appiconfg.png` — o 栞 em cima do fundo.
- `Resources/Splash/splash.png` — o 栞 rosa na tela de abertura (fundo `#0c0a1d`, definido no `ShioriApp.csproj`).
- `Resources/Images/tab_*.svg` — ícones das abas (traço simples; a cor é aplicada pelo Shell).
