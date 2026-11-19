-- ATUALIZAÇÃO 19/11 — NEYMAR WORLD V3: BANCO VISUAL DO SITE (MySQL)
-- Arquivo didático para executar no MySQL, separado do jogo e do login local.
-- Não é usado pelo index.html nem substitui o SQLite do servidor Node.
-- Execute em um banco de TESTE, nunca com informações pessoais verdadeiras.

CREATE DATABASE IF NOT EXISTS neymar_world_site
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE neymar_world_site;

-- 1. Contas do site: corresponde conceitualmente ao cadastro do jogador
CREATE TABLE IF NOT EXISTS contas (
  id VARCHAR(36) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_salt VARBINARY(16) NOT NULL,
  senha_hash VARBINARY(64) NOT NULL,
  criada_em VARCHAR(35) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contas_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Sessões de login
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash VARCHAR(64) NOT NULL,
  conta_id VARCHAR(36) NOT NULL,
  expira_em BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessoes_expiracao (expira_em),
  CONSTRAINT fk_sessoes_conta
    FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Contatos e sugestões recebidos pelo site
CREATE TABLE IF NOT EXISTS mensagens (
  id VARCHAR(36) NOT NULL,
  chave VARCHAR(100) NULL,
  tipo VARCHAR(20) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  personagem VARCHAR(120) NOT NULL,
  mensagem TEXT NOT NULL,
  recebida_em VARCHAR(35) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendente',
  tentativas INT NOT NULL DEFAULT 0,
  proxima_tentativa BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mensagens_chave (chave),
  KEY idx_notificacoes (proxima_tentativa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Consultas ilustrativas para a apresentação do TCC
SHOW TABLES;
DESCRIBE contas;
DESCRIBE sessoes;
DESCRIBE mensagens;

SELECT id, nome, email, criada_em FROM contas;
SELECT conta_id, expira_em FROM sessoes;
SELECT tipo, nome, personagem, recebida_em, estado FROM mensagens;

-- Os usuários do arquivo usuarios-exemplo.json não aparecem aqui
-- automaticamente. JSON e MySQL são demonstrações independentes.
-- Não inserir senha em texto puro nas colunas senha_hash/senha_salt.
