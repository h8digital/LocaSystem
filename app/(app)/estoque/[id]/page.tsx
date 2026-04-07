'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { Badge, Btn } from '@/components/ui'

// ─── Helpers visuais ──────────────────────────────────────────────────────────
const KPI = ({ label, value, color, sub }: { label:string; value:string|number; color?:string; sub?:string }) => (
  <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
    padding:'16px 20px', boxShadow:'var(--shadow-sm)' }}>
    <div style={{ fontSize:'var(--fs-md)', fontWeight:600, color:'var(--t-muted)',
      textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:'var(--fs-kpi)', fontWeight:800, color: color ?? 'var(--t-primary)', lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:4 }}>{sub}</div>}
  </div>
)

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th style={{ padding:'9px 14px', fontSize:'var(--fs-md)', fontWeight:700, color:'var(--t-muted)',
    textTransform:'uppercase' as const, letterSpacing:'.04em',
    textAlign: right ? 'right' as const : 'left' as const,
    background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
    borderTop:'1px solid var(--border)' }}>{children}</th>
)
const Td = ({ children, mono, muted, right }: { children?: React.ReactNode; mono?:boolean; muted?:boolean; right?:boolean }) => (
  <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)',
    textAlign: right ? 'right' as const : 'left' as const,
    color: muted ? 'var(--t-muted)' : 'var(--t-primary)',
    fontFamily: mono ? 'var(--font-mono)' : undefined,
    fontSize: 'var(--fs-base)' }}>{children}</td>
)

