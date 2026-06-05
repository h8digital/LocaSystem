// build: 2026-06-05
// Chamada via cron job diariamente às 6h (America/Sao_Paulo)
// Gera faturas mensais para contratos ativos com tipo_contrato = 'mensal'
// cujo dia_vencimento == dia de hoje, se ainda não gerada nesta competência

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hoje      = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaHoje   = hoje.getDate()
  const ano       = hoje.getFullYear()
  const mes       = hoje.getMonth() + 1
  const competencia = `${ano}-${String(mes).padStart(2,'0')}-01`
  const dataHoje    = `${ano}-${String(mes).padStart(2,'0')}-${String(diaHoje).padStart(2,'0')}`

  // Buscar contratos mensais ativos com dia_vencimento = hoje
  const { data: contratos, error } = await supabase
    .from('contratos')
    .select('id, numero, total, subtotal, frete, dia_vencimento, cliente_id, clientes(nome)')
    .eq('status', 'ativo')
    .eq('tipo_contrato', 'mensal')
    .eq('dia_vencimento', diaHoje)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!contratos?.length) return new Response(JSON.stringify({ geradas: 0, msg: 'Nenhum contrato mensal vence hoje.' }))

  let geradas = 0
  const erros: string[] = []

  for (const ct of contratos) {
    // Verificar duplicidade pela competência
    const { data: existe } = await supabase
      .from('faturas')
      .select('id')
      .eq('contrato_id', ct.id)
      .eq('competencia', competencia)
      .maybeSingle()

    if (existe) continue

    // Sequenciar número da fatura
    const { data: ultima } = await supabase
      .from('faturas')
      .select('numero')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    const seq = ultima?.numero
      ? (parseInt(ultima.numero.replace(/\D/g, '').slice(-6)) + 1)
      : 1
    const numero = `FAT${ano}${String(seq).padStart(6,'0')}`

    const { error: errIns } = await supabase.from('faturas').insert({
      contrato_id:      ct.id,
      numero,
      tipo:             'recorrente',
      status:           'pendente',
      valor:            ct.total,
      valor_recebido:   0,
      saldo_restante:   ct.total,
      data_emissao:     dataHoje,
      data_vencimento:  dataHoje,
      competencia,
      descricao: `Locação mensal — ${(ct.clientes as any)?.nome ?? ''} · ${String(mes).padStart(2,'0')}/${ano}`,
    })

    if (errIns) erros.push(`${ct.numero}: ${errIns.message}`)
    else geradas++
  }

  return new Response(
    JSON.stringify({ geradas, erros, total_verificados: contratos.length, competencia }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
