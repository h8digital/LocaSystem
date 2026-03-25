import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/* ── Parser de User-Agent (simples, sem dependências) ── */
function parseUserAgent(ua: string) {
  const s = ua ?? ''

  // Dispositivo
  let dispositivo = 'Desktop'
  if (/tablet|ipad/i.test(s)) dispositivo = 'Tablet'
  else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(s)) dispositivo = 'Mobile'

  // Sistema Operacional
  let sistema = 'Desconhecido'
  if      (/iphone|ipad|ipod/i.test(s)) sistema = 'iOS'
  else if (/android/i.test(s))          sistema = 'Android'
  else if (/windows nt 10/i.test(s))    sistema = 'Windows 10/11'
  else if (/windows nt/i.test(s))       sistema = 'Windows'
  else if (/mac os x|macintosh/i.test(s)) sistema = 'macOS'
  else if (/linux/i.test(s))            sistema = 'Linux'
  else if (/cros/i.test(s))             sistema = 'ChromeOS'

  // Navegador
  let navegador = 'Desconhecido'
  if      (/edg\//i.test(s))         navegador = 'Edge'
  else if (/opr\/|opera/i.test(s))   navegador = 'Opera'
  else if (/chrome\/\d/i.test(s))    navegador = 'Chrome'
  else if (/safari\/\d/i.test(s))    navegador = 'Safari'
  else if (/firefox\/\d/i.test(s))   navegador = 'Firefox'
  else if (/trident|msie/i.test(s))  navegador = 'Internet Explorer'

  return { dispositivo, sistema, navegador }
}

/* ── GET: buscar dados da cotação pelo token ── */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const { data: cot } = await supabase
    .from('cotacoes')
    .select('*, clientes(nome,cpf_cnpj,email,celular,telefone), cotacao_itens(*, produtos(nome,unidade)), periodos_locacao(nome,dias)')
    .eq('token_aprovacao', token)
    .single()

  if (!cot) return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 })

  // Registrar visualização
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req.headers.get('x-real-ip')
             ?? 'desconhecido'
  const ua  = req.headers.get('user-agent') ?? ''
  const dev = parseUserAgent(ua)

  await supabase.from('cotacao_logs').insert({
    cotacao_id: cot.id,
    acao: 'visualizou',
    ip, user_agent: ua, ...dev,
    nome_respondente: cot.clientes?.nome,
    telefone_respondente: cot.clientes?.celular || cot.clientes?.telefone,
    email_respondente: cot.clientes?.email,
  })

  await supabase.from('cotacoes')
    .update({ visualizacoes: (cot.visualizacoes ?? 0) + 1 })
    .eq('id', cot.id)

  return NextResponse.json(cot)
}

/* ── POST: registrar aprovação ou recusa ── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, acao, motivo, nome, telefone, email } = body

    if (!token || !acao) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

    const { data: cot } = await supabase
      .from('cotacoes')
      .select('id,status,data_validade,cliente_id,clientes(nome,celular,telefone,email)')
      .eq('token_aprovacao', token)
      .single()

    if (!cot) return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 })
    if (cot.status !== 'aguardando')
      return NextResponse.json({ error: 'Cotação não está aguardando aprovação' }, { status: 400 })

    // Verificar validade
    if (new Date(cot.data_validade) < new Date()) {
      await supabase.from('cotacoes').update({ status: 'expirada' }).eq('id', cot.id)
      await supabase.from('cotacao_logs').insert({
        cotacao_id: cot.id, acao: 'expirada',
        nome_respondente: (cot as any).clientes?.nome,
      })
      return NextResponse.json({ error: 'Cotação expirada' }, { status: 410 })
    }

    // Capturar dados técnicos
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              ?? req.headers.get('x-real-ip')
              ?? 'desconhecido'
    const ua  = req.headers.get('user-agent') ?? ''
    const dev = parseUserAgent(ua)

    // Nome e telefone: usa o informado ou cai para o do cliente
    const cliente = (cot as any).clientes
    const nomeLog     = nome     || cliente?.nome     || null
    const telefoneLog = telefone || cliente?.celular  || cliente?.telefone || null
    const emailLog    = email    || cliente?.email    || null

    const novoStatus = acao === 'aprovar' ? 'aprovada' : 'recusada'

    // Atualizar cotação
    await supabase.from('cotacoes').update({
      status:        novoStatus,
      data_resposta: new Date().toISOString(),
      motivo_recusa: motivo || null,
      updated_at:    new Date().toISOString(),
    }).eq('id', cot.id)

    // Gravar log completo
    await supabase.from('cotacao_logs').insert({
      cotacao_id:           cot.id,
      acao:                 novoStatus,
      nome_respondente:     nomeLog,
      telefone_respondente: telefoneLog,
      email_respondente:    emailLog,
      ip,
      user_agent:           ua,
      dispositivo:          dev.dispositivo,
      sistema:              dev.sistema,
      navegador:            dev.navegador,
      motivo_recusa:        motivo || null,
    })

    return NextResponse.json({ ok: true, status: novoStatus })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
