import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/produto-fotos?produto_id=X
export async function GET(req: NextRequest) {
  const produtoId = req.nextUrl.searchParams.get('produto_id')
  if (!produtoId) return NextResponse.json({ ok: false, error: 'produto_id obrigatório' })

  const { data, error } = await sb
    .from('produto_fotos')
    .select('*')
    .eq('produto_id', Number(produtoId))
    .order('principal', { ascending: false })
    .order('ordem')

  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true, data })
}

// POST /api/produto-fotos  (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const produtoId = formData.get('produto_id') as string
    const file      = formData.get('file') as File
    const principal = formData.get('principal') === 'true'

    if (!produtoId || !file) return NextResponse.json({ ok: false, error: 'produto_id e file são obrigatórios' })

    // Nome único para evitar colisões
    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const uuid     = crypto.randomUUID()
    const path     = `${produtoId}/${uuid}.${ext}`

    // Upload para o bucket
    const bytes    = await file.arrayBuffer()
    const { error: upErr } = await sb.storage
      .from('equipamentos')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false })

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message })

    // URL pública
    const { data: urlData } = sb.storage.from('equipamentos').getPublicUrl(path)
    const url = urlData.publicUrl

    // Se for principal, desmarcar as outras
    if (principal) {
      await sb.from('produto_fotos').update({ principal: false }).eq('produto_id', Number(produtoId))
    }

    // Contar fotos existentes para definir ordem
    const { count } = await sb.from('produto_fotos')
      .select('*', { count: 'exact', head: true }).eq('produto_id', Number(produtoId))

    const { data, error } = await sb.from('produto_fotos').insert({
      produto_id:   Number(produtoId),
      storage_path: path,
      url,
      principal:    principal || (count === 0),  // primeira foto é principal automaticamente
      ordem:        count ?? 0,
    }).select().single()

    if (error) return NextResponse.json({ ok: false, error: error.message })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// DELETE /api/produto-fotos?id=X
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório' })

    const { data: foto } = await sb.from('produto_fotos').select('*').eq('id', Number(id)).single()
    if (!foto) return NextResponse.json({ ok: false, error: 'Foto não encontrada' })

    // Remover do storage
    await sb.storage.from('equipamentos').remove([foto.storage_path])

    // Remover do banco
    await sb.from('produto_fotos').delete().eq('id', Number(id))

    // Se era a principal, promover a próxima
    if (foto.principal) {
      const { data: proxima } = await sb.from('produto_fotos')
        .select('id').eq('produto_id', foto.produto_id).order('ordem').limit(1).single()
      if (proxima) await sb.from('produto_fotos').update({ principal: true }).eq('id', proxima.id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// PATCH /api/produto-fotos?id=X  — definir como principal
export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    const { produto_id } = await req.json()
    if (!id || !produto_id) return NextResponse.json({ ok: false, error: 'Parâmetros obrigatórios' })

    await sb.from('produto_fotos').update({ principal: false }).eq('produto_id', Number(produto_id))
    await sb.from('produto_fotos').update({ principal: true  }).eq('id', Number(id))

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
