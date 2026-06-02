// build: 2026-06-02
'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PageHeader, Btn, Filters } from '@/components/ui'

const STATUS_MAP: Record<string, { label:string; cls:string }> = {
  rascunho:   { label:'Rascunho',   cls:'ds-badge ds-badge-gray'   },
  em_analise: { label:'Em Análise', cls:'ds-badge ds-badge-yellow' },
  aguardando: { label:'Aguardando', cls:'ds-badge ds-badge-blue'   },
  aprovada:   { label:'Aprovada',   cls:'ds-badge ds-badge-green'  },
  recusada:   { label:'Recusada',   cls:'ds-badge ds-badge-red'    },
  expirada:   { label:'Expirada',   cls:'ds-badge ds-badge-gray'   },
  convertida: { label:'Convertida', cls:'ds-badge ds-badge-blue'   },
}
function StatusBadge({ s }: { s: string }) {
  const { cls, label } = STATUS_MAP[s] ?? { cls:'ds-badge ds-badge-gray', label:s }
  return <span className={cls}><span className="ds-badge-dot"/>{label}</span>
}

export default function CotacoesPage() {
  const router = useRouter()

  const [lista,     setLista]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [totais,    setTotais]    = useState({ em_analise:0, aguardando:0, aprovadas:0, valor_pipeline:0 })
  const [novasSite, setNovasSite] = useState(0)
  const [filters,   setFilters]   = useState({ busca:'', status:'' })

  const load = useCallback(async () => {
    setLoading(true)

    const { data: todas } = await supabase.from('cotacoes').select('status,total,origem')
    const lt = todas ?? []
    setTotais({
      em_analise:   lt.filter(c => ['rascunho','em_analise'].includes(c.status)).length,
      aguardando:   lt.filter(c => c.status === 'aguardando').length,
      aprovadas:    lt.filter(c => c.status === 'aprovada').length,
      valor_pipeline: lt.filter(c => ['em_analise','aguardando','aprovada'].includes(c.status))
        .reduce((s, c) => s + Number(c.total ?? 0), 0),
    })
    setNovasSite(lt.filter(c => c.origem === 'site' && ['em_analise','aguardando'].includes(c.status)).length)

    let q = supabase.from('cotacoes')
      .select('id,numero,status,origem,data_emissao,data_validade,total,contrato_id,visualizacoes,periodo_nome,clientes(nome),usuarios(nome)')
      .order('created_at', { ascending: false })
      .limit(300)

    if (filters.status) q = q.eq('status', filters.status)
    if (filters.busca)  q = q.or(`numero.ilike.%${filters.busca}%`)

    const { data } = await q
    let resultado = data ?? []

    if (filters.busca) {
      const b = filters.busca.toLowerCase()
      resultado = resultado.filter(c =>
        c.numero?.toLowerCase().includes(b) ||
        (c.clientes as any)?.nome?.toLowerCase().includes(b)
      )
    }

    setLista(resultado)
    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <PageHeader
        title="Cotações"
        subtitle={novasSite > 0 ? `🌐 ${novasSite} nova${novasSite > 1 ? 's' : ''} do site aguardando análise` : undefined}
        actions={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" size="sm" onClick={() => router.push('/cotacoes/rapida')}>⚡ Cotação Rápida</Btn>
            <Btn onClick={() => router.push('/cotacoes/criar')}>+ Nova Cotação</Btn>
          </div>
        }
      />

      {/* KPIs — apenas 4 essenciais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Em Análise',   value: totais.em_analise,  accent:'#fbbf24', status:'em_analise' },
          { label:'Aguardando',   value: totais.aguardando,  accent:'#818cf8', status:'aguardando' },
          { label:'Aprovadas',    value: totais.aprovadas,   accent:'#34d399', status:'aprovada'   },
          { label:'Pipeline (R$)', value: fmt.money(totais.valor_pipeline), accent:'#0ea5e9'       },
        ].map(k => (
          <div key={k.label}
            onClick={() => k.status && setFilters(f => ({ ...f, status: f.status === k.status ? '' : k.status! }))}
            style={{ background:'var(--bg-card)', border:`1px solid ${filters.status === k.status ? k.accent : 'var(--border)'}`, borderTop:`3px solid ${k.accent}`, borderRadius:'var(--r-md)', padding:'12px 16px', cursor: k.status ? 'pointer' : 'default', transition:'all 0.15s' }}>
            <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--t-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color: Number(k.value) === 0 ? 'var(--t-muted)' : k.accent, lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Filters
        fields={[
          { type:'text',   key:'busca',  placeholder:'Buscar por número ou cliente...', flex:'1' },
          { type:'select', key:'status', placeholder:'Todos os status', width:'180px',
            options: Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value:v, label })) },
        ]}
        values={filters}
        onChange={(k, v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca:'', status:'' })}
      />

      {/* Tabela */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Vendedor</th>
              <th>Emissão</th>
              <th>Validade</th>
              <th style={{ textAlign:'right' }}>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8}>
                <div className="ds-empty"><div className="ds-empty-title">Carregando...</div></div>
              </td></tr>
            )}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={8}>
                <div className="ds-empty">
                  <div className="ds-empty-icon">📋</div>
                  <div className="ds-empty-title">Nenhuma cotação encontrada</div>
                  {(filters.busca || filters.status) && (
                    <button className="ds-empty-action" onClick={() => setFilters({ busca:'', status:'' })}>Limpar filtros</button>
                  )}
                </div>
              </td></tr>
            )}
            {!loading && lista.map((row, i) => {
              const vencida = ['em_analise','aguardando','rascunho'].includes(row.status) && row.data_validade < hoje
              return (
                <tr key={row.id}
                  style={{ background: i%2===0 ? 'var(--bg-card)' : 'var(--bg-header)', cursor:'pointer' }}
                  onClick={() => router.push(`/cotacoes/${row.id}`)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i%2===0 ? 'var(--bg-card)' : 'var(--bg-header)'}>
                  <td style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--c-primary)' }}>
                    {row.numero}
                    {row.origem === 'site' && (
                      <span style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3, background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.35)', color:'#fbbf24', verticalAlign:'middle' }}>
                        SITE
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight:500, color:'var(--t-primary)' }}>
                    {(row.clientes as any)?.nome ?? '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <StatusBadge s={row.status} />
                      {vencida && <span style={{ fontSize:10, color:'#f87171', fontWeight:700 }}>VENCIDA</span>}
                    </div>
                  </td>
                  <td style={{ color:'var(--t-muted)', fontSize:'var(--fs-md)' }}>
                    {(row.usuarios as any)?.nome ?? '—'}
                  </td>
                  <td style={{ color:'var(--t-muted)', fontSize:'var(--fs-md)', whiteSpace:'nowrap' }}>
                    {fmt.date(row.data_emissao)}
                  </td>
                  <td style={{ color: vencida ? '#f87171' : 'var(--t-muted)', fontSize:'var(--fs-md)', whiteSpace:'nowrap' }}>
                    {fmt.date(row.data_validade)}
                  </td>
                  <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--t-primary)' }}>
                    {fmt.money(row.total)}
                  </td>
                  <td style={{ width:28 }}>
                    <span style={{ color:'var(--t-muted)', fontSize:14 }}>›</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
