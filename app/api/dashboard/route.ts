// build: 2026-06-02
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const de   = searchParams.get('de')   || new Date(Date.now() - 56*86400000).toISOString().split('T')[0]
  const ate  = searchParams.get('ate')  || new Date().toISOString().split('T')[0]
  const hoje = new Date().toISOString().split('T')[0]

  const [
    // KPIs principais
    { data: kpi },
    // Locações por semana
    { data: locSemana },
    // Receita prevista (faturas pendentes)
    { data: receitaPrevista },
    // Ranking de clientes
    { data: rankClientes },
    // Produtos mais locados
    { data: rankProdutos },
    // Contratos vencendo em 15 dias
    { data: vencendo },
    // Faturas vencidas (inadimplência)
    { data: inadimplentes },
    // Contratos por status
    { data: contratoStatus },
    // Receita realizada por semana
    { data: receitaSemana },
  ] = await Promise.all([
    // KPIs — rpc não usado, calculamos manualmente abaixo
    sb.from('contratos').select('status').limit(1),

    // Locações por semana no período
    sb.from('contratos')
      .select('created_at, total, status')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59'),

    // Receita prevista próximos 30 dias
    sb.from('faturas')
      .select('data_vencimento, valor, status, contrato_id')
      .in('status', ['pendente', 'vencida'])
      .gte('data_vencimento', new Date(Date.now() - 7*86400000).toISOString().split('T')[0])
      .lte('data_vencimento', new Date(Date.now() + 45*86400000).toISOString().split('T')[0])
      .order('data_vencimento'),

    // Ranking clientes
    sb.from('contratos')
      .select('total, clientes(id, nome)')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59'),

    // Ranking produtos
    sb.from('contrato_itens')
      .select('quantidade, total_item, produtos(id, nome, titulo_site)')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59')
      .not('produto_id', 'is', null),

    // Contratos vencendo nos próximos 15 dias
    sb.from('contratos')
      .select('numero, data_fim, total, status, clientes(nome)')
      .eq('status', 'ativo')
      .gte('data_fim', hoje)
      .lte('data_fim', new Date(Date.now() + 15*86400000).toISOString().split('T')[0])
      .order('data_fim'),

    // Inadimplentes — faturas vencidas
    sb.from('faturas')
      .select('numero, valor, data_vencimento, contratos(numero, clientes(nome))')
      .eq('status', 'vencida')
      .order('data_vencimento'),

    // Contratos por status (geral)
    sb.from('contratos')
      .select('status')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59'),

    // Receita realizada (faturas pagas) por semana
    sb.from('faturas')
      .select('data_pagamento, valor_pago')
      .eq('status', 'paga')
      .gte('data_pagamento', de)
      .lte('data_pagamento', ate),
  ])

  // ── Processar locações por semana ─────────────────────────────────────────
  const semanas: Record<string, { semana: string; contratos: number; valor: number }> = {}
  ;(locSemana ?? []).forEach((c: any) => {
    const d    = new Date(c.created_at)
    const dow  = d.getDay()
    const seg  = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const key  = seg.toISOString().split('T')[0]
    if (!semanas[key]) semanas[key] = { semana: key, contratos: 0, valor: 0 }
    semanas[key].contratos++
    semanas[key].valor += Number(c.total ?? 0)
  })

  // ── Receita por semana ────────────────────────────────────────────────────
  const recSemanas: Record<string, { semana: string; valor: number }> = {}
  ;(receitaSemana ?? []).forEach((f: any) => {
    if (!f.data_pagamento) return
    const d   = new Date(f.data_pagamento)
    const dow = d.getDay()
    const seg = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const key = seg.toISOString().split('T')[0]
    if (!recSemanas[key]) recSemanas[key] = { semana: key, valor: 0 }
    recSemanas[key].valor += Number(f.valor_pago ?? 0)
  })

  // ── Ranking clientes ──────────────────────────────────────────────────────
  const clienteMap: Record<number, { nome: string; contratos: number; valor: number }> = {}
  ;(rankClientes ?? []).forEach((c: any) => {
    const cli = c.clientes
    if (!cli?.id) return
    if (!clienteMap[cli.id]) clienteMap[cli.id] = { nome: cli.nome, contratos: 0, valor: 0 }
    clienteMap[cli.id].contratos++
    clienteMap[cli.id].valor += Number(c.total ?? 0)
  })
  const topClientes = Object.values(clienteMap)
    .sort((a, b) => b.valor - a.valor).slice(0, 10)

  // ── Ranking produtos ──────────────────────────────────────────────────────
  const prodMap: Record<number, { nome: string; locacoes: number; unidades: number; receita: number }> = {}
  ;(rankProdutos ?? []).forEach((i: any) => {
    const p = i.produtos
    if (!p?.id) return
    if (!prodMap[p.id]) prodMap[p.id] = { nome: p.titulo_site || p.nome, locacoes: 0, unidades: 0, receita: 0 }
    prodMap[p.id].locacoes++
    prodMap[p.id].unidades += Number(i.quantidade ?? 0)
    prodMap[p.id].receita  += Number(i.total_item ?? 0)
  })
  const topProdutos = Object.values(prodMap)
    .sort((a, b) => b.locacoes - a.locacoes).slice(0, 10)

  // ── KPIs do período ───────────────────────────────────────────────────────
  const cts = locSemana ?? []
  const totalContratos = cts.length
  const valorContratos = cts.reduce((s: number, c: any) => s + Number(c.total ?? 0), 0)
  const ativos = cts.filter((c: any) => c.status === 'ativo').length

  // Totais gerais
  const { data: geral } = await sb.from('contratos').select('status', { count: 'exact' })
  const totalAtivos = (geral ?? []).filter((c: any) => c.status === 'ativo').length

  const { data: fatGeral } = await sb
    .from('faturas').select('status, valor, valor_pago')
  const aReceber      = (fatGeral ?? []).filter((f: any) => ['pendente','vencida'].includes(f.status))
    .reduce((s: number, f: any) => s + Number(f.valor ?? 0), 0)
  const receitaTotal  = (fatGeral ?? []).filter((f: any) => f.status === 'paga')
    .reduce((s: number, f: any) => s + Number(f.valor_pago ?? 0), 0)
  const inadimplencia = (fatGeral ?? []).filter((f: any) => f.status === 'vencida')
    .reduce((s: number, f: any) => s + Number(f.valor ?? 0), 0)

  // Previsão por dia (próximos 45 dias)
  const previsao = (receitaPrevista ?? []).map((f: any) => ({
    data:    f.data_vencimento,
    valor:   Number(f.valor),
    status:  f.status,
    vencida: f.status === 'vencida',
  }))

  return NextResponse.json({
    ok: true,
    kpis: {
      contratos_ativos: totalAtivos,
      contratos_periodo: totalContratos,
      valor_periodo: valorContratos,
      a_receber:    aReceber,
      receita_total: receitaTotal,
      inadimplencia,
    },
    locacoes_semana: Object.values(semanas).sort((a, b) => a.semana.localeCompare(b.semana)),
    receita_semana:  Object.values(recSemanas).sort((a, b) => a.semana.localeCompare(b.semana)),
    previsao_receita: previsao,
    top_clientes: topClientes,
    top_produtos: topProdutos,
    contratos_vencendo: (vencendo ?? []).map((c: any) => ({
      numero:   c.numero,
      data_fim: c.data_fim,
      total:    c.total,
      cliente:  c.clientes?.nome,
    })),
    inadimplentes: (inadimplentes ?? []).map((f: any) => ({
      numero:          f.numero,
      valor:           f.valor,
      data_vencimento: f.data_vencimento,
      contrato:        f.contratos?.numero,
      cliente:         f.contratos?.clientes?.nome,
    })),
  })
}
