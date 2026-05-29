// build: 2026-05-29 17:55:15
'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { Btn } from '@/components/ui'

const PERIODOS = [
  { campo:'preco_locacao_diario',  label:'Diário'          },
  { campo:'preco_fds',             label:'Final de Semana' },
  { campo:'preco_locacao_semanal', label:'Semanal'         },
  { campo:'preco_quinzenal',       label:'Quinzenal'       },
  { campo:'preco_locacao_mensal',  label:'Mensal'          },
]

export default function CatalogoEquipamentosPage() {
  const [produtos,   setProdutos]   = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [catFiltro,  setCatFiltro]  = useState('')
  const [busca,      setBusca]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [soAtivos,   setSoAtivos]   = useState(true)
  const [soSite,     setSoSite]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('produtos')
      .select(`
        id, nome, codigo, marca, modelo, descricao, ativo,
        publicado_site, destaque_home, unidade,
        preco_locacao_diario, preco_fds, preco_locacao_semanal,
        preco_quinzenal, preco_locacao_mensal,
        categorias(nome),
        produto_fotos(url, principal)
      `)
      .order('nome')

    if (soAtivos) q = q.eq('ativo', 1)

    const { data } = await q
    setProdutos(data ?? [])

    const { data: cats } = await supabase
      .from('categorias').select('id,nome').order('nome')
    setCategorias(cats ?? [])
    setLoading(false)
  }, [soAtivos])

  useEffect(() => { load() }, [load])

  const filtrados = produtos.filter(p => {
    const catNome = Array.isArray(p.categorias) ? p.categorias[0]?.nome : p.categorias?.nome
    const okCat   = !catFiltro || catNome === catFiltro
    const okBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) ||
                    (p.codigo ?? '').toLowerCase().includes(busca.toLowerCase())
    const okSite  = !soSite || p.publicado_site
    return okCat && okBusca && okSite
  })

  function getPeriodosAtivos(p: any) {
    return PERIODOS.filter(per => Number(p[per.campo] ?? 0) > 0)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Header */}
      <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--t-primary)', margin:0 }}>
            📦 Catálogo de Equipamentos
          </h1>
          <div style={{ fontSize:13, color:'var(--t-muted)', marginTop:2 }}>
            {loading ? 'Carregando...' : `${filtrados.length} equipamento(s)`}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código..."
            style={{ padding:'7px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--border)',
              background:'var(--bg-input)', color:'var(--t-primary)', fontSize:13, width:220 }} />
          <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--border)',
              background:'var(--bg-input)', color:'var(--t-primary)', fontSize:13 }}>
            <option value="">Todas as categorias</option>
            {categorias.map((c:any) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--t-secondary)', cursor:'pointer' }}>
            <input type="checkbox" checked={soAtivos} onChange={e => setSoAtivos(e.target.checked)} />
            Só ativos
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--t-secondary)', cursor:'pointer' }}>
            <input type="checkbox" checked={soSite} onChange={e => setSoSite(e.target.checked)} />
            Publicados no site
          </label>
          <Btn onClick={() => window.print()} variant="secondary">🖨️ Imprimir</Btn>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--t-muted)' }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--t-muted)' }}>
            Nenhum equipamento encontrado.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
            {filtrados.map(p => {
              const fotos   = p.produto_fotos ?? []
              const foto    = fotos.find((f:any) => f.principal)?.url ?? fotos[0]?.url
              const catNome = Array.isArray(p.categorias) ? p.categorias[0]?.nome : p.categorias?.nome
              const perAtivos = getPeriodosAtivos(p)

              return (
                <div key={p.id} style={{
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:'var(--r-lg)', overflow:'hidden',
                  display:'flex', flexDirection:'column',
                }}>
                  {/* Foto */}
                  <div style={{ position:'relative', aspectRatio:'4/3',
                    background:'rgba(255,255,255,0.03)', overflow:'hidden' }}>
                    {foto
                      ? <img src={foto} alt={p.nome}
                          style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', display:'flex',
                          alignItems:'center', justifyContent:'center', fontSize:48, opacity:.2 }}>🔧</div>
                    }
                    <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:4 }}>
                      {p.publicado_site && (
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                          background:'rgba(99,102,241,0.85)', color:'#fff', fontWeight:700 }}>
                          🌐 Site
                        </span>
                      )}
                      {p.destaque_home && (
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                          background:'rgba(251,191,36,0.85)', color:'#000', fontWeight:700 }}>
                          ⭐
                        </span>
                      )}
                      {!p.ativo && (
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                          background:'rgba(248,113,113,0.85)', color:'#fff', fontWeight:700 }}>
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                    <div>
                      {catNome && (
                        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                          letterSpacing:'0.07em', color:'var(--c-primary)', marginBottom:3 }}>
                          {catNome}
                        </div>
                      )}
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--t-primary)', lineHeight:1.3 }}>
                        {p.nome}
                      </div>
                      {(p.codigo || p.marca) && (
                        <div style={{ fontSize:11, color:'var(--t-muted)', marginTop:2 }}>
                          {[p.codigo, p.marca, p.modelo].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {perAtivos.length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        {perAtivos.map(per => (
                          <div key={per.campo} style={{
                            background:'rgba(255,255,255,0.04)', borderRadius:6,
                            padding:'5px 8px', display:'flex',
                            justifyContent:'space-between', alignItems:'center',
                          }}>
                            <span style={{ fontSize:10, color:'var(--t-muted)' }}>{per.label}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--c-primary)' }}>
                              {fmt.money(Number(p[per.campo]))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {p.descricao && (
                      <div style={{ fontSize:11, color:'var(--t-muted)', lineHeight:1.5,
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
                        {p.descricao}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important }
          [style*="var(--bg-card)"] { background: white !important; border: 1px solid #ddd !important }
          [style*="var(--t-primary)"] { color: #111 !important }
          [style*="var(--t-muted)"] { color: #666 !important }
        }
      `}</style>
    </div>
  )
}
