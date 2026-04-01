import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie  = cookieStore.get('locasystem_user')
    if (!userCookie) return NextResponse.json({ ok:false, error:'Não autenticado' }, { status:401 })
    const user = JSON.parse(userCookie.value)

    const body = await req.json()
    const { itens, subtotal, total, comissao_valor, ...contrato } = body

    // ── Gerar número do contrato via sequence do banco (atômico, sem race condition)
    const { data: param } = await sb.from('parametros').select('valor').eq('chave','prefixo_contrato').single()
    const prefixo = param?.valor ?? 'LOC'

    const { data: numData, error: numError } = await sb
      .rpc('gerar_numero_contrato', { prefixo })
    if (numError) return NextResponse.json({ ok:false, error:'Erro ao gerar número: ' + numError.message })
    const numero = numData as string

    // ── Criar contrato
    const { data: c, error } = await sb.from('contratos').insert({
      numero,
      cliente_id:           contrato.cliente_id,
      usuario_id:           user.id,
      periodo_id:           contrato.periodo_id || null,
      data_inicio:          contrato.data_inicio,
      data_fim:             contrato.data_fim,
      forma_pagamento:      contrato.forma_pagamento || 'pix',
      caucao:               Number(contrato.caucao) || 0,
      subtotal:             Number(subtotal) || 0,
      desconto:             Number(contrato.desconto) || 0,
      acrescimo:            Number(contrato.acrescimo) || 0,
      total:                Number(total) || 0,
      frete:                Number(contrato.frete) || 0,
      tipo_contrato:        contrato.tipo_contrato || 'unico',
      dia_vencimento:       contrato.dia_vencimento ? Number(contrato.dia_vencimento) : null,
      data_venc_fatura:     contrato.data_venc_fatura || null,
      comissao_percentual:  Number(contrato.comissao_percentual) || 0,
      comissao_valor:       Number(comissao_valor) || 0,
      observacoes:          contrato.observacoes || null,
      local_uso_cep:        contrato.local_uso_cep        || null,
      local_uso_endereco:   contrato.local_uso_endereco   || null,
      local_uso_numero:     contrato.local_uso_numero     || null,
      local_uso_complemento:contrato.local_uso_complemento|| null,
      local_uso_bairro:     contrato.local_uso_bairro     || null,
      local_uso_cidade:     contrato.local_uso_cidade     || null,
      local_uso_estado:     contrato.local_uso_estado     || null,
      local_uso_referencia: contrato.local_uso_referencia || null,
      status: 'rascunho',
    }).select('id').single()

    if (error) return NextResponse.json({ ok:false, error:error.message })

    // ── Criar itens
    for (const item of itens) {
      await sb.from('contrato_itens').insert({
        contrato_id:       c.id,
        produto_id:        item.produto_id || null,
        patrimonio_id:     item.patrimonio_id || null,
        quantidade:        item.quantidade || 1,
        preco_unitario:    Number(item.preco_unitario) || 0,
        total_item:        Number(item.total) || 0,
        preco_diario:      Number(item.preco_diario)      || 0,
        custo_reposicao:   Number(item.custo_reposicao)   || 0,
        prazo_entrega_dias: Number(item.prazo_entrega_dias) || 0,
        tipo_item:         item.tipo_item || 'locacao',
        descricao_livre:   item.descricao_livre || null,
      })
      if (item.patrimonio_id) {
        // NÃO marcar como locado aqui — só na ativação do contrato
        // A marcação prematura impede a ativação (verifica status='locado')
      }
    }

    // ── Gerar número da fatura via sequence do banco (atômico)
    const { data: paramFat } = await sb.from('parametros').select('valor').eq('chave','prefixo_fatura').single()
    const prefFat = paramFat?.valor ?? 'FAT'

    const { data: numFatData, error: numFatError } = await sb
      .rpc('gerar_numero_fatura', { prefixo: prefFat })
    if (numFatError) return NextResponse.json({ ok:false, error:'Erro ao gerar número da fatura: ' + numFatError.message })
    const numFatura = numFatData as string

    const dataVenc = contrato.data_venc_fatura || contrato.data_fim
    const hoje = new Date().toISOString().split('T')[0]
    await sb.from('faturas').insert({
      contrato_id:     c.id,
      numero:          numFatura,
      tipo:            contrato.tipo_contrato === 'recorrente' ? 'recorrente' : 'locacao',
      status:          'pendente',
      valor:           Number(total),
      valor_recebido:  0,
      saldo_restante:  Number(total),
      data_emissao:    hoje,
      data_vencimento: dataVenc || hoje,
      competencia:     contrato.tipo_contrato === 'recorrente' ? hoje.slice(0,7) + '-01' : null,
      parcela_num:     1,
      descricao:       `Locação — Contrato ${numero}`,
      forma_pagamento: contrato.forma_pagamento || null,
    })

    return NextResponse.json({ ok:true, id:c.id, numero })
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
