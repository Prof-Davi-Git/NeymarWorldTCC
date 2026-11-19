# Banco de Dados do SITE — Neymar World V3

## ATUALIZAÇÃO 19/11 — Somente a tabela usuarios

O arquivo **`modelo-site.sql`** agora contém **apenas uma tabela: `usuarios`**, com quatro colunas (`id`, `nome`, `email`, `senha`). Ele cria o banco MySQL `neymar_world_site`, cria essa tabela, inclui os **cinco usuários fictícios do arquivo `usuarios-exemplo.json` com `INSERT INTO`** e executa um `SELECT` para visualizar os registros.

Execute **`modelo-site.sql`** no ambiente MySQL. Ao rodar o script novamente, ele atualiza os usuários com os mesmos identificadores, em vez de falhar por duplicidade.

Os e-mails de demonstração usam o domínio `.example`. A senha `neymar123` aparece em texto no JSON e no SQL **somente para a simulação escolar**; nunca utilize esse método para contas reais. A tabela visual **não está ligada** ao login do site, que, ao abrir `index.html` diretamente ou no Live Server, utiliza `usuarios-exemplo.js` e os cadastros locais do navegador. Um novo cadastro não altera o JSON nem o MySQL.

**Observação:** se você já executou a versão antiga de `modelo-site.sql`, as tabelas antigas `contas`, `sessoes` e `mensagens` podem continuar no seu MySQL. O novo arquivo não cria nem apaga essas tabelas, para não excluir dados inadvertidamente. Elas podem ser removidas separadamente se você confirmar que são apenas tabelas de teste.

## Arquivos da demonstração

- `modelo-site.sql`: **única tabela MySQL exigida para a atividade**, `usuarios`, e cinco registros por `INSERT INTO`.
- `usuarios-exemplo.json`: cinco usuários de demonstração, com nomes comuns, e-mails e a senha fictícia.
- `usuarios-exemplo.js`: cópia auxiliar para autenticação demonstrativa ao abrir arquivos locais.
- `autenticacao-local.js`: valida contas fictícias e mantém cadastros adicionais apenas neste navegador.
- `modelo-site-sqlite.sql`: **referência antiga** do projeto SQLite, não utilizar nesta atividade MySQL.

## Teste rápido

1. Faça Pull do repositório.
2. Execute `modelo-site.sql` na ferramenta MySQL.
3. Rode `SELECT * FROM neymar_world_site.usuarios;` e confira os cinco nomes e e-mails.
4. Para testar login, abra `../index.html` e use, por exemplo, `ana@neymarworld.example` com senha `neymar123`. Esse login é demonstrativo e separado da tabela MySQL.

Nenhum arquivo do jogo, código de interface, `script.js` ou servidor `server.mjs` foi alterado nesta atualização.
