// build: 2026-05-29 17:55:15
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { Btn, Badge, inputCls } from '@/components/ui'
import { calcularPrecoItem, calcularDias, type PrecosProduto } from '@/lib/calcularCobranca'

// ── Tipos ────────────────────────────────────────────────────────────────────
type Aba = 'inventario' | 'historico' | 'contratos' | 'precos' | 'acessorios' | 'internet'

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
  const [contratos,  setContratos]  = useState<any[]>([])
  const [acessorios, setAcessorios] = useState<any[]>([])
  const [formAcess,  setFormAcess]  = useState({ nome:'', descricao:'', quantidade:1, obrigatorio:true })
  const [salvandoAcc,setSalvandoAcc]= useState(false)
  const [erroAcc,    setErroAcc]    = useState('')

  // ── Campos de publicação no site ────────────────────────────────────────────
  const [siteData, setSiteData] = useState({
    publicado_site:  false,
    destaque_home:   false,
    slug:            '',
    titulo_site:     '',
    descricao_site:  '',
    seo_title:       '',
    seo_description: '',
    ordem_site:      0,
  })
  const [salvandoSite, setSalvandoSite] = useState(false)
  const [erroSite,     setErroSite]     = useState('')
  const [okSite,       setOkSite]       = useState(false)

  // ── Fotos (agora dentro da aba Internet) ─────────────────────────────────
  const [fotos,      setFotos]      = useState<any[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const searchParams = useSearchParams()
  const abaInicial = (searchParams.get('aba') as Aba) ?? 'inventario'
  const [aba, setAba] = useState<Aba>(abaInicial)

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
    // Carregar campos de publicação no site
    if (prod) {
      setSiteData({
        publicado_site:  prod.publicado_site  ?? false,
        destaque_home:   prod.destaque_home   ?? false,
        slug:            prod.slug            ?? '',
        titulo_site:     prod.titulo_site     ?? '',
        descricao_site:  prod.descricao_site  ?? '',
        seo_title:       prod.seo_title       ?? '',
        seo_description: prod.seo_description ?? '',
        ordem_site:      prod.ordem_site      ?? 0,
      })
    }
    // Carregar fotos
    const { data: fs } = await supabase.from('produto_fotos')
      .select('*').eq('produto_id', Number(id)).order('ordem')
    setFotos(fs ?? [])
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

  async function uploadFotoInternet(file: File) {
    setUploadando(true)
    const ext  = file.name.split('.').pop()
    const path = `produtos/${id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('produto-fotos').upload(path, file, { upsert: false })
    if (upErr) { alert('Erro no upload: ' + upErr.message); setUploadando(false); return }
    const { data: { publicUrl } } = supabase.storage.from('produto-fotos').getPublicUrl(path)
    const isPrimeira = fotos.length === 0
    await supabase.from('produto_fotos').insert({
      produto_id:    Number(id),
      url:           publicUrl,
      storage_path:  path,
      principal:     isPrimeira,
      ordem:         fotos.length,
    })
    const { data: fs } = await supabase.from('produto_fotos')
      .select('*').eq('produto_id', Number(id)).order('ordem')
    setFotos(fs ?? [])
    setUploadando(false)
  }

  async function excluirFotoInternet(foto: any) {
    if (!confirm('Excluir esta foto?')) return
    if (foto.storage_path) {
      await supabase.storage.from('produto-fotos').remove([foto.storage_path])
    }
    await supabase.from('produto_fotos').delete().eq('id', foto.id)
    const restantes = fotos.filter(f => f.id !== foto.id)
    if (foto.principal && restantes.length > 0) {
      await supabase.from('produto_fotos').update({ principal: true }).eq('id', restantes[0].id)
    }
    const { data: fs } = await supabase.from('produto_fotos')
      .select('*').eq('produto_id', Number(id)).order('ordem')
    setFotos(fs ?? [])
  }

  async function marcarPrincipalInternet(foto: any) {
    await supabase.from('produto_fotos').update({ principal: false }).eq('produto_id', Number(id))
    await supabase.from('produto_fotos').update({ principal: true }).eq('id', foto.id)
    const { data: fs } = await supabase.from('produto_fotos')
      .select('*').eq('produto_id', Number(id)).order('ordem')
    setFotos(fs ?? [])
  }

  async function salvarSite() {
    setSalvandoSite(true); setErroSite(''); setOkSite(false)
    let slug = siteData.slug.trim()
    if (!slug && siteData.titulo_site.trim()) {
      slug = siteData.titulo_site.trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
    }
    const { error } = await supabase.from('produtos').update({
      publicado_site:  siteData.publicado_site,
      destaque_home:   siteData.destaque_home,
      slug:            slug || null,
      titulo_site:     siteData.titulo_site.trim() || null,
      descricao_site:  siteData.descricao_site.trim() || null,
      seo_title:       siteData.seo_title.trim() || null,
      seo_description: siteData.seo_description.trim() || null,
      ordem_site:      Number(siteData.ordem_site) || 0,
    }).eq('id', Number(id))
    if (error) { setErroSite(error.message); setSalvandoSite(false); return }
    if (slug) setSiteData(s => ({ ...s, slug }))
    setOkSite(true)
    setSalvandoSite(false)
    setTimeout(() => setOkSite(false), 3000)
  }


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
          ['acessorios', `🔩 Acessórios (${acessorios.length})`],
          ['internet',   `🌐 Internet (${fotos.length > 0 ? fotos.length + ' foto' + (fotos.length>1?'s':'') + ' · ' : ''}site)`],
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


      {/* ── ABA: ACESSÓRIOS ─────────────────────────────────────────────── */}
      {aba === 'acessorios' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Formulário novo acessório */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
            borderRadius:'var(--r-lg)', padding:16 }}>
            <div style={{ fontWeight:600, marginBottom:12, color:'var(--t-secondary)' }}>
              + Adicionar Acessório
            </div>
            {erroAcc && <div className="ds-alert-error" style={{marginBottom:10}}>{erroAcc}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 120px auto', gap:8, alignItems:'end' }}>
              <div>
                <div className="ds-label">Nome do acessório *</div>
                <input className="ds-input" value={formAcess.nome}
                  onChange={e=>setFormAcess(f=>({...f,nome:e.target.value}))}
                  placeholder="Ex: Bateria, Carregador, Maleta..." />
              </div>
              <div>
                <div className="ds-label">Quantidade</div>
                <input type="number" min="1" className="ds-input" value={formAcess.quantidade}
                  onChange={e=>setFormAcess(f=>({...f,quantidade:Number(e.target.value)}))} />
              </div>
              <div>
                <div className="ds-label">Obrigatório</div>
                <select className="ds-select" value={formAcess.obrigatorio?'1':'0'}
                  onChange={e=>setFormAcess(f=>({...f,obrigatorio:e.target.value==='1'}))}>
                  <option value="1">Sim</option>
                  <option value="0">Não</option>
                </select>
              </div>
              <button
                onClick={async()=>{
                  if(!formAcess.nome.trim()){setErroAcc('Informe o nome.');return}
                  setSalvandoAcc(true);setErroAcc('')
                  const{error}=await supabase.from('produto_acessorios').insert({
                    produto_id:  Number(id),
                    nome:        formAcess.nome.trim(),
                    quantidade:  formAcess.quantidade,
                    obrigatorio: formAcess.obrigatorio,
                    ativo:       1,
                  })
                  if(error){setErroAcc(error.message);setSalvandoAcc(false);return}
                  setFormAcess({nome:'',descricao:'',quantidade:1,obrigatorio:true})
                  const{data}=await supabase.from('produto_acessorios')
                    .select('*').eq('produto_id',Number(id)).eq('ativo',1).order('id')
                  setAcessorios(data??[])
                  setSalvandoAcc(false)
                }}
                disabled={salvandoAcc}
                style={{ padding:'8px 16px', borderRadius:'var(--r-md)',
                  background:'linear-gradient(135deg,#6366f1,#818cf8)',
                  border:'none', color:'#fff', fontWeight:600, cursor:'pointer',
                  fontSize:'var(--fs-md)', fontFamily:'var(--font-sans)' }}>
                {salvandoAcc ? '...' : '+ Adicionar'}
              </button>
            </div>
          </div>

          {/* Lista de acessórios */}
          {acessorios.length === 0 ? (
            <div className="ds-empty">
              <div className="ds-empty-icon">🔩</div>
              <div className="ds-empty-title">Nenhum acessório cadastrado.</div>
              <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginTop:4}}>
                Acessórios aparecem automaticamente no contrato de locação junto com este equipamento.
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:'var(--r-lg)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.03)' }}>
                    {['Acessório','Qtd','Obrigatório',''].map(h=>(
                      <th key={h} style={{ padding:'8px 14px', textAlign:'left',
                        fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--t-muted)',
                        textTransform:'uppercase', letterSpacing:'.05em',
                        borderBottom:'1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {acessorios.map(a=>(
                    <tr key={a.id}
                      style={{ borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(129,140,248,0.06)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--t-primary)' }}>
                        {a.nome}
                      </td>
                      <td style={{ padding:'10px 14px', color:'var(--t-secondary)' }}>
                        {a.quantidade}x
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{
                          padding:'2px 8px', borderRadius:99, fontSize:'var(--fs-xs)', fontWeight:600,
                          background: a.obrigatorio ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.12)',
                          color: a.obrigatorio ? '#34d399' : '#94a3b8',
                        }}>{a.obrigatorio ? 'Obrigatório' : 'Opcional'}</span>
                      </td>
                      <td style={{ padding:'8px 12px', textAlign:'right' }}>
                        <button
                          onClick={async()=>{
                            if(!confirm(`Remover "${a.nome}"?`)) return
                            await supabase.from('produto_acessorios').update({ativo:0}).eq('id',a.id)
                            setAcessorios(prev=>prev.filter(x=>x.id!==a.id))
                          }}
                          className="tbl-btn del" title="Remover">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding:'8px 14px', fontSize:'var(--fs-xs)', color:'var(--t-muted)',
                borderTop:'1px solid var(--border)', background:'rgba(255,255,255,0.02)' }}>
                🔩 {acessorios.length} acessório(s) — aparecem automaticamente no contrato de locação
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── ABA: PUBLICAÇÃO NO SITE ─────────────────────────────────────── */}
      {aba === 'internet' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>


          {/* ── FOTOS ──────────────────────────────────────────────────────── */}
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--t-primary)', marginBottom:16 }}>🖼️ Fotos do Equipamento</div>
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--r-lg)',
              padding:'20px', textAlign:'center', cursor:'pointer', transition:'all .15s',
              background: uploadando ? 'var(--bg-header)' : 'var(--bg-card)', marginBottom:16 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) uploadFotoInternet(f) }}
              onClick={() => document.getElementById('foto-input-internet')?.click()}>
              <input id="foto-input-internet" type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => { const f=e.target.files?.[0]; if(f) uploadFotoInternet(f); e.currentTarget.value='' }} />
              {uploadando
                ? <div style={{ color:'var(--t-muted)' }}>Enviando...</div>
                : <div>
                    <div style={{ fontSize:28, marginBottom:6 }}>🖼️</div>
                    <div style={{ fontWeight:600, fontSize:'var(--fs-base)', color:'var(--t-primary)', marginBottom:2 }}>Clique ou arraste aqui</div>
                    <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>JPG, PNG, WEBP — máx. 5MB</div>
                  </div>
              }
            </div>
            {fotos.length === 0
              ? <div style={{ textAlign:'center', padding:'12px', color:'var(--t-muted)' }}>Nenhuma foto cadastrada.</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {fotos.map((foto:any) => (
                    <div key={foto.id} style={{ position:'relative', borderRadius:'var(--r-md)',
                      overflow:'hidden', border: foto.principal ? '2px solid var(--c-primary)' : '1px solid var(--border)',
                      aspectRatio:'4/3', background:'var(--bg-header)' }}>
                      <img src={foto.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      {foto.principal && (
                        <div style={{ position:'absolute', top:4, left:4, padding:'1px 6px',
                          background:'var(--c-primary)', color:'#fff', borderRadius:99, fontSize:10, fontWeight:700 }}>★ Principal</div>
                      )}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0,
                        background:'rgba(0,0,0,0.6)', display:'flex', gap:4, padding:'5px 6px' }}>
                        {!foto.principal && (
                          <button onClick={() => marcarPrincipalInternet(foto)}
                            style={{ flex:1, padding:'3px', borderRadius:'var(--r-sm)', border:'none',
                              background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:10, cursor:'pointer', fontWeight:600 }}>
                            ★ Principal
                          </button>
                        )}
                        <button onClick={() => excluirFotoInternet(foto)}
                          style={{ padding:'3px 7px', borderRadius:'var(--r-sm)', border:'none',
                            background:'rgba(220,38,38,0.7)', color:'#fff', fontSize:10, cursor:'pointer' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Status de publicação */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Publicar no site */}
            <div style={{ background:'var(--bg-card)', border:`2px solid ${siteData.publicado_site ? 'rgba(52,211,153,0.5)' : 'var(--border)'}`, borderRadius:'var(--r-lg)', padding:20, cursor:'pointer', transition:'all .2s' }}
              onClick={() => setSiteData(s => ({ ...s, publicado_site: !s.publicado_site }))}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:24 }}>🌐</div>
                <div style={{
                  width:44, height:24, borderRadius:12, position:'relative', transition:'all .2s',
                  background: siteData.publicado_site ? 'var(--c-success)' : 'rgba(255,255,255,0.15)',
                }}>
                  <div style={{
                    position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'all .2s',
                    left: siteData.publicado_site ? 23 : 3,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
              <div style={{ fontWeight:700, color:'var(--t-primary)', fontSize:'var(--fs-base)' }}>Publicar no Site</div>
              <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:4 }}>
                {siteData.publicado_site ? '✅ Visível no catálogo público' : '⏸️ Oculto no site'}
              </div>
            </div>

            {/* Destaque na home */}
            <div style={{ background:'var(--bg-card)', border:`2px solid ${siteData.destaque_home ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`, borderRadius:'var(--r-lg)', padding:20, cursor:'pointer', transition:'all .2s' }}
              onClick={() => setSiteData(s => ({ ...s, destaque_home: !s.destaque_home }))}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:24 }}>⭐</div>
                <div style={{
                  width:44, height:24, borderRadius:12, position:'relative', transition:'all .2s',
                  background: siteData.destaque_home ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                }}>
                  <div style={{
                    position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'all .2s',
                    left: siteData.destaque_home ? 23 : 3,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
              <div style={{ fontWeight:700, color:'var(--t-primary)', fontSize:'var(--fs-base)' }}>Destaque na Home</div>
              <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:4 }}>
                {siteData.destaque_home ? '⭐ Aparece nos destaques da home' : '○ Não aparece nos destaques'}
              </div>
            </div>
          </div>

          {/* Dados de publicação */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--t-primary)', marginBottom:16 }}>📝 Dados de Publicação</div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:12 }}>
                <div>
                  <div className="ds-label">Título no site</div>
                  <input className="ds-input" value={siteData.titulo_site}
                    onChange={e => setSiteData(s => ({ ...s, titulo_site: e.target.value }))}
                    placeholder={produto?.nome ?? 'Nome público do equipamento'} />
                  <div style={{ fontSize:11, color:'var(--t-muted)', marginTop:4 }}>Se vazio, usa o nome do cadastro</div>
                </div>
                <div>
                  <div className="ds-label">Ordem</div>
                  <input type="number" className="ds-input" value={siteData.ordem_site}
                    onChange={e => setSiteData(s => ({ ...s, ordem_site: Number(e.target.value) }))}
                    placeholder="0" min={0} />
                  <div style={{ fontSize:11, color:'var(--t-muted)', marginTop:4 }}>Menor = primeiro</div>
                </div>
              </div>

              <div>
                <div className="ds-label">Slug (URL amigável)</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', whiteSpace:'nowrap' }}>
                    /equipamentos/
                  </span>
                  <input className="ds-input" value={siteData.slug}
                    onChange={e => setSiteData(s => ({ ...s, slug: e.target.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') }))}
                    placeholder="andaime-tubular-1m" />
                </div>
                <div style={{ fontSize:11, color:'var(--t-muted)', marginTop:4 }}>Gerado automaticamente se vazio</div>
              </div>

              <div>
                <div className="ds-label">Descrição para o site</div>
                <textarea className="ds-textarea" value={siteData.descricao_site}
                  onChange={e => setSiteData(s => ({ ...s, descricao_site: e.target.value }))}
                  rows={3}
                  placeholder="Descrição que aparece para o cliente final no site. Pode ser diferente da descrição interna." />
              </div>
            </div>
          </div>

          {/* SEO */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 24px' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--t-primary)', marginBottom:4 }}>🔍 SEO — Google</div>
            <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginBottom:16 }}>Controla como o equipamento aparece nos resultados de busca</div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                  <span className="ds-label" style={{ margin:0 }}>Título SEO</span>
                  <span style={{ fontSize:11, color: siteData.seo_title.length > 60 ? 'var(--c-danger)' : 'var(--t-muted)' }}>
                    {siteData.seo_title.length}/60
                  </span>
                </div>
                <input className="ds-input" value={siteData.seo_title} maxLength={70}
                  onChange={e => setSiteData(s => ({ ...s, seo_title: e.target.value }))}
                  placeholder={`${produto?.nome ?? 'Equipamento'} — Locação em Sapucaia do Sul | Kanoff Soluções`} />
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                  <span className="ds-label" style={{ margin:0 }}>Meta Description</span>
                  <span style={{ fontSize:11, color: siteData.seo_description.length > 160 ? 'var(--c-danger)' : 'var(--t-muted)' }}>
                    {siteData.seo_description.length}/160
                  </span>
                </div>
                <textarea className="ds-textarea" value={siteData.seo_description} maxLength={170} rows={2}
                  onChange={e => setSiteData(s => ({ ...s, seo_description: e.target.value }))}
                  placeholder={`Alugue ${produto?.nome ?? 'equipamento'} na Kanoff Soluções. Cotação online rápida, entrega e retirada em Sapucaia do Sul e região.`} />
              </div>

              {/* Preview Google */}
              {(siteData.seo_title || siteData.seo_description) && (
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'var(--r-md)', padding:'12px 16px' }}>
                  <div style={{ fontSize:11, color:'var(--t-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Preview Google</div>
                  <div style={{ fontSize:13, color:'#8ab4f8', marginBottom:2 }}>
                    {siteData.seo_title || (produto?.nome ?? 'Título do equipamento')}
                  </div>
                  <div style={{ fontSize:11, color:'#34a853' }}>
                    kanoffsolucoes.com.br/equipamentos/{siteData.slug || 'slug'}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.5 }}>
                    {siteData.seo_description || 'Meta description aparecerá aqui...'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Salvar */}
          {erroSite && <div className="ds-alert-error">{erroSite}</div>}
          {okSite && (
            <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:'var(--r-md)', padding:'10px 16px', fontSize:'var(--fs-md)', color:'#34d399' }}>
              ✅ Configurações do site salvas com sucesso!
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={salvarSite} disabled={salvandoSite}
              style={{ padding:'10px 28px', borderRadius:'var(--r-md)', border:'none',
                background: salvandoSite ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                color:'#fff', fontSize:'var(--fs-md)', fontWeight:700, cursor:'pointer',
                fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:8,
                opacity: salvandoSite ? .7 : 1 }}>
              {salvandoSite ? 'Salvando...' : '🌐 Salvar Configurações do Site'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
