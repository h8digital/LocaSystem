// build: 2026-05-29 18:10:30
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function fmtM(v:number){ return 'R$ '+Number(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') }
function fmtD(s:string){ if(!s)return'—'; return new Date(s.includes('T')?s:s+'T12:00:00').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}) }
function fmtDT(s:string){ if(!s)return'—'; return new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) }

// GET /api/documentos/recibo-devolucao?devolucao_id=X
export async function GET(req: NextRequest) {
  try {
    const devolucao_id = req.nextUrl.searchParams.get('devolucao_id')
    if (!devolucao_id) return NextResponse.json({ ok:false, error:'devolucao_id obrigatório' })

    // Carregar devolução + contrato + cliente
    const { data: dev } = await sb.from('devolucoes')
      .select(`*, usuarios(nome), contratos(id,numero,data_inicio,data_fim,
        clientes(nome,cpf_cnpj,email,celular,telefone))`)
      .eq('id', devolucao_id).single()
    if (!dev) return NextResponse.json({ ok:false, error:'Devolução não encontrada.' })

    // Carregar itens devolvidos nesta devolução
    const { data: itens } = await sb.from('devolucao_itens')
      .select(`*, patrimonios(numero_patrimonio,numero_serie),
        contrato_itens(quantidade,preco_unitario,produtos(nome,marca,modelo))`)
      .eq('devolucao_id', devolucao_id)

    // Template do banco
    const { data: tmpl } = await sb.from('doc_templates').select('conteudo').eq('id',4).single()
    if (!tmpl) return NextResponse.json({ ok:false, error:'Template de recibo de devolução não encontrado (id=4).' })

    // Parâmetros da empresa
    const { data: params } = await sb.from('parametros').select('chave,valor')
    const p:Record<string,string> = {}
    ;(params??[]).forEach((x:any)=>{ p[x.chave]=x.valor })

    const contrato = (dev as any).contratos ?? {}
    const cliente  = contrato.clientes ?? {}

    const multa   = Number(dev.multa_atraso??0)
    const avarias = Number(dev.valor_avarias??0)
    const caucao  = Number(dev.caucao_devolvido??0)
    const totalExtras = multa + avarias

    // Montar linhas dos itens via substituição do loop {{#itens_devolucao}}
    const condMap:Record<string,{label:string;cls:string}> = {
      bom:       {label:'Bom Estado', cls:'td-ok'},
      avariado:  {label:'Avariado',   cls:'td-avaria'},
      perdido:   {label:'Extraviado', cls:'td-perda'},
      manutencao:{label:'Manutenção', cls:'td-avaria'},
    }

    // Processar o template: substituir loop {{#itens_devolucao}} manualmente
    let html = tmpl.conteudo as string

    // 1. Processar o loop de itens
    const loopMatch = html.match(/\{\{#itens_devolucao\}\}([\s\S]*?)\{\{\/itens_devolucao\}\}/)
    if (loopMatch) {
      const rowTemplate = loopMatch[1]
      const rows = (itens??[]).map((item:any)=>{
        const prod = item.contrato_itens?.produtos ?? {}
        const pat  = item.patrimonios
        const cond = condMap[item.condicao] ?? {label:item.condicao??'—',cls:''}
        const custo = Number(item.custo_avaria??0)
        const marcaModelo = [prod.marca,prod.modelo].filter(Boolean).join(' ') || '—'
        return rowTemplate
          .replace(/\{\{item_nome\}\}/g,           prod.nome??'—')
          .replace(/\{\{item_marca_modelo\}\}/g,    marcaModelo)
          .replace(/\{\{item_patrimonio\}\}/g,      pat?.numero_patrimonio??'—')
          .replace(/\{\{item_serie\}\}/g,           pat?.numero_serie??'—')
          .replace(/\{\{item_quantidade\}\}/g,      String(item.quantidade_devolvida??1))
          .replace(/\{\{item_condicao\}\}/g,        cond.label)
          .replace(/\{\{item_condicao_classe\}\}/g, cond.cls)
          .replace(/\{\{item_custo_avaria\}\}/g,    custo>0?fmtM(custo):'—')
      }).join('')
      html = html.replace(loopMatch[0], rows)
    }

    // 2. Processar blocos condicionais
    const blocos:Record<string,boolean> = {
      tem_valores_extras:     (totalExtras>0||caucao>0),
      tem_atraso:             multa>0,
      tem_avaria:             avarias>0,
      tem_caucao_devolvido:   caucao>0,
      devolucao_observacoes:  !!(dev.observacoes?.trim()),
    }
    html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,(_:string,tag:string,content:string)=>{
      return blocos[tag] ? content : ''
    })

    // 3. Substituir tags simples
    const tags:Record<string,string> = {
      '{{empresa_logo_url}}':          p.empresa_logo_url??'',
      '{{empresa_nome}}':            p.empresa_nome??'',
      '{{empresa_cnpj}}':            p.empresa_cnpj??'',
      '{{empresa_telefone}}':        p.empresa_telefone??'',
      '{{empresa_email}}':           p.empresa_email??'',
      '{{empresa_endereco}}':        [p.empresa_logradouro,p.empresa_numero,p.empresa_cidade,p.empresa_estado].filter(Boolean).join(', '),
      '{{contrato_numero}}':         contrato.numero??'—',
      '{{data_inicio}}':             fmtD(contrato.data_inicio),
      '{{data_fim}}':                fmtD(contrato.data_fim),
      '{{cliente_nome}}':            cliente.nome??'—',
      '{{cliente_cpf_cnpj}}':        cliente.cpf_cnpj??'—',
      '{{cliente_telefone}}':        cliente.celular||cliente.telefone||'—',
      '{{cliente_email}}':           cliente.email??'—',
      '{{devolucao_numero}}':        String(devolucao_id),
      '{{devolucao_data}}':          fmtDT(dev.data_devolucao),
      '{{devolucao_tipo}}':          dev.tipo==='total'?'Devolução Total':'Devolução Parcial',
      '{{devolucao_operador}}':      (dev as any).usuarios?.nome??'—',
      '{{devolucao_total_itens}}':   String((itens??[]).length),
      '{{devolucao_dias_atraso}}':   String(dev.dias_atraso??0),
      '{{devolucao_multa_atraso}}':  fmtM(multa),
      '{{devolucao_valor_avarias}}': fmtM(avarias),
      '{{devolucao_caucao_devolvido}}': fmtM(caucao),
      '{{devolucao_total_extras}}':  fmtM(totalExtras),
      '{{devolucao_observacoes}}':   dev.observacoes??'',
      '{{data_emissao}}':            fmtDT(new Date().toISOString()),
    }
    for (const [tag,val] of Object.entries(tags)) {
      html = html.split(tag).join(val)
    }

    // 4. Limpar tags não substituídas
    html = html.replace(/\{\{[^}]+\}\}/g,'')

    // Salvar em doc_gerados (tabela correta que /doc/[token] lê)
    const token = Math.random().toString(36).slice(2)+Date.now().toString(36)
    const { error: saveErr } = await sb.from('doc_gerados').insert({
      contrato_id:    Number(contrato.id),
      template_id:    4,
      titulo:         `Recibo de Devolução Nº ${devolucao_id} — ${contrato.numero}`,
      conteudo_final: html,
      token,
      expirado:       0,
      expires_at:     new Date(Date.now()+30*86400*1000).toISOString(),
    })
    if (saveErr) return NextResponse.json({ ok:false, error:'Erro ao salvar: '+saveErr.message })

    return NextResponse.json({ ok:true, token })

  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
