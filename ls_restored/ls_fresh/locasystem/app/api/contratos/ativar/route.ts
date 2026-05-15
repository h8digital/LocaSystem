import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// POST /api/contratos/ativar
// Transição DRAFT → ACTIVE
// Regras:
// 1. Contrato deve estar em status 'rascunho'
// 2. Deve ter pelo menos 1 item
// 3. Para itens rastreáveis: patrimonio_id obrigatório
// 4. Patrimônio não pode estar locado em outro contrato ativo
// 5. Atualiza status dos patrimônios para 'locado'
// 6. Registra remessa no estoque
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = JSON.parse(cookieStore.get('locasystem_user')?.value ?? '{}')
    if (!user.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { contrato_id } = await req.json()

    // Buscar contrato com itens e produtos
    const { data: contrato } = await sb.from('contratos')
      .select('*, clientes(nome)')
      .eq('id', contrato_id).single()
    if (!contrato) return NextResponse.json({ ok: false, error: 'Contrato não encontrado' })
    if (contrato.status !== 'rascunho') {
      return NextResponse.json({ ok: false, error: `Apenas contratos em rascunho podem ser ativados. Status atual: ${contrato.status}` })
    }

    const { data: itens } = await sb.from('contrato_itens')
      .select('*, produtos(nome, controla_patrimonio)')
      .eq('contrato_id', contrato_id)
    if (!itens?.length) return NextResponse.json({ ok: false, error: 'O contrato não possui itens.' })

    // ── Validações de integridade ─────────────────────────────────────────────
    for (const item of itens) {
      const prod = item.produtos as any
      // Itens rastreáveis EXIGEM patrimônio
      if (prod?.controla_patrimonio && !item.patrimonio_id) {
        return NextResponse.json({
          ok: false,
          error: `O item "${prod.nome}" é rastreável e exige vinculação de um número de série/patrimônio.`
        })
      }
      // Patrimônio não pode estar em outro contrato ativo
      if (item.patrimonio_id) {
        const { data: pat } = await sb.from('patrimonios').select('status, numero_patrimonio').eq('id', item.patrimonio_id).single()
        if (pat?.status === 'locado') {
          return NextResponse.json({
            ok: false,
            error: `O patrimônio "${pat.numero_patrimonio}" já está locado em outro contrato ativo.`
          })
        }
        if (pat?.status === 'manutencao') {
          return NextResponse.json({
            ok: false,
            error: `O patrimônio "${pat.numero_patrimonio}" está em manutenção e não pode ser locado.`
          })
        }
      }
    }

    const agora = new Date().toISOString()

    // ── Atualizar patrimônios para RENTED ────────────────────────────────────
    for (const item of itens) {
      if (item.patrimonio_id) {
        await sb.from('patrimonios').update({ status: 'locado' }).eq('id', item.patrimonio_id)
      }
    }

    // ── Registrar remessa (saída de estoque) ─────────────────────────────────
    for (const item of itens) {
      const prod = item.produtos as any
      if (!prod?.controla_patrimonio) {
        // Produto por quantidade: registrar saída no estoque
        await sb.from('estoque_movimentacoes').insert({
          produto_id:   item.produto_id,
          tipo:         'saida',
          quantidade:   item.quantidade,
          observacoes:  `Remessa — Contrato ${contrato.numero}`,
          usuario_id:   user.id,
        })
      }
    }

    // ── Ativar contrato ──────────────────────────────────────────────────────
    await sb.from('contratos').update({
      status:          'ativo',
      data_ativacao:   agora,
      data_retirada:   agora,
      remessa_gerada:  true,
      data_remessa:    agora,
    }).eq('id', contrato_id)

    return NextResponse.json({
      ok: true,
      msg: `Contrato ${contrato.numero} ativado. Remessa registrada. ${itens.length} item(ns) com status atualizado para LOCADO.`,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
