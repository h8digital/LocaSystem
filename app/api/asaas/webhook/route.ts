// build: 2026-06-06 — Webhook Asaas com validação por token simples (padrão Asaas)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// O Asaas envia o token configurado no header 'asaas-access-token'
// Comparação direta — não HMAC
async function validarToken(req: NextRequest): Promise<boolean> {
  try {
    const { data } = await sb.from('parametros')
      .select('valor').eq('chave', 'asaas_webhook_token').maybeSingle()
    const tokenSalvo = (data as any)?.valor
    if (!tokenSalvo) return true // sem token configurado, aceita tudo

    // Asaas envia em asaas-access-token
    const tokenRecebido = req.headers.get('asaas-access-token')
      || req.headers.get('access-token')
      || req.headers.get('authorization')?.replace('Bearer ', '')

    return tokenRecebido === tokenSalvo
  } catch {
    return true
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    const { event, payment } = body

    // Validar token
    const valido = await validarToken(req)
    if (!valido) {
      return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 })
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
        data_pagamento:  payment.paymentDate ?? payment.clientPaymentDate ?? hoje,
        forma_pagamento: payment.billingType?.toLowerCase() ?? 'pix',
        observacoes:     `Pago via Asaas (${payment.billingType}) — ID: ${payment.id}`,
      }).eq('id', fat.id)

      // Notificar usuários
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
        status: 'vencida', asaas_status: payment.status,
      }).eq('id', fat.id)
    }

    if (event === 'PAYMENT_CANCELLED') {
      await sb.from('faturas').update({
        asaas_status: payment.status, asaas_payment_id: null,
      }).eq('id', fat.id)
    }

    return NextResponse.json({ ok: true, event, fatura_id: fat.id })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
