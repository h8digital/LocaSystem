/**
 * Motor de Cobrança Proporcional — LocaSystem
 *
 * Regras de negócio:
 *
 * DIÁRIA:
 *   - Cobra pela diferença de dias entre retirada e devolução
 *   - Ex: retirou 01/04, entregou 10/04 → 9 diárias
 *   - total = dias * preco_diario
 *
 * FINAL DE SEMANA (FDS):
 *   - Preço fixo do pacote FDS (sexta até segunda 12h)
 *   - Não proporcional — é um preço de pacote
 *   - total = preco_fds (independente da quantidade de dias)
 *
 * SEMANAL:
 *   - 7 dias completos = 1 semana
 *   - Resto: diárias avulsas
 *   - Ex: 10 dias → 1 semana + 3 diárias
 *   - total = semanas * preco_semanal + diasRestantes * preco_diario
 *
 * QUINZENAL:
 *   - 15 dias completos = 1 quinzena
 *   - Resto: diárias avulsas
 *   - Ex: 18 dias → 1 quinzena + 3 diárias
 *   - total = quinzenas * preco_quinzenal + diasRestantes * preco_diario
 *
 * MENSAL:
 *   - 30 dias completos = 1 mês
 *   - Resto: diárias avulsas
 *   - Ex: 33 dias → 1 mês + 3 diárias
 *   - total = meses * preco_mensal + diasRestantes * preco_diario
 *
 * TRIMESTRAL:
 *   - 90 dias completos = 1 trimestre
 *   - Resto: cobrado na menor unidade disponível abaixo (mensal, quinzenal, diário)
 *
 * SEMESTRAL:
 *   - 180 dias completos = 1 semestre
 *   - Resto: trimestral → mensal → diário
 */

export type TipoPeriodo =
  | 'diario'
  | 'fds'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'trimestral'
  | 'semestral'

export interface PrecosProduto {
  preco_locacao_diario:   number
  preco_fds:              number
  preco_locacao_semanal:  number
  preco_quinzenal:        number
  preco_locacao_mensal:   number
  preco_trimestral:       number
  preco_semestral:        number
}

export interface ResultadoCobranca {
  tipo:            TipoPeriodo
  dias:            number
  // Detalhamento da composição do valor
  periodos:        number   // quantos períodos completos (meses, quinzenas, semanas)
  diasRestantes:   number   // dias avulsos após os períodos completos
  // Valores
  valorPeriodos:   number   // valor dos períodos completos
  valorDiarias:    number   // valor das diárias avulsas
  valorUnitario:   number   // preco unitário "tabelado" (para exibição no item)
  totalItem:       number   // total do item (sem multiplicar por quantidade — caller faz isso)
  // Descrição legível
  descricao:       string
}

/**
 * Detecta o tipo de período a partir do nome cadastrado ou dos dias
 */
export function detectarTipoPeriodo(nomePeriodo: string, dias: number): TipoPeriodo {
  const n = nomePeriodo.toLowerCase()
  if (n.includes('final') || n.includes('fds') || n.includes('weekend') || n.includes('fim de semana')) return 'fds'
  if (n.includes('semestral') || n.includes('semestre') || dias >= 180) return 'semestral'
  if (n.includes('trimestral') || n.includes('trimestre') || dias >= 90)  return 'trimestral'
  if (n.includes('mensal')     || n.includes('mês')       || (dias >= 30 && dias < 90))  return 'mensal'
  if (n.includes('quinzenal')  || n.includes('quinzena')  || (dias >= 15 && dias < 30))  return 'quinzenal'
  if (n.includes('semanal')    || n.includes('semana')    || (dias >= 7  && dias < 15))  return 'semanal'
  return 'diario'
}

/**
 * Calcula o valor a cobrar por 1 unidade do produto para um dado período
 * baseado nos dias reais de locação (data_fim - data_inicio).
 */
