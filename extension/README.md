# Shiori Watch Party (extensão)

Sincroniza o player do Crunchyroll entre os membros de uma sala da watch party do Shiori e mostra o chat da sala por cima do vídeo.

## Como funciona

- `src/bg.ts`: background. É o único que fala com o Supabase: faz login, entra na sala, escuta `party_playback` e `party_messages` em tempo real e repassa para as abas.
- `src/crunchy.ts`: roda em todas as frames do Crunchyroll. A frame que tem o `<video>` manda play/pause/pulos feitos pela pessoa e aplica os comandos dos amigos. O chat (botão 栞) fica num Shadow DOM.
- `src/site.ts`: roda no site Shiori, para a página detectar a extensão e conectar ela à sala ("Conectar à sala").
- `src/popup.ts`: login com a conta Shiori e escolha da sala.

Regras de sincronia:

- Só viram comando para a sala os eventos que vêm de clique ou tecla da pessoa.
- Dar play quando a sala já está tocando o mesmo episódio só alinha com o grupo, sem mandar comando.
- Quem ficar para trás (buffer) é realinhado a cada 2 s se a diferença passar de 2,5 s.

## Build

```bash
npm run build:ext   # gera extension/dist e public/shiori-extension.zip
```

## Instalar

- **Chrome/Edge/Opera/Brave:** `chrome://extensions` → "Modo do desenvolvedor" → "Carregar sem compactação" → pasta extraída.
- **Firefox:** `about:debugging` → "Este Firefox" → "Carregar extensão temporária" → `manifest.json`. Some ao fechar o Firefox. Para ficar permanente, é preciso assinar a extensão (gratuito, "não listada") em addons.mozilla.org.
