import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// POST /api/contratos/encerrar
// Encerra contrato em status pendente_manutencao após validar:
// 1. Todas as OS vinculadas estão concluídas
// 2. Saldo devedor = 0
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { contrato_id } = await req.json()

    const { data: contrato } = await sb.from('contratos').select('numero, status').eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado' })

    if (!['pendente_manutencao', 'ativo'].includes(contrato.status)) {
      return NextResponse.json({ ok: false, error: `Contrato com status "${contrato.status}" não pode ser encerrado por esta rota.` })
    }

    // ── Verificar OS abertas ──────────────────────────────────────────────────
    const { data: osAbertas } = await sb.from('manutencoes')
      .select('id, status, custo, cobrado_em_fatura')
      .eq('contrato_id', contrato_id)
      .in('status', ['aberto', 'em_andamento'])

    if (osAbertas && osAbertas.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Existem ${osAbertas.length} Ordem(ns) de Serviço em aberto vinculadas a este contrato. Conclua todas as OS antes de encerrar.`,
        os_pendentes: osAbertas.map(o => o.id),
      })
    }

    // ── Lançar custos de OS ainda não faturadas ───────────────────────────────
    const { data: osPendentes } = await sb.from('manutencoes')
      .select('id, custo, custo_cobrado_cliente')
      .eq('contrato_id', contrato_id)
      .eq('status', 'concluido')
      .eq('cobrado_em_fatura', false)
      .gt('custo_cobrado_cliente', 0)

    if (osPendentes && osPendentes.length > 0) {
      const totalOS = osPendentes.reduce((s, o) => s + Number(o.custo_cobrado_cliente), 0)
      const { count } = await sb.from('faturas').select('*', { count: 'exact', head: true })
      const ano = new Date().getFullYear()
      const numFat = `FAT${ano}${String((count ?? 0) + 1).padStart(6,'0')}`

      await sb.from('faturas').insert({
        contrato_id,
        numero:          numFat,
        tipo:            'avaria',
        status:          'pendente',
        valor:           totalOS,
        valor_recebido:  0,
        saldo_restante:  totalOS,
        data_emissao:    new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        descricao:       `Custos de manutenção/reparo — Contrato ${contrato.numero}`,
      })

      // Marcar OS como cobradas
      for (const os of osPendentes) {
        await sb.from('manutencoes').update({ cobrado_em_fatura: true }).eq('id', os.id)
      }

      return NextResponse.json({
        ok: false,
        fatura_gerada: true,
        valor_fatura: totalOS,
        error: `Foi gerada uma fatura de R$ ${totalOS.toFixed(2).replace('.',',')} referente aos custos de manutenção. Quite esta fatura para encerrar o contrato.`,
      })
    }

    // ── GAP 7: Verificar saldo devedor ────────────────────────────────────────
    const { data: saldo } = await sb.from('contrato_saldo')
      .select('saldo_devedor')
      .eq('contrato_id', contrato_id)
      .single()

    if (saldo && Number(saldo.saldo_devedor) > 0.01) {
      return NextResponse.json({
        ok: false,
        error: `Saldo devedor de R$ ${Number(saldo.saldo_devedor).toFixed(2).replace('.',',')} pendente. Quite todas as faturas antes de encerrar.`,
      })
    }

    // ── Encerrar ──────────────────────────────────────────────────────────────
    await sb.from('contratos').update({ status: 'encerrado' }).eq('id', contrato_id)

    return NextResponse.json({ ok: true, msg: 'Contrato encerrado com sucesso. Saldo zerado, todas as OS concluídas.' })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
