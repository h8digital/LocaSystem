import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'


export const runtime = 'nodejs'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie  = cookieStore.get('locasystem_user')
    if (!userCookie) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = JSON.parse(userCookie.value)

    const { cotacao_id } = await req.json()
    if (!cotacao_id) return NextResponse.json({ error: 'cotacao_id obrigatório' }, { status: 400 })

    // Buscar cotação completa
    const { data: cot, error: cotErr } = await supabase
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .eq('id', cotacao_id)
      .single()

    if (cotErr || !cot) return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 })
    if (cot.status === 'convertida') return NextResponse.json({ error: 'Cotação já convertida' }, { status: 400 })
    if (!['aprovada','aguardando','rascunho'].includes(cot.status))
      return NextResponse.json({ error: 'Cotação não pode ser convertida no status atual' }, { status: 400 })

    // Gerar número do contrato
    const ano = new Date().getFullYear()
    const { data: ultimoContrato } = await supabase
      .from('contratos').select('numero').ilike('numero', `LOC${ano}%`).order('numero', { ascending: false }).limit(1)
    const seq = ultimoContrato?.length
      ? parseInt(ultimoContrato[0].numero.replace(`LOC${ano}`, '')) + 1
      : 1
    const numeroContrato = `LOC${ano}${String(seq).padStart(6, '0')}`

    // Criar contrato
    const contratoPayload = {
      numero:       numeroContrato,
      cliente_id:   cot.cliente_id,
      usuario_id:   user.id,
      periodo_id:   cot.periodo_id,
      status:       'rascunho',
      data_inicio:  cot.data_inicio,
      data_fim:     cot.data_fim,
      subtotal:     cot.subtotal,
      desconto:     cot.desconto,
      acrescimo:    cot.acrescimo,
      total:        cot.total,
      forma_pagamento:    cot.forma_pagamento,
      condicao_pagamento: cot.condicao_pagamento,
      observacoes:  cot.observacoes,
      local_uso_cep:         cot.local_uso_cep,
      local_uso_endereco:    cot.local_uso_endereco,
      local_uso_numero:      cot.local_uso_numero,
      local_uso_complemento: cot.local_uso_complemento,
      local_uso_bairro:      cot.local_uso_bairro,
      local_uso_cidade:      cot.local_uso_cidade,
      local_uso_estado:      cot.local_uso_estado,
      local_uso_referencia:  cot.local_uso_referencia,
    }

    const { data: contrato, error: contratoErr } = await supabase
      .from('contratos').insert(contratoPayload).select('id').single()

    if (contratoErr || !contrato)
      return NextResponse.json({ error: 'Erro ao criar contrato: ' + contratoErr?.message }, { status: 500 })

    // Criar itens do contrato
    const itens = (cot.cotacao_itens || []).map((it: any) => ({
      contrato_id:    contrato.id,
      produto_id:     it.produto_id,
      quantidade:     it.quantidade,
      preco_unitario: it.preco_unitario,
      desconto_item:  it.desconto_item,
      total_item:     it.total_item,
      observacoes:    it.observacoes,
    }))

    if (itens.length > 0) {
      const { error: itensErr } = await supabase.from('contrato_itens').insert(itens)
      if (itensErr) return NextResponse.json({ error: 'Erro nos itens: ' + itensErr.message }, { status: 500 })
    }

    // Marcar cotação como convertida
    await supabase.from('cotacoes').update({
      status: 'convertida',
      contrato_id: contrato.id,
      updated_at: new Date().toISOString(),
    }).eq('id', cotacao_id)

    return NextResponse.json({ ok: true, contrato_id: contrato.id, numero: numeroContrato })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}