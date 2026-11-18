# Banco de Dados do SITE — Neymar World V3

**Atividade didática do TCC. Não altera o jogo, o login nem o servidor.**

## Arquivos adicionados

- `modelo-site.sql` — representa as três tabelas que o servidor **já usa** no SQLite: `contas`, `sessoes` e `mensagens`. Contém `CREATE TABLE` e exemplos de `SELECT`. **Não precisa ser executado**, pois `server.mjs` já cria as tabelas ao iniciar.
- `usuarios-exemplo.json` — cinco usuários **inteiramente fictícios**, sem senhas. É apenas um exemplo para apresentar estruturas JSON e comparar SQL/JSON na aula. **Não é lido pelo login**, nem contém usuários reais.

## Como o login já está integrado

1. **`../index.html`**: abre a janela Entrar/Criar conta.
2. **`../script.js`**: envia os dados às rotas da API, consulta a conta conectada e atualiza a interface.
3. **`../server.mjs`**: valida os dados no servidor e lê/grava a tabela `contas` no **SQLite**.
4. **Tabela `sessoes`**: armazena o hash do token da sessão e permite verificar se o usuário está conectado.
5. **Pasta `demo/`** (quando for adicionada): o servidor exige sessão ativa para permitir acesso à demo local.

**Importante:** este projeto já possui uma integração real com banco de dados. Conectar o login ao `usuarios-exemplo.json` substituiria uma implementação mais adequada por uma lista pública de contas. Por isso, o JSON fica apenas para demonstração.

## O banco do site não é o jogo

- **Site**: `index.html`, `style.css`, `script.js`, `server.mjs`, formulários de conta, mensagens e arquivos de mídia usados na apresentação.
- **Jogo**: eventual exportação em `demo/` e seus recursos próprios; não foram modificados.

## Como testar na máquina do aluno

O cadastro/login da V3 **não funciona abrindo apenas `index.html` por `file://`**. Ele precisa do servidor que já vem com o projeto:

1. Abra no VSCode a pasta `neymar-world-v3/neymar-world-v3` que contém `package.json`.
2. Se o Node.js compatível já estiver instalado, execute `npm.cmd start` no terminal do Windows.
3. Acesse `http://localhost:3000`, clique em **Entrar** e crie uma conta fictícia.
4. Ao concluir, o site utiliza `/api/conta/cadastro`, cria o registro SQLite e estabelece uma sessão. O login posterior usa `/api/conta/entrar`.
5. A rota `/api/conta` informa se existe usuário conectado. A opção **Sair** usa `/api/conta/sair`.

O arquivo de banco gerado pelo servidor fica, por padrão, em `../dados/mensagens.sqlite`. Ele é **privado** e não deve ser enviado ao GitHub.

**Não colocar senhas, mensagens pessoais, chaves de API ou banco real no repositório público.**
