-- ── 1. Campo prazo_entrega_dias em produtos ───────────────────────────────
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER DEFAULT 0;

-- ── 2. Campos extras em contrato_itens ───────────────────────────────────
ALTER TABLE contrato_itens
  ADD COLUMN IF NOT EXISTS preco_diario       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_reposicao    NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER       DEFAULT 0;

-- Comentário: preco_diario = preço/dia do produto (base para multa de atraso)
-- custo_reposicao = valor da nota promissória por item
-- prazo_entrega_dias = previsão de entrega do produto
