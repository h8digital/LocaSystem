import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function nextFatNum(count: number, ano: number, pref = 'FAT') {
  return `${pref}${ano}${String(count + 1).padStart(6,'0')}`
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { contrato_id } = await req.json()
    const hoje = new Date().toISOString().split('T')[0]
    const ano  = new Date().getFullYear()

    const { data: contrato } = await sb.from('contratos')
      .select('numero, status, total, subtotal, frete, caucao')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado' })

    if (!['pendente_manutencao','ativo','em_devolucao'].includes(contrato.status)) {
      return NextResponse.json({ ok: false, error: `Contrato com status "${contrato.status}" não pode ser encerrado por esta rota.` })
    }

    // ── 1. Verificar OS abertas ───────────────────────────────────────────────
    const { data: osAbertas } = await sb.from('manutencoes')
      .select('id, status')
      .eq('contrato_id', contrato_id)
      .in('status', ['aberto','em_andamento'])

    if (osAbertas && osAbertas.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Existem ${osAbertas.length} Ordem(ns) de Serviço em aberto. Conclua-as antes de encerrar.`,
        os_pendentes: osAbertas.map(o => o.id),
      })
    }

    // ── 2. Gerar fatura de OS concluídas ainda não cobradas ───────────────────
    const { data: osPendentes } = await sb.from('manutencoes')
      .select('id, custo_cobrado_cliente')
      .eq('contrato_id', contrato_id)
      .eq('status', 'concluido')
      .eq('cobrado_em_fatura', false)
      .gt('custo_cobrado_cliente', 0)

    if (osPendentes && osPendentes.length > 0) {
      const totalOS = osPendentes.reduce((s, o) => s + Number(o.custo_cobrado_cliente), 0)
      const { count } = await sb.from('faturas').select('*', { count:'exact', head:true })
      const { data: pref } = await sb.from('parametros').select('valor').eq('chave','prefixo_fatura').single()

      await sb.from('faturas').insert({
        contrato_id,
        numero:          nextFatNum(count ?? 0, ano, (pref as any)?.valor ?? 'FAT'),
        tipo:            'avaria',
        status:          'pendente',
        valor:           totalOS,
        valor_recebido:  0,
        saldo_restante:  totalOS,
        data_emissao:    hoje,
        data_vencimento: hoje,
        descricao:       `Manutenção/reparo — Contrato ${contrato.numero}`,
      })

      for (const os of osPendentes) {
        await sb.from('manutencoes').update({ cobrado_em_fatura: true }).eq('id', os.id)
      }

      return NextResponse.json({
        ok: false,
        fatura_gerada: true,
        valor_fatura: totalOS,
        error: `Gerada fatura de R$ ${totalOS.toFixed(2).replace('.',',')} referente a manutenção. Quite para encerrar.`,
      })
    }

    // ── 3. Verificar saldo devedor (com fallback para status=pago) ────────────
    const { data: saldo } = await sb.from('contrato_saldo')
      .select('saldo_devedor, total_faturado, total_recebido')
      .eq('contrato_id', contrato_id)
      .single()

    if (saldo && Number(saldo.saldo_devedor) > 0.01) {
      return NextResponse.json({
        ok: false,
        error: `Saldo devedor de R$ ${Number(saldo.saldo_devedor).toFixed(2).replace('.',',')} pendente. Quite todas as faturas antes de encerrar.`,
        saldo_devedor: saldo.saldo_devedor,
      })
    }

    // ── 4. Verificar se o total do contrato foi integralmente faturado ────────
    // Se houver diferença (ex: frete não faturado), gerar fatura complementar
    const totalContrato    = Number(contrato.total)
    const totalFaturado    = Number(saldo?.total_faturado ?? 0)
    const totalRecebido    = Number(saldo?.total_recebido ?? 0)
    const diferenca        = totalContrato - totalFaturado

    if (diferenca > 0.01) {
      const { count } = await sb.from('faturas').select('*', { count:'exact', head:true })
      const { data: pref } = await sb.from('parametros').select('valor').eq('chave','prefixo_fatura').single()

      await sb.from('faturas').insert({
        contrato_id,
        numero:          nextFatNum(count ?? 0, ano, (pref as any)?.valor ?? 'FAT'),
        tipo:            'locacao',
        status:          'pendente',
        valor:           diferenca,
        valor_recebido:  0,
        saldo_restante:  diferenca,
        data_emissao:    hoje,
        data_vencimento: hoje,
        descricao:       `Complemento faturamento — Contrato ${contrato.numero} (frete e ajustes)`,
      })

      return NextResponse.json({
        ok: false,
        fatura_gerada: true,
        valor_fatura: diferenca,
        error: `Gerada fatura complementar de R$ ${diferenca.toFixed(2).replace('.',',')} (diferença não faturada). Quite para encerrar.`,
      })
    }

    // ── 5. Gerar fatura final discriminada (documento de encerramento) ────────
    // Apenas se não existe fatura de encerramento gerada ainda
    const { data: fatExistente } = await sb.from('faturas')
      .select('id')
      .eq('contrato_id', contrato_id)
      .eq('tipo', 'encerramento')
      .maybeSingle()

    if (!fatExistente) {
      const { data: todasFaturas } = await sb.from('faturas')
        .select('tipo, valor, valor_recebido, status')
        .eq('contrato_id', contrato_id)
        .neq('status', 'cancelado')

      const { count } = await sb.from('faturas').select('*', { count:'exact', head:true })
      const { data: pref } = await sb.from('parametros').select('valor').eq('chave','prefixo_fatura').single()

      const vLocacao = (todasFaturas ?? []).filter(f=>f.tipo==='locacao').reduce((s,f)=>s+Number(f.valor),0)
      const vFrete   = Number(contrato.frete ?? 0)
      const vMulta   = (todasFaturas ?? []).filter(f=>f.tipo==='multa').reduce((s,f)=>s+Number(f.valor),0)
      const vOS      = (todasFaturas ?? []).filter(f=>['avaria','dano'].includes(f.tipo)).reduce((s,f)=>s+Number(f.valor),0)
      const vTotal   = vLocacao + vMulta + vOS
      const vPago    = (todasFaturas ?? []).reduce((s,f)=>s+Number(f.valor_recebido??0),0)

      const linhas = [
        vLocacao > 0 ? `Locação: R$ ${vLocacao.toFixed(2).replace('.',',')}` : null,
        vFrete   > 0 ? `Frete: R$ ${vFrete.toFixed(2).replace('.',',')}` : null,
        vMulta   > 0 ? `Multa por atraso: R$ ${vMulta.toFixed(2).replace('.',',')}` : null,
        vOS      > 0 ? `Manutenção/OS: R$ ${vOS.toFixed(2).replace('.',',')}` : null,
        `Total: R$ ${vTotal.toFixed(2).replace('.',',')}`,
        `Recebido: R$ ${vPago.toFixed(2).replace('.',',')}`,
      ].filter(Boolean).join(' | ')

      await sb.from('faturas').insert({
        contrato_id,
        numero:          nextFatNum(count ?? 0, ano, (pref as any)?.valor ?? 'FAT'),
        tipo:            'encerramento',
        status:          'pago',           // documento de fechamento, saldo já zerado
        valor:           vTotal,
        valor_recebido:  vPago,
        saldo_restante:  0,
        data_emissao:    hoje,
        data_vencimento: hoje,
        descricao:       `Fatura de Encerramento — Contrato ${contrato.numero} | ${linhas}`,
      })
    }

    // ── 6. Encerrar ───────────────────────────────────────────────────────────
    await sb.from('contratos').update({ status: 'encerrado' }).eq('id', contrato_id)

    return NextResponse.json({
      ok: true,
      msg: `Contrato ${contrato.numero} encerrado com sucesso. Fatura de encerramento gerada.`,
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
