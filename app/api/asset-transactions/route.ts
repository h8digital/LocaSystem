import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const produto_id   = searchParams.get('produto_id')
  const patrimonio_id = searchParams.get('patrimonio_id')
  let q = sb.from('asset_transactions')
    .select('*, patrimonios(numero_patrimonio,numero_serie), usuarios(nome), clientes(nome)')
    .order('data_transacao', { ascending: false })
  if (produto_id)    q = q.eq('produto_id', Number(produto_id))
  if (patrimonio_id) q = q.eq('patrimonio_id', Number(patrimonio_id))
  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true, data })
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const { produto_id, patrimonio_id, tipo, valor, data_transacao,
            numero_nota_fiscal, fornecedor_id, garantia_ate,
            depreciacao_meses, status_apos, observacoes } = body

    if (!tipo || !produto_id)
      return NextResponse.json({ ok: false, error: 'Tipo e Produto são obrigatórios.' })

    // PRD 3.4: validar unicidade do patrimônio na entrada (compra)
    if (tipo === 'compra' && patrimonio_id) {
      const { data: existing } = await sb.from('asset_transactions')
        .select('id').eq('patrimonio_id', patrimonio_id).eq('tipo','compra').maybeSingle()
      if (existing)
        return NextResponse.json({ ok: false, error: 'Este patrimônio já possui uma entrada de compra registrada.' })
    }

    const { data, error } = await sb.from('asset_transactions').insert({
      produto_id: Number(produto_id),
      patrimonio_id: patrimonio_id ? Number(patrimonio_id) : null,
      tipo, valor: Number(valor) || 0, data_transacao,
      numero_nota_fiscal: numero_nota_fiscal || null,
      fornecedor_id: fornecedor_id ? Number(fornecedor_id) : null,
      garantia_ate: garantia_ate || null,
      depreciacao_meses: depreciacao_meses ? Number(depreciacao_meses) : null,
      status_apos: status_apos || null,
      observacoes: observacoes || null,
      usuario_id: user.id,
    }).select().single()

    if (error) return NextResponse.json({ ok: false, error: error.message })

    // Atualizar status do patrimônio
    if (patrimonio_id && status_apos) {
      await sb.from('patrimonios').update({ status: status_apos }).eq('id', Number(patrimonio_id))
    }

    // PRD 3.5: Compra → atualiza custo_reposicao do produto pai com o valor mais recente
    if (tipo === 'compra' && produto_id && Number(valor) > 0) {
      await sb.from('produtos').update({ custo_reposicao: Number(valor) }).eq('id', Number(produto_id))
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' })
  const { error } = await sb.from('asset_transactions').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true })
}
