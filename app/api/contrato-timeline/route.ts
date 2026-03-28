import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contrato_id = searchParams.get('contrato_id')
  if (!contrato_id) return NextResponse.json({ ok:false, error:'contrato_id obrigatório' })

  const { data, error } = await sb.from('contrato_timeline')
    .select('*, usuarios(nome)')
    .eq('contrato_id', Number(contrato_id))
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ ok:false, error:error.message })
  return NextResponse.json({ ok:true, data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
  const body = await req.json()
  const { contrato_id, tipo, descricao, detalhes } = body

  const { data, error } = await sb.from('contrato_timeline').insert({
    contrato_id: Number(contrato_id),
    usuario_id: user.id || null,
    tipo, descricao,
    detalhes: detalhes || null,
  }).select().single()

  if (error) return NextResponse.json({ ok:false, error:error.message })
  return NextResponse.json({ ok:true, data })
}
