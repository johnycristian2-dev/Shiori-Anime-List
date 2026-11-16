# E-mails do Shiori (confirmação, login por código, senha nova)

## Como funciona

1. A pessoa cria a conta e o Shiori pede um **código de 6 dígitos**, na mesma janela.
2. O e-mail chega com o código **e** um botão. Qualquer um dos dois confirma a conta.
3. Digitou o código: a conta está confirmada e a pessoa já entra. Funciona em qualquer aparelho, mesmo abrindo o e-mail no celular e o site no PC.
4. O mesmo vale para **entrar sem senha** e **esqueci a senha**: em vez de procurar link, é só digitar o código.
5. Não chegou? Há o botão **Reenviar** (a cada 60 s) e o aviso de olhar o spam.
6. Se alguém tentar entrar antes de confirmar, o Shiori reenvia o código e abre a tela para digitar.

Os modelos ficam em `supabase/email-templates/`. Cada um tem PT, EN e JA e usa o idioma escolhido no cadastro.

## Passo 1 — Um serviço de envio (SMTP)

O envio padrão do Supabase só manda e-mail para os membros da sua organização e no máximo 2 por hora. Para o público, use um SMTP próprio.

**Brevo** (grátis, 300 e-mails por dia, não precisa de domínio):
1. Crie a conta em brevo.com.
2. Em *Senders, Domains & Dedicated IPs* → *Senders*, adicione o e-mail remetente e confirme o código que chega nele.
3. Em *SMTP & API* → *SMTP*, gere uma **SMTP key**.
4. Anote os dados: servidor `smtp-relay.brevo.com`, porta `587`, usuário (o login SMTP mostrado na página) e senha (a SMTP key).

**Resend** é uma alternativa (3.000 por mês), mas só manda para qualquer pessoa depois de verificar um domínio seu.

## Passo 2 — Configurar no Supabase (projeto `shiori`)

**Authentication → Emails → SMTP Settings**: ative *Custom SMTP* e preencha:
- Sender email: o remetente verificado no Brevo
- Sender name: `Shiori 栞`
- Host, porta, usuário e senha: os do passo 1

**Authentication → Sign In / Providers → Email**:
- *Confirm email*: **ligado**
- *Email OTP Length*: **6**

**Authentication → Rate Limits**: *emails per hour*, pelo menos `30`.

**Authentication → URL Configuration**:
- Site URL: `https://shiori-anime-list.vercel.app`
- Redirect URLs: `https://shiori-anime-list.vercel.app/**`

**Authentication → Emails → Templates**: em cada modelo, cole o HTML do arquivo e use o assunto abaixo.

| Modelo no Supabase | Arquivo | Assunto |
| --- | --- | --- |
| Confirm signup | `confirm.html` | `Shiori 栞 · Seu código: {{ .Token }}` |
| Magic Link | `magic.html` | `Shiori 栞 · Código para entrar: {{ .Token }}` |
| Reset Password | `recovery.html` | `Shiori 栞 · Código para senha nova: {{ .Token }}` |

Pronto. Para testar, crie uma conta no site com um e-mail seu.
