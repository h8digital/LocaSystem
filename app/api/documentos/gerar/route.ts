import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmt_money(v: number | string | null | undefined): string {
  const n = Number(v ?? 0)
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmt_date(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function valor_extenso(valor: number): string {
  // Extenso simplificado para nota promissória (até 999.999,99)
  const partes: Record<number,string> = {
    1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',
    10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze',16:'dezesseis',
    17:'dezessete',18:'dezoito',19:'dezenove',20:'vinte',30:'trinta',40:'quarenta',
    50:'cinquenta',60:'sessenta',70:'setenta',80:'oitenta',90:'noventa'
  }
  const centenas: Record<number,string> = {
    100:'cem',200:'duzentos',300:'trezentos',400:'quatrocentos',500:'quinhentos',
    600:'seiscentos',700:'setecentos',800:'oitocentos',900:'novecentos'
  }
  if (valor === 0) return 'zero reais'
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)
  function porExtenso(n: number): string {
    if (n === 0) return ''
    if (n <= 20) return partes[n] ?? ''
    if (n < 100) {
      const dez = Math.floor(n / 10) * 10
      const uni = n % 10
      return uni === 0 ? partes[dez] : `${partes[dez]} e ${partes[uni]}`
    }
    if (n === 100) return 'cem'
    const cent = Math.floor(n / 100) * 100
    const resto = n % 100
    return resto === 0 ? centenas[cent] : `${centenas[cent]} e ${porExtenso(resto)}`
  }
  function milhar(n: number): string {
    if (n >= 1000) {
      const mil = Math.floor(n / 1000)
      const resto = n % 1000
      const milStr = mil === 1 ? 'mil' : `${porExtenso(mil)} mil`
      return resto === 0 ? milStr : `${milStr} e ${porExtenso(resto)}`
    }
    return porExtenso(n)
  }
  const reaisStr = reais === 1 ? `${milhar(reais)} real` : `${milhar(reais)} reais`
  if (centavos === 0) return reaisStr
  const centStr = centavos === 1 ? `${partes[centavos]} centavo` : `${porExtenso(centavos)} centavos`
  return `${reaisStr} e ${centStr}`
}

// Substituição de blocos condicionais {{#tag}}...{{/tag}}
function processarBlocos(html: string, dados: Record<string,boolean>): string {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, tag, conteudo) => {
    return dados[tag] ? conteudo : ''
  })
}

// Substituição de loops {{#lista}}...{{/lista}} com array de objetos
function processarLoops(html: string, loops: Record<string, Record<string,string>[]>): string {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, tag, template) => {
    const arr = loops[tag]
    if (!arr) return match
    return arr.map(item => {
      let row = template
      for (const [k, v] of Object.entries(item)) {
        row = row.split(`{{${k}}}`).join(v)
      }
      return row
    }).join('')
  })
}

