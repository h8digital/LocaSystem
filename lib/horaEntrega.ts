// Regra de SLA: locação feita antes das 12h (horário de Brasília) → entrega até 12h;
// feita às 12h ou depois → entrega até 18h.
export function calcularHoraEntrega(agora: Date = new Date()): '12:00' | '18:00' {
  const horaBR = Number(
    agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })
  )
  return horaBR < 12 ? '12:00' : '18:00'
}
