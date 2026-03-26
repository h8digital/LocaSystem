import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { contrato_id, itens, dias_atraso, valor_avarias, caucao_devolvido, observacoes } = await req.json()

    const { data: contrato } = await sb.from('contratos').select('*').eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado' })

    // ── GAP 7: Bloquear encerramento se saldo devedor pendente ────────────────
    const { data: saldo } = await sb.from('contrato_saldo')
      .select('saldo_devedor, custo_os_pendente')
      .eq('contrato_id', contrato_id)
      .single()
    if (saldo && Number(saldo.saldo_devedor) > 0.01) {
      return NextResponse.json({
        ok: false,
        error: `Existe saldo devedor de R$ ${Number(saldo.saldo_devedor).toFixed(2).replace('.',',')} pendente. Quite todas as faturas antes de encerrar.`
      })
    }

    // ── Multa por atraso ──────────────────────────────────────────────────────
    let multa_atraso = 0
    if (dias_atraso > 0) {
      // Regra PRD seção 3: Overdue = dias × tabela DIÁRIA (não % do total)
      // Buscar o valor diário médio dos itens do contrato
      const { data: itensContrato } = await sb.from('contrato_itens')
        .select('preco_diario, quantidade, produtos(preco_locacao_diario)')
        .eq('contrato_id', contrato_id)
      const valorDiarioTotal = (itensContrato ?? []).reduce((s: number, i: any) => {
        const diario = Number(i.preco_diario ?? (i.produtos as any)?.preco_locacao_diario ?? 0)
        return s + diario * Number(i.quantidade ?? 1)
      }, 0)
      multa_atraso = valorDiarioTotal * dias_atraso
    }

    const temAvaria = itens.some((i: any) => i.condicao === 'avariado' || i.condicao === 'extraviado')
    const status = dias_atraso > 0 ? 'com_atraso' : valor_avarias > 0 ? 'com_avaria' : 'completa'

    // ── Registrar devolução ───────────────────────────────────────────────────
    const { data: dev } = await sb.from('devolucoes').insert({
      contrato_id,
      usuario_id:      user.id,
      data_devolucao:  new Date().toISOString(),
      status,
      dias_atraso,
      multa_atraso,
      valor_avarias,
      caucao_devolvido,
      observacoes,
    }).select().single()

    // ── Processar cada item devolvido ─────────────────────────────────────────
    const osGeradas: number[] = []

    for (const item of itens) {
      await sb.from('devolucao_itens').insert({
        devolucao_id:       dev.id,
        contrato_item_id:   item.contrato_item_id,
        patrimonio_id:      item.patrimonio_id ?? null,
        quantidade_devolvida: item.quantidade,
        condicao:           item.condicao === 'extraviado' ? 'perdido' : item.condicao,
        custo_avaria:       item.custo_avaria,
      })

      if (item.patrimonio_id) {
        // ── GAP 3: Atualizar status do patrimônio ─────────────────────────────
        // avariado → manutencao | extraviado → descartado | bom → disponivel
        const novoStatusPat =
          item.condicao === 'avariado'   ? 'manutencao'  :
          item.condicao === 'extraviado' ? 'descartado'  : 'disponivel'

        await sb.from('patrimonios').update({ status: novoStatusPat }).eq('id', item.patrimonio_id)

        // ── GAP 5: Criar OS automaticamente para itens avariados ──────────────
        if (item.condicao === 'avariado') {
          const { data: os } = await sb.from('manutencoes').insert({
            contrato_id,
            devolucao_id:        dev.id,
            produto_id:          item.produto_id,
            patrimonio_id:       item.patrimonio_id,
            tipo:                'corretiva',
            status:              'aberto',
            descricao:           `Avaria registrada na devolução do contrato ${contrato.numero}`,
            custo:               item.custo_avaria ?? 0,
            custo_cobrado_cliente: item.custo_avaria ?? 0,
            cobrado_em_fatura:   false,
            data_abertura:       new Date().toISOString().split('T')[0],
            usuario_id:          user.id,
          }).select('id').single()
          if (os) osGeradas.push(os.id)
        }
      }

      // Para itens sem patrimônio (quantidade), atualizar estoque se devolvido ok
      if (!item.patrimonio_id && item.condicao === 'bom') {
        // Estoque volta automaticamente (já controlado pela view estoque_disponivel)
      }
    }

    // ── GAP 4: Status PENDING_MAINTENANCE se há OS abertas, senão ENCERRADO ──
    const novoStatusContrato = osGeradas.length > 0 ? 'pendente_manutencao' : 'encerrado'

    await sb.from('contratos').update({
      status:              novoStatusContrato,
      data_devolucao_real: new Date().toISOString(),
    }).eq('id', contrato_id)

    // ── Fatura extra para multa/avaria (apenas se há valores) ─────────────────
    if (multa_atraso > 0 || valor_avarias > 0) {
      const extra = multa_atraso + valor_avarias
      const { count } = await sb.from('faturas').select('*', { count: 'exact', head: true })
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
        descricao:       `${multa_atraso > 0 ? 'Multa por atraso' : 'Cobrança de avaria'} — Contrato ${contrato.numero}`,
      })
    }

    return NextResponse.json({
      ok:           true,
      status:       novoStatusContrato,
      os_geradas:   osGeradas,
      pendente_manutencao: osGeradas.length > 0,
      msg: osGeradas.length > 0
        ? `Devolução registrada. ${osGeradas.length} OS criada(s) automaticamente. O contrato ficará em "Pendente de Manutenção" até as OS serem concluídas e os custos lançados.`
        : 'Devolução registrada. Contrato encerrado com sucesso.',
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