export async function POST(req: NextRequest) {
  const { contrato_id, template_id } = await req.json()
  if (!contrato_id) return NextResponse.json({ ok:false, error:'contrato_id obrigatório' })

  // ── Carregar dados ────────────────────────────────────────────────────────
  const [
    { data: contrato },
    { data: itens },
    { data: params },
    { data: periodos },
  ] = await Promise.all([
    sb.from('contratos')
      .select('*, clientes(*), usuarios(nome)')
      .eq('id', contrato_id).single(),
    sb.from('contrato_itens')
      .select(`*, produtos(nome,preco_locacao_diario,custo_reposicao,prazo_entrega_dias),
               patrimonios(numero_patrimonio,numero_serie)`)
      .eq('contrato_id', contrato_id)
      .order('tipo_item')
      .order('id'),
    sb.from('parametros').select('chave,valor'),
    sb.from('periodos_locacao').select('*').eq('ativo',1).order('dias'),
  ])

  if (!contrato) return NextResponse.json({ ok:false, error:'Contrato não encontrado' })

  // ── Template ──────────────────────────────────────────────────────────────
  const tmplId = template_id ?? 1
  const { data: tmpl } = await sb.from('doc_templates').select('conteudo').eq('id', tmplId).single()
  if (!tmpl) return NextResponse.json({ ok:false, error:'Template não encontrado' })

  // ── Parâmetros da empresa ─────────────────────────────────────────────────
  const p: Record<string,string> = {}
  ;(params ?? []).forEach((x: any) => { p[x.chave] = x.valor })

  // ── Dados do cliente ──────────────────────────────────────────────────────
  const cliente = contrato.clientes ?? {}
  const endCliente = [
    cliente.logradouro, cliente.numero, cliente.complemento,
    cliente.bairro, cliente.cidade, cliente.estado
  ].filter(Boolean).join(', ')

  // ── Período ───────────────────────────────────────────────────────────────
  const di   = contrato.data_inicio ? new Date(contrato.data_inicio + 'T12:00:00') : null
  const df   = contrato.data_fim    ? new Date(contrato.data_fim    + 'T12:00:00') : null
  const dias = di && df ? Math.max(1, Math.ceil((df.getTime() - di.getTime()) / 86400000)) : 0

  // Descobrir período pelo numero de dias
  const periodoDetected = (periodos ?? []).reduce((best: any, p2: any) => {
    if (p2.dias <= dias && (!best || p2.dias > best.dias)) return p2
    return best
  }, null)
  const periodoNome = periodoDetected?.nome ?? `${dias} dia(s)`

  // ── Local de uso ──────────────────────────────────────────────────────────
  const localUso = [
    contrato.local_uso_endereco,
    contrato.local_uso_numero,
    contrato.local_uso_complemento,
    contrato.local_uso_bairro,
    contrato.local_uso_cidade,
    contrato.local_uso_estado,
  ].filter(Boolean).join(', ') || contrato.local_uso_referencia || '—'

  // ── Separar itens por tipo ────────────────────────────────────────────────
  const itensLocacao   = (itens ?? []).filter((i: any) => i.tipo_item !== 'acessorio')
  const itensAcessorios = (itens ?? []).filter((i: any) => i.tipo_item === 'acessorio')
  const temAcessorios  = itensAcessorios.length > 0

  // ── Calcular totais ────────────────────────────────────────────────────────
  const subtotal        = itensLocacao.reduce((s: number, i: any) => s + Number(i.total_item), 0)
  const totalAcessorios = itensAcessorios.reduce((s: number, i: any) => s + Number(i.total_item), 0)
  const totalGeral      = Number(contrato.total ?? 0)
  const totalReposicao  = itensLocacao.reduce((s: number, i: any) => s + Number(i.custo_reposicao ?? 0) * Number(i.quantidade), 0)
  const multaDiaria     = itensLocacao.reduce((s: number, i: any) => s + Number(i.preco_diario ?? i.produtos?.preco_locacao_diario ?? 0), 0)

  // ── Nota promissória: valor = maior entre total do contrato e custo reposição
  const valorNP = Math.max(totalGeral, totalReposicao)

  // ── Lista resumida de equipamentos para nota promissória ──────────────────
  const listaResumida = itensLocacao
    .map((i: any) => {
      const nome = i.descricao_livre ?? i.produtos?.nome ?? '—'
      const pat  = i.patrimonios?.numero_patrimonio ? ` (Pat. ${i.patrimonios.numero_patrimonio})` : ''
      return `${nome}${pat}`
    })
    .join('; ')

  // ── Vencimento NP: data de término do contrato ────────────────────────────
  const vencimentoNP = fmt_date(contrato.data_fim)

  // ── Empresa ───────────────────────────────────────────────────────────────
  const empresaEndereco = p['empresa_endereco'] ?? ''
  const empresaCidade   = p['empresa_cidade']   ?? ''
  const empresaEstado   = p['empresa_estado']   ?? ''

  // ── Loops de itens ────────────────────────────────────────────────────────
  const rowsLocacao: Record<string,string>[] = itensLocacao.map((i: any) => ({
    nome:             i.descricao_livre ?? i.produtos?.nome ?? '—',
    patrimonio_num:   i.patrimonios?.numero_patrimonio ?? '—',
    numero_serie:     i.patrimonios?.numero_serie ?? '—',
    quantidade:       String(i.quantidade),
    preco_unitario:   fmt_money(i.preco_unitario),
    periodo_descricao: periodoNome,
    total_item:       fmt_money(i.total_item),
  }))

  const rowsAcessorios: Record<string,string>[] = itensAcessorios.map((i: any) => ({
    nome:           i.descricao_livre ?? i.produtos?.nome ?? '—',
    quantidade:     String(i.quantidade),
    preco_unitario: fmt_money(i.preco_unitario),
    total_item:     fmt_money(i.total_item),
  }))

  // ── Tags simples ──────────────────────────────────────────────────────────
  const tags: Record<string,string> = {
    '{{empresa_nome}}':                    p['empresa_nome'] ?? '',
    '{{empresa_cnpj}}':                    p['empresa_cnpj'] ?? '',
    '{{empresa_telefone}}':                p['empresa_telefone'] ?? '',
    '{{empresa_email}}':                   p['empresa_email'] ?? '',
    '{{empresa_endereco}}':                empresaEndereco,
    '{{empresa_cidade}}':                  empresaCidade,
    '{{empresa_estado}}':                  empresaEstado,
    '{{cliente_nome}}':                    cliente.nome ?? '',
    '{{cliente_cpf_cnpj}}':               cliente.cpf_cnpj ?? '',
    '{{cliente_email}}':                   cliente.email ?? '',
    '{{cliente_telefone}}':               cliente.celular || cliente.telefone || '',
    '{{cliente_contato}}':                 cliente.contato ?? '',
    '{{cliente_endereco_completo}}':       endCliente,
    '{{contrato_numero}}':                 String(contrato.numero ?? ''),
    '{{data_emissao}}':                    new Date().toLocaleDateString('pt-BR'),
    '{{data_inicio}}':                     fmt_date(contrato.data_inicio),
    '{{data_fim}}':                        fmt_date(contrato.data_fim),
    '{{dias_totais}}':                     String(dias),
    '{{local_uso}}':                       localUso,
    '{{subtotal}}':                        fmt_money(subtotal + totalAcessorios),
    '{{desconto}}':                        fmt_money(contrato.desconto),
    '{{frete}}':                           fmt_money(contrato.frete ?? 0),
    '{{total_geral}}':                     fmt_money(totalGeral),
    '{{multa_diaria}}':                    fmt_money(multaDiaria),
    '{{total_nota_promissoria}}':          fmt_money(valorNP),
    '{{total_nota_promissoria_extenso}}':  valor_extenso(valorNP),
    '{{vencimento_nota}}':                 vencimentoNP,
    '{{lista_equipamentos_resumida}}':     listaResumida,
    // compatibilidade com tags antigas
    '{{contrato_data_inicio}}':            fmt_date(contrato.data_inicio),
    '{{contrato_data_fim}}':               fmt_date(contrato.data_fim),
    '{{contrato_total}}':                  fmt_money(totalGeral),
    '{{contrato_subtotal}}':               fmt_money(subtotal + totalAcessorios),
    '{{contrato_desconto}}':               fmt_money(contrato.desconto),
    '{{contrato_frete}}':                  fmt_money(contrato.frete ?? 0),
    '{{contrato_forma_pagamento}}':        (contrato.forma_pagamento ?? '').replace(/_/g,' ').replace(/\b\w/g,(cc:string)=>cc.toUpperCase()),
    '{{contrato_observacoes}}':            contrato.observacoes ?? '',
    '{{contrato_dias}}':                   String(dias),
    '{{contrato_periodo}}':                periodoNome,
    '{{vendedor_nome}}':                   (contrato.usuarios as any)?.nome ?? '',
  }

  // ── Processar HTML ────────────────────────────────────────────────────────
  let html = tmpl.conteudo as string

  // 1. Processar loops de linhas primeiro
  html = processarLoops(html, {
    itens_locacao:   rowsLocacao,
    itens_acessorios: rowsAcessorios,
  })

  // 2. Processar blocos condicionais
  html = processarBlocos(html, {
    tem_acessorios: temAcessorios,
    tem_desconto:   Number(contrato.desconto) > 0,
    tem_frete:      Number(contrato.frete ?? 0) > 0,
  })

  // 3. Substituir tags simples
  for (const [tag, val] of Object.entries(tags)) {
    html = html.split(tag).join(val)
  }

  // 4. Limpar tags não substituídas
  html = html.replace(/\{\{[^}]+\}\}/g, '')

  // ── Gerar token único para acesso público ─────────────────────────────────
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)

  // ── Salvar no banco ────────────────────────────────────────────────────────
  const { data: doc, error: docErr } = await sb.from('doc_gerados').insert({
    contrato_id,
    template_id:    tmplId,
    conteudo_final: html,
    token,
    titulo:         `Contrato ${contrato.numero ?? contrato_id}`,
    expirado:       0,
    visualizacoes:  0,
  }).select('id, token').single()

  if (docErr) return NextResponse.json({ ok:false, error:docErr.message })

  return NextResponse.json({ ok:true, doc_id: doc.id, token: doc.token, html })
}
