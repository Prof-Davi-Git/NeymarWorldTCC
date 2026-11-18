# Neymar World — site da demo

## Atualizar no VS Code

1. Extraia o pacote para uma pasta nova e abra essa pasta em **Arquivo → Abrir Pasta** no VS Code. Guarde a sua pasta antiga como cópia.
2. Se preferir atualizar a pasta atual, substitua `index.html`, `style.css` e `script.js` pelos novos arquivos. Copie também `assets/`, `server.mjs`, `package.json`, `.gitignore` e `.env.example`. Mantenha esses nomes e a estrutura das pastas.
3. Use o novo `configuracao.js` e transfira os valores que você já colocou no antigo, especialmente `linkDemo`, `emailSuporte`, `redes` e `classificacao`. Preserve suas imagens personalizadas e a pasta `demo/` se tiver exportado o jogo para a web.
4. Instale o Node.js 22.13 ou mais recente. No terminal do VS Code, dentro da pasta do projeto, rode `npm start` e abra `http://localhost:3000`. Se o PowerShell bloquear `npm.ps1`, rode `npm.cmd start`.

Abrir `index.html` direto no Chrome permite ver o layout. Para testar sugestões e contatos, acesse o endereço que o servidor imprimir no terminal.

## Onde trocar textos, links e datas

Em `configuracao.js`, edite os valores dentro de `window.NEYMAR_WORLD`.

| Campo | O que preencher |
| --- | --- |
| `linkDemo` | URL pública do jogo ou `./demo/index.html` se você incluir a exportação web na pasta `demo/`. Vazio, o botão abre a janela com detalhes da demonstração. |
| `criadores` | Um item por pessoa, como `{ nome: "Nome da pessoa", funcao: "Programação" }`. |
| `lancamento` | Data futura confirmada no formato `AAAA-MM-DDTHH:MM:SS-03:00`. A contagem aparece automaticamente. Com o campo vazio, aparece **A definir**. |
| `eventos` | Um item por evento futuro com `titulo`, `data` no mesmo formato e `descricao`. |
| `requisitos` | Plataformas e requisitos mínimos confirmados para jogar. |
| `redes` e `emailSuporte` | Links das redes sociais e e-mail público, caso queira mostrar um botão de e-mail no suporte. |

Em `index.html`, procure **Ideias de implementação de novos personagens** para editar os conceitos e as ideias de modo em dupla, conexão online e controle. Os retratos ficam em `assets/conceito-*.webp`. Procure **GUIA PARA INICIANTES** para editar as teclas e as instruções. Em **Mídia e cenários**, os links baixam as imagens `assets/wallpaper-rio.jpg` e `assets/wallpaper-vale.jpg`.

O botão **Som da praia** liga ou pausa o áudio ambiente. Para trocar o som, substitua `assets/ambiente-praia.mp3` por um MP3 com o mesmo nome ou ajuste o `src` do elemento `audio`.

## Guardar mensagens e receber por e-mail

O servidor cria o banco SQLite em `dados/mensagens.sqlite`. Envie uma mensagem de teste pelo formulário com o servidor aberto. Em outro terminal, na mesma pasta, rode `npm run mensagens` para conferir o que foi gravado. Use esse comando em um terminal privado, pois ele mostra os dados preenchidos nos formulários.

Para receber cópias por e-mail, faça uma cópia de `.env.example` chamada `.env` e preencha estes campos.

- `RESEND_API_KEY` com uma chave da sua conta Resend.
- `EMAIL_REMETENTE` com um endereço de envio autorizado no Resend. Em produção, use um domínio que você tenha verificado lá.
- `EMAIL_DESTINO` com o endereço da equipe que vai receber os contatos e as sugestões.

Reinicie `npm start` depois de editar o arquivo. Com a configuração de e-mail vazia, as mensagens são gravadas no banco. Mantenha `.env`, a chave e o banco fora do repositório e das pastas públicas. O campo `emailSuporte` é para exibir um contato público.

## Publicar e obter um link

Um endereço `file://` no Chrome aponta para o seu computador. Para compartilhar no Instagram, publique o projeto em uma hospedagem com Node.js e um volume persistente para que os formulários continuem funcionando.

1. Envie o conteúdo da pasta do projeto para a raiz de um repositório no GitHub, incluindo `.gitignore` e `.env.example`. Deixe `.env` e `dados/` no seu computador.
2. Em um serviço como a Railway, crie um projeto a partir desse repositório. Use Node.js 22.13 ou mais recente e configure `npm start` como comando de início.
3. Anexe um volume ao serviço no caminho `/data`. Nas variáveis do serviço, configure `HOST=0.0.0.0`, `SQLITE_PATH=/data/mensagens.sqlite` e as três variáveis do Resend. Use a porta indicada pela plataforma. Se a hospedagem usar proxy reverso, configure `PROXY_HOPS` de acordo com o número de proxies confiáveis que acrescentam o IP a `X-Forwarded-For`.
4. Nas configurações de rede do serviço, gere um domínio público. Abra o endereço HTTPS em uma aba anônima e envie uma mensagem de teste. Use o endereço público no adesivo de link do Instagram.
