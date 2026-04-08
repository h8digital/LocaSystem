import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtMoney(v: number) {
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/devolucoes/registrar
//
// Suporta devolução PARCIAL e TOTAL.
//
// body: {
//   contrato_id: number
//   tipo: 'parcial' | 'total'          — obrigatório
//   dias_atraso: number
//   valor_avarias: number
//   caucao_devolvido: number
//   observacoes: string
//   itens: [{
//     contrato_item_id: number
//     patrimonio_id: number | null
//     produto_id: number
//     quantidade_devolvida: number      — quantos estão sendo devolvidos AGORA
//     quantidade_total: number          — total do item no contrato
//     condicao: 'bom' | 'avariado' | 'extraviado'
//     custo_avaria: number
//   }]
// }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const {
      contrato_id,
      tipo = 'total',
      itens,
      dias_atraso = 0,
      valor_avarias = 0,
      caucao_devolvido = 0,
      observacoes,
    } = await req.json()

    if (!contrato_id || !itens?.length) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' })
    }
    if (!['parcial','total'].includes(tipo)) {
      return NextResponse.json({ ok: false, error: 'Tipo de devolução inválido' })
    }

    // ── Carregar contrato ─────────────────────────────────────────────────────
    const { data: contrato } = await sb.from('contratos')
      .select('*, clientes(nome)')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado' })
    if (!['ativo','em_devolucao'].includes(contrato.status)) {
      return NextResponse.json({ ok: false, error: `Contrato em status "${contrato.status}" não pode registrar devolução.` })
    }

    // ── Para devolução TOTAL: verificar saldo devedor ─────────────────────────
    if (tipo === 'total') {
      const { data: saldo } = await sb.from('contrato_saldo')
        .select('saldo_devedor')
        .eq('contrato_id', contrato_id)
        .single()
      if (saldo && Number(saldo.saldo_devedor) > 0.01) {
        return NextResponse.json({
          ok: false,
          error: `Existe saldo devedor de ${fmtMoney(Number(saldo.saldo_devedor))} pendente. Quite todas as faturas antes de encerrar o contrato.`
        })
      }
    }

    // ── Validar quantidades ───────────────────────────────────────────────────
    for (const item of itens) {
      const { data: ci } = await sb.from('contrato_itens')
        .select('quantidade, qtd_devolvida')
        .eq('id', item.contrato_item_id).single()
      if (!ci) return NextResponse.json({ ok: false, error: `Item ${item.contrato_item_id} não encontrado.` })
      const pendente = Number(ci.quantidade) - Number(ci.qtd_devolvida ?? 0)
      if (Number(item.quantidade_devolvida) > pendente) {
        return NextResponse.json({ ok: false, error: `Quantidade a devolver (${item.quantidade_devolvida}) maior que pendente (${pendente}) para o item ${item.contrato_item_id}.` })
      }
    }

    // ── Multa por atraso (apenas na devolução total ou se informado) ──────────
    let multa_atraso = 0
    if (dias_atraso > 0) {
      const { data: itensContrato } = await sb.from('contrato_itens')
        .select('preco_diario, quantidade, produtos(preco_locacao_diario)')
        .eq('contrato_id', contrato_id)
      // Multa proporcional aos itens devolvidos agora
      const idsDevolvidos = itens.map((i: any) => i.contrato_item_id)
      const itensMulta = (itensContrato ?? []).filter((i: any) => idsDevolvidos.includes(i.id))
      const valorDiario = itensMulta.reduce((s: number, i: any) => {
        return s + Number(i.preco_diario ?? (i.produtos as any)?.preco_locacao_diario ?? 0) * Number(i.quantidade ?? 1)
      }, 0) || (itensContrato ?? []).reduce((s: number, i: any) => {
        return s + Number(i.preco_diario ?? (i.produtos as any)?.preco_locacao_diario ?? 0) * Number(i.quantidade ?? 1)
      }, 0)
      multa_atraso = valorDiario * dias_atraso
    }

    const statusDev = dias_atraso > 0 ? 'com_atraso' : valor_avarias > 0 ? 'com_avaria' : 'completa'

    // ── Registrar devolução ───────────────────────────────────────────────────
    const { data: dev, error: devErr } = await sb.from('devolucoes').insert({
      contrato_id,
      usuario_id:      user.id,
      data_devolucao:  new Date().toISOString(),
      tipo,
      status:          statusDev,
      dias_atraso,
      multa_atraso,
      valor_avarias,
      caucao_devolvido: tipo === 'total' ? caucao_devolvido : 0,
      observacoes,
    }).select().single()
    if (devErr) return NextResponse.json({ ok: false, error: devErr.message })

    const osGeradas: number[] = []

    // ── Processar cada item devolvido ─────────────────────────────────────────
    for (const item of itens) {
      const qtdDev = Number(item.quantidade_devolvida)

      // Registrar item da devolução
      await sb.from('devolucao_itens').insert({
        devolucao_id:         dev.id,
        contrato_item_id:     item.contrato_item_id,
        patrimonio_id:        item.patrimonio_id ?? null,
        quantidade_devolvida: qtdDev,
        condicao:             item.condicao === 'extraviado' ? 'perdido' : item.condicao,
        custo_avaria:         item.custo_avaria ?? 0,
      })

      // Atualizar qtd_devolvida no contrato_item
      const { data: ci } = await sb.from('contrato_itens')
        .select('quantidade, qtd_devolvida')
        .eq('id', item.contrato_item_id).single()
      const novaQtdDev = Number(ci?.qtd_devolvida ?? 0) + qtdDev
      const devTotal = novaQtdDev >= Number(ci?.quantidade ?? 0)
      await sb.from('contrato_itens').update({
        qtd_devolvida:  novaQtdDev,
        data_devolucao: devTotal ? new Date().toISOString() : null,
      }).eq('id', item.contrato_item_id)

      // Atualizar status do patrimônio rastreável
      if (item.patrimonio_id) {
        const novoStatusPat =
          item.condicao === 'avariado'   ? 'manutencao'  :
          item.condicao === 'extraviado' ? 'descartado'  : 'disponivel'
        await sb.from('patrimonios').update({ status: novoStatusPat }).eq('id', item.patrimonio_id)

        // Criar OS automática para avariados
        if (item.condicao === 'avariado') {
          const { data: os } = await sb.from('manutencoes').insert({
            contrato_id,
            devolucao_id:            dev.id,
            produto_id:              item.produto_id,
            patrimonio_id:           item.patrimonio_id,
            tipo:                    'corretiva',
            status:                  'aberto',
            descricao:               `Avaria registrada na devolução ${tipo} do contrato ${contrato.numero}`,
            custo:                   item.custo_avaria ?? 0,
            custo_cobrado_cliente:   item.custo_avaria ?? 0,
            cobrado_em_fatura:       false,
            data_abertura:           new Date().toISOString().split('T')[0],
            usuario_id:              user.id,
          }).select('id').single()
          if (os) osGeradas.push(os.id)
        }
      }
    }

    // ── Verificar se TODOS os itens foram devolvidos ──────────────────────────
    const { data: todosItens } = await sb.from('contrato_itens')
      .select('quantidade, qtd_devolvida')
      .eq('contrato_id', contrato_id)
    const tudoDevolvido = (todosItens ?? []).every(
      (i: any) => Number(i.qtd_devolvida ?? 0) >= Number(i.quantidade)
    )

    // ── Determinar novo status do contrato ────────────────────────────────────
    let novoStatusContrato = contrato.status // mantém ativo por padrão
    let dataEncerramento: string | null = null

    if (tipo === 'total' || tudoDevolvido) {
      // Devolução total ou parcial que completou tudo
      novoStatusContrato = osGeradas.length > 0 ? 'pendente_manutencao' : 'encerrado'
      dataEncerramento = new Date().toISOString()
    } else {
      // Devolução parcial — contrato continua ativo
      novoStatusContrato = 'ativo'
    }

    await sb.from('contratos').update({
      status:              novoStatusContrato,
      ...(dataEncerramento ? { data_devolucao_real: dataEncerramento } : {}),
    }).eq('id', contrato_id)

    // ── Fatura extra para multa/avaria ────────────────────────────────────────
    if (multa_atraso > 0 || valor_avarias > 0) {
      const extra = multa_atraso + valor_avarias
      const { count } = await sb.from('faturas')
        .select('*', { count: 'exact', head: true })
      const ano = new Date().getFullYear()
      const numFat = `FAT${ano}${String((count ?? 0) + 1).padStart(6,'0')}`
      await sb.from('faturas').insert({
        contrato_id,
        numero:          numFat,
        tipo:            multa_atraso > 0 ? 'multa' : 'avaria',
        status:          'pendente',
        valor:           extra,
        valor_recebido:  0,
        saldo_restante:  extra,
        data_emissao:    new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        descricao:       [
          multa_atraso > 0 ? `Multa por atraso (${dias_atraso}d)` : '',
          valor_avarias > 0 ? 'Cobrança de avaria/extravio' : '',
        ].filter(Boolean).join(' + ') + ` — Contrato ${contrato.numero}`,
      })
    }

    // ── Registrar na timeline ─────────────────────────────────────────────────
    const pctDevolvido = todosItens
      ? Math.round(100 * (todosItens.reduce((s:any,i:any)=>s+Number(i.qtd_devolvida??0),0)) /
          (todosItens.reduce((s:any,i:any)=>s+Number(i.quantidade),0)))
      : 100
    await sb.from('contrato_timeline').insert({
      contrato_id,
      usuario_id:  user.id,
      tipo:        'devolucao',
      descricao:   tipo === 'parcial'
        ? `Devolução parcial registrada — ${itens.length} item(ns), ${pctDevolvido}% do contrato devolvido`
        : `Devolução total registrada — contrato ${novoStatusContrato === 'encerrado' ? 'encerrado' : 'pendente de manutenção'}`,
      detalhes: { tipo, itens_devolvidos: itens.length, os_geradas: osGeradas.length, pct_devolvido: pctDevolvido },
    })

    const msg = tipo === 'parcial' && !tudoDevolvido
      ? `Devolução parcial registrada (${pctDevolvido}% do contrato). O contrato permanece ativo com os itens restantes.`
      : osGeradas.length > 0
        ? `Devolução total registrada. ${osGeradas.length} OS criada(s). Contrato em "Pendente de Manutenção".`
        : 'Devolução total registrada. Contrato encerrado com sucesso.'

    return NextResponse.json({
      ok: true,
      tipo,
      status_contrato:     novoStatusContrato,
      tudo_devolvido:      tudoDevolvido,
      os_geradas:          osGeradas,
      percentual_devolvido: pctDevolvido,
      msg,
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
