'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { Btn, Badge, inputCls } from '@/components/ui'
import { calcularPrecoItem, calcularDias, type PrecosProduto } from '@/lib/calcularCobranca'

// ── Tipos ────────────────────────────────────────────────────────────────────
type Aba = 'inventario' | 'historico' | 'contratos' | 'precos'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'var(--c-success,#16a34a)',
  locado:     'var(--c-primary)',
  manutencao: 'var(--c-warning,#f59e0b)',
  inativo:    'var(--t-muted)',
}
const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  locado:     'Locado',
  manutencao: 'Manutenção',
  inativo:    'Inativo',
}

export default function EquipamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [produto,   setProduto]   = useState<any>(null)
  const [pats,      setPats]      = useState<any[]>([])
  const [movs,      setMovs]      = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [aba,       setAba]       = useState<Aba>('inventario')

  // ── Filtros do inventário ────────────────────────────────────────────────
  const [busca,   setBusca]   = useState('')
  const [filtro,  setFiltro]  = useState('todos')
  const [pagina,  setPagina]  = useState(1)
  const PER_PAGE = 20

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: prod }, { data: patsData }, { data: movsData }, { data: ciData }] = await Promise.all([
      supabase.from('produtos')
        .select('*, categorias(nome)')
        .eq('id', Number(id))
        .single(),
      supabase.from('patrimonios')
        .select('*, contrato_itens!contrato_itens_patrimonio_id_fkey(contrato_id, contratos(id,numero,status,data_inicio,data_fim,clientes(nome)))')
        .eq('produto_id', Number(id))
        .is('deleted_at', null)
        .order('numero_patrimonio'),
      supabase.from('estoque_movimentacoes')
        .select('*')
        .eq('produto_id', Number(id))
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('contrato_itens')
        .select('*, contratos(id,numero,status,data_inicio,data_fim,clientes(nome))')
        .eq('produto_id', Number(id))
        .order('created_at', { ascending: false }),
    ])
    setProduto(prod)
    setPats(patsData ?? [])
    setMovs(movsData ?? [])
    setContratos((ciData ?? []).filter((ci: any) => ci.contratos))
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{display:"flex",alignItems:"center",gap:5,margin:"0 auto 12px",width:"fit-content"}}><div style={{width:7,height:7,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",opacity:.3}}/><div style={{width:7,height:7,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out 0.2s infinite",opacity:.3}}/><div style={{width:7,height:7,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out 0.4s infinite",opacity:.3}}/></div>
    </div>
  )
  if (!produto) return (
    <div style={{ padding:40, textAlign:'center', color:'var(--t-muted)' }}>
      Produto não encontrado.
    </div>
  )

  // ── Cálculos de resumo ───────────────────────────────────────────────────
  const dispCount  = pats.filter(p => p.status === 'disponivel').length
  const locCount   = pats.filter(p => p.status === 'locado').length
  const manutCount = pats.filter(p => p.status === 'manutencao').length
  const totalCount = pats.length

  // ── Filtro + busca + paginação ───────────────────────────────────────────
  const patsFiltrados = pats.filter(p => {
    const matchBusca = !busca ||
      p.numero_patrimonio?.toLowerCase().includes(busca.toLowerCase()) ||
      p.numero_serie?.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro = filtro === 'todos' || p.status === filtro
    return matchBusca && matchFiltro
  })
  const totalPags  = Math.max(1, Math.ceil(patsFiltrados.length / PER_PAGE))
  const patsPagina = patsFiltrados.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE)

  // ── Preços ───────────────────────────────────────────────────────────────
  const precos = [
    { l: 'Diário',        v: produto.preco_locacao_diario,  d: 1   },
    { l: 'FDS',           v: produto.preco_fds,              d: 2   },
    { l: 'Semanal',       v: produto.preco_locacao_semanal,  d: 7   },
    { l: 'Quinzenal',     v: produto.preco_quinzenal,        d: 15  },
    { l: 'Mensal',        v: produto.preco_locacao_mensal,   d: 30  },
    { l: 'Trimestral',    v: produto.preco_trimestral,       d: 90  },
    { l: 'Semestral',     v: produto.preco_semestral,        d: 180 },
    { l: 'Custo Repos.',  v: produto.custo_reposicao,        d: 0   },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:24 }}>
        <button onClick={() => router.back()}
          style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
            border:'1px solid var(--border)', borderRadius:'var(--r-md)', background:'var(--bg-card)',
            cursor:'pointer', fontSize:16, flexShrink:0, color:'var(--t-secondary)' }}>
          ←
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--t-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
            Equipamento{produto.codigo ? ` · ${produto.codigo}` : ''}
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--t-primary)', margin:0, lineHeight:1.2 }}>
            {produto.nome}
          </h1>
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:4 }}>
            {[produto.marca, produto.modelo, produto.categorias?.nome].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {[
            { l:'Disponível', v:dispCount,  c:STATUS_COLOR.disponivel },
            { l:'Locado',     v:locCount,   c:STATUS_COLOR.locado     },
            { l:'Total',      v:totalCount, c:'var(--t-secondary)'    },
          ].map(k => (
            <div key={k.l} style={{ textAlign:'center', padding:'10px 16px',
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:'var(--r-md)', minWidth:80 }}>
              <div style={{ fontSize:22, fontWeight:800, color:k.c }}>{k.v}</div>
              <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.05em', marginTop:2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:24, gap:0 }}>
        {([
          ['inventario', `🏷️ Inventário (${totalCount})`],
          ['historico',  `📋 Histórico de Movimentações (${movs.length})`],
          ['contratos',  `📄 Contratos (${contratos.length})`],
          ['precos',     '💰 Tabela de Preços'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k as Aba)}
            style={{
              padding:'11px 22px', border:'none', background:'none', cursor:'pointer',
              fontWeight: aba === k ? 700 : 500,
              fontSize:'var(--fs-base)',
              color: aba === k ? 'var(--c-primary)' : 'var(--t-muted)',
              borderBottom: aba === k ? '2px solid var(--c-primary)' : '2px solid transparent',
              marginBottom:-2, transition:'all .15s', whiteSpace:'nowrap',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ ABA: INVENTÁRIO ═════════════════════════════════════════════════ */}
      {aba === 'inventario' && (
        <div className="ds-card">

          {/* Filtros */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)',
            display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            {/* Chips de status */}
            <div style={{ display:'flex', gap:6 }}>
              {[
                { val:'todos',      label:`Todos (${totalCount})`,       color:'var(--t-secondary)' },
                { val:'disponivel', label:`✅ Disp. (${dispCount})`,      color:STATUS_COLOR.disponivel },
                { val:'locado',     label:`🔵 Loc. (${locCount})`,        color:STATUS_COLOR.locado     },
                ...(manutCount > 0 ? [{ val:'manutencao', label:`🔧 Man. (${manutCount})`, color:STATUS_COLOR.manutencao }] : []),
              ].map(btn => (
                <button key={btn.val} onClick={() => { setFiltro(btn.val); setPagina(1) }}
                  style={{
                    fontSize:'var(--fs-xs)', fontWeight:600, padding:'4px 12px', borderRadius:99,
                    cursor:'pointer', border:'1px solid', transition:'all .15s',
                    borderColor: btn.color,
                    background: filtro === btn.val ? btn.color : 'transparent',
                    color:      filtro === btn.val ? '#fff'    : btn.color,
                  }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div style={{ flex:1, minWidth:220, position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                color:'var(--t-muted)', fontSize:14, pointerEvents:'none' }}>🔍</span>
              <input
                value={busca}
                onChange={e => { setBusca(e.target.value); setPagina(1) }}
                placeholder="Buscar por Nº Patrimônio ou Nº Série..."
                className={inputCls}
                style={{ paddingLeft:32 }}
              />
            </div>
          </div>

          {/* Tabela */}
          {patsFiltrados.length === 0 ? (
            <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t-muted)' }}>
              {busca ? `Nenhum patrimônio encontrado para "${busca}"` : 'Nenhum patrimônio neste filtro.'}
            </div>
          ) : (
            <>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width:130 }}>Nº Patrimônio</th>
                    <th style={{ width:130 }}>Nº Série</th>
                    <th style={{ width:130 }}>Status</th>
                    <th style={{ width:120 }}>Aquisição</th>
                    <th style={{ width:110 }}>Custo Aquis.</th>
                    <th>Contrato Atual</th>
                    <th style={{ width:120 }}>Cliente</th>
                    <th style={{ width:120 }}>Devolução Prev.</th>
                  </tr>
                </thead>
                <tbody>
                  {patsPagina.map((pat: any) => {
                    const ci = (pat.contrato_itens ?? [])
                      .find((c: any) => ['ativo','em_devolucao','pendente_manutencao'].includes(c.contratos?.status))
                    const color = STATUS_COLOR[pat.status] ?? 'var(--t-muted)'
                    return (
                      <tr key={pat.id}>
                        <td className="tbl-mono" style={{ fontWeight:700 }}>
                          {pat.numero_patrimonio}
                        </td>
                        <td className="tbl-mono" style={{ color:'var(--t-muted)' }}>
                          {pat.numero_serie || '—'}
                        </td>
                        <td>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:6,
                            fontWeight:600, fontSize:'var(--fs-xs)',
                            padding:'4px 10px', borderRadius:99,
                            background: color + '18', color,
                          }}>
                            <span style={{ width:7, height:7, borderRadius:'50%',
                              background:color, flexShrink:0 }} />
                            {STATUS_LABEL[pat.status] ?? pat.status}
                          </span>
                        </td>
                        <td style={{ color:'var(--t-muted)', fontSize:'var(--fs-sm)' }}>
                          {pat.data_aquisicao
                            ? new Date(pat.data_aquisicao).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="tbl-mono" style={{ color:'var(--t-muted)', fontSize:'var(--fs-sm)' }}>
                          {pat.valor_aquisicao > 0 ? fmt.money(pat.valor_aquisicao) : '—'}
                        </td>
                        <td>
                          {ci ? (
                            <a href={`/contratos/${ci.contratos?.id}`} target="_blank" rel="noreferrer"
                              style={{ fontFamily:'var(--font-mono)', fontWeight:700,
                                color:'var(--c-primary)', textDecoration:'none',
                                display:'inline-flex', alignItems:'center', gap:4 }}>
                              {ci.contratos?.numero}
                              <span style={{ fontSize:10, opacity:.7 }}>↗</span>
                            </a>
                          ) : <span style={{ color:'var(--t-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)' }}>
                          {ci?.contratos?.clientes?.nome ?? '—'}
                        </td>
                        <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                          {ci?.contratos?.data_fim
                            ? new Date(ci.contratos.data_fim).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Paginação */}
              {totalPags > 1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 16px', borderTop:'1px solid var(--border)',
                  background:'var(--bg-header)' }}>
                  <span style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                    {patsFiltrados.length} patrimônio(s) · página {pagina} de {totalPags}
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
                      style={{ padding:'5px 14px', borderRadius:'var(--r-sm)',
                        border:'1px solid var(--border)', background:'var(--bg-card)',
                        cursor: pagina <= 1 ? 'not-allowed' : 'pointer',
                        color: pagina <= 1 ? 'var(--t-muted)' : 'var(--t-primary)',
                        fontSize:'var(--fs-sm)' }}>
                      ← Anterior
                    </button>
                    {Array.from({ length: Math.min(7, totalPags) }, (_, i) => {
                      const p = totalPags <= 7 ? i + 1
                        : Math.max(1, Math.min(totalPags - 6, pagina - 3)) + i
                      return (
                        <button key={p} onClick={() => setPagina(p)}
                          style={{ padding:'5px 12px', borderRadius:'var(--r-sm)',
                            fontSize:'var(--fs-sm)', cursor:'pointer', border:'1px solid',
                            borderColor: p === pagina ? 'var(--c-primary)' : 'var(--border)',
                            background:  p === pagina ? 'var(--c-primary)' : 'var(--bg-card)',
                            color:       p === pagina ? '#fff' : 'var(--t-primary)',
                            fontWeight:  p === pagina ? 700 : 400 }}>
                          {p}
                        </button>
                      )
                    })}
                    <button disabled={pagina >= totalPags} onClick={() => setPagina(p => p + 1)}
                      style={{ padding:'5px 14px', borderRadius:'var(--r-sm)',
                        border:'1px solid var(--border)', background:'var(--bg-card)',
                        cursor: pagina >= totalPags ? 'not-allowed' : 'pointer',
                        color: pagina >= totalPags ? 'var(--t-muted)' : 'var(--t-primary)',
                        fontSize:'var(--fs-sm)' }}>
                      Próximo →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ ABA: HISTÓRICO DE MOVIMENTAÇÕES ════════════════════════════════ */}
      {aba === 'historico' && (
        <div className="ds-card">
          {movs.length === 0 ? (
            <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t-muted)' }}>
              Nenhuma movimentação registrada ainda.
            </div>
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ width:160 }}>Data</th>
                  <th style={{ width:120 }}>Tipo</th>
                  <th style={{ width:100 }}>Quantidade</th>
                  <th>Observações</th>
                  <th style={{ width:130 }}>Nº Nota Fiscal</th>
                  <th style={{ width:110 }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m: any) => {
                  const isEntrada = m.tipo === 'entrada' || m.tipo === 'compra'
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                        {new Date(m.created_at).toLocaleDateString('pt-BR')}{' '}
                        <span style={{ opacity:.6 }}>
                          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          fontWeight:600, fontSize:'var(--fs-xs)',
                          padding:'3px 9px', borderRadius:99,
                          background: isEntrada ? '#dcfce718' : '#fee2e218',
                          color: isEntrada ? '#16a34a' : '#dc2626',
                        }}>
                          {isEntrada ? '📥' : '📤'} {m.tipo?.charAt(0).toUpperCase() + m.tipo?.slice(1)}
                        </span>
                      </td>
                      <td className="tbl-mono" style={{
                        fontWeight:700,
                        color: isEntrada ? '#16a34a' : '#dc2626',
                      }}>
                        {isEntrada ? '+' : '-'}{m.quantidade}
                      </td>
                      <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)' }}>
                        {m.observacoes || '—'}
                      </td>
                      <td className="tbl-mono" style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                        {m.numero_nota_fiscal || '—'}
                      </td>
                      <td className="tbl-mono" style={{ fontSize:'var(--fs-sm)' }}>
                        {m.valor > 0 ? fmt.money(m.valor) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ ABA: CONTRATOS ══════════════════════════════════════════════════ */}
      {aba === 'contratos' && (
        <div className="ds-card">
          {contratos.length === 0 ? (
            <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t-muted)' }}>
              Este equipamento ainda não foi utilizado em nenhum contrato.
            </div>
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ width:150 }}>Nº Contrato</th>
                  <th>Cliente</th>
                  <th style={{ width:120 }}>Status</th>
                  <th style={{ width:110 }}>Início</th>
                  <th style={{ width:110 }}>Término</th>
                  <th style={{ width:80, textAlign:'right' }}>Qtd</th>
                  <th style={{ width:120, textAlign:'right' }}>Valor Unit.</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((ci: any) => {
                  const c = ci.contratos
                  const statusColors: Record<string, string> = {
                    ativo:          'var(--c-success,#16a34a)',
                    rascunho:       'var(--t-muted)',
                    encerrado:      'var(--c-primary)',
                    cancelado:      'var(--c-danger)',
                    em_devolucao:   'var(--c-warning,#f59e0b)',
                  }
                  const sc = statusColors[c?.status] ?? 'var(--t-muted)'
                  return (
                    <tr key={ci.id}>
                      <td>
                        <a href={`/contratos/${c?.id}`} target="_blank" rel="noreferrer"
                          style={{ fontFamily:'var(--font-mono)', fontWeight:700,
                            color:'var(--c-primary)', textDecoration:'none',
                            display:'inline-flex', alignItems:'center', gap:4 }}>
                          {c?.numero ?? '—'}
                          <span style={{ fontSize:10, opacity:.7 }}>↗</span>
                        </a>
                      </td>
                      <td style={{ fontWeight:600, fontSize:'var(--fs-md)' }}>
                        {c?.clientes?.nome ?? '—'}
                      </td>
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          fontWeight:600, fontSize:'var(--fs-xs)',
                          padding:'3px 9px', borderRadius:99,
                          background: sc + '18', color: sc,
                        }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:sc }} />
                          {(c?.status ?? '—').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                        {c?.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                        {c?.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="tbl-mono" style={{ textAlign:'right', fontWeight:600 }}>
                        {ci.quantidade}
                      </td>
                      <td className="tbl-money" style={{ textAlign:'right' }}>
                        {fmt.money(ci.preco_unitario ?? 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ ABA: PREÇOS ═════════════════════════════════════════════════════ */}
      {aba === 'precos' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {precos.map(p => (
            <div key={p.l} style={{
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:'var(--r-md)', padding:'16px 18px',
              borderLeft: p.v > 0 ? '3px solid var(--c-primary)' : '3px solid var(--border)',
            }}>
              <div style={{ fontSize:'var(--fs-sm)', fontWeight:600, color:'var(--t-muted)',
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                {p.l}
              </div>
              <div style={{ fontSize:22, fontWeight:800,
                color: p.v > 0 ? 'var(--c-primary)' : 'var(--t-light)' }}>
                {p.v > 0 ? fmt.money(p.v) : '—'}
              </div>
              {p.v > 0 && p.d > 1 && (
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:4 }}>
                  {fmt.money(p.v / p.d)}/dia
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
