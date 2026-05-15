// Edge Function: gerar-faturas-recorrentes
// Deve ser chamada via cron job diariamente (ex: às 6h)
// Verifica contratos recorrentes ativos cujo dia_vencimento == hoje
// e gera a fatura do mês se ainda não existir para a competência atual

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hoje     = new Date()
  const diaHoje  = hoje.getDate()
  const ano      = hoje.getFullYear()
  const mes      = hoje.getMonth() + 1
  // competência = 1º dia do mês atual
  const competencia = `${ano}-${String(mes).padStart(2,'0')}-01`

  // Buscar contratos recorrentes ativos cujo dia_vencimento == hoje
  const { data: contratos, error } = await supabase
    .from('contratos')
    .select('id, numero, total, dia_vencimento, clientes(nome)')
    .eq('status', 'ativo')
    .eq('tipo_contrato', 'recorrente')
    .eq('dia_vencimento', diaHoje)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!contratos?.length) return new Response(JSON.stringify({ geradas: 0, msg: 'Nenhum contrato recorrente vence hoje.' }))

  let geradas = 0
  const erros: string[] = []

  for (const contrato of contratos) {
    // Verificar se já existe fatura para esta competência
    const { data: existente } = await supabase
      .from('faturas')
      .select('id')
      .eq('contrato_id', contrato.id)
      .eq('competencia', competencia)
      .maybeSingle()

    if (existente) continue // já gerada

    // Buscar última fatura para sequenciar o número
    const { data: ultima } = await supabase
      .from('faturas')
      .select('numero, parcela_num')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    const seq = ultima?.numero
      ? (parseInt(ultima.numero.replace(/\D/g,'').slice(-6)) + 1)
      : 1
    const numero     = `FAT${ano}${String(seq).padStart(6,'0')}`
    const parcelaNum = (ultima?.parcela_num ?? 0) + 1

    // Data de vencimento: dia configurado no mês atual
    const dataVenc = `${ano}-${String(mes).padStart(2,'0')}-${String(diaHoje).padStart(2,'0')}`

    const { error: errIns } = await supabase.from('faturas').insert({
      contrato_id:     contrato.id,
      numero,
      tipo:            'recorrente',
      status:          'pendente',
      valor:           contrato.total,
      valor_recebido:  0,
      saldo_restante:  contrato.total,
      data_emissao:    hoje.toISOString().split('T')[0],
      data_vencimento: dataVenc,
      competencia,
      parcela_num:     parcelaNum,
      descricao:       `Locação recorrente — ${String(mes).padStart(2,'0')}/${ano}`,
    })

    if (errIns) erros.push(`${contrato.numero}: ${errIns.message}`)
    else geradas++
  }

  return new Response(JSON.stringify({ geradas, erros, total_verificados: contratos.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
