import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { cookies }                   from 'next/headers'
import nodemailer                    from 'nodemailer'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── POST /api/email ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { para, cc, assunto, corpo, contrato_id, html } = await req.json()
    if (!para || !assunto) return NextResponse.json({ ok: false, error: 'Destinatário e assunto são obrigatórios' })

    // ── 1. Buscar config SMTP: preferência usuário → global ────────────────
    const { data: usuarioData } = await sb.from('usuarios')
      .select('smtp_host,smtp_porta,smtp_usuario,smtp_senha,smtp_seguro,smtp_de_nome,smtp_de_email,smtp_ativo,nome,email')
      .eq('id', user.id).single()

    const { data: params } = await sb.from('parametros')
      .select('chave,valor')
    const p: Record<string,string> = {}
    params?.forEach(x => { p[x.chave] = x.valor ?? '' })

    // Decide qual SMTP usar
    const useUserSmtp = usuarioData?.smtp_ativo && usuarioData?.smtp_host
    const smtpConfig = useUserSmtp ? {
      host:   usuarioData.smtp_host!,
      port:   usuarioData.smtp_porta || 587,
      secure: usuarioData.smtp_seguro ?? true,
      auth:   { user: usuarioData.smtp_usuario!, pass: usuarioData.smtp_senha! },
    } : {
      host:   p['email_host'],
      port:   Number(p['email_port'] || 587),
      secure: p['email_secure'] === 'true',
      auth:   { user: p['email_user'], pass: p['email_pass'] },
    }

    if (!smtpConfig.host || !smtpConfig.auth.user)
      return NextResponse.json({ ok: false, error: 'Nenhuma configuração SMTP ativa. Configure em Parâmetros > E-mail ou no seu perfil de usuário.' })

    const fromName  = useUserSmtp ? (usuarioData.smtp_de_nome  || usuarioData.nome) : (p['email_from_name'] || 'LocaSystem')
    const fromEmail = useUserSmtp ? (usuarioData.smtp_de_email || usuarioData.smtp_usuario!) : (p['email_from_email'] || smtpConfig.auth.user)
    const replyTo   = useUserSmtp ? (usuarioData.smtp_de_email || smtpConfig.auth.user) : (p['email_reply_to'] || smtpConfig.auth.user)

    // ── 2. Criar transporter e enviar ──────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   smtpConfig.host,
      port:   smtpConfig.port,
      secure: smtpConfig.secure,
      auth:   { user: smtpConfig.auth.user, pass: smtpConfig.auth.pass },
      tls:    { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to:      para,
      cc:      cc || undefined,
      replyTo: replyTo || undefined,
      subject: assunto,
      html:    html || corpo || assunto,
      text:    corpo || assunto,
    })

    // ── 3. Registrar no log ────────────────────────────────────────────────
    await sb.from('email_log').insert({
      usuario_id:  user.id,
      contrato_id: contrato_id || null,
      para, cc: cc || null, assunto, corpo: corpo || null,
      status: 'enviado',
    })

    return NextResponse.json({ ok: true, msg: `E-mail enviado para ${para}` })

  } catch (e: any) {
    // Registrar erro no log
    try {
      const cookieStore = await cookies()
      const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
      const { assunto, para, contrato_id } = await req.json().catch(()=>({}))
      if (user.id) await sb.from('email_log').insert({
        usuario_id: user.id, contrato_id: contrato_id || null,
        para: para || '', assunto: assunto || '', status: 'erro', erro_msg: e.message,
      })
    } catch {}
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// ── GET /api/email/testar ─ Test connection ────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' })

    const { searchParams } = new URL(req.url)
    const usar = searchParams.get('usar') // 'usuario' ou 'global'

    const { data: params } = await sb.from('parametros').select('chave,valor')
    const p: Record<string,string> = {}
    params?.forEach(x => { p[x.chave] = x.valor ?? '' })

    let host='', port=587, secure=false, user_='', pass_=''

    if (usar === 'usuario') {
      const { data: u } = await sb.from('usuarios')
        .select('smtp_host,smtp_porta,smtp_usuario,smtp_senha,smtp_seguro').eq('id', user.id).single()
      host = u?.smtp_host || ''; port = u?.smtp_porta || 587
      secure = u?.smtp_seguro ?? false; user_ = u?.smtp_usuario || ''; pass_ = u?.smtp_senha || ''
    } else {
      host = p['email_host']; port = Number(p['email_port'] || 587)
      secure = p['email_secure'] === 'true'; user_ = p['email_user']; pass_ = p['email_pass']
    }

    if (!host || !user_) return NextResponse.json({ ok: false, error: 'Configuração incompleta' })

    const transporter = nodemailer.createTransport({
      host, port, secure, auth: { user: user_, pass: pass_ },
      tls: { rejectUnauthorized: false },
    })

    await transporter.verify()
    return NextResponse.json({ ok: true, msg: 'Conexão SMTP verificada com sucesso!' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
