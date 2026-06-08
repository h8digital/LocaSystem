// build: 2026-06-06 — Cancelar cobrança no Asaas
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  try {
    const { payment_id } = await req.json()
    if (!payment_id) return NextResponse.json({ ok: false, error: 'payment_id obrigatório' })

    const { data: params } = await sb.from('parametros').select('chave,valor')
      .in('chave', ['asaas_api_key', 'asaas_ambiente'])
    const cfg: Record<string, string> = {}
    ;(params ?? []).forEach((r: any) => { cfg[r.chave] = r.valor })

    if (!cfg.asaas_api_key) return NextResponse.json({ ok: false, error: 'Chave Asaas não configurada.' })

    const baseUrl = cfg.asaas_ambiente === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3'

    // Cancelar/deletar a cobrança no Asaas
    const res = await fetch(`${baseUrl}/payments/${payment_id}`, {
      method: 'DELETE',
      headers: { 'access_token': cfg.asaas_api_key },
    })

    if (res.status === 200 || res.status === 204) {
      return NextResponse.json({ ok: true })
    }

    const body = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: false, error: JSON.stringify(body) })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
