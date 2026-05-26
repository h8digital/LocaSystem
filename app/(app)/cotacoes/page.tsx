'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PageHeader, Badge, ActionButtons, Btn } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label:string; cls:string; accent:string }> = {
  rascunho:   { label:'Rascunho',   cls:'ds-badge ds-badge-gray',   accent:'#94a3b8' },
  aguardando: { label:'Aguardando', cls:'ds-badge ds-badge-yellow', accent:'#fbbf24' },
  aprovada:   { label:'Aprovada',   cls:'ds-badge ds-badge-green',  accent:'#34d399' },
  recusada:   { label:'Recusada',   cls:'ds-badge ds-badge-red',    accent:'#f87171' },
  expirada:   { label:'Expirada',   cls:'ds-badge ds-badge-gray',   accent:'#64748b' },
  convertida: { label:'Convertida', cls:'ds-badge ds-badge-blue',   accent:'#818cf8' },
}

function StatusBadge({ s }: { s: string }) {
  const info = STATUS_MAP[s] ?? { label: s, cls:'ds-badge ds-badge-gray', accent:'#94a3b8' }
  return <span className={info.cls}><span className="ds-badge-dot"/>{info.label}</span>
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function Kpi({ label, value, accent, sub, onClick }: { label:string; value:string|number; accent:string; sub?:string; onClick?:()=>void }) {
  const zero = String(value) === '0' || value === 'R$ 0,00'
  return (
    <div onClick={onClick}
      style={{
        background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderTop:`2px solid ${accent}`,
        borderRadius:'var(--r-lg)', padding:'14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition:'all .2s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.4)',
        textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:600, lineHeight:1,
        color: zero ? 'rgba(255,255,255,0.22)' : accent }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CotacoesPage() {
  const router = useRouter()

  const [lista,   setLista]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis,    setKpis]    = useState({
    total:0, rascunho:0, aguardando:0, aprovadas:0,
    recusadas:0, convertidas:0, expiradas:0,
    vencidas:0, valor_aprovado:0, valor_aguardando:0,
  })

  // Filtros
  const [fBusca,       setFBusca]      = useState('')
  const [fStatus,      setFStatus]     = useState('')
  const [fCliente,     setFCliente]    = useState('')
  const [fVendedor,    setFVendedor]   = useState('')
  const [fEmissaoDe,   setFEmissaoDe]  = useState('')
  const [fEmissaoAte,  setFEmissaoAte] = useState('')
  const [fValidDe,     setFValidDe]    = useState('')
  const [fValidAte,    setFValidAte]   = useState('')

  const [novasSite, setNovasSite] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const hoje = new Date().toISOString().split('T')[0]

    // KPIs — sem filtros
    const { data: todas } = await supabase.from('cotacoes')
      .select('status, total, data_validade, origem')
    const lt = todas ?? []
    setKpis({
      total:          lt.length,
      rascunho:       lt.filter(c => c.status === 'rascunho').length,
      aguardando:     lt.filter(c => c.status === 'aguardando').length,
      aprovadas:      lt.filter(c => c.status === 'aprovada').length,
      recusadas:      lt.filter(c => c.status === 'recusada').length,
      convertidas:    lt.filter(c => c.status === 'convertida').length,
      expiradas:      lt.filter(c => c.status === 'expirada').length,
      vencidas:       lt.filter(c => ['rascunho','aguardando'].includes(c.status) && c.data_validade < hoje).length,
      valor_aprovado: lt.filter(c => c.status === 'aprovada').reduce((s,c) => s + Number(c.total ?? 0), 0),
      valor_aguardando: lt.filter(c => c.status === 'aguardando').reduce((s,c) => s + Number(c.total ?? 0), 0),
    })
    setNovasSite(lt.filter((cotItem: any) => cotItem.origem === 'site' && cotItem.status === 'aguardando').length)

    // Tabela — com filtros
    let q = supabase.from('cotacoes')
      .select('id,numero,status,data_emissao,data_validade,data_inicio,data_fim,total,contrato_id,visualizacoes,clientes(nome),usuarios(nome),periodos_locacao(nome)')
      .order('created_at', { ascending: false })

    if (fStatus)     q = q.eq('status', fStatus)
    if (fEmissaoDe)  q = q.gte('data_emissao', fEmissaoDe)
    if (fEmissaoAte) q = q.lte('data_emissao', fEmissaoAte)
    if (fValidDe)    q = q.gte('data_validade', fValidDe)
    if (fValidAte)   q = q.lte('data_validade', fValidAte)
    if (fBusca)      q = q.ilike('numero', `%${fBusca}%`)

    const { data } = await q.limit(300)
    let resultado = data ?? []

    // Filtro client-side por cliente e vendedor (campos relacionados)
    if (fCliente) {
      resultado = resultado.filter(c =>
        (c.clientes as any)?.nome?.toLowerCase().includes(fCliente.toLowerCase())
      )
    }
    if (fVendedor) {
      resultado = resultado.filter(c =>
        (c.usuarios as any)?.nome?.toLowerCase().includes(fVendedor.toLowerCase())
      )
    }

    setLista(resultado)
    setLoading(false)
  }, [fBusca, fStatus, fCliente, fVendedor, fEmissaoDe, fEmissaoAte, fValidDe, fValidAte])

  useEffect(() => { load() }, [load])

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function excluir(id: number) {
    if (!confirm('Excluir esta cotação?')) return
    await supabase.from('cotacao_itens').delete().eq('cotacao_id', id)
    await supabase.from('cotacoes').delete().eq('id', id)
    load()
  }

  async function enviarCliente(row: any) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2,'0')).join('')
    await supabase.from('cotacoes').update({
      status: 'aguardando', token_aprovacao: token, updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    const link = `${window.location.origin}/cotacao/${token}`
    await navigator.clipboard.writeText(link)
    alert(`✅ Link copiado!\n\n${link}`)
    load()
  }

  async function converter(row: any) {
    if (!confirm(`Converter cotação ${row.numero} em contrato?`)) return
    const r = await fetch('/api/cotacoes/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotacao_id: row.id }),
    })
    const d = await r.json()
    if (d.error) { alert('Erro: ' + d.error); return }
    if (confirm(`✅ Contrato ${d.numero} criado! Deseja abri-lo?`))
      router.push(`/contratos/${d.contrato_id}`)
    else load()
  }

  function limparFiltros() {
    setFBusca(''); setFStatus(''); setFCliente(''); setFVendedor('')
    setFEmissaoDe(''); setFEmissaoAte(''); setFValidDe(''); setFValidAte('')
  }

  const hoje = new Date().toISOString().split('T')[0]

  const Th = ({ children, right }: any) => (
    <th style={{ padding:'8px 14px', textAlign: right?'right':'left',
      fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.38)',
      textTransform:'uppercase', letterSpacing:'0.05em',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      background:'rgba(255,255,255,0.03)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  )
  const Td = ({ children, right, mono, muted }: any) => (
    <td style={{ padding:'10px 14px', textAlign:right?'right':'left',
      fontFamily:mono?'var(--font-mono)':undefined,
      color:muted?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.82)',
      borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      {children}
    </td>
  )

  const Label = ({ children }: any) => (
    <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)',
      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5, fontWeight:600 }}>
      {children}
    </div>
  )

  const inputStyle = { width:'100%', background:'rgba(255,255,255,0.07)',
    border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-md)',
    padding:'7px 10px', fontSize:'var(--fs-md)', color:'rgba(255,255,255,0.88)',
    fontFamily:'var(--font-sans)', outline:'none', colorScheme:'dark' as const }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      <PageHeader title="📋 Cotações" subtitle={
          novasSite > 0
            ? `Propostas comerciais — 🌐 ${novasSite} nova${novasSite > 1 ? 's' : ''} do site aguardando resposta`
            : 'Propostas comerciais para clientes'
        }
        actions={<div style={{display:'flex',gap:8}}>
          <button onClick={() => router.push('/cotacoes/rapida')}
            style={{ padding:'7px 14px', borderRadius:'var(--r-md)',
              border:'1px solid rgba(129,140,248,0.35)', background:'rgba(129,140,248,0.12)',
              color:'#a5b4fc', fontSize:'var(--fs-md)', fontWeight:500,
              cursor:'pointer', fontFamily:'var(--font-sans)',
              display:'flex', alignItems:'center', gap:6 }}>
            ⚡ Cotação Rápida
          </button>
          <Btn onClick={() => router.push('/cotacoes/criar')}>+ Nova Cotação</Btn>
        </div>} />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        <Kpi label="Total"        value={kpis.total}              accent="#94a3b8" />
        <Kpi label="Aguardando"   value={kpis.aguardando}         accent="#fbbf24"
          sub={kpis.valor_aguardando > 0 ? fmt.money(kpis.valor_aguardando) : undefined}
          onClick={() => { setFStatus('aguardando') }} />
        <Kpi label="Aprovadas"    value={kpis.aprovadas}          accent="#34d399"
          sub={kpis.valor_aprovado > 0 ? fmt.money(kpis.valor_aprovado) : undefined}
          onClick={() => { setFStatus('aprovada') }} />
        <Kpi label="Convertidas"  value={kpis.convertidas}        accent="#818cf8"
          onClick={() => { setFStatus('convertida') }} />
        <Kpi label="Validade Vencida" value={kpis.vencidas}       accent="#f87171"
          sub={kpis.vencidas > 0 ? 'cotação(ões) expirada(s)' : undefined} />
      </div>

      {/* Linha 2 de KPIs: menor */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        <Kpi label="Rascunho"   value={kpis.rascunho}   accent="#64748b"
          onClick={() => setFStatus('rascunho')} />
        <Kpi label="Recusadas"  value={kpis.recusadas}  accent="#f87171"
          onClick={() => setFStatus('recusada')} />
        <Kpi label="Expiradas"  value={kpis.expiradas}  accent="#475569"
          onClick={() => setFStatus('expirada')} />
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:'var(--r-lg)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.25)', textAlign:'center', lineHeight:1.5 }}>
            Clique num KPI<br/>para filtrar
          </span>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'14px 16px' }}>

        {/* Linha 1 */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end', marginBottom:10 }}>

          <div style={{ flex:'0 1 160px' }}>
            <Label>Número</Label>
            <input value={fBusca} onChange={e=>setFBusca(e.target.value)}
              style={inputStyle} placeholder="Ex: COT2026..." />
          </div>

          <div style={{ flex:'0 1 150px' }}>
            <Label>Status</Label>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)}
              style={{ ...inputStyle }}>
              <option value="">Todos</option>
              {Object.entries(STATUS_MAP).map(([v,i]) => (
                <option key={v} value={v}>{i.label}</option>
              ))}
            </select>
          </div>

          <div style={{ flex:'1 1 180px', minWidth:150 }}>
            <Label>Cliente</Label>
            <input value={fCliente} onChange={e=>setFCliente(e.target.value)}
              style={inputStyle} placeholder="Nome do cliente..." />
          </div>

          <div style={{ flex:'1 1 160px', minWidth:140 }}>
            <Label>Vendedor</Label>
            <input value={fVendedor} onChange={e=>setFVendedor(e.target.value)}
              style={inputStyle} placeholder="Nome do vendedor..." />
          </div>

        </div>

        {/* Linha 2 */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>

          <div style={{ flex:'0 1 130px' }}>
            <Label>Emissão de</Label>
            <input type="date" value={fEmissaoDe} onChange={e=>setFEmissaoDe(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <Label>Emissão até</Label>
            <input type="date" value={fEmissaoAte} onChange={e=>setFEmissaoAte(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <Label>Validade de</Label>
            <input type="date" value={fValidDe} onChange={e=>setFValidDe(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <Label>Validade até</Label>
            <input type="date" value={fValidAte} onChange={e=>setFValidAte(e.target.value)} style={inputStyle} />
          </div>

          <button onClick={limparFiltros}
            style={{ alignSelf:'flex-end', padding:'7px 14px', borderRadius:'var(--r-md)',
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
              color:'rgba(255,255,255,0.6)', fontSize:'var(--fs-md)', cursor:'pointer',
              fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
            ✕ Limpar
          </button>

        </div>

        {!loading && (
          <div style={{ marginTop:10, fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.3)' }}>
            {lista.length} resultado(s)
          </div>
        )}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>

        {loading ? (
          <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
        ) : lista.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-icon">📋</div>
            <div className="ds-empty-title">Nenhuma cotação encontrada.</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-md)' }}>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Cliente</Th>
                <Th>Vendedor</Th>
                <Th>Período</Th>
                <Th>Emissão</Th>
                <Th>Validade</Th>
                <Th>Início</Th>
                <Th>Fim</Th>
                <Th right>Total</Th>
                <Th>Visualiz.</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {lista.map(row => {
                const validadeVencida = ['rascunho','aguardando'].includes(row.status)
                  && row.data_validade < hoje
                return (
                  <tr key={row.id}
                    onClick={() => router.push(`/cotacoes/${row.id}`)}
                    style={{ cursor:'pointer' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(129,140,248,0.06)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>

                    <Td mono>
                      <span style={{ fontWeight:700, color:'#818cf8' }}>{row.numero}</span>
                      {row.origem === 'site' && (
                        <span style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'2px 6px',
                          borderRadius:4, background:'rgba(251,191,36,0.15)',
                          border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24',
                          verticalAlign:'middle' }}>
                          🌐 SITE
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ fontWeight:500, color:'rgba(255,255,255,0.88)' }}>
                        {(row.clientes as any)?.nome ?? '—'}
                      </span>
                    </Td>
                    <Td muted>{(row.usuarios as any)?.nome ?? '—'}</Td>
                    <Td muted>{(row.periodos_locacao as any)?.nome ?? '—'}</Td>
                    <Td muted>{fmt.date(row.data_emissao) || '—'}</Td>
                    <Td>
                      <span style={{
                        color: validadeVencida ? 'var(--c-danger)' : 'rgba(255,255,255,0.55)',
                        fontWeight: validadeVencida ? 700 : 400,
                      }}>
                        {fmt.date(row.data_validade) || '—'}
                        {validadeVencida && ' ⚠'}
                      </span>
                    </Td>
                    <Td muted>{fmt.date(row.data_inicio) || '—'}</Td>
                    <Td muted>{fmt.date(row.data_fim) || '—'}</Td>
                    <Td right>
                      <span style={{ fontWeight:700, color:'rgba(255,255,255,0.88)' }}>
                        {fmt.money(row.total)}
                      </span>
                    </Td>
                    <Td>
                      {Number(row.visualizacoes) > 0
                        ? <span style={{ fontSize:'var(--fs-sm)', color:'rgba(255,255,255,0.45)',
                            background:'rgba(255,255,255,0.07)', padding:'2px 6px',
                            borderRadius:4, fontFamily:'var(--font-mono)' }}>
                            👁 {row.visualizacoes}
                          </span>
                        : <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'var(--fs-sm)' }}>—</span>
                      }
                    </Td>
                    <Td><StatusBadge s={row.status} /></Td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', whiteSpace:'nowrap' }}
                      onClick={e => e.stopPropagation()}>
                      {(() => {
                        const sec: AcaoSecundaria[] = []
                        if (['rascunho','aguardando'].includes(row.status))
                          sec.push({ label:'📤 Enviar ao Cliente', onClick:()=>enviarCliente(row), grupo:1 })
                        if (['aprovada','aguardando','rascunho'].includes(row.status) && !row.contrato_id)
                          sec.push({ label:'🔄 Converter em Contrato', onClick:()=>converter(row), grupo:1 })
                        if (row.contrato_id)
                          sec.push({ label:'📄 Ver Contrato', onClick:()=>router.push(`/contratos/${row.contrato_id}`), grupo:1 })
                        if (row.status === 'rascunho')
                          sec.push({ label:'🗑 Excluir Cotação', onClick:()=>excluir(row.id), grupo:2, destrutivo:true })
                        return (
                          <ActionButtons
                            onView={() => router.push(`/cotacoes/${row.id}`)}
                            onEdit={row.status === 'rascunho' ? () => router.push(`/cotacoes/${row.id}`) : undefined}
                            acoesSec={sec}
                          />
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
