// build: 2026-06-06 — Limpeza de dados de teste (apenas admin)
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-api'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { confirmar, modo } = await req.json()
    if (confirmar !== 'CONFIRMAR_LIMPEZA') {
      return NextResponse.json({ ok: false, error: 'Confirmação inválida.' })
    }

    const stats: Record<string, number> = {}

    // ── Contratos ────────────────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'contratos') {
      // IDs dos itens de contrato para deletar devolucao_itens
      const { data: itens } = await sb.from('contrato_itens').select('id')
      const itemIds = (itens ?? []).map((i: any) => i.id)
      if (itemIds.length) {
        const { count: di } = await sb.from('devolucao_itens').delete({ count:'exact' }).in('contrato_item_id', itemIds)
        stats.devolucao_itens = di ?? 0
      }
      const { count: tl } = await sb.from('contrato_timeline').delete({ count:'exact' }).neq('id', 0)
      const { count: nt } = await sb.from('notificacoes').delete({ count:'exact' }).neq('id', 0)
      const { count: ft } = await sb.from('faturas').delete({ count:'exact' }).neq('id', 0)
      const { count: ci } = await sb.from('contrato_itens').delete({ count:'exact' }).neq('id', 0)
      const { count: ct } = await sb.from('contratos').delete({ count:'exact' }).neq('id', 0)
      stats.timeline       = tl ?? 0
      stats.notificacoes   = nt ?? 0
      stats.faturas        = ft ?? 0
      stats.contrato_itens = ci ?? 0
      stats.contratos      = ct ?? 0
      // Liberar todos os patrimônios
      await sb.from('patrimonios').update({ status: 'disponivel' }).eq('status', 'locado')
    }

    // ── Clientes ─────────────────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'clientes') {
      const { count: ce } = await sb.from('cliente_enderecos').delete({ count:'exact' }).neq('id', 0)
      const { count: cl } = await sb.from('clientes').delete({ count:'exact' }).neq('id', 0)
      stats.cliente_enderecos = ce ?? 0
      stats.clientes          = cl ?? 0
    }

    // ── Cotações ─────────────────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'cotacoes') {
      const { count: coi } = await sb.from('cotacao_itens').delete({ count:'exact' }).neq('id', 0)
      const { count: co }  = await sb.from('cotacoes').delete({ count:'exact' }).neq('id', 0)
      stats.cotacao_itens = coi ?? 0
      stats.cotacoes      = co  ?? 0
    }

    // ── Documentos gerados ───────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'docs') {
      const { count: dc } = await sb.from('documentos').delete({ count:'exact' }).neq('id', 0)
      stats.documentos = dc ?? 0
    }

    return NextResponse.json({ ok: true, stats })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
