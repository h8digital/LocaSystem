import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LIMITE_BYTES = 10 * 1024 * 1024 // 10MB
const BUCKET = 'documentos-credito'

// GET /api/clientes/documentos?cliente_id=X
export async function GET(req: NextRequest) {
  const cliente_id = req.nextUrl.searchParams.get('cliente_id')
  if (!cliente_id) return NextResponse.json({ ok: false, error: 'cliente_id obrigatório' })
  const { data, error } = await sb
    .from('cliente_documentos')
    .select('*, usuarios(nome)')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message })
  return NextResponse.json({ ok: true, data })
}

// POST /api/clientes/documentos — upload de novo documento (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const formData = await req.formData()
    const cliente_id    = formData.get('cliente_id') as string
    const tipo_documento = formData.get('tipo_documento') as string
    const descricao     = formData.get('descricao') as string || null
    const arquivo       = formData.get('arquivo') as File | null

    if (!cliente_id || !tipo_documento || !arquivo) {
      return NextResponse.json({ ok: false, error: 'cliente_id, tipo_documento e arquivo são obrigatórios.' })
    }
    if (arquivo.size > LIMITE_BYTES) {
      return NextResponse.json({ ok: false, error: `Arquivo muito grande. Limite: 10MB. Tamanho enviado: ${(arquivo.size/1024/1024).toFixed(1)}MB.` })
    }

    // Gerar caminho único no Storage
    const ext = arquivo.name.split('.').pop() ?? 'bin'
    const storagePath = `${cliente_id}/${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const arrayBuf = await arquivo.arrayBuffer()
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuf, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: false,
      })
    if (upErr) return NextResponse.json({ ok: false, error: 'Erro no upload: ' + upErr.message })

    // URL assinada com 10 anos de validade (para exibição permanente no sistema)
    const { data: signed } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)

    const { data: doc, error: dbErr } = await sb.from('cliente_documentos').insert({
      cliente_id:     Number(cliente_id),
      tipo_documento,
      descricao,
      nome_arquivo:   arquivo.name,
      url:            signed?.signedUrl ?? '',
      storage_path:   storagePath,
      tamanho_bytes:  arquivo.size,
      mime_type:      arquivo.type || null,
      status:         'pendente',
      usuario_id:     user.id,
    }).select().single()

    if (dbErr) {
      // Limpar arquivo do storage se inserção falhar
      await sb.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ ok: false, error: dbErr.message })
    }

    return NextResponse.json({ ok: true, data: doc })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// PATCH /api/clientes/documentos — alterar tipo, descricao ou status
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const { id, tipo_documento, descricao, status } = body
    if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório' })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (tipo_documento !== undefined) updates.tipo_documento = tipo_documento
    if (descricao      !== undefined) updates.descricao      = descricao
    if (status         !== undefined) updates.status         = status

    const { data, error } = await sb.from('cliente_documentos')
      .update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

// DELETE /api/clientes/documentos?id=X
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório' })

    // Buscar o storage_path antes de deletar
    const { data: doc } = await sb.from('cliente_documentos')
      .select('storage_path').eq('id', id).single()

    const { error: dbErr } = await sb.from('cliente_documentos').delete().eq('id', id)
    if (dbErr) return NextResponse.json({ ok: false, error: dbErr.message })

    // Remover do Storage
    if (doc?.storage_path) {
      await sb.storage.from(BUCKET).remove([doc.storage_path])
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