export function calcularCobranca(
  diasReais:      number,
  tipo:           TipoPeriodo,
  precos:         PrecosProduto,
): ResultadoCobranca {

  const d = precos.preco_locacao_diario   ?? 0
  const s = precos.preco_locacao_semanal  ?? 0
  const q = precos.preco_quinzenal        ?? 0
  const m = precos.preco_locacao_mensal   ?? 0
  const t = precos.preco_trimestral       ?? 0
  const se= precos.preco_semestral        ?? 0
  const f = precos.preco_fds              ?? 0

  // Garantia mínima
  const dias = Math.max(diasReais, 1)

  switch (tipo) {

    // ── DIÁRIA ──────────────────────────────────────────────────
    case 'diario': {
      const total = dias * d
      return {
        tipo, dias,
        periodos: dias, diasRestantes: 0,
        valorPeriodos: total, valorDiarias: 0,
        valorUnitario: d, totalItem: total,
        descricao: `${dias} diária${dias > 1 ? 's' : ''} × ${fmtMoney(d)}`,
      }
    }

    // ── FINAL DE SEMANA ─────────────────────────────────────────
    case 'fds': {
      // FDS é um pacote fixo — preço único, não proporcional
      const preco = f > 0 ? f : d * dias
      return {
        tipo, dias,
        periodos: 1, diasRestantes: 0,
        valorPeriodos: preco, valorDiarias: 0,
        valorUnitario: preco, totalItem: preco,
        descricao: `Pacote FDS ${fmtMoney(preco)}`,
      }
    }

    // ── SEMANAL ─────────────────────────────────────────────────
    case 'semanal': {
      const semanas = Math.floor(dias / 7)
      const resto   = dias % 7
      const precoSemanal = s > 0 ? s : d * 7
      const valorSem  = semanas * precoSemanal
      const valorDia  = resto   * d
      const total     = valorSem + valorDia
      const partes    = []
      if (semanas > 0) partes.push(`${semanas} semana${semanas > 1 ? 's' : ''} × ${fmtMoney(precoSemanal)}`)
      if (resto   > 0) partes.push(`${resto} diária${resto > 1 ? 's' : ''} × ${fmtMoney(d)}`)
      return {
        tipo, dias,
        periodos: semanas, diasRestantes: resto,
        valorPeriodos: valorSem, valorDiarias: valorDia,
        valorUnitario: precoSemanal, totalItem: total,
        descricao: partes.join(' + ') || `${dias} dias`,
      }
    }

    // ── QUINZENAL ───────────────────────────────────────────────
    case 'quinzenal': {
      const quinzenas = Math.floor(dias / 15)
      const resto     = dias % 15
      const precoQ    = q > 0 ? q : d * 15
      const valorQ    = quinzenas * precoQ
      const valorDia  = resto     * d
      const total     = valorQ + valorDia
      const partes    = []
      if (quinzenas > 0) partes.push(`${quinzenas} quinzena${quinzenas > 1 ? 's' : ''} × ${fmtMoney(precoQ)}`)
      if (resto     > 0) partes.push(`${resto} diária${resto > 1 ? 's' : ''} × ${fmtMoney(d)}`)
      return {
        tipo, dias,
        periodos: quinzenas, diasRestantes: resto,
        valorPeriodos: valorQ, valorDiarias: valorDia,
        valorUnitario: precoQ, totalItem: total,
        descricao: partes.join(' + ') || `${dias} dias`,
      }
    }

    // ── MENSAL ──────────────────────────────────────────────────
    case 'mensal': {
      const meses    = Math.floor(dias / 30)
      const resto    = dias % 30
      const precoM   = m > 0 ? m : d * 30
      const valorM   = meses  * precoM
      const valorDia = resto  * d
      const total    = valorM + valorDia
      const partes   = []
      if (meses  > 0) partes.push(`${meses} ${meses > 1 ? 'meses' : 'mês'} × ${fmtMoney(precoM)}`)
      if (resto  > 0) partes.push(`${resto} diária${resto > 1 ? 's' : ''} × ${fmtMoney(d)}`)
      return {
        tipo, dias,
        periodos: meses, diasRestantes: resto,
        valorPeriodos: valorM, valorDiarias: valorDia,
        valorUnitario: precoM, totalItem: total,
        descricao: partes.join(' + ') || `${dias} dias`,
      }
    }

    // ── TRIMESTRAL ──────────────────────────────────────────────
    case 'trimestral': {
      const trimestres = Math.floor(dias / 90)
      const restoT     = dias % 90
      const precoT     = t > 0 ? t : d * 90
      // Resto do trimestre: usar mensal + diário
      const mesesResto = Math.floor(restoT / 30)
      const diasResto  = restoT % 30
      const precoM     = m > 0 ? m : d * 30
      const valorTrim  = trimestres * precoT
      const valorMes   = mesesResto * precoM
      const valorDia   = diasResto  * d
      const total      = valorTrim + valorMes + valorDia
      const partes     = []
      if (trimestres > 0) partes.push(`${trimestres} trimestre${trimestres > 1 ? 's' : ''} × ${fmtMoney(precoT)}`)
      if (mesesResto > 0) partes.push(`${mesesResto} ${mesesResto > 1 ? 'meses' : 'mês'} × ${fmtMoney(precoM)}`)
      if (diasResto  > 0) partes.push(`${diasResto} diária${diasResto > 1 ? 's' : ''} × ${fmtMoney(d)}`)
      return {
        tipo, dias,
        periodos: trimestres, diasRestantes: restoT,
        valorPeriodos: valorTrim, valorDiarias: valorMes + valorDia,
        valorUnitario: precoT, totalItem: total,
        descricao: partes.join(' + ') || `${dias} dias`,
      }
    }

    // ── SEMESTRAL ───────────────────────────────────────────────
    case 'semestral': {
      const semestres  = Math.floor(dias / 180)
      const restoSem   = dias % 180
      const precoSe    = se > 0 ? se : d * 180
      // Resto: trimestral → mensal → diário
      const trimResto  = Math.floor(restoSem / 90)
      const restoTrim  = restoSem % 90
      const mesResto   = Math.floor(restoTrim / 30)
      const diaResto   = restoTrim % 30
      const precoT     = t > 0 ? t : d * 90
      const precoM     = m > 0 ? m : d * 30
      const valorSem   = semestres * precoSe
      const valorTrim  = trimResto * precoT
      const valorMes   = mesResto  * precoM
      const valorDia   = diaResto  * d
      const total      = valorSem + valorTrim + valorMes + valorDia
      const partes     = []
      if (semestres > 0) partes.push(`${semestres} semestre${semestres > 1 ? 's' : ''} × ${fmtMoney(precoSe)}`)
      if (trimResto > 0) partes.push(`${trimResto} trimestre${trimResto > 1 ? 's' : ''} × ${fmtMoney(precoT)}`)
      if (mesResto  > 0) partes.push(`${mesResto} ${mesResto > 1 ? 'meses' : 'mês'} × ${fmtMoney(precoM)}`)
      if (diaResto  > 0) partes.push(`${diaResto} diária${diaResto > 1 ? 's' : ''} × ${fmtMoney(d)}`)
      return {
        tipo, dias,
        periodos: semestres, diasRestantes: restoSem,
        valorPeriodos: valorSem, valorDiarias: valorTrim + valorMes + valorDia,
        valorUnitario: precoSe, totalItem: total,
        descricao: partes.join(' + ') || `${dias} dias`,
      }
    }

    default:
      return {
        tipo: 'diario', dias,
        periodos: dias, diasRestantes: 0,
        valorPeriodos: dias * d, valorDiarias: 0,
        valorUnitario: d, totalItem: dias * d,
        descricao: `${dias} diárias`,
      }
  }
}

/**
 * Calcula a diferença em dias entre data_inicio e data_fim.
 * data_fim - data_inicio (data de devolução - data de retirada).
 * Ex: retirada 01/04, devolução 10/04 = 9 dias.
 */
export function calcularDias(dataInicio: string, dataFim: string): number {
  if (!dataInicio || !dataFim) return 1
  const d1 = new Date(dataInicio + 'T00:00:00')
  const d2 = new Date(dataFim   + 'T00:00:00')
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return Math.max(diff, 1)
}

/** Formata moeda para uso interno nas descrições */
function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/**
 * Helper: calcula preço de 1 item completo dado o período selecionado e os dias reais.
 * Retorna o totalItem (valor para 1 unidade do produto no período).
 */
export function calcularPrecoItem(
  produto: PrecosProduto,
  diasReais: number,
  nomePeriodo: string,
  diasPeriodo: number,
): ResultadoCobranca {
  const tipo = detectarTipoPeriodo(nomePeriodo, diasPeriodo)
  return calcularCobranca(diasReais, tipo, produto)
}
