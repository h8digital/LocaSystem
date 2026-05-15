import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// POST — cliente aprova ou reprova via token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, acao, assinatura_svg, motivo_reprovacao } = body
    // acao: 'aprovar' | 'reprovar'

    if (!token || !acao) return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' })

    // Buscar aprovação
    const { data: apr } = await sb
      .from('contrato_aprovacoes')
      .select('*, contratos(id, numero, status)')
      .eq('token', token)
      .eq('status', 'pendente')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!apr) return NextResponse.json({ ok: false, error: 'Link inválido, expirado ou já utilizado.' })

    // Coletar IP e User-Agent
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '0.0.0.0'
    const ua = req.headers.get('user-agent') ?? ''

    const novoStatus = acao === 'aprovar' ? 'aprovado' : 'reprovado'

    // Atualizar aprovação
    await sb.from('contrato_aprovacoes').update({
      status:             novoStatus,
      ip_aprovador:       ip,
      user_agent:         ua,
      assinatura_svg:     assinatura_svg ?? null,
      motivo_reprovacao:  motivo_reprovacao ?? null,
      aprovado_em:        new Date().toISOString(),
    }).eq('token', token)

    const contrato = apr.contratos as any

    // Registrar na timeline
    await sb.from('contrato_timeline').insert({
      contrato_id: contrato.id,
      tipo: acao === 'aprovar' ? 'ativacao' : 'alteracao',
      descricao: acao === 'aprovar'
        ? `Contrato aprovado eletronicamente pelo cliente (IP: ${ip})`
        : `Contrato reprovado pelo cliente. Motivo: ${motivo_reprovacao ?? '—'}`,
      detalhes: { ip, user_agent: ua, acao },
    })

    // Se aprovado e contrato ainda em rascunho → ativar
    if (acao === 'aprovar' && contrato.status === 'rascunho') {
      await sb.from('contratos').update({ status: 'ativo', data_ativacao: new Date().toISOString() })
        .eq('id', contrato.id)
    }

    return NextResponse.json({ ok: true, status: novoStatus })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// GET — buscar dados da aprovação pelo token (para a página pública)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ ok: false, error: 'Token obrigatório' })

  const { data } = await sb
    .from('contrato_aprovacoes')
    .select('*, contratos(numero, data_inicio, data_fim, total, clientes(nome, cpf_cnpj))')
    .eq('token', token)
    .single()

  if (!data) return NextResponse.json({ ok: false, error: 'Aprovação não encontrada' })

  const expirado = data.expires_at && new Date(data.expires_at) < new Date()
  return NextResponse.json({ ok: true, data: { ...data, expirado } })
}
