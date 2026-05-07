import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmt_money(v: number) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmt_date(s: string) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

function fmt_datetime(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })
}

// GET /api/documentos/recibo-devolucao?devolucao_id=X
export async function GET(req: NextRequest) {
  try {
    const devolucao_id = req.nextUrl.searchParams.get('devolucao_id')
    if (!devolucao_id) return NextResponse.json({ ok:false, error:'devolucao_id obrigatório' })

    // Carregar devolução com itens e contrato
    const { data: dev } = await sb.from('devolucoes')
      .select(`*, usuarios(nome), contratos(
        numero, data_inicio, data_fim, cliente_id,
        clientes(nome, cpf_cnpj, email, celular, telefone),
        usuarios(nome)
      )`)
      .eq('id', devolucao_id).single()

    if (!dev) return NextResponse.json({ ok:false, error:'Devolução não encontrada' })

    const { data: itens } = await sb.from('devolucao_itens')
      .select('*, patrimonios(numero_patrimonio), contrato_itens(produto_id, produtos(nome))')
      .eq('devolucao_id', devolucao_id)

    const { data: params } = await sb.from('parametros').select('chave,valor')
    const p: Record<string,string> = {}
    ;(params ?? []).forEach((x:any) => { p[x.chave] = x.valor })

    const contrato = (dev as any).contratos ?? {}
    const cliente  = contrato.clientes ?? {}

    // Montar linhas de itens para o recibo
    const linhasItens = (itens ?? []).map((i:any) => {
      const nome = (i.contrato_itens as any)?.produtos?.nome ?? '—'
      const pat  = (i.patrimonios as any)?.numero_patrimonio ?? '—'
      const cond = i.condicao === 'perdido' ? 'Extraviado' : i.condicao === 'manutencao' ? 'Avariado' : 'Bom Estado'
      const qtd  = Number(i.quantidade_devolvida ?? 1)
      return `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #eee">${nome}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;text-align:center">${pat}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">${qtd}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;
            color:${i.condicao==='bom'?'#166534':i.condicao==='perdido'?'#991b1b':'#92400e'};font-weight:600">
            ${cond}
          </td>
          ${i.custo_avaria>0?`<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;color:#b45309;font-weight:600">${fmt_money(i.custo_avaria)}</td>`:'<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;color:#999">—</td>'}
        </tr>`
    }).join('')

    const totalMulata = Number(dev.multa_atraso ?? 0)
    const totalAvaria = Number(dev.valor_avarias ?? 0)
    const totalExtras = totalMulata + totalAvaria

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Recibo de Devolução — ${contrato.numero}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:15mm}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;padding-bottom:5mm;border-bottom:2px solid #1a56db}
  h1{font-size:14pt;color:#1a56db;font-weight:700}
  .sub{font-size:8pt;color:#888;margin-top:2px}
  .info-box{background:#f5f7fb;border:1px solid #dde2ef;border-radius:4px;padding:4mm;margin-bottom:6mm}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
  .field label{font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:.04em;display:block}
  .field span{font-size:9pt;color:#222;font-weight:600}
  h3{font-size:9pt;color:#1a56db;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3mm}
  table{width:100%;border-collapse:collapse;margin-bottom:6mm}
  th{padding:5px 8px;background:#1a56db;color:#fff;font-size:7.5pt;font-weight:700;text-align:left}
  th.c,td.c{text-align:center}th.r,td.r{text-align:right}
  .totais{background:#f5f7fb;border-radius:4px;padding:4mm;margin-bottom:6mm}
  .totais-row{display:flex;justify-content:space-between;padding:1.5mm 0;font-size:9pt}
  .totais-row.destaque{font-weight:700;font-size:10pt;border-top:1px solid #dde2ef;margin-top:2mm;padding-top:2mm}
  .assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin-top:10mm}
  .assin-box{border-top:1px solid #333;padding-top:3mm;text-align:center;font-size:8pt;color:#555}
  .badge{display:inline-block;padding:1px 6px;border-radius:99px;font-size:7pt;font-weight:700}
  .badge-total{background:#dbeafe;color:#1e40af}
  .badge-parcial{background:#fef3c7;color:#92400e}
  @media print{body{padding:10mm}}
</style>
</head><body>

<div class="hdr">
  <div>
    <h1>${p.empresa_nome ?? 'Empresa'}</h1>
    <div class="sub">Recibo de Devolução de Equipamentos</div>
  </div>
  <div style="text-align:right;font-size:8pt;color:#555;line-height:1.7">
    ${p.empresa_cnpj ? `CNPJ: ${p.empresa_cnpj}<br>` : ''}
    ${p.empresa_telefone ? `Tel: ${p.empresa_telefone}<br>` : ''}
    ${p.empresa_email ?? ''}
  </div>
</div>

<div class="info-box">
  <div class="info-grid">
    <div class="field"><label>Contrato</label><span>${contrato.numero ?? '—'}</span></div>
    <div class="field"><label>Data da Devolução</label><span>${fmt_datetime(dev.data_devolucao)}</span></div>
    <div class="field"><label>Cliente</label><span>${cliente.nome ?? '—'}</span></div>
    <div class="field"><label>CPF/CNPJ</label><span>${cliente.cpf_cnpj ?? '—'}</span></div>
    <div class="field"><label>Tipo</label>
      <span class="badge ${dev.tipo==='total'?'badge-total':'badge-parcial'}">
        ${dev.tipo==='total'?'Devolução Total':'Devolução Parcial'}
      </span>
    </div>
    <div class="field"><label>Operador</label><span>${(dev as any).usuarios?.nome ?? '—'}</span></div>
  </div>
</div>

<h3>Equipamentos Devolvidos</h3>
<table>
  <thead><tr>
    <th>Equipamento</th>
    <th class="c">Patrimônio</th>
    <th class="c">Qtd</th>
    <th class="c">Condição</th>
    <th class="r">Custo Avaria</th>
  </tr></thead>
  <tbody>${linhasItens}</tbody>
</table>

${totalExtras > 0 ? `
<div class="totais">
  <h3 style="margin-bottom:4mm">Valores Adicionais</h3>
  ${totalMulata > 0 ? `<div class="totais-row"><span>Multa por atraso (${dev.dias_atraso}d)</span><span style="color:#991b1b;font-weight:600">${fmt_money(totalMulata)}</span></div>` : ''}
  ${totalAvaria > 0 ? `<div class="totais-row"><span>Avarias / Extravios</span><span style="color:#b45309;font-weight:600">${fmt_money(totalAvaria)}</span></div>` : ''}
  <div class="totais-row destaque"><span>Total a Pagar</span><span style="color:#991b1b">${fmt_money(totalExtras)}</span></div>
</div>` : ''}

${dev.observacoes ? `<div class="info-box"><label style="font-size:7pt;color:#888;display:block;margin-bottom:2mm">OBSERVAÇÕES</label><span style="font-size:9pt">${dev.observacoes}</span></div>` : ''}

<div class="assinaturas">
  <div class="assin-box">
    ${p.empresa_nome ?? 'Empresa'}<br>Entregador / Responsável
  </div>
  <div class="assin-box">
    ${cliente.nome ?? 'Cliente'}<br>Recebedor / Locatário
  </div>
</div>

<div style="text-align:center;font-size:7pt;color:#aaa;margin-top:8mm">
  Documento gerado em ${new Date().toLocaleString('pt-BR')} · ${contrato.numero}
</div>

</body></html>`

    // Salvar documento temporariamente e retornar
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await sb.from('documentos_gerados').insert({
      contrato_id: (contrato as any).id,
      template_id: 2,
      titulo:      `Recibo de Devolução #${devolucao_id} — ${contrato.numero}`,
      html_content: html,
      token,
      expirado:    0,
      expira_em:   new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    })

    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/doc/${token}`
    return NextResponse.json({ ok:true, url, html })

  } catch(e:any) {
    return NextResponse.json({ ok:false, error: e.message })
  }
}
