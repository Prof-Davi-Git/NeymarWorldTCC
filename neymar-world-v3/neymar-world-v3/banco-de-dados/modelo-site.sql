-- ATUALIZAÇÃO 19/11 — NEYMAR WORLD V3 / BANCO VISUAL DE USUÁRIOS (MySQL)
-- Contém APENAS a tabela usuarios, com os 5 usuários fictícios do JSON.
-- Arquivo para atividade no MySQL. Não controla o login do index.html.
-- Senhas abaixo são exclusivamente de TESTE; nunca use senhas reais assim.

CREATE DATABASE IF NOT EXISTS neymar_world_site
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE neymar_world_site;

CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  senha VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insere os mesmos registros de usuarios-exemplo.json.
-- Se executar novamente, atualiza os registros com o mesmo id.
INSERT INTO usuarios (id, nome, email, senha) VALUES
  ('exemplo-1', 'Ana Silva', 'ana@neymarworld.example', 'neymar123'),
  ('exemplo-2', 'Bruno Oliveira', 'bruno@neymarworld.example', 'neymar123'),
  ('exemplo-3', 'Carla Santos', 'carla@neymarworld.example', 'neymar123'),
  ('exemplo-4', 'Daniel Pereira', 'daniel@neymarworld.example', 'neymar123'),
  ('exemplo-5', 'Fernanda Costa', 'fernanda@neymarworld.example', 'neymar123')
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  email = VALUES(email),
  senha = VALUES(senha);

-- Visualizar os cinco registros na tabela:
SELECT id, nome, email, senha FROM usuarios;
