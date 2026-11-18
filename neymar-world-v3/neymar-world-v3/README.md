# Neymar World · Versão 3

## Abrir no VS Code

1. Extraia o ZIP em uma pasta nova. Abra no VS Code a pasta que tem o arquivo `package.json`.
2. Em `configuracao.js`, copie os links de redes e da demo que você já tinha na versão anterior. Os créditos de **Ivan e Ryan** e a indicação de **10 anos** já estão definidos nesse arquivo.
3. Se já configurou o envio de e-mails, copie seu `.env` da versão anterior para essa pasta. Mantenha esse arquivo fora do GitHub e dos ZIPs compartilhados.
4. Com Node.js 22.13 ou mais recente, abra **Terminal → New Terminal** e rode `npm.cmd start` no Windows. Abra `http://localhost:3000` no Chrome e deixe o terminal aberto enquanto estiver testando.

No macOS ou Linux, use `npm start`. O servidor vem com o projeto e usa o SQLite do Node. Para testar cadastro, demo protegida e feedback, abra o endereço do servidor.

## Idiomas, tema e acessibilidade

Abra o botão **Preferências** no topo. Ali você escolhe entre Português (Brasil), inglês, espanhol, francês, alemão, italiano, japonês, coreano, chinês simplificado e árabe. No árabe, o layout muda a direção da leitura. A escolha fica salva no navegador.

O menu também permite escurecer a página, aumentar o texto, reforçar o contraste, reduzir movimentos e usar o cursor padrão. O site tem foco visível para navegação por teclado e um atalho inicial para pular ao conteúdo. **Ler em voz alta** usa a voz disponível no navegador para narrar os textos da seção visível. **Parar narração** interrompe a leitura. O narrador e as traduções pertencem ao site. Traduções da interface do jogo e controles acessíveis dentro da demo são configurados na exportação do jogo.

## Cadastro e botão da demo

O botão **Entrar**, no topo, abre cadastro e login. Você pode criar uma conta com nome, e-mail e senha de pelo menos oito caracteres. A conta e a sessão ficam no servidor. O site de apresentação e o suporte são acessíveis aos visitantes.

Para ligar o jogo, coloque todos os arquivos da exportação web dentro de `demo/` e preencha `linkDemo: "./demo/index.html"` em `configuracao.js`. Se a entrada da exportação tiver outro nome, use aquele caminho. Com uma demo configurada, o botão pede login antes de abrir o jogo. A proteção vale também para a URL direta de `/demo/` hospedada neste servidor. Se a demo tiver um link externo, a proteção da URL direta é responsabilidade da hospedagem daquele jogo.

Os campos `requisitos`, `lancamento` e `eventos` também estão em `configuracao.js`. Os textos personalizados nesses campos aparecem no idioma em que você escrever. A lista de controles e as ideias da demo ficam no `index.html`.

## Onde chegam os feedbacks

Quando alguém envia **Fale com a equipe** ou **Sugira um personagem**, o servidor recebe a mensagem pela API `POST /api/mensagens` e a guarda no SQLite. Por padrão, o arquivo é `dados/mensagens.sqlite`. O servidor cria o banco quando inicia. As contas também ficam nesse banco.

**Para baixar uma planilha**, abra outro terminal na pasta do projeto e rode:

```powershell
npm.cmd run feedback:csv
```

Abra `dados/feedback.csv` no Excel ou importe para o Google Planilhas. Esse comando exporta as mensagens do banco usado pelo servidor. Se o banco estiver em outro caminho em `SQLITE_PATH`, o CSV será salvo ao lado dele. Para ver as mensagens no terminal, use `npm.cmd run mensagens`. Mantenha o banco e o CSV em local privado.

**Para receber no Gmail**, mantenha estes campos no `.env` do servidor:

```env
EMAIL_DESTINO=GMAIL_DO_JOGO
EMAIL_REMETENTE=REMETENTE_AUTORIZADO_NO_RESEND
RESEND_API_KEY=CHAVE_DO_RESEND
```

Se estiver começando do zero, copie `.env.example` e dê à cópia o nome `.env`. Para testar com `onboarding@resend.dev`, use como destinatário o e-mail da sua conta Resend. Depois de salvar, reinicie o servidor e envie um feedback de teste. A mensagem fica salva mesmo durante uma falha de envio. A tela informa quando a mensagem foi salva e o e-mail está na fila, configurando ou falhou.

Se você vai substituir a versão anterior **na mesma máquina** e quiser manter as mensagens de teste, pare o servidor antigo e faça uma cópia da pasta `dados/` para a nova versão. Se os dois arquivos já apontam para o mesmo `SQLITE_PATH` persistente, o servidor acrescenta as tabelas das contas ao banco existente.

## Ter um link público para os fãs

1. Envie os arquivos do projeto ao GitHub. Inclua a pasta `assets/` e a exportação `demo/` se já existir. Guarde `.env`, o banco e as planilhas fora do repositório.
2. Conecte o repositório a uma hospedagem Node como a Railway. Deixe `npm start` como comando de início e configure `HOST=0.0.0.0`. Use a porta fornecida pela hospedagem.
3. Anexe um volume persistente, por exemplo em `/data`, e configure `SQLITE_PATH=/data/mensagens.sqlite`. Coloque as três variáveis de e-mail nas configurações privadas da hospedagem.
4. Gere um domínio HTTPS público. Configure `SITE_ORIGIN` com o endereço desse domínio, sem caminho, como `https://seu-site.exemplo`. Se houver proxy reverso, configure `PROXY_HOPS` conforme a documentação da hospedagem. Abra a URL em uma aba anônima e teste o cadastro, a demo e o formulário antes de compartilhar.

O Gmail recebe as cópias dos feedbacks enviados pelo endereço público. Para exportar a planilha desses mesmos envios, rode o comando no ambiente da hospedagem com acesso ao volume do banco.
