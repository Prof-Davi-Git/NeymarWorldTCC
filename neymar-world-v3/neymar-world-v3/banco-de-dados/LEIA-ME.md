# Banco de Dados do SITE — Neymar World V3

## ATUALIZAÇÃO 18/11 — Demonstração sem servidor

Esta atividade foi feita para o professor abrir **index.html diretamente**, sem terminal, instalação ou comandos. A **V3 original também possui um servidor real**, mas o modo demonstrativo não depende dele.

### Arquivos da atividade

| Arquivo | O que faz |
| --- | --- |
| `modelo-site.sql` | Modelo visual com as tabelas `contas`, `sessoes` e `mensagens`. Não precisa executar. |
| `usuarios-exemplo.json` | Cinco contas **totalmente inventadas** com uma senha de exemplo comum. É o documento didático dos usuários. |
| `usuarios-exemplo.js` | Cópia auxiliar dos mesmos usuários, pois o navegador impede a leitura por `fetch()` de JSON local (`file://`). |
| `autenticacao-local.js` | Demonstra cadastro, login, sessão e saída usando o armazenamento deste navegador. |
| `../index.html` | **Somente** adicionados dois scripts auxiliares, sem mudar a estrutura visual nem o jogo. |
| `../script.js` | Adicionado modo local quando a página é aberta diretamente; a integração com servidor foi preservada. |

### Teste na aula: sem servidor

1. Abra `index.html` com dois cliques ou pelo VSCode.
2. Clique no botão **Entrar** do cabeçalho.
3. Experimente um usuário fictício presente no JSON: **ana@neymarworld.example**, senha **neymar123**.
4. Clique em **Sair da conta**, depois em **Criar conta**.
5. Cadastre outro nome, e-mail e senha fictícios de pelo menos oito caracteres.
6. O usuário aparece conectado imediatamente. Após sair, pode voltar a entrar com os mesmos dados **no mesmo navegador**.

**Importante:** novos cadastros são salvos somente no **localStorage** deste navegador. Eles **NÃO são adicionados automaticamente ao arquivo JSON**: um arquivo JSON estático não pode ser editado por uma página HTML aberta localmente. O JSON funciona como lista inicial de cinco exemplos (espelhada no JS auxiliar).

### Acesso ao jogo / botão de download

O campo `linkDemo` em `../configuracao.js` está **vazio** no repositório examinado. Assim, clicar em **Entrar na demo** apenas mostra informações do jogo. Quando o aluno tiver o arquivo/link do jogo, poderá configurá-lo separadamente. Neste exemplo, o site pode **pedir login antes de abrir um link**, mas o link ou arquivo público não fica realmente protegido: alguém com o endereço direto poderá acessá-lo.

**Não usar dados nem senhas reais.** O JSON e os códigos públicos contêm credenciais de TESTE. O armazenamento local é uma simulação pedagógica, não autenticação segura.

### Sobre o SQLite da V3

Quando aberto pelo servidor Node do aluno, o site **continua usando** `server.mjs` e o SQLite para cadastro, login e mensagens, como antes. Esse banco real é separado dos dados demonstrativos locais e continua sem qualquer modificação nesta atividade.

### Escopo preservado

Nenhum arquivo ou código do jogo foi modificado. Não alteramos `server.mjs`, imagens, sons, vídeos ou arquivos da demo. O arquivo SQL é apenas documental e não interfere nos registros existentes.
