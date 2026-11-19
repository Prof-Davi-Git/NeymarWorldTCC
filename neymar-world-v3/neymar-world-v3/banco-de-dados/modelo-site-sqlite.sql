-- CÓPIA DE REFERÊNCIA: esquema SQLite original da V3
-- Este arquivo representa o esquema criado pelo servidor Node.
-- Execute apenas em SQLite, não em MySQL.

-- ATIVIDADE DE BANCO DE DADOS — NEYMAR WORLD V3
-- Modelo DOCUMENTAL do banco do SITE (não é código do jogo).
-- Baseado nas tabelas que server.mjs já cria automaticamente em SQLite.
-- NÃO é necessário executar este arquivo para o login funcionar.
-- NÃO coloque senhas em texto puro nem sobrescreva dados de contas existentes.

PRAGMA foreign_keys = ON;

-- Contas cadastradas pela página index.html
CREATE TABLE IF NOT EXISTS contas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_salt BLOB NOT NULL,
  senha_hash BLOB NOT NULL,
  criada_em TEXT NOT NULL
);

-- Sessões dos usuários que estão conectados
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  conta_id TEXT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  expira_em INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_expiracao
  ON sessoes (expira_em);

-- Sugestões e contatos enviados pelo site
CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  chave TEXT UNIQUE,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  personagem TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  recebida_em TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notificacoes
  ON mensagens (proxima_tentativa) WHERE estado = 'pendente';

-- CONSULTAS DIDÁTICAS (somente leitura)
SELECT id, nome, email, criada_em FROM contas;
SELECT conta_id, expira_em FROM sessoes;
SELECT tipo, nome, personagem, recebida_em, estado FROM mensagens;
