// build: 2026-06-05 — Fase 4: Integração Asaas
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getConfig() {
  const { data } = await sb.from('parametros').select('chave,valor')
    .in('chave',['asaas_api_key','asaas_ambiente','asaas_multa_pct','asaas_juros_pct','asaas_descricao_padrao'])
  const p: Record<string,string> = {}
  ;(data??[]).forEach((r:any)=>{ p[r.chave]=r.valor })
  return p
}

function baseUrl(cfg: Record<string,string>) {
  return cfg.asaas_ambiente==='production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'
}

async function api(cfg: Record<string,string>, path: string, method='GET', body?: any) {
  const r = await fetch(baseUrl(cfg)+path, {
    method,
    headers: { 'Content-Type':'application/json', 'access_token': cfg.asaas_api_key },
    body: body ? JSON.stringify(body) : undefined,
  })
  return r.json()
}

async function upsertCliente(cfg: Record<string,string>, cli: any): Promise<string> {
  if (cli.asaas_customer_id) return cli.asaas_customer_id
  const cpf = cli.cpf_cnpj?.replace(/\D/g,'')
  if (cpf) {
    const b = await api(cfg, `/customers?cpfCnpj=${cpf}`)
    if (b.data?.length) {
      await sb.from('clientes').update({ asaas_customer_id: b.data[0].id }).eq('id', cli.id)
      return b.data[0].id
    }
  }
  const novo = await api(cfg, '/customers', 'POST', {
    name:        cli.nome,
    cpfCnpj:     cpf || undefined,
    email:       cli.email || undefined,
    mobilePhone: cli.celular?.replace(/\D/g,'') || undefined,
  })
  if (!novo.id) throw new Error('Erro ao criar cliente Asaas: '+JSON.stringify(novo))
  await sb.from('clientes').update({ asaas_customer_id: novo.id }).eq('id', cli.id)
  return novo.id
}

export async function POST(req: NextRequest) {
  try {
    const { fatura_id, tipo='PIX' } = await req.json()
    const cfg = await getConfig()
    if (!cfg.asaas_api_key) return NextResponse.json({ ok:false, error:'Chave Asaas não configurada. Acesse Parâmetros → Cobranças.' })

    const { data: fat } = await sb.from('faturas')
      .select('*, contratos(numero, clientes(id,nome,cpf_cnpj,email,celular,asaas_customer_id))')
      .eq('id', fatura_id).maybeSingle()
    if (!fat) return NextResponse.json({ ok:false, error:'Fatura não encontrada.' })
    if (!['pendente','vencida'].includes(fat.status))
      return NextResponse.json({ ok:false, error:`Fatura "${fat.status}" não pode ser cobrada.` })

    // Cobrança já existe e está ativa — retornar dados
    if (fat.asaas_payment_id) {
      const p = await api(cfg, `/payments/${fat.asaas_payment_id}`)
      if (p.id && !['CANCELLED','REFUNDED','OVERDUE'].includes(p.status))
        return NextResponse.json({ ok:true, ja_existe:true,
          pix_qrcode: fat.pix_qrcode, pix_copia_cola: fat.pix_copia_cola,
          boleto_url: fat.boleto_url, boleto_linha_digitavel: fat.boleto_linha_digitavel })
    }

    const cli = (fat.contratos as any)?.clientes
    if (!cli) return NextResponse.json({ ok:false, error:'Cliente não encontrado.' })

    const customerId = await upsertCliente(cfg, cli)

    const billingType = tipo==='PIX_BOLETO' ? 'UNDEFINED' : tipo
    const pgto = await api(cfg, '/payments', 'POST', {
      customer:          customerId,
      billingType,
      value:             Number(fat.saldo_restante ?? fat.valor),
      dueDate:           fat.data_vencimento,
      description:       `${cfg.asaas_descricao_padrao||'Locação de equipamentos'}${fat.descricao?' — '+fat.descricao:''}`,
      externalReference: String(fatura_id),
      fine:     { value: Number(cfg.asaas_multa_pct??2), type:'PERCENTAGE' },
      interest: { value: Number(cfg.asaas_juros_pct??1) },
    })
    if (!pgto.id) return NextResponse.json({ ok:false, error:'Asaas: '+JSON.stringify(pgto) })

    // QR Code PIX
    let pixQrcode=null, pixCopiaCola=null
    if (['PIX','UNDEFINED'].includes(billingType)) {
      const qr = await api(cfg, `/payments/${pgto.id}/pixQrCode`)
      pixQrcode    = qr.encodedImage ?? null
      pixCopiaCola = qr.payload ?? null
    }

    // Boleto
    let boletoUrl = pgto.bankSlipUrl ?? null, boletoLinha=null
    if (['BOLETO','UNDEFINED'].includes(billingType)) {
      const bol = await api(cfg, `/payments/${pgto.id}/identificationField`)
      boletoLinha = bol.identificationField ?? null
    }

    await sb.from('faturas').update({
      asaas_payment_id:      pgto.id,
      asaas_status:          pgto.status,
      pix_qrcode:            pixQrcode,
      pix_copia_cola:        pixCopiaCola,
      boleto_url:            boletoUrl,
      boleto_linha_digitavel: boletoLinha,
    }).eq('id', fatura_id)

    return NextResponse.json({ ok:true,
      asaas_payment_id: pgto.id, asaas_status: pgto.status,
      pix_qrcode: pixQrcode, pix_copia_cola: pixCopiaCola,
      boleto_url: boletoUrl, boleto_linha_digitavel: boletoLinha,
    })
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message })
  }
}
