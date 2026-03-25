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

    // Multa por atraso
    let multa_atraso = 0
    if (dias_atraso > 0) {
      const { data: param } = await sb.from('parametros').select('valor').eq('chave', 'multa_atraso_percentual').single()
      const pct = Number(param?.valor ?? 2)
      multa_atraso = contrato.total * (pct / 100) * dias_atraso
    }

    const status = dias_atraso > 0 ? 'com_atraso' : valor_avarias > 0 ? 'com_avaria' : 'completa'

    const { data: dev } = await sb.from('devolucoes').insert({
      contrato_id, usuario_id: user.id, data_devolucao: new Date().toISOString(),
      status, dias_atraso, multa_atraso, valor_avarias, caucao_devolvido, observacoes,
    }).select().single()

    // Processar itens
    for (const item of itens) {
      await sb.from('devolucao_itens').insert({ devolucao_id: dev.id, contrato_item_id: item.contrato_item_id, patrimonio_id: item.patrimonio_id ?? null, quantidade_devolvida: item.quantidade, condicao: item.condicao, custo_avaria: item.custo_avaria })
      if (item.patrimonio_id) {
        const novoStatus = item.condicao === 'avariado' ? 'manutencao' : 'disponivel'
        await sb.from('patrimonios').update({ status: novoStatus }).eq('id', item.patrimonio_id)
      }
    }

    // Encerrar contrato
    await sb.from('contratos').update({ status: 'encerrado', data_devolucao_real: new Date().toISOString() }).eq('id', contrato_id)

    // Fatura extra se necessário
    if (multa_atraso > 0 || valor_avarias > 0) {
      const extra = multa_atraso + valor_avarias
      const { count } = await sb.from('faturas').select('*', { count: 'exact', head: true })
      await sb.from('faturas').insert({ contrato_id, numero: `FAT${new Date().getFullYear()}${String((count ?? 0) + 1).padStart(6,'0')}`, tipo: multa_atraso > 0 ? 'multa' : 'dano', status: 'pendente', valor: extra, data_emissao: new Date().toISOString().split('T')[0], data_vencimento: new Date().toISOString().split('T')[0], descricao: `Multa/avaria — Contrato ${contrato.numero}` })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
