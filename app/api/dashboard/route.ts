// build: 2026-06-04
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const de  = searchParams.get('de')  || new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
  const ate = searchParams.get('ate') || new Date().toISOString().split('T')[0]
  const hoje = new Date().toISOString().split('T')[0]

  const [
    { data: contratos },
    { data: faturas },
    { data: locSemana },
    { data: receitaSemana },
    { data: receitaPrevista },
    { data: rankClientes },
    { data: topProdutos },
    { data: vencendo },
    { data: inadimplentes },
    { data: vencidos },
    { data: contratosMapa },
    { data: paramMapbox },
  ] = await Promise.all([
    // Todos contratos — para KPIs globais
    sb.from('contratos').select('status, total, created_at'),

    // Todas faturas — para KPIs financeiros
    sb.from('faturas').select('status, valor, valor_pago'),

    // Contratos no período (para gráfico semanal)
    sb.from('contratos')
      .select('created_at, total, status')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59'),

    // Faturas pagas no período (receita realizada)
    sb.from('faturas')
      .select('data_pagamento, valor_pago')
      .eq('status', 'paga')
      .gte('data_pagamento', de)
      .lte('data_pagamento', ate),

    // Previsão: faturas pendentes/vencidas próximas
    sb.from('faturas')
      .select('data_vencimento, valor, status')
      .in('status', ['pendente', 'vencida'])
      .gte('data_vencimento', new Date(Date.now() - 7*86400000).toISOString().split('T')[0])
      .lte('data_vencimento', new Date(Date.now() + 45*86400000).toISOString().split('T')[0])
      .order('data_vencimento'),

    // Ranking clientes — JOIN via contratos no período
    sb.from('contratos')
      .select('total, clientes(id, nome)')
      .gte('created_at', de)
      .lte('created_at', ate + 'T23:59:59'),

    // Top produtos — via contrato_itens JOIN contratos (filtro pelo contrato.created_at)
    // contrato_itens NÃO tem created_at, então filtramos via contrato_id
    sb.from('contrato_itens')
      .select('quantidade, total_item, produto_id, produtos(id, nome, titulo_site), contratos!inner(created_at)')
      .gte('contratos.created_at', de)
      .lte('contratos.created_at', ate + 'T23:59:59')
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

    // Contratos vencidos (ativos com data_fim no passado)
    sb.from('contratos')
      .select('id, numero, data_inicio, data_fim, total, clientes(nome)')
      .eq('status', 'ativo')
      .lt('data_fim', hoje)
      .order('data_fim'),

    // Contratos ativos geocodificados — para o mapa do dashboard
    sb.from('contratos')
      .select('id, numero, total, local_uso_lat, local_uso_lng, local_uso_cidade, local_uso_bairro, clientes(nome)')
      .eq('status', 'ativo')
      .not('local_uso_lat', 'is', null)
      .not('local_uso_lng', 'is', null),

    // Token do Mapbox (mapa do dashboard)
    sb.from('parametros').select('valor').eq('chave', 'mapbox_token').maybeSingle(),
  ])

  // ── KPIs globais ──────────────────────────────────────────────────────────
  const cts = contratos ?? []
  const fats = faturas ?? []

  const contratosAtivos    = cts.filter(c => c.status === 'ativo').length
  const contratosPeriodo   = locSemana?.length ?? 0
  const valorPeriodo       = (locSemana ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0)
  const aReceber           = fats.filter(f => ['pendente','vencida'].includes(f.status)).reduce((s, f) => s + Number(f.valor ?? 0), 0)
  const receitaTotal       = fats.filter(f => f.status === 'paga').reduce((s, f) => s + Number(f.valor_pago ?? 0), 0)
  const inadimplencia      = fats.filter(f => f.status === 'vencida').reduce((s, f) => s + Number(f.valor ?? 0), 0)

  // Contratos vencidos e multa estimada (diária proporcional ao valor do contrato)
  const vencidosList = (vencidos ?? []).map((c: any) => {
    const diasVencido = Math.max(0, Math.ceil((Date.now() - new Date(c.data_fim + 'T12:00:00').getTime()) / 86400000))
    const diasContrato = Math.max(1, Math.ceil((new Date(c.data_fim + 'T12:00:00').getTime() - new Date(c.data_inicio + 'T12:00:00').getTime()) / 86400000))
    const valorDiario = Number(c.total ?? 0) / diasContrato
    const multaEstimada = valorDiario * diasVencido
    return {
      numero:          c.numero,
      cliente:         c.clientes?.nome,
      data_fim:        c.data_fim,
      dias_vencido:    diasVencido,
      valor_contrato:  Number(c.total ?? 0),
      multa_estimada:  multaEstimada,
    }
  })
  const totalMulta = vencidosList.reduce((s, c) => s + c.multa_estimada, 0)

  // ── Locações por semana ───────────────────────────────────────────────────
  const semanas: Record<string, { semana: string; label: string; contratos: number; valor: number }> = {}
  ;(locSemana ?? []).forEach((c: any) => {
    const d   = new Date(c.created_at)
    const dow = d.getDay()
    const seg = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const key = seg.toISOString().split('T')[0]
    const [y, m, dia] = key.split('-')
    if (!semanas[key]) semanas[key] = { semana: key, label: `${dia}/${m}`, contratos: 0, valor: 0 }
    semanas[key].contratos++
    semanas[key].valor += Number(c.total ?? 0)
  })

  // ── Receita por semana ────────────────────────────────────────────────────
  const recSemanas: Record<string, { semana: string; label: string; valor: number }> = {}
  ;(receitaSemana ?? []).forEach((f: any) => {
    if (!f.data_pagamento) return
    const d   = new Date(f.data_pagamento + 'T12:00:00')
    const dow = d.getDay()
    const seg = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const key = seg.toISOString().split('T')[0]
    const [, m, dia] = key.split('-')
    if (!recSemanas[key]) recSemanas[key] = { semana: key, label: `${dia}/${m}`, valor: 0 }
    recSemanas[key].valor += Number(f.valor_pago ?? 0)
  })

  // ── Ranking clientes ──────────────────────────────────────────────────────
  const clienteMap: Record<number, { nome: string; contratos: number; valor: number }> = {}
  ;(rankClientes ?? []).forEach((c: any) => {
    const cli = c.clientes; if (!cli?.id) return
    if (!clienteMap[cli.id]) clienteMap[cli.id] = { nome: cli.nome, contratos: 0, valor: 0 }
    clienteMap[cli.id].contratos++
    clienteMap[cli.id].valor += Number(c.total ?? 0)
  })
  const topClientes = Object.values(clienteMap).sort((a, b) => b.valor - a.valor).slice(0, 10)

  // ── Top produtos — sem filtro de created_at em contrato_itens ────────────
  const prodMap: Record<number, { nome: string; locacoes: number; unidades: number; receita: number }> = {}
  ;(topProdutos ?? []).forEach((i: any) => {
    const p = i.produtos; if (!p?.id) return
    if (!prodMap[p.id]) prodMap[p.id] = { nome: p.titulo_site || p.nome, locacoes: 0, unidades: 0, receita: 0 }
    prodMap[p.id].locacoes++
    prodMap[p.id].unidades += Number(i.quantidade ?? 0)
    prodMap[p.id].receita  += Number(i.total_item ?? 0)
  })
  const topProdutosList = Object.values(prodMap).sort((a, b) => b.locacoes - a.locacoes).slice(0, 10)

  return NextResponse.json({
    ok: true,
    kpis: {
      contratos_ativos:   contratosAtivos,
      contratos_periodo:  contratosPeriodo,
      valor_periodo:      valorPeriodo,
      a_receber:          aReceber,
      receita_total:      receitaTotal,
      inadimplencia,
      contratos_vencidos: vencidosList.length,
      multa_estimada:     totalMulta,
    },
    locacoes_semana:   Object.values(semanas).sort((a, b) => a.semana.localeCompare(b.semana)),
    receita_semana:    Object.values(recSemanas).sort((a, b) => a.semana.localeCompare(b.semana)),
    previsao_receita:  (receitaPrevista ?? []).map((f: any) => ({ data: f.data_vencimento, valor: Number(f.valor), vencida: f.status === 'vencida' })),
    top_clientes:      topClientes,
    top_produtos:      topProdutosList,
    contratos_vencendo:(vencendo ?? []).map((c: any) => ({ numero: c.numero, data_fim: c.data_fim, total: c.total, cliente: c.clientes?.nome })),
    contratos_vencidos: vencidosList,
    inadimplentes:     (inadimplentes ?? []).map((f: any) => ({ numero: f.numero, valor: f.valor, data_vencimento: f.data_vencimento, contrato: f.contratos?.numero, cliente: f.contratos?.clientes?.nome })),
    contratos_mapa:    (contratosMapa ?? []).map((c: any) => ({
      id: c.id, numero: c.numero, total: Number(c.total ?? 0),
      lat: Number(c.local_uso_lat), lng: Number(c.local_uso_lng),
      cidade: c.local_uso_cidade, bairro: c.local_uso_bairro, cliente: c.clientes?.nome,
    })),
    mapbox_token: paramMapbox?.valor || null,
  })
}
