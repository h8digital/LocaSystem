-- ═══════════════════════════════════════════════════════════════════
--  LocaSystem — Migrações Necessárias
--  Execute este script no SQL Editor do Supabase antes do deploy
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabela de locais de armazenagem ───────────────────────────
CREATE TABLE IF NOT EXISTS locais_armazenagem (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Campo em patrimonios ──────────────────────────────────────
ALTER TABLE patrimonios
  ADD COLUMN IF NOT EXISTS local_armazenagem_id INTEGER REFERENCES locais_armazenagem(id);

-- ── 3. Campo em estoque_movimentacoes ────────────────────────────
ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS local_armazenagem_id INTEGER REFERENCES locais_armazenagem(id);

-- ── 4. Campo prazo_entrega_dias em produtos ──────────────────────
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER DEFAULT 0;

-- ── 5. Campos extras em contrato_itens ──────────────────────────
ALTER TABLE contrato_itens
  ADD COLUMN IF NOT EXISTS preco_diario        NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_reposicao     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias  INTEGER       DEFAULT 0;

-- ── 6. Locais padrão (opcional) ──────────────────────────────────
INSERT INTO locais_armazenagem (nome, ativo) VALUES
  ('Galpão Principal', 1),
  ('Depósito', 1)
ON CONFLICT DO NOTHING;
