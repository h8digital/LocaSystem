// build: 2026-06-06 — Sincronização manual de pagamentos Asaas
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
    const { fatura_id } = await req.json().catch(()=>({}))
    const { data: params } = await sb.from('parametros').select('chave,valor')
      .in('chave',['asaas_api_key','asaas_ambiente'])
    const cfg: Record<string,string> = {}
    ;(params??[]).forEach((r:any)=>{ cfg[r.chave]=r.valor })
    const baseUrl = cfg.asaas_ambiente==='production'
      ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3'

    let query = sb.from('faturas').select('id,numero,status,valor,asaas_payment_id')
      .not('asaas_payment_id','is',null).in('status',['pendente','vencida'])
    if (fatura_id) query = (query as any).eq('id', fatura_id)

    const { data: faturas } = await query
    if (!faturas?.length) return NextResponse.json({ ok:true, atualizadas:0 })

    const hoje = new Date().toISOString().split('T')[0]
    let atualizadas = 0

    for (const fat of faturas) {
      const r = await fetch(`${baseUrl}/payments/${fat.asaas_payment_id}`, {
        headers: { 'access_token': cfg.asaas_api_key }
      })
      const pgto = await r.json()
      if (!pgto.id) continue

      if (['RECEIVED','CONFIRMED'].includes(pgto.status)) {
        await sb.from('faturas').update({
          status: 'pago', asaas_status: pgto.status,
          valor_pago: Number(pgto.value ?? fat.valor),
          valor_recebido: Number(pgto.value ?? fat.valor),
          saldo_restante: 0,
          data_pagamento: pgto.paymentDate ?? pgto.clientPaymentDate ?? hoje,
          forma_pagamento: pgto.billingType?.toLowerCase() ?? 'pix',
          observacoes: `Pago via Asaas (${pgto.billingType}) — ID: ${pgto.id}`,
        }).eq('id', fat.id)
        atualizadas++
      } else if (pgto.status === 'OVERDUE') {
        await sb.from('faturas').update({ status:'vencida', asaas_status:pgto.status }).eq('id', fat.id)
      } else {
        await sb.from('faturas').update({ asaas_status: pgto.status }).eq('id', fat.id)
      }
    }
    return NextResponse.json({ ok:true, atualizadas, verificadas: faturas.length })
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
