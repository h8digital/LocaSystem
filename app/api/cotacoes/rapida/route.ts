// build: 2026-05-29 18:10:30
import { syslog } from '@/lib/syslog'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtM(v: number) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtD(s: string) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// POST /api/cotacoes/rapida
// Body: { cliente: {nome, email, telefone, cidade}, itens: [{produto_id, quantidade}] }
export async function POST(req: NextRequest) {
  try {
    const { cliente, itens } = await req.json()

    if (!cliente?.nome?.trim()) return NextResponse.json({ ok: false, error: 'Nome do cliente obrigatório.' })
    if (!itens?.length)         return NextResponse.json({ ok: false, error: 'Selecione ao menos um equipamento.' })

    // ── Parâmetros da empresa ──────────────────────────────────────────────
    const { data: params } = await sb.from('parametros').select('chave,valor')
    const p: Record<string, string> = {}
    ;(params ?? []).forEach((x: any) => { p[x.chave] = x.valor })

    // ── Criar ou buscar cliente com dados básicos ──────────────────────────
    let clienteId: number | null = null
    if (cliente.email) {
      const { data: existe } = await sb.from('clientes')
        .select('id').ilike('email', cliente.email.trim()).limit(1).maybeSingle()
      if (existe?.id) clienteId = existe.id
    }
    if (!clienteId && cliente.telefone) {
      const tel = cliente.telefone.replace(/\D/g, '')
      const { data: existe } = await sb.from('clientes')
        .select('id').or(`celular.ilike.%${tel}%,telefone.ilike.%${tel}%`).limit(1).maybeSingle()
      if (existe?.id) clienteId = existe.id
    }
    if (!clienteId) {
      const { data: novo, error: insErr } = await sb.from('clientes').insert({
        nome:    cliente.nome.trim(),
        email:   cliente.email?.trim() || null,
        celular: cliente.telefone?.trim() || null,
        cidade:  cliente.cidade?.trim() || null,
        tipo:    'PF',
        ativo:   1,
      }).select('id').maybeSingle()
      if (insErr) {
      await syslog('api/cotacoes/rapida', 'Erro ao criar cliente', { detalhe: insErr.message, contexto: { nome: cliente.nome } })
      return NextResponse.json({ ok:false, error:'Erro ao criar cliente: ' + insErr.message })
    }
      clienteId = novo?.id ?? null
    }
    if (!clienteId) return NextResponse.json({ ok: false, error: 'Erro ao registrar cliente.' })

    // ── Buscar produtos com todos os preços ───────────────────────────────
    const prodIds = itens.map((i: any) => i.produto_id)
    const { data: produtos } = await sb.from('produtos')
      .select('id,nome,marca,descricao,preco_locacao_diario,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_fds,categorias(nome)')
      .in('id', prodIds)
    const prodMap: Record<number, any> = {}
    ;(produtos ?? []).forEach((p: any) => { prodMap[p.id] = p })

    // ── Calcular totais (usa preço diário como base) ───────────────────────
    const itensFull = itens.map((i: any) => {
      const prod = prodMap[i.produto_id] ?? {}
      const preco = Number(prod.preco_locacao_diario ?? 0)
      return {
        produto_id:    i.produto_id,
        quantidade:    i.quantidade,
        preco_unitario: preco,
        total_item:    preco * i.quantidade,
        produto:       prod,
      }
    })
    const subtotal = itensFull.reduce((s: number, i: any) => s + i.total_item, 0)

    // ── Criar cotação ──────────────────────────────────────────────────────
    const hoje     = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const validade = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // Token de aprovação — permite cliente ver, aprovar e recusar pelo link público
    const tokenAprovacao = [
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2),
      Date.now().toString(36),
    ].join('')

    const { data: cotacao, error: cotErr } = await sb.from('cotacoes').insert({
      cliente_id:      clienteId,
      status:          'aguardando',
      data_emissao:    hoje,
      data_validade:   validade,
      subtotal,
      desconto:        0,
      acrescimo:       0,
      total:           subtotal,
      usuario_id:      null,
      token_aprovacao: tokenAprovacao,
      observacoes:     `Cotação rápida. Cliente: ${cliente.nome}${cliente.cidade ? ' — ' + cliente.cidade : ''}`,
    }).select('id,numero').maybeSingle()

    if (cotErr) {
      await syslog('api/cotacoes/rapida', 'Erro ao criar cotação', { detalhe: cotErr.message, contexto: { clienteId } })
      return NextResponse.json({ ok: false, error: 'Erro ao criar cotação: ' + cotErr.message })
    }
    if (!cotacao) return NextResponse.json({ ok: false, error: 'Cotação não retornou dados.' })

    // ── Inserir itens ──────────────────────────────────────────────────────
    await sb.from('cotacao_itens').insert(
      itensFull.map((i: any) => ({
        cotacao_id:    cotacao.id,
        produto_id:    i.produto_id,
        quantidade:    i.quantidade,
        preco_unitario: i.preco_unitario,
        total_item:    i.total_item,
      }))
    )

    // ── Gerar HTML do PDF ──────────────────────────────────────────────────
    // Periodos com labels e campos
    const periodos = [
      { label: 'Diário',           campo: 'preco_locacao_diario' },
      { label: 'Final de Semana',  campo: 'preco_fds' },
      { label: 'Semanal (7d)',     campo: 'preco_locacao_semanal' },
      { label: 'Quinzenal (15d)',  campo: 'preco_quinzenal' },
      { label: 'Mensal (30d)',     campo: 'preco_locacao_mensal' },
    ]

    // Para cada produto, montar os preços apenas dos períodos com valor > 0
    const linhasItens = itensFull.map((item: any) => {
      const prod  = item.produto
      const qtd   = Number(item.quantidade)

      // Para cada período: mostra unitário e total (unitário × qtd)
      const precosCols = periodos
        .filter(per => Number(prod[per.campo] ?? 0) > 0)
        .map(per => {
          const unit  = Number(prod[per.campo])
          const total = unit * qtd
          return `<td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:right;white-space:nowrap;line-height:1.5">
            <div style="font-size:7pt;color:#6b7280">${fmtM(unit)} × ${qtd}</div>
            <div style="font-weight:700;color:#111;font-size:8.5pt">${fmtM(total)}</div>
          </td>`
        })
        .join('')

      return `
        <tr style="background:#f9fafb">
          <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:700;vertical-align:top">
            ${prod.nome ?? '—'}
            ${prod.marca ? `<span style="font-weight:400;color:#6b7280;font-size:8pt"> · ${prod.marca}</span>` : ''}
            ${prod.categorias?.nome ? `<br><span style="font-weight:400;color:#9ca3af;font-size:7.5pt">${prod.categorias.nome}</span>` : ''}
          </td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:700">${qtd}</td>
          ${precosCols}
        </tr>`
    }).join('')

    // ── Linha de TOTAL por período ──────────────────────────────────────────
    // Cabeçalhos de período — só os que algum produto tem
    const periodosUsados = periodos.filter(per =>
      itensFull.some((item: any) => Number(item.produto[per.campo] ?? 0) > 0)
    )
    const thPeriodos = periodosUsados
      .map(per => `<th style="padding:6px 8px;background:#1e40af;color:#fff;text-align:right;white-space:nowrap;font-size:8pt">${per.label}</th>`)
      .join('')

    const linhaTotal = `
      <tr style="background:#eff6ff;border-top:2px solid #1e40af">
        <td style="padding:7px 8px;border:1px solid #dbeafe;font-weight:800;color:#1e3a8a;font-size:8.5pt" colspan="2">
          TOTAL GERAL DA COTAÇÃO
        </td>
        ${periodosUsados.map(per => {
          const soma = itensFull.reduce((s: number, item: any) => {
            const unit = Number(item.produto[per.campo] ?? 0)
            return s + unit * Number(item.quantidade)
          }, 0)
          return `<td style="padding:7px 8px;border:1px solid #dbeafe;text-align:right;font-weight:800;color:#1e3a8a;font-size:9pt;white-space:nowrap">${fmtM(soma)}</td>`
        }).join('')}
      </tr>`


    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#111;background:#fff}
  .page{width:210mm;padding:8mm 10mm;display:flex;flex-direction:column;gap:4mm}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d4ed8;padding-bottom:4mm}
  .logo{font-size:16pt;font-weight:900;color:#1d4ed8;letter-spacing:-0.5px}
  .logo-sub{font-size:7.5pt;color:#6b7280;margin-top:1mm}
  .emp-info{text-align:right;font-size:7.5pt;color:#4b5563;line-height:1.6}
  .doc-title{text-align:center;padding:4mm 0 2mm}
  .doc-title h2{font-size:13pt;font-weight:900;color:#1e3a8a;text-transform:uppercase;letter-spacing:.5px}
  .doc-title p{font-size:7.5pt;color:#6b7280;margin-top:1mm}
  .section{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:2mm}
  .sec-title{background:#eff6ff;padding:3mm 4mm;font-weight:700;font-size:8pt;text-transform:uppercase;color:#1e40af;border-bottom:1px solid #dbeafe}
  .sec-body{padding:3mm 4mm}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:2mm 6mm}
  .fl{font-size:6.5pt;color:#9ca3af;text-transform:uppercase;font-weight:700;margin-bottom:1mm}
  .fv{font-size:8.5pt;font-weight:600;color:#111}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  .aviso{background:#fefce8;border:1px solid #fde68a;border-radius:4px;padding:3mm 4mm;font-size:7.5pt;color:#92400e;line-height:1.6}
  .ass{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:4mm}
  .ass-box{border-top:1.5px solid #333;padding-top:2mm;text-align:center;font-size:7pt;color:#6b7280}
  .footer{border-top:1px solid #e5e7eb;padding-top:2mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#9ca3af}
  .total-row{background:#eff6ff;font-weight:700}
</style>
</head><body><div class="page">

<div class="hdr">
  <div>
    <div class="logo">${p.empresa_nome ?? 'Locadora'}</div>
    <div class="logo-sub">Locação de Equipamentos</div>
    <div style="font-size:7pt;color:#9ca3af;margin-top:2mm">CNPJ: ${p.empresa_cnpj ?? '—'} &nbsp;|&nbsp; Tel: ${p.empresa_telefone ?? '—'}</div>
    <div style="font-size:7pt;color:#9ca3af">${p.empresa_endereco ?? ''}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11pt;font-weight:900;color:#1d4ed8">COTAÇÃO</div>
    <div style="font-size:9pt;font-weight:700;color:#374151;margin-top:1mm">${cotacao.numero}</div>
    <div style="font-size:7pt;color:#9ca3af;margin-top:1mm">Emissão: ${fmtD(hoje)}</div>
    <div style="font-size:7pt;color:#9ca3af">Válida até: ${fmtD(validade)}</div>
  </div>
</div>

<div class="section">
  <div class="sec-title">Dados do Solicitante</div>
  <div class="sec-body">
    <div class="grid-2">
      <div><div class="fl">Nome</div><div class="fv">${cliente.nome}</div></div>
      <div><div class="fl">Cidade</div><div class="fv">${cliente.cidade || '—'}</div></div>
      <div><div class="fl">E-mail</div><div class="fv">${cliente.email || '—'}</div></div>
      <div><div class="fl">Telefone / WhatsApp</div><div class="fv">${cliente.telefone || '—'}</div></div>
    </div>
  </div>
</div>

<div class="section">
  <div class="sec-title">Equipamentos — Tabela de Preços por Período</div>
  <table>
    <thead>
      <tr>
        <th style="padding:6px 8px;background:#1e40af;color:#fff;text-align:left;font-size:8pt">Equipamento</th>
        <th style="padding:6px 8px;background:#1e40af;color:#fff;text-align:center;font-size:8pt">Qtd</th>
        ${thPeriodos}
      </tr>
    </thead>
    <tbody>
      ${linhasItens}
      ${linhaTotal}
    </tbody>
  </table>
</div>

<div class="aviso">
  <strong>⚠️ Atenção:</strong> Esta cotação é meramente informativa.
  <strong>Preços e disponibilidade de estoque estão sujeitos a alteração sem aviso prévio.</strong>
  A confirmação de disponibilidade e valores finais ocorrerá no momento da formalização do contrato de locação.
  Validade desta cotação: até <strong>${fmtD(validade)}</strong>.
</div>

<div class="ass">
  <div class="ass-box">
    ${p.empresa_nome ?? 'Empresa'}<br>Representante Comercial
  </div>
  <div class="ass-box">
    ${cliente.nome}<br>Solicitante
  </div>
</div>

<div class="footer">
  <span>${p.empresa_nome ?? ''} — CNPJ ${p.empresa_cnpj ?? ''}</span>
  <span>Cotação ${cotacao.numero} · Gerada em ${fmtD(hoje)}</span>
</div>

</div></body></html>`

    // ── Salvar em doc_gerados ──────────────────────────────────────────────
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const { error: saveErr } = await sb.from('doc_gerados').insert({
      contrato_id:    null,
      template_id:    5,
      titulo:         `Cotação ${cotacao.numero} — ${cliente.nome}`,
      conteudo_final: html,
      token,
      expirado:       0,
      expires_at:     new Date(Date.now() + 30 * 86400000).toISOString(),
    })

    if (saveErr) return NextResponse.json({ ok: false, error: 'Erro ao salvar PDF: ' + saveErr.message })

    return NextResponse.json({
      ok:         true,
      token,
      cotacao_id: cotacao.id,
      numero:     cotacao.numero,
    })

  } catch (e: any) {
    await syslog('api/cotacoes/rapida', e.message ?? 'Erro inesperado', {
      nivel: 'error',
      detalhe: e.stack ?? String(e),
    })
    return NextResponse.json({ ok: false, error: e.message })
  }
}
