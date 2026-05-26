// build: 2026-05-26 01:22:45 UTC
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/system/logs?nivel=error&origem=&limite=100
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const nivel  = searchParams.get('nivel')
  const origem = searchParams.get('origem')
  const limite = Math.min(Number(searchParams.get('limite') ?? 100), 500)

  let q = sb.from('system_logs')
    .select('*, usuarios(nome)')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (nivel)  q = q.eq('nivel', nivel)
  if (origem) q = q.ilike('origem', `%${origem}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true, logs: data })
}

// DELETE /api/system/logs — limpar logs antigos (> 30 dias)
export async function DELETE() {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count } = await sb.from('system_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
  return NextResponse.json({ ok: true, removidos: count })
}
