import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  const { nome, email, senha, perfil, comissao_percentual, telefone } = await req.json()
  if (!senha || senha.length < 6) return NextResponse.json({ ok: false, error: 'Senha muito curta' })
  const hash = await bcrypt.hash(senha, 12)
  const { error } = await supabase.from('usuarios').insert({ nome, email, senha: hash, perfil, comissao_percentual, telefone, ativo: 1 })
  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true })
}