export default function EstoqueDetalheProductPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [produto,       setProduto]       = useState<any>(null)
  const [patrimonios,   setPatrimonios]   = useState<any[]>([])
  const [locados,       setLocados]       = useState<any[]>([])   // contratos ativos com este produto
  const [manutencoes,   setManutencoes]   = useState<any[]>([])   // OS abertas deste produto
  const [movimentos,    setMovimentos]    = useState<any[]>([])   // últimas movimentações
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!id) return
    loadTudo()
  }, [id])

  async function loadTudo() {
    setLoading(true)

    // 1. Dados do produto
    const { data: prod } = await supabase
      .from('produtos')
      .select('*, categorias(nome)')
      .eq('id', id)
      .single()
    setProduto(prod)

    // 2. Patrimônios (para produtos controlados por patrimônio)
    const { data: pats } = await supabase
      .from('patrimonios')
      .select('*, locais_armazenagem(nome)')
      .eq('produto_id', id)
      .order('numero_patrimonio')
    setPatrimonios(pats ?? [])

    // 3. Contratos ativos que têm este produto (locados)
    const { data: itens } = await supabase
      .from('contrato_itens')
      .select('*, contratos(id, numero, status, data_fim, clientes(nome)), patrimonios(numero_patrimonio)')
      .eq('produto_id', id)
    // Filtrar apenas contratos ativos no frontend (PostgREST não suporta filtro em tabela relacionada)
    setLocados((itens ?? []).filter((i: any) => i.contratos?.status === 'ativo'))

    // 4. Manutenções abertas/em andamento
    const { data: mans } = await supabase
      .from('manutencoes')
      .select('*, patrimonios(numero_patrimonio)')
      .eq('produto_id', id)
      .in('status', ['aberto', 'em_andamento'])
      .order('data_abertura', { ascending: false })
    setManutencoes(mans ?? [])

    // 5. Últimas movimentações
    const { data: movs } = await supabase
      .from('estoque_movimentacoes')
      .select('*, usuarios(nome), locais_armazenagem(nome)')
      .eq('produto_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setMovimentos(movs ?? [])

    setLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:10, color:'var(--t-muted)' }}>
      <div style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",verticalAlign:"middle",flexShrink:0}}/> Carregando...
    </div>
  )
  if (!produto) return (
    <div style={{ textAlign:'center', padding:48, color:'var(--t-muted)' }}>Produto não encontrado.</div>
  )

  // ── Cálculos ─────────────────────────────────────────────────────────────
  const qtdLocada     = locados.reduce((s: number, i: any) => s + Number(i.quantidade ?? 1), 0)
  const qtdManutencao = manutencoes.length
  const qtdDisponivel = produto.controla_patrimonio
    ? patrimonios.filter((p: any) => p.status === 'disponivel').length
    : Math.max(0, (produto.estoque_total ?? 0) - qtdLocada)
  const previsaoRetorno = locados.length > 0
    ? locados.reduce((mais: string, i: any) => {
        const d = i.contratos?.data_fim ?? ''
        return d > mais ? d : mais
      }, '')
    : null

  const statusColor = (s: string) =>
    s === 'disponivel' ? 'var(--c-success)' :
    s === 'locado'     ? 'var(--c-primary)' :
    s === 'manutencao' ? 'var(--c-warning)' : 'var(--t-muted)'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()}
          style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
            cursor:'pointer', color:'var(--t-secondary)', fontSize:16, flexShrink:0 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <h1 style={{ margin:0, fontSize:'var(--fs-lg)', fontWeight:700, color:'var(--t-primary)' }}>
              {produto.nome}
            </h1>
            <Badge value={produto.ativo ? 'ativo' : 'inativo'} dot />
          </div>
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:2 }}>
            {(produto.categorias as any)?.nome ?? '—'}
            {produto.marca && ` · ${produto.marca}`}
            {produto.modelo && ` · ${produto.modelo}`}
          </div>
        </div>
        <Btn variant="secondary" onClick={() => router.push(`/equipamentos`)}>
          Ver Cadastro
        </Btn>
        <Btn onClick={() => router.push(`/estoque`)}>
          Voltar ao Estoque
        </Btn>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <KPI label="Disponível"
          value={produto.controla_patrimonio ? `${qtdDisponivel} un` : `${qtdDisponivel} un`}
          color={qtdDisponivel === 0 ? 'var(--c-danger)' : 'var(--c-success)'}
          sub={!produto.controla_patrimonio && qtdLocada > 0 ? `${produto.estoque_total} total − ${qtdLocada} locado(s)` : undefined}
        />
        <KPI label="Locado"       value={`${qtdLocada} un`}     color="var(--c-primary)"
          sub={locados.length > 0 ? `${locados.length} contrato(s)` : undefined} />
        <KPI label="Manutenção"   value={`${qtdManutencao} un`} color={qtdManutencao > 0 ? 'var(--c-warning)' : 'var(--t-muted)'}
          sub={qtdManutencao > 0 ? `${qtdManutencao} OS aberta(s)` : undefined} />
        <KPI label="Prev. Retorno" value={previsaoRetorno ? fmt.date(previsaoRetorno) : '—'}
          color={previsaoRetorno ? 'var(--t-primary)' : 'var(--t-muted)'}
          sub={previsaoRetorno ? 'data de fim do último contrato' : 'nenhum item locado'} />
      </div>

      {/* ── Contratos Ativos (Itens Locados) ──────────────────────────────── */}
      <div className="ds-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>Itens Locados em Contratos Ativos</div>
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>{qtdLocada} unidade(s) fora do estoque</div>
        </div>
        {locados.length === 0
          ? <div className="ds-empty"><div className="ds-empty-title">Nenhum item locado no momento.</div></div>
          : <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Contrato</Th><Th>Cliente</Th><Th>Patrimônio</Th>
                <Th right>Qtd</Th><Th>Prev. Retorno</Th>
              </tr></thead>
              <tbody>
                {locados.map((item: any, i: number) => (
                  <tr key={i} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                    <Td>
                      <button onClick={() => router.push(`/contratos/${item.contratos?.id}`)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                          color:'var(--c-primary)', fontWeight:700, fontFamily:'var(--font-mono)',
                          fontSize:'var(--fs-base)', textDecoration:'underline', textUnderlineOffset:2 }}>
                        {item.contratos?.numero}
                      </button>
                    </Td>
                    <Td>{item.contratos?.clientes?.nome ?? '—'}</Td>
                    <Td mono muted>{(item.patrimonios as any)?.numero_patrimonio ?? '—'}</Td>
                    <Td right>{item.quantidade ?? 1}</Td>
                    <Td>
                      <span style={{ fontWeight: item.contratos?.data_fim ? 600 : 400,
                        color: (() => {
                          const hoje = new Date().toISOString().split('T')[0]
                          const fim  = item.contratos?.data_fim ?? ''
                          return fim < hoje ? 'var(--c-danger)' : 'var(--t-primary)'
                        })() }}>
                        {item.contratos?.data_fim ? fmt.date(item.contratos.data_fim) : '—'}
                        {(() => {
                          const hoje = new Date().toISOString().split('T')[0]
                          const fim  = item.contratos?.data_fim ?? ''
                          return fim && fim < hoje ? ' ⚠ Atrasado' : ''
                        })()}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* ── Ordens de Serviço Abertas ──────────────────────────────────────── */}
      <div className="ds-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>Ordens de Serviço em Aberto</div>
          {manutencoes.length > 0 && (
            <div style={{ fontSize:'var(--fs-md)', color:'var(--c-warning)', fontWeight:600 }}>
              {manutencoes.length} OS ativa(s)
            </div>
          )}
        </div>
        {manutencoes.length === 0
          ? <div className="ds-empty"><div className="ds-empty-title">Nenhuma ordem de serviço aberta.</div></div>
          : <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Nº OS</Th><Th>Patrimônio</Th><Th>Tipo</Th>
                <Th>Status</Th><Th>Abertura</Th><Th>Previsão</Th>
              </tr></thead>
              <tbody>
                {manutencoes.map((os: any, i: number) => (
                  <tr key={i} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                    <Td>
                      <button onClick={() => router.push(`/manutencoes`)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                          color:'var(--c-warning)', fontWeight:700, fontFamily:'var(--font-mono)',
                          fontSize:'var(--fs-base)', textDecoration:'underline', textUnderlineOffset:2 }}>
                        OS-{String(os.id).padStart(5,'0')}
                      </button>
                    </Td>
                    <Td mono muted>{(os.patrimonios as any)?.numero_patrimonio ?? '—'}</Td>
                    <Td muted>{os.tipo?.replace(/_/g,' ')}</Td>
                    <Td><Badge value={os.status} dot /></Td>
                    <Td muted>{fmt.date(os.data_abertura)}</Td>
                    <Td>
                      <span style={{ color: (() => {
                          if (!os.data_previsao) return 'var(--t-muted)'
                          const hoje = new Date().toISOString().split('T')[0]
                          return os.data_previsao < hoje ? 'var(--c-danger)' : 'var(--t-primary)'
                        })(), fontWeight: os.data_previsao ? 600 : 400 }}>
                        {os.data_previsao ? fmt.date(os.data_previsao) : '—'}
                        {os.data_previsao && os.data_previsao < new Date().toISOString().split('T')[0] ? ' ⚠' : ''}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* ── Patrimônios (se controla_patrimonio) ──────────────────────────── */}
      {produto.controla_patrimonio === 1 && (
        <div className="ds-card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'var(--fs-base)' }}>
            Patrimônios — {patrimonios.length} cadastrado(s)
          </div>
          {patrimonios.length === 0
            ? <div className="ds-empty"><div className="ds-empty-title">Nenhum patrimônio cadastrado.</div></div>
            : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <Th>Nº Patrimônio</Th><Th>S/N</Th><Th>Local</Th><Th>Status</Th>
                </tr></thead>
                <tbody>
                  {patrimonios.map((pat: any, i: number) => (
                    <tr key={pat.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <Td><span style={{ fontWeight:700, fontFamily:'var(--font-mono)' }}>{pat.numero_patrimonio}</span></Td>
                      <Td mono muted>{pat.numero_serie || '—'}</Td>
                      <Td muted>{(pat.locais_armazenagem as any)?.nome ?? '—'}</Td>
                      <Td>
                        <span style={{ fontWeight:600, color: statusColor(pat.status) }}>
                          ● {pat.status?.charAt(0).toUpperCase() + pat.status?.slice(1)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* ── Últimas Movimentações ──────────────────────────────────────────── */}
      <div className="ds-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'var(--fs-base)' }}>
          Últimas Movimentações de Estoque
        </div>
        {movimentos.length === 0
          ? <div className="ds-empty"><div className="ds-empty-title">Nenhuma movimentação registrada.</div></div>
          : <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Data</Th><Th>Tipo</Th><Th right>Quantidade</Th>
                <Th>Local</Th><Th>Usuário</Th><Th>Observações</Th>
              </tr></thead>
              <tbody>
                {movimentos.map((mov: any, i: number) => {
                  const isEntrada = mov.tipo === 'entrada'
                  return (
                    <tr key={mov.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <Td muted>{fmt.date(mov.created_at?.split('T')[0])}</Td>
                      <Td>
                        <span style={{ fontWeight:600, color: isEntrada ? 'var(--c-success)' : 'var(--c-danger)' }}>
                          {isEntrada ? '▲ Entrada' : '▼ Saída'}
                        </span>
                      </Td>
                      <Td right>
                        <span style={{ fontWeight:700, fontFamily:'var(--font-mono)',
                          color: isEntrada ? 'var(--c-success)' : 'var(--c-danger)' }}>
                          {isEntrada ? '+' : '-'}{mov.quantidade}
                        </span>
                      </Td>
                      <Td muted>{(mov.locais_armazenagem as any)?.nome ?? '—'}</Td>
                      <Td muted>{(mov.usuarios as any)?.nome ?? '—'}</Td>
                      <Td muted>{mov.observacoes || '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        }
      </div>

    </div>
  )
}
