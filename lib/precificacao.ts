/**
 * ═══════════════════════════════════════════════════════════════
 * LOCASYSTEM — Motor de Precificação por Tempo Real
 * ═══════════════════════════════════════════════════════════════
 *
 * Regras de negócio:
 *
 * DIÁRIA
 *   Cobra a diferença de dias entre retirada e devolução.
 *   Ex: retirou 01/04, devolveu 10/04 → 9 diárias
 *
 * FINAL DE SEMANA (FDS)
 *   Uma unidade = sexta → segunda até 12h.
 *   Se devolver segunda após 12h → cobra 1 FDS + diárias extras.
 *   Dias fora do bloco FDS são cobrados como diárias.
 *
 * QUINZENAL
 *   Blocos completos de 15 dias + diárias pelo restante.
 *   Ex: 18 dias = 1 quinzena (preco_quinzenal) + 3 diárias (preco_locacao_diario)
 *
 * MENSAL
 *   Blocos completos de 30 dias + diárias pelo restante.
 *   Ex: 33 dias = 1 mensal (preco_locacao_mensal) + 3 diárias (preco_locacao_diario)
 *
 * SEMANAL
 *   Blocos completos de 7 dias + diárias pelo restante.
 *   Ex: 10 dias = 1 semana (preco_locacao_semanal) + 3 diárias (preco_locacao_diario)
 * ═══════════════════════════════════════════════════════════════
 */

export interface Produto {
  preco_locacao_diario:  number
  preco_fds:             number
  preco_locacao_semanal: number
  preco_quinzenal:       number
  preco_locacao_mensal:  number
  preco_trimestral:      number
  preco_semestral:       number
}

export interface Periodo {
  id:   number
  nome: string
  dias: number
}

export interface ResultadoPrecificacao {
  /** Preço total calculado para o item */
  total:         number
  /** Preço unitário de referência (preço da modalidade base) */
  preco_base:    number
  /** Detalhamento do cálculo para exibição */
  detalhamento:  string
  /** Número de dias efetivos cobrados */
  dias_cobrados: number
  /** Breakdown para exibição detalhada */
  breakdown: {
    blocos:      number   // ex: 2 mensais
    unidade:     string   // ex: 'mensal'
    preco_bloco: number   // ex: 150.00
    resto:       number   // ex: 3 dias
    preco_resto: number   // ex: 12.00 (3 × 4.00)
    total:       number
  }
}

/**
 * Calcula o número de dias efetivos entre retirada e devolução.
 * Retirada inclusive, devolução exclusive (igual a diferencça de datas).
 * 
 * Ex: retirou 01/04, devolveu 10/04 → 9 dias
 */
export function calcularDias(dataInicio: Date | string, dataFim: Date | string): number {
  const ini = new Date(dataInicio)
  const fim = new Date(dataFim)
  ini.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 86_400_000))
}

/**
 * Conta quantos blocos de FDS (sex → seg) existem em um intervalo.
 * Retorna { blocosFDS, diasExtras }
 */
function contarBlocosFDS(
  dataInicio: Date,
  dataFim: Date,
  horaFim?: string // 'HH:MM' — se segunda e hora <= 12:00, não conta extra
): { blocosFDS: number; diasExtras: number } {
  let blocosFDS = 0
  let diasExtras = 0

  const cur = new Date(dataInicio)
  cur.setHours(0, 0, 0, 0)
  const fim = new Date(dataFim)
  fim.setHours(0, 0, 0, 0)

  const totalDias = Math.round((fim.getTime() - cur.getTime()) / 86_400_000)
  if (totalDias <= 0) return { blocosFDS: 0, diasExtras: 0 }

  // Percorre o intervalo identificando blocos FDS completos
  let i = 0
  while (i < totalDias) {
    const dia = new Date(cur)
    dia.setDate(dia.getDate() + i)
    const dow = dia.getDay() // 0=dom,1=seg,...,5=sex,6=sab

    if (dow === 5) {
      // Sexta: início de possível bloco FDS
      // Bloco = sex(i) + sab(i+1) + dom(i+2) + seg(i+3) → 3 diárias
      const diasRestantes = totalDias - i
      
      if (diasRestantes >= 3) {
        // Tem pelo menos sex + sab + dom (mínimo FDS)
        // Verificar se tem segunda também
        const temSegunda = diasRestantes > 3
        
        if (temSegunda) {
          // Tem a segunda — verificar hora de devolução
          const diaSegunda = new Date(cur)
          diaSegunda.setDate(diaSegunda.getDate() + i + 3)
          const ehUltimoDia = (i + 3) === totalDias - 1 || (i + 4) >= totalDias

          if (ehUltimoDia) {
            // A segunda é o último dia — verificar hora
            const [h, m] = (horaFim ?? '23:59').split(':').map(Number)
            const minutosEntrega = h * 60 + (m || 0)
            if (minutosEntrega <= 12 * 60) {
              // Segunda até 12h: conta como FDS completo (sex+sab+dom+seg)
              blocosFDS++
              i += 4
              continue
            } else {
              // Segunda após 12h: FDS (sex+sab+dom) + 1 extra
              blocosFDS++
              i += 3
              continue
            }
          } else {
            // Tem mais dias depois da segunda: FDS (sex+sab+dom) aplicado
            blocosFDS++
            i += 3
            continue
          }
        } else {
          // Só tem sex+sab+dom: 1 FDS
          blocosFDS++
          i += 3
          continue
        }
      } else {
        // Não tem dias suficientes para FDS — cobra como diárias
        diasExtras++
        i++
      }
    } else {
      // Dias fora de bloco FDS → diária
      diasExtras++
      i++
    }
  }

  return { blocosFDS, diasExtras }
}

