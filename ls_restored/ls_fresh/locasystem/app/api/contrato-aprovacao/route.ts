import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function gerarToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST — gerar link de aprovação eletrônica
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
  if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

  const { contrato_id, doc_gerado_id } = await req.json()
  if (!contrato_id) return NextResponse.json({ ok: false, error: 'contrato_id obrigatório' })

  // Verificar se já existe aprovação pendente
  const { data: existente } = await sb
    .from('contrato_aprovacoes')
    .select('id, token, status')
    .eq('contrato_id', contrato_id)
    .eq('status', 'pendente')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existente) {
    return NextResponse.json({ ok: true, token: existente.token, ja_existia: true })
  }

  const token = gerarToken()
  const { data, error } = await sb.from('contrato_aprovacoes').insert({
    contrato_id,
    doc_gerado_id: doc_gerado_id ?? null,
    token,
    status: 'pendente',
  }).select('id, token').single()

  if (error) return NextResponse.json({ ok: false, error: error.message })

  // Registrar na timeline
  await sb.from('contrato_timeline').insert({
    contrato_id,
    usuario_id: user.id,
    tipo: 'documento',
    descricao: 'Link de aprovação eletrônica gerado e enviado ao cliente',
  })

  return NextResponse.json({ ok: true, token: data.token })
}

// GET — buscar log de aprovação de um contrato
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contrato_id = searchParams.get('contrato_id')
  if (!contrato_id) return NextResponse.json({ ok: false, error: 'contrato_id obrigatório' })

  const { data } = await sb
    .from('contrato_aprovacoes')
    .select('*')
    .eq('contrato_id', Number(contrato_id))
    .order('created_at', { ascending: false })

  return NextResponse.json({ ok: true, data: data ?? [] })
}
