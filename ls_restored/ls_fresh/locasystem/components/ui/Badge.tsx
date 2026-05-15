'use client'

// Mapa de status → classe de cor
const STATUS_MAP: Record<string, { cls: string; label?: string }> = {
  // Contratos
  rascunho:            { cls: 'ds-badge-gray',   label: 'Rascunho' },
  ativo:               { cls: 'ds-badge-green',  label: 'Ativo' },
  em_devolucao:        { cls: 'ds-badge-blue',   label: 'Em Devolução' },
  pendente_manutencao: { cls: 'ds-badge-yellow', label: 'Pend. Manutenção' },
  encerrado:           { cls: 'ds-badge-gray',   label: 'Encerrado' },
  cancelado:           { cls: 'ds-badge-red',    label: 'Cancelado' },
  inadimplente:        { cls: 'ds-badge-red',    label: 'Inadimplente' },
  // Cotações
  pendente:            { cls: 'ds-badge-yellow', label: 'Pendente' },
  aprovado:            { cls: 'ds-badge-green',  label: 'Aprovado' },
  reprovado:           { cls: 'ds-badge-red',    label: 'Reprovado' },
  expirado:            { cls: 'ds-badge-gray',   label: 'Expirado' },
  // Faturas
  pago:                { cls: 'ds-badge-green',  label: 'Pago' },
  parcial:             { cls: 'ds-badge-blue',   label: 'Parcial' },
  vencido:             { cls: 'ds-badge-red',    label: 'Vencido' },
  // Manutenções
  aberto:              { cls: 'ds-badge-yellow', label: 'Aberto' },
  em_andamento:        { cls: 'ds-badge-blue',   label: 'Em Andamento' },
  concluido:           { cls: 'ds-badge-green',  label: 'Concluído' },
  // Patrimônios
  disponivel:          { cls: 'ds-badge-green',  label: 'Disponível' },
  locado:              { cls: 'ds-badge-blue',   label: 'Locado' },
  manutencao:          { cls: 'ds-badge-yellow', label: 'Manutenção' },
  descartado:          { cls: 'ds-badge-gray',   label: 'Descartado' },
  reservado:           { cls: 'ds-badge-purple', label: 'Reservado' },
  // Pessoas
  PF:                  { cls: 'ds-badge-blue',   label: 'Pessoa Física' },
  PJ:                  { cls: 'ds-badge-purple', label: 'Pessoa Jurídica' },
  // SPC
  limpo:               { cls: 'ds-badge-green',  label: 'Limpo' },
  restrito:            { cls: 'ds-badge-yellow', label: 'Restrito' },
  negativado:          { cls: 'ds-badge-red',    label: 'Negativado' },
  // Genérico
  ativo_gen:           { cls: 'ds-badge-green',  label: 'Ativo' },
  inativo:             { cls: 'ds-badge-gray',   label: 'Inativo' },
  enviado:             { cls: 'ds-badge-green',  label: 'Enviado' },
  erro:                { cls: 'ds-badge-red',    label: 'Erro' },
}

interface BadgeProps {
  value: string
  label?: string
  dot?: boolean
}

export default function Badge({ value, label, dot }: BadgeProps) {
  const mapped = STATUS_MAP[value] ?? { cls: 'ds-badge-gray', label: value }
  const displayLabel = label ?? mapped.label ?? value
  const cls = mapped.cls

  return (
    <span className={`ds-badge ${cls}`}>
      {dot && <span className="ds-badge-dot" />}
      {displayLabel}
    </span>
  )
}
