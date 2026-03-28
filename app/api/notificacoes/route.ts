import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// GET — listar notificações do usuário logado
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
  if (!user.id) return NextResponse.json({ ok:false, error:'Não autenticado' }, {status:401})

  const { searchParams } = new URL(req.url)
  const apenasNaoLidas = searchParams.get('nao_lidas') === 'true'

  let q = sb.from('notificacoes').select('*')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (apenasNaoLidas) q = q.eq('lida', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok:false, error:error.message })

  const naoLidas = (data ?? []).filter(n => !n.lida).length
  return NextResponse.json({ ok:true, data: data ?? [], nao_lidas: naoLidas })
}

// PATCH — marcar como lida(s)
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
  if (!user.id) return NextResponse.json({ ok:false, error:'Não autenticado' })

  const { id, todas } = await req.json()
  if (todas) {
    await sb.from('notificacoes').update({ lida: true }).eq('usuario_id', user.id).eq('lida', false)
  } else if (id) {
    await sb.from('notificacoes').update({ lida: true }).eq('id', id).eq('usuario_id', user.id)
  }
  return NextResponse.json({ ok: true })
}

// POST — criar notificação (uso interno / sistema)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { usuario_id, tipo, titulo, mensagem, referencia_tipo, referencia_id } = body
  const { data, error } = await sb.from('notificacoes').insert({
    usuario_id, tipo, titulo, mensagem: mensagem || null,
    referencia_tipo: referencia_tipo || null,
    referencia_id: referencia_id || null,
  }).select().single()
  if (error) return NextResponse.json({ ok:false, error:error.message })
  return NextResponse.json({ ok:true, data })
}
