import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Forçar Node.js runtime (não Edge) para suportar bcryptjs
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', 1)
      .single()

    if (error || !user) {
      return NextResponse.json({ ok: false, error: 'Usuário não encontrado' })
    }

    // Verificar senha com bcryptjs
    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(senha, user.senha)

    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Senha incorreta' })
    }

    // Atualizar último login
    await supabase
      .from('usuarios')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', user.id)

    // Salvar sessão em cookie httpOnly
    const cookieStore = await cookies()
    cookieStore.set('locasystem_user', JSON.stringify({
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      comissao: user.comissao_percentual
    }), {
      httpOnly: true,
      maxAge: 7200,
      path: '/',
      sameSite: 'lax',
    })

    return NextResponse.json({
      ok: true,
      user: { id: user.id, nome: user.nome, perfil: user.perfil }
    })

  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 })
  }
}
