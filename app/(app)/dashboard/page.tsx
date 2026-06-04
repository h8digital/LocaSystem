// build: 2026-06-02
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Helpers ───────────────────────────────────────────────────────────────────
const R$ = (v: number) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)
const semLabel = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
const dataBR = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const diasAte = (iso: string) => {
  const diff = new Date(iso + 'T12:00:00').getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ── Mini SVG Charts ───────────────────────────────────────────────────────────
function BarChart({
  data, xKey, yKey, color = '#6366f1', height = 120, onClick,
}: {
  data: any[]; xKey: string; yKey: string; color?: string; height?: number; onClick?: (item: any) => void
}) {
  const max = Math.max(...data.map(d => Number(d[yKey]) || 0), 1)
  const w   = 100 / data.length
  return (
    <svg viewBox={`0 0 ${data.length * 40} ${height + 24}`} style={{ width: '100%', height: height + 24, overflow: 'visible' }}>
      {data.map((d, i) => {
        const val = Number(d[yKey]) || 0
        const bh  = Math.max((val / max) * height, val > 0 ? 3 : 0)
        const x   = i * 40 + 4
        const y   = height - bh
        return (
          <g key={i} style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={() => onClick?.(d)}>
            <rect x={x} y={y} width={32} height={bh} rx={3} fill={color} opacity={0.85}
              style={{ transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
            />
            <title>{d[xKey]}: {val.toLocaleString('pt-BR')}</title>
            <text x={x + 16} y={height + 14} textAnchor="middle" fill="#64748b" fontSize="9">
              {d[xKey]?.toString().slice(-5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ data, xKey, y1Key, y2Key, color1 = '#6366f1', color2 = '#34d399', height = 120 }: {
  data: any[]; xKey: string; y1Key: string; y2Key?: string; color1?: string; color2?: string; height?: number
}) {
  if (data.length < 2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:12 }}>Dados insuficientes</div>
  const vals1 = data.map(d => Number(d[y1Key]) || 0)
  const vals2 = y2Key ? data.map(d => Number(d[y2Key]) || 0) : []
  const all   = [...vals1, ...vals2]
  const max   = Math.max(...all, 1)
  const W     = 600; const H = height
  const sx    = (i: number) => (i / (data.length - 1)) * W
  const sy    = (v: number) => H - (v / max) * (H - 10)
  const path  = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: H + 20 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={0} y1={sy(max * f)} x2={W} y2={sy(max * f)} stroke="#1e293b" strokeWidth={1} />
      ))}
      {/* Lines */}
      <path d={path(vals1)} fill="none" stroke={color1} strokeWidth={2.5} strokeLinejoin="round" />
      {y2Key && <path d={path(vals2)} fill="none" stroke={color2} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="5,3" />}
      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(vals1[i])} r={3.5} fill={color1} />
          <title>{d[xKey]}: {vals1[i].toLocaleString('pt-BR')}</title>
        </g>
      ))}
      {/* X labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, _, arr) => {
        const i = data.indexOf(d)
        return <text key={i} x={sx(i)} y={H + 16} textAnchor="middle" fill="#475569" fontSize="9">{semLabel(d[xKey])}</text>
      })}
    </svg>
  )
}

function DonutChart({ segments, size = 80 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#1e293b' }} />
  let cum = 0
  const r = 28; const cx = 40; const cy = 40
  const arc = (start: number, end: number, r: number) => {
    const s = (start / total) * 2 * Math.PI - Math.PI / 2
    const e = (end   / total) * 2 * Math.PI - Math.PI / 2
    const large = (end - start) / total > 0.5 ? 1 : 0
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`
  }
  return (
    <svg viewBox="0 0 80 80" width={size} height={size}>
      {segments.map((seg, i) => {
        if (seg.value === 0) return null
        const path = arc(cum, cum + seg.value, r)
        cum += seg.value
        return (
          <g key={i}>
            <path d={path} fill="none" stroke={seg.color} strokeWidth={10} strokeLinecap="butt" />
            <title>{seg.label}: {seg.value}</title>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={22} fill="#0f172a" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="700">{total}</text>
    </svg>
  )
}

// ── Card base ─────────────────────────────────────────────────────────────────
function Card({ title, subtitle, children, onClick, accent, span, minH }: {
  title: string; subtitle?: string; children: React.ReactNode
  onClick?: () => void; accent?: string; span?: number; minH?: number
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--bg-card)',
        border:       `1px solid ${accent ? accent + '33' : 'var(--border)'}`,
        borderTop:    accent ? `3px solid ${accent}` : '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding:      '18px 20px',
        gridColumn:   span ? `span ${span}` : undefined,
        minHeight:    minH,
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t-muted)', marginBottom: 2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--t-muted)', opacity: 0.7 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function KPI({ value, label, sub, color, trend }: { value: string; label: string; sub?: string; color?: string; trend?: number }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--t-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--t-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t-muted)', marginTop: 2, opacity: 0.7 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize: 11, color: trend >= 0 ? '#34d399' : '#f87171', marginTop: 4, fontWeight: 600 }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────
function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,8,20,0.75)', backdropFilter:'blur(4px)' }} />
      <div style={{ position:'relative', background:'#0f172a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:24, width:'100%', maxWidth:600, maxHeight:'80vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#e2e8f0' }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const PERIODOS = [
  { label: '7 dias',   dias: 7   },
  { label: '30 dias',  dias: 30  },
  { label: '60 dias',  dias: 60  },
  { label: '90 dias',  dias: 90  },
  { label: '6 meses',  dias: 180 },
  { label: '1 ano',    dias: 365 },
]

export default function DashboardPage() {
  const router   = useRouter()
  const [periodo, setPeriodo] = useState(30)
  const [loading, setLoading] = useState(true)
  const [data,    setData]    = useState<any>(null)
  const [modal,   setModal]   = useState<{ title: string; content: React.ReactNode } | null>(null)
  const [grafico, setGrafico] = useState<'contratos' | 'receita' | 'previsao'>('contratos')

  const load = useCallback(async (dias: number) => {
    setLoading(true)
    const ate = new Date().toISOString().split('T')[0]
    const de  = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0]
    const res = await fetch(`/api/dashboard?de=${de}&ate=${ate}`)
    const d   = await res.json()
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load(periodo) }, [periodo, load])

  // ── Modais de detalhe ─────────────────────────────────────────────────────
  function abrirVencendo() {
    const items = data?.contratos_vencendo ?? []
    setModal({
      title: `${items.length} Contrato(s) vencendo em 15 dias`,
      content: (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>
            {['Contrato','Cliente','Vence em','Valor'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'#64748b', borderBottom:'1px solid #1e293b', fontSize:11, textTransform:'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map((c: any, i: number) => {
              const dias = diasAte(c.data_fim)
              return (
                <tr key={i} onClick={() => { setModal(null); router.push('/contratos') }}
                  style={{ cursor:'pointer', background: i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding:'8px', color:'#818cf8', fontFamily:'monospace', fontWeight:700 }}>{c.numero}</td>
                  <td style={{ padding:'8px', color:'#e2e8f0' }}>{c.cliente}</td>
                  <td style={{ padding:'8px', color: dias <= 3 ? '#f87171' : dias <= 7 ? '#fbbf24' : '#34d399', fontWeight:600 }}>
                    {dias === 0 ? 'Hoje' : dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
                  </td>
                  <td style={{ padding:'8px', fontFamily:'monospace', color:'#e2e8f0' }}>{R$(c.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )
    })
  }

  function abrirInadimplentes() {
    const items = data?.inadimplentes ?? []
    setModal({
      title: `Inadimplência — ${items.length} fatura(s) vencida(s)`,
      content: (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>
            {['Cliente','Fatura','Vencimento','Valor'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'#64748b', borderBottom:'1px solid #1e293b', fontSize:11, textTransform:'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map((f: any, i: number) => (
              <tr key={i} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                <td style={{ padding:'8px', color:'#e2e8f0' }}>{f.cliente}</td>
                <td style={{ padding:'8px', color:'#818cf8', fontFamily:'monospace' }}>{f.numero}</td>
                <td style={{ padding:'8px', color:'#f87171' }}>{dataBR(f.data_vencimento)}</td>
                <td style={{ padding:'8px', fontFamily:'monospace', color:'#f87171', fontWeight:700 }}>{R$(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    })
  }

  function abrirProduto(p: any) {
    setModal({
      title: p.nome,
      content: (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {[
            { l:'Locações', v: p.locacoes,                      c:'#818cf8' },
            { l:'Unidades', v: p.unidades,                      c:'#0ea5e9' },
            { l:'Receita',  v: R$(p.receita),                   c:'#34d399' },
          ].map(k => (
            <div key={k.l} style={{ background:'#1e293b', borderRadius:8, padding:'14px 16px' }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', marginBottom:4 }}>{k.l}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      )
    })
  }

  function abrirCliente(c: any) {
    setModal({
      title: c.nome,
      content: (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[
            { l:'Contratos', v: c.contratos, c:'#818cf8' },
            { l:'Valor Total', v: R$(c.valor), c:'#34d399' },
          ].map(k => (
            <div key={k.l} style={{ background:'#1e293b', borderRadius:8, padding:'14px 16px' }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', marginBottom:4 }}>{k.l}</div>
              <div style={{ fontSize:22, fontWeight:700, color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      )
    })
  }

  // ── Dados derivados ───────────────────────────────────────────────────────
  const kpis     = data?.kpis ?? {}
  const locSem   = data?.locacoes_semana ?? []
  const recSem   = data?.receita_semana ?? []
  const previsao = data?.previsao_receita ?? []
  const clientes = data?.top_clientes ?? []
  const produtos = data?.top_produtos ?? []
  const vencendo = data?.contratos_vencendo ?? []
  const inadimpl = data?.inadimplentes ?? []

  const maxBarCliente = Math.max(...clientes.map((c: any) => c.valor), 1)
  const maxBarProduto = Math.max(...produtos.map((p: any) => p.locacoes), 1)

  // Previsão acumulada por semana
  const prevSem: Record<string, number> = {}
  previsao.forEach((f: any) => {
    const d   = new Date(f.data + 'T12:00:00')
    const dow = d.getDay()
    const seg = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const key = seg.toISOString().split('T')[0]
    prevSem[key] = (prevSem[key] ?? 0) + f.valor
  })
  const prevSemArr = Object.entries(prevSem).map(([semana, valor]) => ({ semana, valor })).sort((a,b) => a.semana.localeCompare(b.semana))

  const grafData = grafico === 'contratos' ? locSem
    : grafico === 'receita' ? recSem
    : prevSemArr

  const grafYKey = grafico === 'contratos' ? 'contratos' : 'valor'
  const grafColor = grafico === 'previsao' ? '#fbbf24' : grafico === 'receita' ? '#34d399' : '#6366f1'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header com filtro de período ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--t-primary)' }}>Visão Geral do Negócio</div>
          <div style={{ fontSize:12, color:'var(--t-muted)', marginTop:2 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
          </div>
        </div>
        <div style={{ display:'flex', gap:4, background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:3 }}>
          {PERIODOS.map(p => (
            <button key={p.dias} onClick={() => setPeriodo(p.dias)}
              style={{
                padding:'5px 12px', borderRadius:'var(--r-sm)', border:'none', cursor:'pointer',
                fontSize:12, fontWeight: periodo === p.dias ? 700 : 400,
                background: periodo === p.dias ? 'var(--c-primary)' : 'transparent',
                color: periodo === p.dias ? '#fff' : 'var(--t-muted)',
                transition:'all 0.15s',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400, color:'var(--t-muted)', flexDirection:'column', gap:12 }}>
          <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTop:'3px solid var(--c-primary)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <div>Carregando dados...</div>
          <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          {/* ── KPIs principais ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
            {[
              { label:'Contratos Ativos',  value: kpis.contratos_ativos,  fmt: (v:number) => String(v),  color:'#818cf8', accent:'#6366f1', onClick: () => router.push('/contratos') },
              { label:'No Período',        value: kpis.contratos_periodo, fmt: (v:number) => String(v),  color:'#0ea5e9', accent:'#0ea5e9' },
              { label:'Faturado Período',  value: kpis.valor_periodo,     fmt: R$,                       color:'#34d399', accent:'#34d399' },
              { label:'A Receber',         value: kpis.a_receber,         fmt: R$,                       color:'#fbbf24', accent:'#fbbf24', onClick: () => router.push('/financeiro') },
              { label:'Receita Realizada', value: kpis.receita_total,     fmt: R$,                       color:'#34d399', accent:'#10b981' },
              { label:'Inadimplência',     value: kpis.inadimplencia,     fmt: R$,                       color: kpis.inadimplencia > 0 ? '#f87171' : '#34d399', accent: kpis.inadimplencia > 0 ? '#ef4444' : '#10b981', onClick: kpis.inadimplencia > 0 ? abrirInadimplentes : undefined },
            ].map(k => (
              <div key={k.label}
                onClick={k.onClick}
                style={{
                  background:'var(--bg-card)', border:`1px solid var(--border)`,
                  borderTop:`3px solid ${k.accent}`, borderRadius:'var(--r-md)',
                  padding:'14px 16px', cursor: k.onClick ? 'pointer' : 'default',
                  transition:'all 0.15s',
                }}
                onMouseEnter={e => k.onClick && ((e.currentTarget as HTMLElement).style.transform='translateY(-2px)')}
                onMouseLeave={e => k.onClick && ((e.currentTarget as HTMLElement).style.transform='none')}>
                <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--t-muted)', marginBottom:6 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1 }}>{k.fmt(k.value ?? 0)}</div>
                {k.onClick && <div style={{ fontSize:10, color:'var(--t-muted)', marginTop:4 }}>Clique para detalhes →</div>}
              </div>
            ))}
          </div>

          {/* ── Alertas ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {/* Contratos vencendo */}
            <div
              onClick={vencendo.length > 0 ? abrirVencendo : undefined}
              style={{
                background: vencendo.length > 0 ? 'rgba(251,191,36,0.06)' : 'var(--bg-card)',
                border: `1px solid ${vencendo.length > 0 ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                borderRadius:'var(--r-md)', padding:'14px 16px',
                cursor: vencendo.length > 0 ? 'pointer' : 'default',
                display:'flex', alignItems:'center', gap:12,
              }}>
              <span style={{ fontSize:28 }}>{vencendo.length > 0 ? '⏰' : '✅'}</span>
              <div>
                <div style={{ fontWeight:700, color: vencendo.length > 0 ? '#fbbf24' : '#34d399', fontSize:14 }}>
                  {vencendo.length > 0 ? `${vencendo.length} contrato(s) vencem em 15 dias` : 'Nenhum contrato vencendo'}
                </div>
                {vencendo.length > 0 && (
                  <div style={{ fontSize:12, color:'var(--t-muted)', marginTop:2 }}>
                    Mais próximo: {vencendo[0]?.cliente} — {dataBR(vencendo[0]?.data_fim)} · Clique para ver todos
                  </div>
                )}
              </div>
            </div>

            {/* Inadimplência */}
            <div
              onClick={inadimpl.length > 0 ? abrirInadimplentes : undefined}
              style={{
                background: inadimpl.length > 0 ? 'rgba(248,113,113,0.06)' : 'var(--bg-card)',
                border: `1px solid ${inadimpl.length > 0 ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
                borderRadius:'var(--r-md)', padding:'14px 16px',
                cursor: inadimpl.length > 0 ? 'pointer' : 'default',
                display:'flex', alignItems:'center', gap:12,
              }}>
              <span style={{ fontSize:28 }}>{inadimpl.length > 0 ? '🔴' : '✅'}</span>
              <div>
                <div style={{ fontWeight:700, color: inadimpl.length > 0 ? '#f87171' : '#34d399', fontSize:14 }}>
                  {inadimpl.length > 0 ? `${inadimpl.length} fatura(s) em atraso` : 'Sem inadimplência'}
                </div>
                {inadimpl.length > 0 && (
                  <div style={{ fontSize:12, color:'var(--t-muted)', marginTop:2 }}>
                    Total: {R$(inadimpl.reduce((s: number, f: any) => s + Number(f.valor), 0))} · Clique para ver todos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Gráfico principal ── */}
          <Card
            title="Evolução do período"
            subtitle={`Últimos ${periodo} dias`}
            span={12}
          >
            {/* Toggle de gráfico */}
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {([
                { k:'contratos', l:'Locações / semana',       c:'#6366f1' },
                { k:'receita',   l:'Receita realizada',        c:'#34d399' },
                { k:'previsao',  l:'Previsão a receber',       c:'#fbbf24' },
              ] as const).map(t => (
                <button key={t.k} onClick={() => setGrafico(t.k)}
                  style={{
                    padding:'4px 12px', borderRadius:'var(--r-sm)', border:`1px solid ${grafico===t.k ? t.c : 'var(--border)'}`,
                    background: grafico===t.k ? t.c + '22' : 'transparent',
                    color: grafico===t.k ? t.c : 'var(--t-muted)',
                    fontSize:12, fontWeight: grafico===t.k ? 700 : 400, cursor:'pointer',
                  }}>
                  {t.l}
                </button>
              ))}
            </div>
            {grafData.length > 0 ? (
              <LineChart
                data={grafData}
                xKey="semana"
                y1Key={grafYKey}
                color1={grafColor}
                height={160}
              />
            ) : (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t-muted)', fontSize:13 }}>
                Sem dados no período selecionado
              </div>
            )}
          </Card>

          {/* ── Linha inferior: Ranking clientes + Produtos + Previsão ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>

            {/* Top Clientes */}
            <Card title="🏆 Ranking de Clientes" subtitle={`Top ${clientes.length} no período`}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {clientes.slice(0, 7).map((c: any, i: number) => (
                  <div key={i} onClick={() => abrirCliente(c)}
                    style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:8, padding:'4px 0',
                      borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background: i < 3 ? ['#fbbf24','#94a3b8','#b45309'][i] : '#1e293b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: i < 3 ? '#000' : '#64748b', flexShrink:0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--t-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.nome}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                        <div style={{ height:4, borderRadius:2, background:'#6366f1', width:`${pct(c.valor, maxBarCliente)}%`, transition:'width 0.5s', minWidth: c.valor > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:10, color:'var(--t-muted)', whiteSpace:'nowrap' }}>{R$(c.valor)}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:'var(--t-muted)', flexShrink:0 }}>{c.contratos}x</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Produtos */}
            <Card title="🔧 Equipamentos Mais Locados" subtitle={`Top ${produtos.length} no período`}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {produtos.slice(0, 7).map((p: any, i: number) => (
                  <div key={i} onClick={() => abrirProduto(p)}
                    style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:8, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background: i < 3 ? ['#fbbf24','#94a3b8','#b45309'][i] : '#1e293b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: i < 3 ? '#000' : '#64748b', flexShrink:0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--t-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.nome}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                        <div style={{ height:4, borderRadius:2, background:'#0ea5e9', width:`${pct(p.locacoes, maxBarProduto)}%`, transition:'width 0.5s', minWidth: p.locacoes > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:10, color:'var(--t-muted)', whiteSpace:'nowrap' }}>{p.locacoes} locações · {p.unidades} un.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Previsão de receita por dia */}
            <Card title="📅 Previsão de Recebimento" subtitle="Faturas pendentes por dia">
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:260, overflowY:'auto' }}>
                {previsao.length === 0 ? (
                  <div style={{ color:'var(--t-muted)', fontSize:13, padding:'20px 0', textAlign:'center' }}>Sem faturas pendentes</div>
                ) : previsao.map((f: any, i: number) => {
                  const vencida = f.vencida
                  const hoje2   = new Date().toISOString().split('T')[0]
                  const isHoje  = f.data === hoje2
                  return (
                    <div key={i} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'7px 10px', borderRadius:6,
                      background: vencida ? 'rgba(248,113,113,0.08)' : isHoje ? 'rgba(99,102,241,0.08)' : 'var(--bg-header)',
                      border:`1px solid ${vencida ? 'rgba(248,113,113,0.2)' : isHoje ? 'rgba(99,102,241,0.2)' : 'transparent'}`,
                    }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color: vencida ? '#f87171' : isHoje ? '#818cf8' : 'var(--t-primary)' }}>
                          {dataBR(f.data)} {vencida ? '⚠️' : isHoje ? '← hoje' : ''}
                        </div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, fontFamily:'monospace', color: vencida ? '#f87171' : '#34d399' }}>
                        {R$(f.valor)}
                      </div>
                    </div>
                  )
                })}
              </div>
              {previsao.length > 0 && (
                <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span style={{ color:'var(--t-muted)' }}>Total previsto</span>
                  <span style={{ fontWeight:700, color:'#fbbf24' }}>
                    {R$(previsao.reduce((s: number, f: any) => s + f.valor, 0))}
                  </span>
                </div>
              )}
            </Card>
          </div>

          {/* ── Locações por semana (barras) ── */}
          {locSem.length > 0 && (
            <Card title="📊 Locações por Semana (barras)" subtitle="Número de contratos criados">
              <BarChart
                data={locSem}
                xKey="semana"
                yKey="contratos"
                color="#6366f1"
                height={100}
              />
            </Card>
          )}
        </>
      )}

      {/* Modal de detalhe */}
      {modal && (
        <DetailModal title={modal.title} onClose={() => setModal(null)}>
          {modal.content}
        </DetailModal>
      )}
    </div>
  )
}
