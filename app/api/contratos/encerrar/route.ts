// build: 2026-05-26 12:49:03
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtM(v: number) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

async function gerarNumeroFatura(): Promise<string> {
  const { data: pref } = await sb.from('parametros').select('valor').eq('chave', 'prefixo_fatura').maybeSingle()
  const prefixo = (pref as any)?.valor ?? 'FAT'
  const ano = new Date().getFullYear()
  const { count } = await sb.from('faturas').select('*', { count: 'exact', head: true })
  return `${prefixo}${ano}${String((count ?? 0) + 1).padStart(6, '0')}`
}

// POST /api/contratos/encerrar
// Fluxo:
//   1. Validar status e OS abertas
//   2. Verificar se todos os itens foram devolvidos — se não, exige devolução primeiro
//   3. Gerar fatura de locação (obrigatória como nota fiscal)
//   4. Encerrar contrato e liberar patrimônios
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { contrato_id } = await req.json()
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // ── Carregar contrato completo ────────────────────────────────────────────
    const { data: contrato } = await sb.from('contratos')
      .select('id, numero, status, total, subtotal, frete, caucao, desconto, acrescimo, data_inicio, data_fim, clientes(nome)')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' })

    if (!['ativo', 'em_devolucao', 'pendente_manutencao'].includes(contrato.status)) {
      return NextResponse.json({
        ok: false,
        error: `Contrato com status "${contrato.status}" não pode ser encerrado.`
      })
    }

    // ── 1. Verificar OS abertas ───────────────────────────────────────────────
    const { data: osAbertas } = await sb.from('manutencoes')
      .select('id').eq('contrato_id', contrato_id).in('status', ['aberto', 'em_andamento'])
    if (osAbertas && osAbertas.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Existem ${osAbertas.length} OS em aberto. Conclua antes de encerrar.`,
      })
    }

    // ── 2. Verificar se todos os itens foram devolvidos ───────────────────────
    const { data: itensContrato } = await sb.from('contrato_itens')
      .select('id, quantidade, qtd_devolvida, patrimonio_id, produtos(nome)')
      .eq('contrato_id', contrato_id)

    const itensPendentes = (itensContrato ?? []).filter(
      (i: any) => Number(i.qtd_devolvida ?? 0) < Number(i.quantidade)
    )

    if (itensPendentes.length > 0) {
      const nomes = itensPendentes.map((i: any) => {
        const pend = Number(i.quantidade) - Number(i.qtd_devolvida ?? 0)
        return `${(i.produtos as any)?.nome ?? 'Item'} (${pend} un. pendente)`
      }).join(', ')
      return NextResponse.json({
        ok: false,
        precisa_devolucao: true,
        error: `Há itens não devolvidos: ${nomes}. Registre a devolução antes de encerrar.`,
      })
    }

    // ── 3. Verificar e gerar fatura de locação (obrigatória) ─────────────────
    // A fatura de locação é o documento fiscal do contrato
    const { data: fatExistentes } = await sb.from('faturas')
      .select('id, tipo, status, valor, valor_recebido, saldo_restante')
      .eq('contrato_id', contrato_id)
      .neq('status', 'cancelado')

    const fats = fatExistentes ?? []
    const fatLocacao = fats.find((f: any) => f.tipo === 'locacao')

    // Se não há fatura de locação, gerar agora
    if (!fatLocacao) {
      const totalLocacao = Number(contrato.total)
      const numFat = await gerarNumeroFatura()
      await sb.from('faturas').insert({
        contrato_id,
        numero:          numFat,
        tipo:            'locacao',
        status:          'pendente',
        valor:           totalLocacao,
        valor_recebido:  0,
        saldo_restante:  totalLocacao,
        data_emissao:    hoje,
        data_vencimento: hoje,
        descricao:       `Locação de equipamentos — Contrato ${contrato.numero}`,
      })
      return NextResponse.json({
        ok: false,
        fatura_gerada: true,
        precisa_pagamento: true,
        error: `Fatura de locação ${numFat} gerada no valor de ${fmtM(totalLocacao)}. Registre o pagamento e então encerre o contrato.`,
      })
    }

    // ── 4. Verificar saldo devedor em todas as faturas ───────────────────────
    const saldoTotal = fats.reduce((s: number, f: any) =>
      s + Number(f.saldo_restante ?? (Number(f.valor) - Number(f.valor_recebido ?? 0))), 0
    )

    if (saldoTotal > 0.01) {
      return NextResponse.json({
        ok: false,
        precisa_pagamento: true,
        error: `Saldo devedor de ${fmtM(saldoTotal)} pendente. Registre o pagamento e então encerre.`,
        saldo_devedor: saldoTotal,
      })
    }

    // ── 5. Liberar patrimônios ────────────────────────────────────────────────
    for (const item of itensContrato ?? []) {
      if (!(item as any).patrimonio_id) continue
      const { data: pat } = await sb.from('patrimonios')
        .select('status').eq('id', (item as any).patrimonio_id).single()
      if (pat?.status === 'locado') {
        await sb.from('patrimonios')
          .update({ status: 'disponivel' })
          .eq('id', (item as any).patrimonio_id)
      }
    }

    // ── 6. Encerrar contrato ──────────────────────────────────────────────────
    await sb.from('contratos').update({
      status:              'encerrado',
      data_devolucao_real: new Date().toISOString(),
    }).eq('id', contrato_id)

    // ── 7. Timeline ──────────────────────────────────────────────────────────
    try {
      await sb.from('contrato_timeline').insert({
        contrato_id,
        usuario_id: user.id,
        tipo:       'encerramento',
        descricao:  `Contrato ${contrato.numero} encerrado com sucesso.`,
      })
    } catch (_) { /* timeline é opcional — não bloqueia encerramento */ }

    return NextResponse.json({
      ok:  true,
      msg: `Contrato ${contrato.numero} encerrado com sucesso.`,
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
