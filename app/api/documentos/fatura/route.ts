import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmt_money(v: number | string | null | undefined): string {
  return 'R$ ' + Number(v ?? 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmt_date(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function valor_extenso(v: number): string {
  const partes: Record<number,string> = {1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze',16:'dezesseis',17:'dezessete',18:'dezoito',19:'dezenove',20:'vinte',30:'trinta',40:'quarenta',50:'cinquenta',60:'sessenta',70:'setenta',80:'oitenta',90:'noventa'}
  const centenas: Record<number,string> = {100:'cem',200:'duzentos',300:'trezentos',400:'quatrocentos',500:'quinhentos',600:'seiscentos',700:'setecentos',800:'oitocentos',900:'novecentos'}
  if (v === 0) return 'zero reais'
  const reais = Math.floor(v); const centavos = Math.round((v - reais) * 100)
  function p(n: number): string {
    if (n === 0) return ''; if (n <= 20) return partes[n] ?? ''
    if (n < 100) { const d = Math.floor(n/10)*10; const u = n%10; return u===0?partes[d]:`${partes[d]} e ${partes[u]}` }
    if (n === 100) return 'cem'; const c = Math.floor(n/100)*100; const r = n%100
    return r===0?centenas[c]:`${centenas[c]} e ${p(r)}`
  }
  function m(n: number): string {
    if (n >= 1000) { const mil = Math.floor(n/1000); const r = n%1000; const ms = mil===1?'mil':`${p(mil)} mil`; return r===0?ms:`${ms} e ${p(r)}` }
    return p(n)
  }
  const rs = reais===1?`${m(reais)} real`:`${m(reais)} reais`
  if (centavos===0) return rs
  return `${rs} e ${centavos===1?`${partes[centavos]} centavo`:`${p(centavos)} centavos`}`
}
function processarBlocos(html: string, dados: Record<string,boolean>): string {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, tag, c) => dados[tag] ? c : '')
}
function processarLoops(html: string, loops: Record<string,Record<string,string>[]>): string {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, tag, tmpl) => {
    const arr = loops[tag]; if (!arr) return match
    return arr.map(item => { let r = tmpl; for (const [k,v] of Object.entries(item)) r = r.split(`{{${k}}}`).join(v); return r }).join('')
  })
}
function fmtForma(v: string) { return (v??'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }

// POST /api/documentos/fatura
// body: { fatura_id, tipo: 'fatura' | 'recibo', recebimento_id? }
export async function POST(req: NextRequest) {
  try {
    const { fatura_id, tipo = 'fatura', recebimento_id } = await req.json()
    if (!fatura_id) return NextResponse.json({ ok:false, error:'fatura_id obrigatório' })

    // ── Carregar dados ──────────────────────────────────────────────────────
    const [{ data: fatura }, { data: params }] = await Promise.all([
      sb.from('faturas')
        .select('*, contratos(numero, data_inicio, data_fim, clientes(*), contrato_itens(*, produtos(nome), patrimonios(numero_patrimonio)))')
        .eq('id', fatura_id).single(),
      sb.from('parametros').select('chave,valor'),
    ])
    if (!fatura) return NextResponse.json({ ok:false, error:'Fatura não encontrada' })

    const p: Record<string,string> = {}
    ;(params??[]).forEach((x:any) => { p[x.chave] = x.valor })

    const contrato = (fatura as any).contratos ?? {}
    const cliente  = contrato.clientes ?? {}
    const itens    = (contrato.contrato_itens ?? []) as any[]

    // ── Recebimento (para recibo) ────────────────────────────────────────────
    let recebimento: any = null
    if (tipo === 'recibo' && recebimento_id) {
      const { data: rec } = await sb.from('fatura_recebimentos').select('*').eq('id', recebimento_id).single()
      recebimento = rec
    } else if (tipo === 'recibo') {
      // pegar o último recebimento
      const { data: recs } = await sb.from('fatura_recebimentos')
        .select('*').eq('fatura_id', fatura_id).order('created_at', { ascending:false }).limit(1)
      recebimento = recs?.[0] ?? null
    }

    // ── Template ─────────────────────────────────────────────────────────────
    const tmplTipo = tipo === 'recibo' ? 'recibo' : 'fatura'
    const { data: tmpl } = await sb.from('doc_templates').select('conteudo,id').eq('tipo', tmplTipo).single()
    if (!tmpl) return NextResponse.json({ ok:false, error:`Template "${tmplTipo}" não encontrado` })

    // ── Separar itens ─────────────────────────────────────────────────────────
    const itensLocacao    = itens.filter((i:any) => i.tipo_item !== 'acessorio')
    const itensAcessorios = itens.filter((i:any) => i.tipo_item === 'acessorio')

    const rowsLoc: Record<string,string>[] = itensLocacao.map((i:any) => ({
      nome:           i.descricao_livre ?? i.produtos?.nome ?? '—',
      patrimonio_num: i.patrimonios?.numero_patrimonio ?? '—',
      quantidade:     String(i.quantidade),
      preco_unitario: fmt_money(i.preco_unitario),
      total_item:     fmt_money(i.total_item),
    }))
    const rowsAcc: Record<string,string>[] = itensAcessorios.map((i:any) => ({
      nome:           i.descricao_livre ?? i.produtos?.nome ?? '—',
      quantidade:     String(i.quantidade),
      preco_unitario: fmt_money(i.preco_unitario),
      total_item:     fmt_money(i.total_item),
    }))

    const valorRecibo    = recebimento ? Number(recebimento.valor) : Number(fatura.valor_recebido ?? fatura.valor)
    const saldoRestante  = Number(fatura.saldo_restante ?? 0)
    const faturaQuitada  = fatura.status === 'pago'

    const statusLabel: Record<string,string> = { pendente:'Pendente', pago:'Pago', parcial:'Parcial', cancelado:'Cancelado' }

    // ── Tags ──────────────────────────────────────────────────────────────────
    const tags: Record<string,string> = {
      '{{empresa_nome}}':          p['empresa_nome'] ?? '',
      '{{empresa_cnpj}}':          p['empresa_cnpj'] ?? '',
      '{{empresa_telefone}}':      p['empresa_telefone'] ?? '',
      '{{empresa_email}}':         p['empresa_email'] ?? '',
      '{{empresa_endereco}}':      p['empresa_endereco'] ?? '',
      '{{empresa_cidade}}':        p['empresa_cidade'] ?? '',
      '{{empresa_estado}}':        p['empresa_estado'] ?? '',
      '{{cliente_nome}}':          cliente.nome ?? '',
      '{{cliente_cpf_cnpj}}':     cliente.cpf_cnpj ?? '',
      '{{cliente_telefone}}':     cliente.celular || cliente.telefone || '',
      '{{cliente_email}}':         cliente.email ?? '',
      '{{contrato_numero}}':       contrato.numero ?? '',
      '{{fatura_numero}}':         (fatura as any).numero ?? '',
      '{{fatura_valor}}':          fmt_money(fatura.valor),
      '{{fatura_saldo}}':          fmt_money(saldoRestante),
      '{{fatura_recebido}}':       fmt_money(fatura.valor_recebido),
      '{{fatura_vencimento}}':     fmt_date((fatura as any).data_vencimento),
      '{{fatura_status}}':         (fatura as any).status ?? '',
      '{{fatura_status_label}}':   statusLabel[(fatura as any).status] ?? (fatura as any).status,
      '{{fatura_descricao}}':      (fatura as any).descricao ?? '',
      '{{data_inicio}}':           fmt_date(contrato.data_inicio),
      '{{data_fim}}':              fmt_date(contrato.data_fim),
      '{{data_pagamento}}':        fmt_date(recebimento?.data_recebimento ?? (fatura as any).data_pagamento),
      '{{data_emissao}}':          new Date().toLocaleDateString('pt-BR'),
      '{{forma_pagamento}}':       fmtForma(recebimento?.forma_pagamento ?? (fatura as any).forma_pagamento),
      '{{recibo_valor}}':          fmt_money(valorRecibo),
      '{{recibo_valor_extenso}}':  valor_extenso(valorRecibo),
      '{{recibo_observacoes}}':    recebimento?.observacoes ?? '',
    }

    // ── Processar HTML ────────────────────────────────────────────────────────
    let html = tmpl.conteudo as string
    html = processarLoops(html, { itens_locacao: rowsLoc, itens_acessorios: rowsAcc })
    html = processarBlocos(html, {
      tem_saldo:           saldoRestante > 0.01,
      tem_recebido:        Number(fatura.valor_recebido ?? 0) > 0,
      tem_saldo_restante:  saldoRestante > 0.01,
      fatura_quitada:      faturaQuitada,
      tem_acessorios:      itensAcessorios.length > 0,
      fatura_descricao:    !!((fatura as any).descricao),
      recibo_observacoes:  !!(recebimento?.observacoes),
    })
    for (const [tag, val] of Object.entries(tags)) {
      html = html.split(tag).join(val)
    }
    html = html.replace(/\{\{[^}]+\}\}/g, '')

    // ── Salvar e retornar token ───────────────────────────────────────────────
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const { data: doc, error: docErr } = await sb.from('doc_gerados').insert({
      contrato_id:    contrato.id ?? null,
      template_id:    tmpl.id,
      conteudo_final: html,
      token,
      titulo:         `${tipo === 'recibo' ? 'Recibo' : 'Fatura'} ${(fatura as any).numero}`,
      expirado:       0,
      visualizacoes:  0,
    }).select('id,token').single()

    if (docErr) return NextResponse.json({ ok:false, error:docErr.message })
    return NextResponse.json({ ok:true, token: doc.token, html })

  } catch(e:any) {
    return NextResponse.json({ ok:false, error: e.message })
  }
}
