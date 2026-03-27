import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ ok: false, error: 'Arquivo obrigatório' })
    if (file.size > 2 * 1024 * 1024)
      return NextResponse.json({ ok: false, error: 'Arquivo excede 2MB' })

    const ext  = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `logo.${ext}`

    // Remove logo anterior
    await sb.storage.from('logos').remove([path])

    const bytes = await file.arrayBuffer()
    const { error: upErr } = await sb.storage
      .from('logos')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message })

    const { data } = sb.storage.from('logos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}` // cache busting

    // Salvar URL no parametro
    await sb.from('parametros')
      .update({ valor: url })
      .eq('chave', 'empresa_logo_url')

    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

export async function DELETE() {
  try {
    const { data: param } = await sb.from('parametros')
      .select('valor').eq('chave', 'empresa_logo_url').single()
    if (param?.valor) {
      const path = param.valor.split('/logos/')[1]?.split('?')[0]
      if (path) await sb.storage.from('logos').remove([path])
    }
    await sb.from('parametros').update({ valor: '' }).eq('chave', 'empresa_logo_url')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
