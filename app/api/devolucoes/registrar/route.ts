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
// A API detecta automaticamente se é parcial ou total comparando
// qtd_devolvida acumulada com a quantidade contratada de cada item.
//
// Devolução PARCIAL: contrato permanece ativo, patrimônios devolvidos liberados
// Devolução TOTAL:   contrato encerrado (ou pendente_manutencao se há avaria)
//
// Fatura extra apenas para multa/avaria — nunca proporcional por item.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const {
      contrato_id,
      itens,
      dias_atraso      = 0,
      valor_avarias    = 0,
      caucao_devolvido = 0,
      observacoes,
    } = await req.json()

    if (!contrato_id || !itens?.length) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos.' })
    }

    // ── Carregar contrato ─────────────────────────────────────────────────────
    const { data: contrato } = await sb.from('contratos')
      .select('*, clientes(nome)')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' })
    if (!['ativo','em_devolucao'].includes(contrato.status)) {
      return NextResponse.json({ ok: false, error: `Contrato em status "${contrato.status}" não permite devolução.` })
    }

    // ── Validar quantidades antes de processar ────────────────────────────────
    for (const item of itens) {
      const { data: ci } = await sb.from('contrato_itens')
        .select('quantidade, qtd_devolvida')
        .eq('id', item.contrato_item_id).single()
      if (!ci) return NextResponse.json({ ok: false, error: `Item ${item.contrato_item_id} não encontrado.` })
      const pendente = Number(ci.quantidade) - Number(ci.qtd_devolvida ?? 0)
      if (Number(item.quantidade_devolvida) > pendente) {
        return NextResponse.json({
          ok: false,
          error: `Quantidade a devolver (${item.quantidade_devolvida}) maior que pendente (${pendente}) para o item ${item.contrato_item_id}.`
        })
    }}

    // ── Processar cada item e acumular qtd_devolvida ──────────────────────────
    const osGeradas: number[] = []
    let qtdTotalContrato = 0
    let qtdTotalDevolvida = 0

    // Registrar devolução principal
    const statusDev = dias_atraso > 0 ? 'com_atraso' : valor_avarias > 0 ? 'com_avaria' : 'completa'
    const { data: dev, error: devErr } = await sb.from('devolucoes').insert({
      contrato_id,
      usuario_id:       user.id,
      data_devolucao:   new Date().toISOString(),
      tipo:             'parcial',  // será atualizado para 'total' se encerrar
      status:           statusDev,
      dias_atraso,
      multa_atraso:     0,          // calculado abaixo
      valor_avarias,
      caucao_devolvido: 0,          // preenchido só se encerrar total
      observacoes,
    }).select().single()
    if (devErr) return NextResponse.json({ ok: false, error: devErr.message })

    for (const item of itens) {
      const qtdDev = Number(item.quantidade_devolvida)
      if (qtdDev <= 0) continue

      // Registrar item da devolução
      await sb.from('devolucao_itens').insert({
        devolucao_id:         dev.id,
        contrato_item_id:     item.contrato_item_id,
        patrimonio_id:        item.patrimonio_id ?? null,
        quantidade_devolvida: qtdDev,
        condicao:             item.condicao === 'extraviado' ? 'perdido' : item.condicao,
        custo_avaria:         item.custo_avaria ?? 0,
        limpeza_cobrada:      !!item.limpeza_cobrada,
        valor_limpeza:        Number(item.valor_limpeza_avulsa ?? 0),
      })

      // Atualizar qtd_devolvida acumulada no item do contrato
      const { data: ci } = await sb.from('contrato_itens')
        .select('quantidade, qtd_devolvida')
        .eq('id', item.contrato_item_id).single()

      const novaQtdDev  = Number(ci?.qtd_devolvida ?? 0) + qtdDev
      const itemCompleto = novaQtdDev >= Number(ci?.quantidade ?? 0)

      await sb.from('contrato_itens').update({
        qtd_devolvida:  novaQtdDev,
        data_devolucao: itemCompleto ? new Date().toISOString() : null,
      }).eq('id', item.contrato_item_id)

      // Controle para verificar se todo o contrato foi devolvido
      qtdTotalContrato  += Number(ci?.quantidade ?? 0)
      qtdTotalDevolvida += novaQtdDev

      // Atualizar status do patrimônio rastreável
      if (item.patrimonio_id) {
        const novoStatusPat =
          item.condicao === 'avariado'   ? 'manutencao'  :
          item.condicao === 'extraviado' ? 'descartado'  : 'disponivel'
        await sb.from('patrimonios').update({ status: novoStatusPat }).eq('id', item.patrimonio_id)

        // OS automática para avariados
        if (item.condicao === 'avariado') {
          const { data: os } = await sb.from('manutencoes').insert({
            contrato_id,
            devolucao_id:          dev.id,
            produto_id:            item.produto_id,
            patrimonio_id:         item.patrimonio_id,
            tipo:                  'corretiva',
            status:                'aberto',
            descricao:             `Avaria registrada na devolução do contrato ${contrato.numero}`,
            custo:                 item.custo_avaria ?? 0,
            custo_cobrado_cliente: item.custo_avaria ?? 0,
            cobrado_em_fatura:     false,
            data_abertura:         new Date().toISOString().split('T')[0],
            usuario_id:            user.id,
          }).select('id').single()
          if (os) osGeradas.push(os.id)
        }
      }
    }

    // ── Calcular limpeza avulsa total cobrada nos itens devolvidos ──────────────
    const totalLimpezaAvulsa = itens.reduce((s: number, i: any) =>
      s + Number(i.valor_limpeza_avulsa ?? 0), 0)

    // ── Buscar totais reais do contrato para detectar parcial vs total ─────────
    const { data: todosItens } = await sb.from('contrato_itens')
      .select('quantidade, qtd_devolvida')
      .eq('contrato_id', contrato_id)

    const tudoDevolvido = (todosItens ?? []).every(
      (i: any) => Number(i.qtd_devolvida ?? 0) >= Number(i.quantidade)
    )
    const qtdTotal    = (todosItens ?? []).reduce((s: number, i: any) => s + Number(i.quantidade), 0)
    const qtdDevTotal = (todosItens ?? []).reduce((s: number, i: any) => s + Number(i.qtd_devolvida ?? 0), 0)
    const pct = qtdTotal > 0 ? Math.round(100 * qtdDevTotal / qtdTotal) : 100

    // ── Verificar saldo devedor SOMENTE se encerrar total ─────────────────────
    if (tudoDevolvido) {
      const { data: saldo } = await sb.from('contrato_saldo')
        .select('saldo_devedor')
        .eq('contrato_id', contrato_id).single()
      if (saldo && Number(saldo.saldo_devedor) > 0.01) {
        // Rollback: desfazer o que foi processado
        await sb.from('devolucoes').delete().eq('id', dev.id)
        return NextResponse.json({
          ok: false,
          error: `Existe saldo devedor de ${fmtMoney(Number(saldo.saldo_devedor))} pendente. Quite todas as faturas antes de encerrar o contrato.`
        })
      }
    }

    // ── Multa por atraso (só na devolução total ou se explicitamente informado) ─
    let multa_atraso = 0
    if (dias_atraso > 0) {
      const { data: itensContrato } = await sb.from('contrato_itens')
        .select('preco_diario, quantidade, produtos(preco_locacao_diario)')
        .eq('contrato_id', contrato_id)
      const valorDiario = (itensContrato ?? []).reduce((s: number, i: any) =>
        s + Number(i.preco_diario ?? (i.produtos as any)?.preco_locacao_diario ?? 0) * Number(i.quantidade ?? 1), 0)
      multa_atraso = valorDiario * dias_atraso
    }

    // ── Determinar novo status do contrato ────────────────────────────────────
    let novoStatus = contrato.status  // mantém ativo por padrão
    let dataEncerramento: string | null = null

    if (tudoDevolvido) {
      novoStatus       = osGeradas.length > 0 ? 'pendente_manutencao' : 'encerrado'
      dataEncerramento = new Date().toISOString()
    }

    // Atualizar a devolução com tipo correto, multa e caução
    await sb.from('devolucoes').update({
      tipo:             tudoDevolvido ? 'total' : 'parcial',
      multa_atraso,
      caucao_devolvido: tudoDevolvido ? caucao_devolvido : 0,
    }).eq('id', dev.id)

    // Atualizar contrato
    await sb.from('contratos').update({
      status: novoStatus,
      ...(dataEncerramento ? { data_devolucao_real: dataEncerramento } : {}),
    }).eq('id', contrato_id)

    // ── Fatura extra para multa/avaria ────────────────────────────────────────
    if (multa_atraso > 0 || valor_avarias > 0 || totalLimpezaAvulsa > 0) {
      const extra = multa_atraso + valor_avarias + totalLimpezaAvulsa
      const { count } = await sb.from('faturas').select('*', { count:'exact', head:true })
      const ano = new Date().getFullYear()
      const numFat = `FAT${ano}${String((count ?? 0) + 1).padStart(6,'0')}`
      await sb.from('faturas').insert({
        contrato_id,
        numero:          numFat,
        tipo:            multa_atraso > 0 ? 'multa' : totalLimpezaAvulsa > 0 ? 'limpeza' : 'avaria',
        status:          'pendente',
        valor:           extra,
        valor_recebido:  0,
        saldo_restante:  extra,
        data_emissao:    new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        descricao:       [
          multa_atraso > 0 ? `Multa por atraso (${dias_atraso}d)` : '',
          valor_avarias > 0 ? 'Cobrança de avaria/extravio' : '',
          totalLimpezaAvulsa > 0 ? `Taxa de limpeza avulsa (${itens.filter((i:any)=>i.limpeza_cobrada).length} item(ns))` : '',
        ].filter(Boolean).join(' + ') + ` — Contrato ${contrato.numero}`,
      })
    }

    // ── Timeline ──────────────────────────────────────────────────────────────
    await sb.from('contrato_timeline').insert({
      contrato_id,
      usuario_id: user.id,
      tipo:       'devolucao',
      descricao:  tudoDevolvido
        ? `Devolução total registrada — contrato ${novoStatus === 'encerrado' ? 'encerrado' : 'pendente de manutenção'}`
        : `Devolução parcial registrada — ${pct}% do contrato devolvido`,
      detalhes: { tudoDevolvido, pct, os_geradas: osGeradas.length },
    })

    // ── Mensagem de retorno ───────────────────────────────────────────────────
    const msg = !tudoDevolvido
      ? `Devolução parcial registrada (${pct}% do contrato). O contrato permanece ativo com os itens restantes.`
      : osGeradas.length > 0
        ? `Devolução total registrada. ${osGeradas.length} OS criada(s). Contrato em "Pendente de Manutenção".`
        : 'Devolução total registrada. Contrato encerrado com sucesso.'

    return NextResponse.json({
      ok:              true,
      tudo_devolvido:  tudoDevolvido,
      tipo:            tudoDevolvido ? 'total' : 'parcial',
      status_contrato: novoStatus,
      os_geradas:      osGeradas,
      pct_devolvido:   pct,
      msg,
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
