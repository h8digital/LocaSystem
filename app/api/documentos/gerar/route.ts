import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function fmt_money(v: number) { return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function fmt_date(d: string)  { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }

function gerarToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('')
}


// ── Valor por extenso (pt-BR) ─────────────────────────────────────────────
function valorPorExtenso(v: number): string {
  const valor = Math.round(v * 100) / 100
  const reais  = Math.floor(valor)
  const cents  = Math.round((valor - reais) * 100)
  const u = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove']
  const t = ['','dez','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
  const d11_19 = ['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
  const c2 = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos']
  function grupo(n: number): string {
    if(n===0) return ''
    if(n===100) return 'cem'
    const c=Math.floor(n/100), resto=n%100
    const dz=Math.floor(resto/10), un=resto%10
    const partes=[]
    if(c) partes.push(c2[c])
    if(resto>=10&&resto<=19) partes.push(d11_19[resto-10])
    else { if(dz) partes.push(t[dz]); if(un) partes.push(u[un]) }
    return partes.join(' e ')
  }
  function por_extenso_int(n: number): string {
    if(n===0) return 'zero'
    if(n>=1000000) return `${por_extenso_int(Math.floor(n/1000000))} ${Math.floor(n/1000000)===1?'milhão':'milhões'}${n%1000000?' e '+por_extenso_int(n%1000000):''}`
    if(n>=1000) return `${por_extenso_int(Math.floor(n/1000))} mil${n%1000?' e '+por_extenso_int(n%1000):''}`
    return grupo(n)
  }
  const partes=[]
  if(reais>0) partes.push(`${por_extenso_int(reais)} ${reais===1?'real':'reais'}`)
  if(cents>0) partes.push(`${por_extenso_int(cents)} ${cents===1?'centavo':'centavos'}`)
  return partes.join(' e ') || 'zero reais'
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get('locasystem_user')
    if (!userCookie) return NextResponse.json({ ok:false, error:'Não autenticado' }, { status:401 })

    const { template_id, contrato_id } = await req.json()

    // Buscar template
    const { data: template } = await sb.from('doc_templates').select('*').eq('id', template_id).single()
    if (!template) return NextResponse.json({ ok:false, error:'Template não encontrado' })

    // Buscar contrato com todos os dados
    const { data: contrato } = await sb.from('contratos')
      .select('*, clientes(*), usuarios(nome)')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok:false, error:'Contrato não encontrado' })

    // Buscar itens do contrato
    const { data: itens } = await sb.from('contrato_itens')
      .select('*, produtos(nome, preco_locacao_diario, custo_reposicao, prazo_entrega_dias), patrimonios(numero_patrimonio)')
      .eq('contrato_id', contrato_id)

    // Buscar parâmetros da empresa
    const { data: params } = await sb.from('parametros').select('chave, valor')
    const p: Record<string,string> = {}
    params?.forEach(x => { p[x.chave] = x.valor ?? '' })

    const cliente  = contrato.clientes as any
    const vendedor = (contrato.usuarios as any)?.nome ?? ''

    // Endereço principal do cliente (completo)
    const endCliente   = [cliente.endereco, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(', ')
    const cidadeCliente = [cliente.cidade, cliente.estado].filter(Boolean).join('/')

    // Endereço de entrega: usa local_uso se preenchido, senão endereço do cliente
    const endEntrega = contrato.local_uso_endereco
      ? [contrato.local_uso_endereco, contrato.local_uso_numero, contrato.local_uso_complemento, contrato.local_uso_bairro, contrato.local_uso_cidade, contrato.local_uso_estado].filter(Boolean).join(', ')
      : endCliente
    const cepEntrega       = contrato.local_uso_cep || cliente.cep || ''
    const referenciaEntrega = contrato.local_uso_referencia || ''

    // Período de cobrança
    const { data: periodoData } = await sb.from('periodos_locacao').select('nome').eq('id', contrato.periodo_id).maybeSingle()
    const periodoNome = (periodoData as any)?.nome ?? ''

    const dias  = Math.max(1, Math.ceil((new Date(contrato.data_fim).getTime() - new Date(contrato.data_inicio).getTime()) / 86400000))
    const agora = new Date()

    // Cidade da empresa extraída do endereço
    const empresaCidade = (() => {
      const end = p['empresa_endereco'] ?? ''
      const partes = end.split(',').map((s: string) => s.trim())
      return partes.length >= 2 ? partes[partes.length - 2] : ''
    })()

    // Gerar tabela de itens — formato Kanoff: Qtd | Patrimônio | Descrição | Aditivo | Val.Equip Unit | Val.Equip Total | Val.Loc Unit | Val.Loc Total
    const itensHtml = (itens ?? []).map((item: any) => {
      const prod       = item.produtos as any
      const patNum     = (item.patrimonios as any)?.numero_patrimonio ?? ''
      const qtd        = Number(item.quantidade ?? 1)
      const custoUnit  = Number(item.custo_reposicao ?? prod?.custo_reposicao ?? 0)
      const custoTotal = custoUnit * qtd
      const locUnit    = Number(item.preco_unitario ?? 0)
      const locTotal   = Number(item.total_item ?? locUnit * qtd)
      return `<tr>
        <td style="text-align:center">${qtd}</td>
        <td style="text-align:center">${patNum}</td>
        <td class="desc">${prod?.nome ?? ''}</td>
        <td style="text-align:center">-</td>
        <td style="text-align:right">${fmt_money(custoUnit)}</td>
        <td style="text-align:right">${fmt_money(custoTotal)}</td>
        <td style="text-align:right">${fmt_money(locUnit)}</td>
        <td style="text-align:right">${fmt_money(locTotal)}</td>
      </tr>`
    }).join('')
    // Completar com linhas vazias até mínimo 8 linhas
    const minRows = 8
    const emptyRows = Math.max(0, minRows - (itens ?? []).length)
    const itensHtmlFull = itensHtml + Array(emptyRows).fill('<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')

    // Mapa de substituição
    const tags: Record<string,string> = {
      '{{empresa_nome}}':             p['empresa_nome'] ?? '',
      '{{empresa_cnpj}}':             p['empresa_cnpj'] ?? '',
      '{{empresa_telefone}}':         p['empresa_telefone'] ?? '',
      '{{empresa_email}}':            p['empresa_email'] ?? '',
      '{{empresa_endereco}}':         p['empresa_endereco'] ?? '',

      '{{cliente_nome}}':             cliente.nome ?? '',
      '{{cliente_cpf_cnpj}}':         cliente.cpf_cnpj ?? '',
      '{{cliente_tipo_doc}}':         cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF',
      '{{cliente_email}}':            cliente.email ?? '',
      '{{cliente_telefone}}':         cliente.celular || cliente.telefone || '',
      '{{cliente_endereco_completo}}':endCliente,
      '{{contrato_numero}}':          contrato.numero,
      '{{contrato_data_inicio}}':     fmt_date(contrato.data_inicio),
      '{{contrato_data_fim}}':        fmt_date(contrato.data_fim),
      '{{contrato_dias}}':            String(dias),
      '{{contrato_subtotal}}':        fmt_money(contrato.subtotal),
      '{{contrato_desconto}}':        fmt_money(contrato.desconto),
      '{{contrato_acrescimo}}':       fmt_money(contrato.acrescimo),
      '{{contrato_total}}':           fmt_money(contrato.total),
      '{{contrato_caucao}}':          fmt_money(contrato.caucao),
      '{{contrato_forma_pagamento}}': (contrato.forma_pagamento ?? '').replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()),
      '{{contrato_observacoes}}':     contrato.observacoes ?? '',
      '{{contrato_frete}}':            fmt_money(contrato.frete ?? 0),
      '{{contrato_periodo}}':          periodoNome,
      '{{contrato_forma_pagamento_desc}}': (contrato.forma_pagamento ?? '').replace(/_/g,' ').replace(/\b\w/g,(cc:string)=>cc.toUpperCase()),
      '{{vendedor_nome}}':             vendedor,
      '{{cliente_rg_ie}}':             cliente.rg_ie ?? '',
      '{{cliente_tipo_doc}}':          cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF',
      '{{cliente_cep}}':               cliente.cep ?? '',
      '{{cliente_cidade}}':            cidadeCliente,
      '{{cliente_bairro}}':            cliente.bairro ?? '',
      '{{cliente_estado}}':            cliente.estado ?? '',
      '{{entrega_endereco}}':          endEntrega,
      '{{entrega_cep}}':               cepEntrega,
      '{{entrega_referencia}}':        referenciaEntrega,
      '{{empresa_cidade}}':            empresaCidade,
      '{{multa_atraso_percentual}}':  p['multa_atraso_percentual'] ?? '2',
      '{{multa_por_dia}}':             fmt_money((itens??[]).reduce((s:number,i:any)=>s+Number(i.preco_diario??i.produtos?.preco_locacao_diario??0),0)),
      '{{data_geracao}}':             agora.toLocaleDateString('pt-BR'),
      '{{hora_geracao}}':             agora.toLocaleTimeString('pt-BR'),
      '{{itens_tabela}}':             itensHtmlFull,
      '{{devolucao_dias_atraso}}':    '0',
      '{{devolucao_multa}}':          'R$ 0,00',
      '{{devolucao_avarias}}':        'R$ 0,00',
      '{{devolucao_caucao}}':         fmt_money(contrato.caucao),
    }

    // ── Nota promissória ──────────────────────────────────────────────────
    const totalReposicao = (itens ?? []).reduce((s: number, item: any) => {
      const prod  = item.produtos as any
      const custo = Number(item.custo_reposicao ?? prod?.custo_reposicao ?? 0)
      const qtd   = Number(item.quantidade ?? 1)
      return s + custo * qtd
    }, 0)

    const promissoriaItensHtml = (itens ?? []).map((item: any, idx: number) => {
      const prod   = item.produtos as any
      const custo  = Number(item.custo_reposicao ?? prod?.custo_reposicao ?? 0)
      const qtd    = Number(item.quantidade ?? 1)
      const patNum = (item.patrimonios as any)?.numero_patrimonio ?? '—'
      return `<tr>
        <td>${idx + 1}</td>
        <td>${prod?.nome ?? ''} ${patNum !== '—' ? `<small>(${patNum})</small>` : ''}</td>
        <td style="text-align:center">${qtd}</td>
        <td style="text-align:right">${fmt_money(custo)}</td>
        <td style="text-align:right">${fmt_money(custo * qtd)}</td>
      </tr>`
    }).join('')

    const multaPorDia = (itens ?? []).reduce((s: number, item: any) => {
      const prod = item.produtos as any
      return s + Number(item.preco_diario ?? prod?.preco_locacao_diario ?? 0)
    }, 0)

    // Adicionar tags da promissória ao mapa
    tags['{{promissoria_itens}}'] = `<table class="doc-table"><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qtd</th><th style="text-align:right">Custo Unit.</th><th style="text-align:right">Total Reposição</th></tr></thead><tbody>${promissoriaItensHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold">TOTAL:</td><td style="text-align:right;font-weight:bold">${fmt_money(totalReposicao)}</td></tr></tfoot></table>`
    tags['{{promissoria_total}}']          = fmt_money(totalReposicao)
    tags['{{promissoria_valor_extenso}}']  = valorPorExtenso(totalReposicao)
    tags['{{multa_por_dia}}']              = fmt_money(multaPorDia)

    // Substituir tags
    let conteudo = template.conteudo
    Object.entries(tags).forEach(([k,v]) => { conteudo = conteudo.replaceAll(k, v) })

    // Salvar documento gerado
    const token = gerarToken()
    const { data: doc, error } = await sb.from('doc_gerados').insert({
      template_id, contrato_id,
      titulo: `${template.nome} — ${contrato.numero}`,
      conteudo_final: conteudo,
      token,
    }).select('id, token').single()

    if (error) return NextResponse.json({ ok:false, error:error.message })

    return NextResponse.json({ ok:true, token: doc.token, doc_id: doc.id })
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
