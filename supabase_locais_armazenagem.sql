-- Tabela: locais_armazenagem
-- Cria locais para armazenagem de produtos/patrimônios no estoque

CREATE TABLE IF NOT EXISTS locais_armazenagem (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona coluna local_armazenagem_id na tabela patrimonios (se não existir)
ALTER TABLE patrimonios
  ADD COLUMN IF NOT EXISTS local_armazenagem_id INTEGER REFERENCES locais_armazenagem(id);

-- Adiciona coluna local_armazenagem_id na tabela estoque_movimentacoes (se não existir)
ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS local_armazenagem_id INTEGER REFERENCES locais_armazenagem(id);

-- Inserir alguns locais padrão (opcional)
INSERT INTO locais_armazenagem (nome, ativo) VALUES
  ('Galpão Principal', 1),
  ('Depósito', 1)
ON CONFLICT DO NOTHING;
