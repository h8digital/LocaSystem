// build: 2026-06-05 — Webhook Asaas com validação de assinatura
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Valida a assinatura HMAC-SHA256 do Asaas
async function validarAssinatura(req: NextRequest, rawBody: string): Promise<boolean> {
  try {
    const { data } = await sb.from('parametros')
      .select('valor').eq('chave', 'asaas_webhook_token').maybeSingle()
    const secret = (data as any)?.valor
    if (!secret) return true // sem token configurado, aceita tudo

    const assinatura = req.headers.get('asaas-signature') || req.headers.get('x-asaas-signature')
    if (!assinatura) return false

    // HMAC-SHA256
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const expected = Buffer.from(signed).toString('hex')
    return expected === assinatura || `sha256=${expected}` === assinatura
  } catch {
    return true // em caso de erro na validação, aceita (não bloqueia)
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    const { event, payment } = body

    // Validar assinatura
    const valido = await validarAssinatura(req, rawBody)
    if (!valido) {
      return NextResponse.json({ ok: false, error: 'Assinatura inválida' }, { status: 401 })
    }

    if (!payment?.id) return NextResponse.json({ ok: true, msg: 'Sem payment ID' })

    // Buscar fatura pelo asaas_payment_id
    const { data: fat } = await sb.from('faturas')
      .select('id, status, valor, contrato_id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (!fat) return NextResponse.json({ ok: true, msg: 'Fatura não encontrada localmente.' })

    const hoje = new Date().toISOString().split('T')[0]

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      await sb.from('faturas').update({
        status:          'pago',
        asaas_status:    payment.status,
        valor_pago:      Number(payment.value ?? fat.valor),
        valor_recebido:  Number(payment.value ?? fat.valor),
        saldo_restante:  0,
        data_pagamento:  payment.paymentDate ?? hoje,
        forma_pagamento: payment.billingType?.toLowerCase() ?? 'pix',
        observacoes:     `Pago via Asaas (${payment.billingType}) — ID: ${payment.id}`,
      }).eq('id', fat.id)

      // Notificar usuários do ERP
      const { data: usuarios } = await sb.from('usuarios')
        .select('id').in('perfil', ['admin','gerente','vendedor']).eq('ativo', 1)
      if (usuarios?.length) {
        await sb.from('notificacoes').insert(usuarios.map((u: any) => ({
          usuario_id:      u.id,
          tipo:            'pagamento',
          titulo:          `💰 Pagamento confirmado — ${payment.billingType}`,
          mensagem:        `Fatura quitada via Asaas. Valor: R$ ${Number(payment.value).toFixed(2).replace('.',',')}`,
          referencia_tipo: 'contrato',
          referencia_id:   fat.contrato_id,
          lida:            false,
        })))
      }
    }

    if (event === 'PAYMENT_OVERDUE') {
      await sb.from('faturas').update({
        status:       'vencida',
        asaas_status: payment.status,
      }).eq('id', fat.id)
    }

    if (event === 'PAYMENT_CANCELLED') {
      await sb.from('faturas').update({
        asaas_status:     payment.status,
        asaas_payment_id: null,
      }).eq('id', fat.id)
    }

    return NextResponse.json({ ok: true, event, fatura_id: fat.id })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