/**
 * Motor principal de precificação.
 * 
 * @param produto  Produto com tabela de preços
 * @param periodo  Período selecionado no contrato
 * @param dias     Número de dias do contrato (calculado via calcularDias)
 * @param quantidade Quantidade do item
 * @param dataInicio Data de início (para FDS)
 * @param dataFim    Data de fim (para FDS)
 * @param horaFim    Hora de devolução no formato 'HH:MM' (para FDS segunda-feira)
 */
export function calcularPreco(
  produto:    Produto,
  periodo:    Periodo,
  dias:       number,
  quantidade: number = 1,
  dataInicio?: Date | string,
  dataFim?:    Date | string,
  horaFim?:    string
): ResultadoPrecificacao {

  const nome = periodo.nome.toLowerCase()
  const isFDS      = nome.includes('fds') || nome.includes('final de semana') || nome.includes('final')
  const isMensal   = nome.includes('mensal') || (periodo.dias === 30 && !isFDS)
  const isQuinzenal= nome.includes('quinzenal') || (periodo.dias === 15 && !isFDS)
  const isSemanal  = nome.includes('semanal') || (periodo.dias === 7 && !isFDS)

  const precoDiario  = Number(produto.preco_locacao_diario ?? 0)

  // ── FINAL DE SEMANA ───────────────────────────────────────────
  if (isFDS) {
    const precoFDS = Number(produto.preco_fds ?? 0) || precoDiario * 3

    if (dataInicio && dataFim) {
      const ini = new Date(dataInicio)
      const fim = new Date(dataFim)
      const { blocosFDS, diasExtras } = contarBlocosFDS(ini, fim, horaFim)

      if (blocosFDS > 0 || diasExtras > 0) {
        const totalItem = (blocosFDS * precoFDS + diasExtras * precoDiario) * quantidade
        const det = blocosFDS > 0 && diasExtras > 0
          ? `${blocosFDS} FDS × ${fmt(precoFDS)} + ${diasExtras} diária(s) × ${fmt(precoDiario)}`
          : blocosFDS > 0
          ? `${blocosFDS} FDS × ${fmt(precoFDS)}`
          : `${diasExtras} diária(s) × ${fmt(precoDiario)}`
        return {
          total: totalItem, preco_base: precoFDS,
          detalhamento: det, dias_cobrados: dias,
          breakdown: { blocos: blocosFDS, unidade: 'final de semana',
            preco_bloco: precoFDS, resto: diasExtras, preco_resto: diasExtras * precoDiario, total: totalItem }
        }
      }
    }

    // Fallback: tratar como 1 FDS
    const total = precoFDS * quantidade
    return {
      total, preco_base: precoFDS,
      detalhamento: `1 FDS × ${fmt(precoFDS)}`,
      dias_cobrados: 3,
      breakdown: { blocos: 1, unidade: 'final de semana',
        preco_bloco: precoFDS, resto: 0, preco_resto: 0, total }
    }
  }

  // ── MENSAL ────────────────────────────────────────────────────
  if (isMensal) {
    const precoMensal = Number(produto.preco_locacao_mensal ?? 0)
    if (!precoMensal) return calcularDiaria(produto, dias, quantidade)

    const blocos  = Math.floor(dias / 30)
    const resto   = dias % 30
    const total   = (blocos * precoMensal + resto * precoDiario) * quantidade
    const det     = blocos > 0 && resto > 0
      ? `${blocos} mês(es) × ${fmt(precoMensal)} + ${resto} diária(s) × ${fmt(precoDiario)}`
      : blocos > 0
      ? `${blocos} mês(es) × ${fmt(precoMensal)}`
      : `${resto} diária(s) × ${fmt(precoDiario)}`
    return {
      total, preco_base: precoMensal,
      detalhamento: det, dias_cobrados: dias,
      breakdown: { blocos, unidade: 'mensal',
        preco_bloco: precoMensal, resto, preco_resto: resto * precoDiario, total }
    }
  }

  // ── QUINZENAL ─────────────────────────────────────────────────
  if (isQuinzenal) {
    const precoQuinzenal = Number(produto.preco_quinzenal ?? 0)
    if (!precoQuinzenal) return calcularDiaria(produto, dias, quantidade)

    const blocos  = Math.floor(dias / 15)
    const resto   = dias % 15
    const total   = (blocos * precoQuinzenal + resto * precoDiario) * quantidade
    const det     = blocos > 0 && resto > 0
      ? `${blocos} quinzena(s) × ${fmt(precoQuinzenal)} + ${resto} diária(s) × ${fmt(precoDiario)}`
      : blocos > 0
      ? `${blocos} quinzena(s) × ${fmt(precoQuinzenal)}`
      : `${resto} diária(s) × ${fmt(precoDiario)}`
    return {
      total, preco_base: precoQuinzenal,
      detalhamento: det, dias_cobrados: dias,
      breakdown: { blocos, unidade: 'quinzenal',
        preco_bloco: precoQuinzenal, resto, preco_resto: resto * precoDiario, total }
    }
  }

  // ── SEMANAL ───────────────────────────────────────────────────
  if (isSemanal) {
    const precoSemanal = Number(produto.preco_locacao_semanal ?? 0)
    if (!precoSemanal) return calcularDiaria(produto, dias, quantidade)

    const blocos  = Math.floor(dias / 7)
    const resto   = dias % 7
    const total   = (blocos * precoSemanal + resto * precoDiario) * quantidade
    const det     = blocos > 0 && resto > 0
      ? `${blocos} semana(s) × ${fmt(precoSemanal)} + ${resto} diária(s) × ${fmt(precoDiario)}`
      : blocos > 0
      ? `${blocos} semana(s) × ${fmt(precoSemanal)}`
      : `${resto} diária(s) × ${fmt(precoDiario)}`
    return {
      total, preco_base: precoSemanal,
      detalhamento: det, dias_cobrados: dias,
      breakdown: { blocos, unidade: 'semanal',
        preco_bloco: precoSemanal, resto, preco_resto: resto * precoDiario, total }
    }
  }

  // ── DIÁRIA (fallback e default) ───────────────────────────────
  return calcularDiaria(produto, dias, quantidade)
}

function calcularDiaria(produto: Produto, dias: number, quantidade: number): ResultadoPrecificacao {
  const precoDiario = Number(produto.preco_locacao_diario ?? 0)
  const total = precoDiario * dias * quantidade
  return {
    total, preco_base: precoDiario,
    detalhamento: `${dias} diária(s) × ${fmt(precoDiario)}`,
    dias_cobrados: dias,
    breakdown: { blocos: dias, unidade: 'diária',
      preco_bloco: precoDiario, resto: 0, preco_resto: 0, total }
  }
}

/** Formata moeda BR */
function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Calcula o preço de um item completo do contrato.
 * Função de conveniência que combina calcularDias + calcularPreco.
 */
export function precificarItem(params: {
  produto:     Produto
  periodo:     Periodo
  dataInicio:  string | Date
  dataFim:     string | Date
  quantidade:  number
  horaFim?:    string
}): ResultadoPrecificacao {
  const dias = calcularDias(params.dataInicio, params.dataFim)
  return calcularPreco(
    params.produto,
    params.periodo,
    dias,
    params.quantidade,
    params.dataInicio,
    params.dataFim,
    params.horaFim
  )
}
