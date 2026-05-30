// build: 2026-05-30
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
    if (!file.name.toLowerCase().endsWith('.pdf'))
      return NextResponse.json({ ok: false, error: 'Somente arquivos PDF são aceitos' })
    if (file.size > 15 * 1024 * 1024)
      return NextResponse.json({ ok: false, error: 'Arquivo excede 15MB' })

    const path = 'contrato-locacao.pdf'
    const bytes = await file.arrayBuffer()

    const { error: upErr } = await sb.storage
      .from('documentos')
      .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message })

    const { data } = sb.storage.from('documentos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`

    // Salvar URL no site_config e parametros
    await sb.from('site_config')
      .upsert({ chave: 'url_contrato_padrao', valor: url }, { onConflict: 'chave' })
    await sb.from('parametros')
      .upsert({ chave: 'url_contrato_padrao', valor: url }, { onConflict: 'chave' })

    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
