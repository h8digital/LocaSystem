import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await sb.from('tabelas_preco').select('*, tabela_preco_regras(*)').eq('ativo',1).order('padrao',{ascending:false}).order('nome')
  return NextResponse.json({ ok:true, data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { nome, descricao, padrao } = await req.json()
  if (!nome) return NextResponse.json({ ok:false, error:'Nome obrigatório' })
  if (padrao) await sb.from('tabelas_preco').update({ padrao: false }).eq('padrao', true)
  const { data, error } = await sb.from('tabelas_preco').insert({ nome, descricao, padrao: !!padrao, ativo:1 }).select().single()
  if (error) return NextResponse.json({ ok:false, error:error.message })
  return NextResponse.json({ ok:true, data })
}

export async function PATCH(req: NextRequest) {
  const { id, regras } = await req.json() // regras = [{produto_id, tipo_periodo, valor}]
  if (!id || !Array.isArray(regras)) return NextResponse.json({ ok:false, error:'Parâmetros inválidos' })
  // Upsert regras
  for (const r of regras) {
    await sb.from('tabela_preco_regras').upsert({
      tabela_id: id, produto_id: r.produto_id,
      tipo_periodo: r.tipo_periodo, valor: Number(r.valor) || 0
    }, { onConflict: 'tabela_id,produto_id,tipo_periodo' })
  }
  return NextResponse.json({ ok:true })
}
