-- Adiciona coluna hora_entrega ('12:00' ou '18:00'), calculada com base no
-- horário em que o contrato/cotação foi criado (regra de SLA de entrega).
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS hora_entrega text;
ALTER TABLE cotacoes  ADD COLUMN IF NOT EXISTS hora_entrega text;
