import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtMoney(v: number) {
  return 'R$ ' + Number(v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtDate(s: string) {
  if (!s) return '—'
  return new Date(s.includes('T') ? s : s + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtDatetime(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// GET /api/documentos/recibo-devolucao?devolucao_id=X
export async function GET(req: NextRequest) {
  try {
    const devolucao_id = req.nextUrl.searchParams.get('devolucao_id')
    if (!devolucao_id) return NextResponse.json({ ok: false, error: 'devolucao_id obrigatório' })

    // ── Carregar devolução com contrato e cliente ────────────────────────────
    const { data: dev, error: devErr } = await sb
      .from('devolucoes')
      .select(`
        *,
        usuarios(nome),
        contratos(
          id, numero, data_inicio, data_fim,
          clientes(nome, cpf_cnpj, email, celular, telefone)
        )
      `)
      .eq('id', devolucao_id)
      .single()

    if (devErr || !dev) return NextResponse.json({ ok: false, error: 'Devolução não encontrada.' })

    // ── Carregar itens devolvidos nesta devolução ────────────────────────────
    const { data: itens } = await sb
      .from('devolucao_itens')
      .select(`
        *,
        patrimonios(numero_patrimonio, numero_serie),
        contrato_itens(
          quantidade, preco_unitario,
          produtos(nome, marca, modelo)
        )
      `)
      .eq('devolucao_id', devolucao_id)

    // ── Parâmetros da empresa ────────────────────────────────────────────────
    const { data: params } = await sb.from('parametros').select('chave,valor')
    const p: Record<string, string> = {}
    ;(params ?? []).forEach((x: any) => { p[x.chave] = x.valor })

    const contrato = (dev as any).contratos ?? {}
    const cliente  = contrato.clientes ?? {}

    // ── Gerar linhas da tabela de itens ─────────────────────────────────────
    const linhasItens = (itens ?? []).map((item: any) => {
      const prod  = item.contrato_itens?.produtos ?? {}
      const pat   = item.patrimonios
      const nome  = prod.nome ?? '—'
      const marca = prod.marca ? `${prod.marca}${prod.modelo ? ' ' + prod.modelo : ''}` : '—'
      const numPat = pat?.numero_patrimonio ?? '—'
      const numSerie = pat?.numero_serie ?? '—'
      const qtd   = Number(item.quantidade_devolvida ?? 1)

      const condMap: Record<string, { label: string; cor: string }> = {
        bom:       { label: 'Bom Estado',  cor: '#166534' },
        avariado:  { label: 'Avariado',    cor: '#92400e' },
        perdido:   { label: 'Extraviado',  cor: '#991b1b' },
        manutencao:{ label: 'Manutenção',  cor: '#92400e' },
      }
      const cond = condMap[item.condicao] ?? { label: item.condicao ?? '—', cor: '#555' }
      const custoAvaria = Number(item.custo_avaria ?? 0)

      return `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;font-weight:600">${nome}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;color:#555">${marca}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;text-align:center">${numPat}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;text-align:center;font-size:8pt;color:#666">${numSerie !== '—' ? numSerie : '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${qtd}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;color:${cond.cor};font-weight:700">${cond.label}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;${custoAvaria > 0 ? 'color:#b45309;font-weight:700' : 'color:#999'}">
            ${custoAvaria > 0 ? fmtMoney(custoAvaria) : '—'}
          </td>
        </tr>`
    }).join('')

    const multa   = Number(dev.multa_atraso ?? 0)
    const avarias = Number(dev.valor_avarias ?? 0)
    const caucao  = Number(dev.caucao_devolvido ?? 0)
    const totalExtras = multa + avarias

    // ── Montar HTML do documento ─────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:9pt;color:#111;background:#fff}
.page{width:210mm;padding:10mm 12mm;display:flex;flex-direction:column;gap:5mm}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0ea5e9;padding-bottom:4mm}
.logo{font-size:15pt;font-weight:900;color:#0ea5e9}
.doc-title{font-size:12pt;font-weight:900;color:#0369a1;text-transform:uppercase;text-align:right}
.doc-sub{font-size:8pt;color:#555;margin-top:1mm;text-align:right}
.section{border:1px solid #dde;border-radius:3px;overflow:hidden}
.section-title{background:#e0f2fe;padding:2mm 3mm;font-weight:700;font-size:8pt;text-transform:uppercase;color:#0369a1;border-bottom:1px solid #dde;letter-spacing:.04em}
.section-body{padding:3mm 4mm}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:2mm 6mm}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm 4mm}
.fl{font-size:7pt;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.fv{font-size:9pt;font-weight:600;border-bottom:1px solid #eee;padding-bottom:1mm;margin-top:0.5mm;min-height:4mm}
table{width:100%;border-collapse:collapse}
thead th{padding:5px 8px;background:#0369a1;color:#fff;font-size:7.5pt;font-weight:700;text-align:left}
thead th.c{text-align:center}thead th.r{text-align:right}
.totais{background:#f0f9ff;border:1px solid #bae6fd;border-radius:3px;padding:3mm 4mm}
.tot-row{display:flex;justify-content:space-between;font-size:9pt;padding:1mm 0}
.tot-row.bold{font-weight:700;border-top:1px solid #bae6fd;margin-top:1mm;padding-top:1.5mm}
.declaracao{font-size:8.5pt;line-height:1.7;text-align:justify;color:#333;background:#f8f9fa;border:1px solid #dee2e6;border-radius:3px;padding:3mm 4mm}
.assin{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:4mm}
.ass-box{border-top:1.5px solid #333;padding-top:2mm;text-align:center}
.ass-label{font-size:7pt;color:#666}
.ass-space{height:14mm}
.footer{padding-top:2mm;border-top:1px solid #ddd;font-size:7pt;color:#888;display:flex;justify-content:space-between}
.badge{display:inline-block;padding:1px 7px;border-radius:99px;font-size:7.5pt;font-weight:700}
.badge-total{background:#dbeafe;color:#1e40af}
.badge-parcial{background:#fef3c7;color:#92400e}
</style></head>
<body><div class="page">

<div class="hdr">
  <div>
    <div class="logo">${p.empresa_nome ?? 'Locadora'}</div>
    <div style="font-size:7.5pt;color:#555;margin-top:1mm">CNPJ: ${p.empresa_cnpj ?? '—'} &nbsp;|&nbsp; Tel: ${p.empresa_telefone ?? '—'}</div>
    <div style="font-size:7.5pt;color:#555">${p.empresa_endereco ?? ''}</div>
  </div>
  <div>
    <div class="doc-title">✓ Recibo de Devolução</div>
    <div class="doc-sub">de Equipamentos</div>
    <div class="doc-sub">Devolução Nº <strong>${devolucao_id}</strong> &nbsp;|&nbsp; Emissão: ${fmtDate(new Date().toISOString())}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Dados da Locação</div>
  <div class="section-body">
    <div class="grid-3">
      <div><div class="fl">Contrato</div><div class="fv" style="font-family:monospace;color:#0369a1;font-weight:800">${contrato.numero ?? '—'}</div></div>
      <div><div class="fl">Período Locado</div><div class="fv">${fmtDate(contrato.data_inicio)} a ${fmtDate(contrato.data_fim)}</div></div>
      <div><div class="fl">Data / Hora da Devolução</div><div class="fv" style="font-weight:700">${fmtDatetime(dev.data_devolucao)}</div></div>
    </div>
    <div class="grid-2" style="margin-top:2mm">
      <div><div class="fl">Cliente</div><div class="fv">${cliente.nome ?? '—'}</div></div>
      <div><div class="fl">CPF / CNPJ</div><div class="fv">${cliente.cpf_cnpj ?? '—'}</div></div>
    </div>
    <div style="margin-top:2mm;display:flex;align-items:center;gap:4mm">
      <div>
        <div class="fl">Tipo de Devolução</div>
        <span class="badge ${dev.tipo === 'total' ? 'badge-total' : 'badge-parcial'}">${dev.tipo === 'total' ? 'Devolução Total' : 'Devolução Parcial'}</span>
      </div>
      <div>
        <div class="fl">Operador Responsável</div>
        <div class="fv">${(dev as any).usuarios?.nome ?? '—'}</div>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Equipamentos Devolvidos (${(itens ?? []).length} item(ns))</div>
  <table>
    <thead><tr>
      <th>Equipamento</th>
      <th>Marca / Modelo</th>
      <th class="c">Nº Patrimônio</th>
      <th class="c">Nº Série</th>
      <th class="c">Qtd</th>
      <th class="c">Condição</th>
      <th class="r">Custo Avaria</th>
    </tr></thead>
    <tbody>${linhasItens || '<tr><td colspan="7" style="padding:8px;color:#999;text-align:center">Nenhum item registrado</td></tr>'}</tbody>
  </table>
</div>

${(totalExtras > 0 || caucao > 0) ? `
<div class="totais">
  <div style="font-size:8pt;font-weight:700;color:#0369a1;text-transform:uppercase;margin-bottom:2mm">Valores da Devolução</div>
  ${dev.dias_atraso > 0 ? `<div class="tot-row"><span>Dias de atraso na entrega</span><span style="color:#991b1b">${dev.dias_atraso} dia(s)</span></div>` : ''}
  ${multa > 0 ? `<div class="tot-row"><span>Multa por atraso</span><span style="color:#991b1b;font-weight:700">${fmtMoney(multa)}</span></div>` : ''}
  ${avarias > 0 ? `<div class="tot-row"><span>Avarias / Extravios</span><span style="color:#b45309;font-weight:700">${fmtMoney(avarias)}</span></div>` : ''}
  ${caucao > 0 ? `<div class="tot-row"><span>Caução devolvido ao cliente</span><span style="color:#166534;font-weight:700">${fmtMoney(caucao)}</span></div>` : ''}
  ${totalExtras > 0 ? `<div class="tot-row bold"><span>Total a cobrar do cliente</span><span style="color:#991b1b">${fmtMoney(totalExtras)}</span></div>` : ''}
</div>` : ''}

${dev.observacoes ? `<div class="declaracao"><strong>Observações:</strong> ${dev.observacoes}</div>` : ''}

<div class="declaracao">
  <strong>${cliente.nome ?? 'O cliente'}</strong>, CPF/CNPJ <strong>${cliente.cpf_cnpj ?? '—'}</strong>,
  declara devolver à empresa <strong>${p.empresa_nome ?? ''}</strong> os equipamentos listados acima,
  referentes ao Contrato de Locação Nº <strong>${contrato.numero ?? '—'}</strong>,
  nas condições descritas neste documento, em ${fmtDatetime(dev.data_devolucao)}.
</div>

<div class="assin">
  <div>
    <div class="ass-space"></div>
    <div class="ass-box">
      <div style="font-size:8pt;font-weight:700">${p.empresa_nome ?? 'Empresa'}</div>
      <div class="ass-label">Recebedor — CNPJ: ${p.empresa_cnpj ?? '—'}</div>
    </div>
  </div>
  <div>
    <div class="ass-space"></div>
    <div class="ass-box">
      <div style="font-size:8pt;font-weight:700">${cliente.nome ?? 'Cliente'}</div>
      <div class="ass-label">Devolvedor — CPF/CNPJ: ${cliente.cpf_cnpj ?? '—'}</div>
    </div>
  </div>
</div>

<div class="footer">
  <span>${p.empresa_nome ?? ''} — CNPJ ${p.empresa_cnpj ?? ''}</span>
  <span>Devolução Nº ${devolucao_id} — Contrato ${contrato.numero ?? ''}</span>
  <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
</div>

</div></body></html>`

    // ── Salvar na tabela correta: doc_gerados ────────────────────────────────
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const { error: saveErr } = await sb.from('doc_gerados').insert({
      contrato_id:    Number(contrato.id),
      template_id:    4,
      titulo:         `Recibo de Devolução Nº ${devolucao_id} — ${contrato.numero}`,
      conteudo_final: html,
      token,
      expirado:       0,
      expires_at:     new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    })

    if (saveErr) return NextResponse.json({ ok: false, error: 'Erro ao salvar documento: ' + saveErr.message })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? ''
    const url    = `${appUrl}/doc/${token}`

    return NextResponse.json({ ok: true, url, token })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
