import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const categoriaId    = searchParams.get('categoria_id')
  const somenteAtivos  = searchParams.get('somente_ativos') !== 'false'

  let q = sb.from('produtos')
    .select(`id,nome,descricao,marca,modelo,
      preco_locacao_diario,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_fds,
      taxa_limpeza_contratada,taxa_limpeza_avulsa,
      controla_patrimonio,foto_url,ativo,
      categorias(id,nome),
      patrimonios(id,status)`)
    .order('nome')
  if (somenteAtivos) q = q.eq('ativo', 1)
  if (categoriaId)   q = q.eq('categoria_id', categoriaId)
  const { data, error } = await q
  if (error) return NextResponse.json({ ok:false, error:error.message })

  const equipamentos = (data ?? []).map((p:any) => {
    const pats = (p.patrimonios ?? []) as any[]
    return {
      ...p, patrimonios: undefined,
      estoque: {
        total:       pats.length,
        disponiveis: pats.filter((x:any)=>x.status==='disponivel').length,
        locados:     pats.filter((x:any)=>x.status==='locado').length,
        manutencao:  pats.filter((x:any)=>x.status==='manutencao').length,
      }
    }
  })

  const { data: params } = await sb.from('parametros').select('chave,valor')
    .in('chave',['empresa_nome','empresa_telefone','empresa_email','empresa_cnpj','empresa_endereco'])
  const empresa:Record<string,string> = {}
  ;(params ?? []).forEach((p:any) => { empresa[p.chave] = p.valor })

  return NextResponse.json({ ok:true, equipamentos, empresa })
}
