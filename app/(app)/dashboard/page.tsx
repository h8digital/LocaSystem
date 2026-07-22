// build: 2026-06-04
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MapaContratos from '@/components/dashboard/MapaContratos'

// ── Helpers ───────────────────────────────────────────────────────────────────
const R$ = (v: number) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)
const dataBR = (iso: string) => { if (!iso) return '—'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}` }
const diasAte = (iso: string) => Math.ceil((new Date(iso+'T12:00:00').getTime() - Date.now()) / 86400000)

// ── Gráfico de barras com tooltip e valores visíveis ─────────────────────────
function BarChart({ data, xKey, yKey, color = '#6366f1', height = 140, formatY }: {
  data: any[]; xKey: string; yKey: string; color?: string; height?: number; formatY?: (v:number)=>string
}) {
  const [hovered, setHovered] = useState<number|null>(null)
  if (!data.length) return <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:13}}>Sem dados no período</div>
  const max = Math.max(...data.map(d => Number(d[yKey])||0), 1)
  const fmt = formatY ?? ((v:number) => String(v))
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${data.length*52} ${height+32}`} style={{width:'100%', height:height+32, overflow:'visible'}}>
        {/* Grid */}
        {[0,0.25,0.5,0.75,1].map(f => (
          <g key={f}>
            <line x1={0} y1={(1-f)*height} x2={data.length*52} y2={(1-f)*height} stroke="#1e293b" strokeWidth={1}/>
            <text x={0} y={(1-f)*height-3} fill="#334155" fontSize="9" textAnchor="start">{fmt(max*f)}</text>
          </g>
        ))}
        {data.map((d,i) => {
          const val = Number(d[yKey])||0
          const bh  = Math.max((val/max)*height, val>0?4:0)
          const x   = i*52+6
          const y   = height-bh
          const isH = hovered===i
          return (
            <g key={i} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)} style={{cursor:'pointer'}}>
              <rect x={x} y={y} width={40} height={bh} rx={4} fill={color} opacity={isH?1:0.75} style={{transition:'opacity 0.15s'}}/>
              {/* Valor acima da barra */}
              {(isH||data.length<=12) && val>0 && (
                <text x={x+20} y={y-5} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">
                  {fmt(val)}
                </text>
              )}
              {/* Label eixo X */}
              <text x={x+20} y={height+18} textAnchor="middle" fill="#64748b" fontSize="10">
                {d[xKey]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title:string; children:React.ReactNode; onClose:()=>void }) {
  useEffect(() => {
    const h = (e:KeyboardEvent) => { if(e.key==='Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(5,8,20,0.8)',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'relative',background:'#0f172a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:24,width:'100%',maxWidth:640,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:15,color:'#e2e8f0'}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:22,lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, color, accent, sub, onClick }: {
  label:string; value:string; color:string; accent:string; sub?:string; onClick?:()=>void
}) {
  return (
    <div onClick={onClick} style={{
      background:'var(--bg-card)', border:`1px solid var(--border)`,
      borderTop:`3px solid ${accent}`, borderRadius:'var(--r-md)',
      padding:'14px 16px', cursor:onClick?'pointer':'default', transition:'all 0.15s',
    }}
    onMouseEnter={e=>onClick&&((e.currentTarget as HTMLElement).style.transform='translateY(-2px)')}
    onMouseLeave={e=>onClick&&((e.currentTarget as HTMLElement).style.transform='none')}>
      <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--t-muted)',marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'var(--t-muted)',marginTop:4}}>{sub}</div>}
      {onClick && <div style={{fontSize:10,color:'var(--t-muted)',marginTop:4}}>↗ Ver detalhes</div>}
    </div>
  )
}

const PERIODOS = [
  {label:'7d',   dias:7},
  {label:'30d',  dias:30},
  {label:'60d',  dias:60},
  {label:'90d',  dias:90},
  {label:'6m',   dias:180},
  {label:'1 ano',dias:365},
]

export default function DashboardPage() {
  const router = useRouter()
  const [periodo,  setPeriodo]  = useState(30)
  const [loading,  setLoading]  = useState(true)
  const [data,     setData]     = useState<any>(null)
  const [modal,    setModal]    = useState<{title:string; content:React.ReactNode}|null>(null)
  const [grafico,  setGrafico]  = useState<'contratos'|'receita'|'previsao'>('contratos')

  const load = useCallback(async (dias:number) => {
    setLoading(true)
    const ate = new Date().toISOString().split('T')[0]
    const de  = new Date(Date.now()-dias*86400000).toISOString().split('T')[0]
    const res = await fetch(`/api/dashboard?de=${de}&ate=${ate}`)
    setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(periodo) }, [periodo, load])

  // ── Modais ────────────────────────────────────────────────────────────────
  function abrirVencendo() {
    const items = data?.contratos_vencendo ?? []
    setModal({ title:`⏰ ${items.length} contrato(s) vencendo em 15 dias`, content: (
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Contrato','Cliente','Vence','Dias','Valor'].map(h=>(
          <th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#64748b',borderBottom:'1px solid #1e293b',fontSize:11,textTransform:'uppercase'}}>{h}</th>
        ))}</tr></thead>
        <tbody>{items.map((c:any,i:number)=>{
          const dias = diasAte(c.data_fim)
          return <tr key={i} style={{background:i%2===0?'transparent':'rgba(255,255,255,0.02)'}}>
            <td style={{padding:'8px',color:'#818cf8',fontFamily:'monospace',fontWeight:700}}>{c.numero}</td>
            <td style={{padding:'8px',color:'#e2e8f0'}}>{c.cliente}</td>
            <td style={{padding:'8px',color:'var(--t-muted)'}}>{dataBR(c.data_fim)}</td>
            <td style={{padding:'8px',fontWeight:700,color:dias<=3?'#f87171':dias<=7?'#fbbf24':'#34d399'}}>{dias}d</td>
            <td style={{padding:'8px',fontFamily:'monospace'}}>{R$(c.total)}</td>
          </tr>
        })}</tbody>
      </table>
    )})
  }

  function abrirVencidos() {
    const items = data?.contratos_vencidos ?? []
    setModal({ title:`🔴 ${items.length} contrato(s) vencido(s) em atraso`, content: (
      <div>
        <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#f87171'}}>
          <strong>Multa estimada total: {R$(data?.kpis?.multa_estimada??0)}</strong>
          <div style={{fontSize:12,opacity:0.8,marginTop:2}}>Calculada proporcionalmente ao valor diário do contrato × dias em atraso</div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr>{['Contrato','Cliente','Venceu em','Dias atraso','Multa estimada'].map(h=>(
            <th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#64748b',borderBottom:'1px solid #1e293b',fontSize:11,textTransform:'uppercase'}}>{h}</th>
          ))}</tr></thead>
          <tbody>{items.map((c:any,i:number)=>(
            <tr key={i} style={{background:i%2===0?'transparent':'rgba(255,255,255,0.02)'}}>
              <td style={{padding:'8px',color:'#818cf8',fontFamily:'monospace',fontWeight:700}}>{c.numero}</td>
              <td style={{padding:'8px',color:'#e2e8f0'}}>{c.cliente}</td>
              <td style={{padding:'8px',color:'#f87171'}}>{dataBR(c.data_fim)}</td>
              <td style={{padding:'8px',fontWeight:700,color:'#f87171'}}>{c.dias_vencido}d</td>
              <td style={{padding:'8px',fontFamily:'monospace',fontWeight:700,color:'#fbbf24'}}>{R$(c.multa_estimada)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )})
  }

  function abrirInadimplentes() {
    const items = data?.inadimplentes ?? []
    setModal({ title:`💸 ${items.length} fatura(s) vencida(s)`, content: (
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Cliente','Fatura','Vencimento','Valor'].map(h=>(
          <th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#64748b',borderBottom:'1px solid #1e293b',fontSize:11,textTransform:'uppercase'}}>{h}</th>
        ))}</tr></thead>
        <tbody>{items.map((f:any,i:number)=>(
          <tr key={i} style={{background:i%2===0?'transparent':'rgba(255,255,255,0.02)'}}>
            <td style={{padding:'8px',color:'#e2e8f0'}}>{f.cliente}</td>
            <td style={{padding:'8px',color:'#818cf8',fontFamily:'monospace'}}>{f.numero}</td>
            <td style={{padding:'8px',color:'#f87171'}}>{dataBR(f.data_vencimento)}</td>
            <td style={{padding:'8px',fontFamily:'monospace',fontWeight:700,color:'#f87171'}}>{R$(f.valor)}</td>
          </tr>
        ))}</tbody>
      </table>
    )})
  }

  // ── Dados ─────────────────────────────────────────────────────────────────
  const kpis     = data?.kpis ?? {}
  const locSem   = data?.locacoes_semana ?? []
  const recSem   = data?.receita_semana  ?? []
  const previsao = data?.previsao_receita ?? []
  const clientes = data?.top_clientes    ?? []
  const produtos = data?.top_produtos    ?? []
  const vencendo = data?.contratos_vencendo ?? []
  const vencidos = data?.contratos_vencidos ?? []
  const inadimpl = data?.inadimplentes   ?? []
  const contratosMapa = data?.contratos_mapa ?? []
  const mapboxToken   = data?.mapbox_token ?? null

  const maxCliente = Math.max(...clientes.map((c:any)=>c.valor),1)
  const maxProduto = Math.max(...produtos.map((p:any)=>p.locacoes),1)

  // Previsão por semana
  const prevSem: Record<string,{label:string;valor:number}> = {}
  previsao.forEach((f:any)=>{
    const d=new Date(f.data+'T12:00:00'); const dow=d.getDay()
    const seg=new Date(d); seg.setDate(d.getDate()-(dow===0?6:dow-1))
    const key=seg.toISOString().split('T')[0]
    const [,m,dia]=key.split('-')
    if(!prevSem[key]) prevSem[key]={label:`${dia}/${m}`,valor:0}
    prevSem[key].valor+=f.valor
  })
  const prevSemArr = Object.entries(prevSem).map(([k,v])=>({semana:k,...v})).sort((a,b)=>a.semana.localeCompare(b.semana))

  const grafData  = grafico==='contratos'?locSem : grafico==='receita'?recSem : prevSemArr
  const grafYKey  = grafico==='contratos'?'contratos':'valor'
  const grafColor = grafico==='previsao'?'#fbbf24':grafico==='receita'?'#34d399':'#6366f1'
  const grafFmt   = grafico==='contratos'?(v:number)=>String(v):(v:number)=>v>=1000?`${(v/1000).toFixed(1)}k`:R$(v)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--t-primary)'}}>Visão Geral do Negócio</div>
          <div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>
            {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
          </div>
        </div>
        <div style={{display:'flex',gap:4,background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:3}}>
          {PERIODOS.map(p=>(
            <button key={p.dias} onClick={()=>setPeriodo(p.dias)} style={{
              padding:'5px 12px',borderRadius:'var(--r-sm)',border:'none',cursor:'pointer',
              fontSize:12,fontWeight:periodo===p.dias?700:400,
              background:periodo===p.dias?'var(--c-primary)':'transparent',
              color:periodo===p.dias?'#fff':'var(--t-muted)',transition:'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:400,color:'var(--t-muted)',flexDirection:'column',gap:12}}>
          <div style={{width:32,height:32,border:'3px solid var(--border)',borderTop:'3px solid var(--c-primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
          Carregando dados...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (<>

        {/* ── KPIs — 8 cards em 2 linhas ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <KPICard label="Contratos Ativos"   value={String(kpis.contratos_ativos??0)} color="#818cf8" accent="#6366f1" onClick={()=>router.push('/contratos')}/>
          <KPICard label="Novos no Período"   value={String(kpis.contratos_periodo??0)} color="#0ea5e9" accent="#0ea5e9"/>
          <KPICard label="Faturado Período"   value={R$(kpis.valor_periodo??0)} color="#34d399" accent="#10b981"/>
          <KPICard label="Receita Recebida"   value={R$(kpis.receita_total??0)} color="#34d399" accent="#059669"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <KPICard label="A Receber"          value={R$(kpis.a_receber??0)} color="#fbbf24" accent="#f59e0b" onClick={()=>router.push('/financeiro')}/>
          <KPICard label="Inadimplência"      value={R$(kpis.inadimplencia??0)} color={kpis.inadimplencia>0?'#f87171':'#34d399'} accent={kpis.inadimplencia>0?'#ef4444':'#10b981'} onClick={inadimpl.length>0?abrirInadimplentes:undefined}/>
          <KPICard label="Contratos Vencidos" value={String(kpis.contratos_vencidos??0)} sub={kpis.contratos_vencidos>0?'Equipamentos ainda na obra':undefined} color={kpis.contratos_vencidos>0?'#f87171':'#34d399'} accent={kpis.contratos_vencidos>0?'#ef4444':'#10b981'} onClick={vencidos.length>0?abrirVencidos:undefined}/>
          <KPICard label="Multa Estimada"     value={R$(kpis.multa_estimada??0)} sub="Atraso na devolução" color={kpis.multa_estimada>0?'#fbbf24':'#34d399'} accent={kpis.multa_estimada>0?'#f59e0b':'#10b981'} onClick={vencidos.length>0?abrirVencidos:undefined}/>
        </div>

        {/* ── Alertas ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div onClick={vencendo.length>0?abrirVencendo:undefined}
            style={{background:vencendo.length>0?'rgba(251,191,36,0.06)':'var(--bg-card)',border:`1px solid ${vencendo.length>0?'rgba(251,191,36,0.3)':'var(--border)'}`,borderRadius:'var(--r-md)',padding:'14px 16px',cursor:vencendo.length>0?'pointer':'default',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>{vencendo.length>0?'⏰':'✅'}</span>
            <div>
              <div style={{fontWeight:700,color:vencendo.length>0?'#fbbf24':'#34d399',fontSize:14}}>
                {vencendo.length>0?`${vencendo.length} contrato(s) vencem em até 15 dias`:'Nenhum contrato vencendo em breve'}
              </div>
              {vencendo.length>0&&<div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>Mais próximo: {vencendo[0]?.cliente} — {dataBR(vencendo[0]?.data_fim)} · Clique para ver todos</div>}
            </div>
          </div>
          <div onClick={vencidos.length>0?abrirVencidos:undefined}
            style={{background:vencidos.length>0?'rgba(248,113,113,0.06)':'var(--bg-card)',border:`1px solid ${vencidos.length>0?'rgba(248,113,113,0.3)':'var(--border)'}`,borderRadius:'var(--r-md)',padding:'14px 16px',cursor:vencidos.length>0?'pointer':'default',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>{vencidos.length>0?'🔴':'✅'}</span>
            <div>
              <div style={{fontWeight:700,color:vencidos.length>0?'#f87171':'#34d399',fontSize:14}}>
                {vencidos.length>0?`${vencidos.length} contrato(s) vencido(s) — equipamentos retidos`:'Nenhum contrato em atraso'}
              </div>
              {vencidos.length>0&&<div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>Multa estimada: {R$(kpis.multa_estimada??0)} · Clique para ver todos</div>}
            </div>
          </div>
        </div>

        {/* ── Mapa de contratos ativos ── */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)'}}>Locais de uso</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--t-primary)',marginTop:2}}>Contratos Ativos no Mapa</div>
            </div>
            {contratosMapa.length>0 && (
              <div style={{fontSize:12,color:'var(--t-muted)'}}>{contratosMapa.length} contrato(s) localizado(s)</div>
            )}
          </div>
          <MapaContratos contratos={contratosMapa} mapboxToken={mapboxToken} />
        </div>

        {/* ── Gráfico principal ── */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)'}}>Evolução semanal — últimos {periodo} dias</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--t-primary)',marginTop:2}}>
                {grafico==='contratos'?'Número de Contratos por Semana':grafico==='receita'?'Receita Recebida por Semana (R$)':'Previsão de Recebimento por Semana (R$)'}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {([
                {k:'contratos',l:'Contratos',c:'#6366f1'},
                {k:'receita',  l:'Receita',  c:'#34d399'},
                {k:'previsao', l:'Previsão', c:'#fbbf24'},
              ] as const).map(t=>(
                <button key={t.k} onClick={()=>setGrafico(t.k)} style={{
                  padding:'4px 12px',borderRadius:'var(--r-sm)',border:`1px solid ${grafico===t.k?t.c:'var(--border)'}`,
                  background:grafico===t.k?t.c+'22':'transparent',
                  color:grafico===t.k?t.c:'var(--t-muted)',
                  fontSize:12,fontWeight:grafico===t.k?700:400,cursor:'pointer',
                }}>{t.l}</button>
              ))}
            </div>
          </div>
          <BarChart
            data={grafData}
            xKey="label"
            yKey={grafYKey}
            color={grafColor}
            height={140}
            formatY={grafFmt}
          />
          {grafico==='contratos'&&locSem.length>0&&(
            <div style={{marginTop:8,fontSize:12,color:'var(--t-muted)',textAlign:'right'}}>
              Total no período: <strong style={{color:'var(--t-primary)'}}>{locSem.reduce((s:number,d:any)=>s+d.contratos,0)} contratos · {R$(locSem.reduce((s:number,d:any)=>s+d.valor,0))}</strong>
            </div>
          )}
        </div>

        {/* ── Ranking + Previsão ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>

          {/* Top Clientes */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:14}}>🏆 Top Clientes — Período</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {clientes.length===0?<div style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:20}}>Sem dados</div>
              :clientes.slice(0,7).map((c:any,i:number)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:18,height:18,borderRadius:'50%',background:i<3?['#fbbf24','#94a3b8','#b45309'][i]:'#1e293b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:i<3?'#000':'#64748b',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:'var(--t-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome}</div>
                    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                      <div style={{height:4,borderRadius:2,background:'#6366f1',width:`${pct(c.valor,maxCliente)}%`,minWidth:c.valor>0?4:0}}/>
                      <span style={{fontSize:10,color:'var(--t-muted)',whiteSpace:'nowrap'}}>{R$(c.valor)}</span>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:'var(--t-muted)',flexShrink:0}}>{c.contratos}x</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Produtos */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:14}}>🔧 Equipamentos Mais Locados</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {produtos.length===0?<div style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:20}}>Sem dados</div>
              :produtos.slice(0,7).map((p:any,i:number)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:18,height:18,borderRadius:'50%',background:i<3?['#fbbf24','#94a3b8','#b45309'][i]:'#1e293b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:i<3?'#000':'#64748b',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:'var(--t-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nome}</div>
                    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                      <div style={{height:4,borderRadius:2,background:'#0ea5e9',width:`${pct(p.locacoes,maxProduto)}%`,minWidth:p.locacoes>0?4:0}}/>
                      <span style={{fontSize:10,color:'var(--t-muted)',whiteSpace:'nowrap'}}>{p.locacoes} locações · {p.unidades} un.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Previsão de receita */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:14}}>📅 Previsão de Recebimento</div>
            <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:260,overflowY:'auto'}}>
              {previsao.length===0
                ?<div style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:20}}>Sem faturas pendentes</div>
                :previsao.map((f:any,i:number)=>{
                  const hoje2=new Date().toISOString().split('T')[0]
                  return (
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderRadius:6,background:f.vencida?'rgba(248,113,113,0.08)':f.data===hoje2?'rgba(99,102,241,0.08)':'var(--bg-header)',border:`1px solid ${f.vencida?'rgba(248,113,113,0.2)':f.data===hoje2?'rgba(99,102,241,0.2)':'transparent'}`}}>
                      <div style={{fontSize:12,fontWeight:500,color:f.vencida?'#f87171':f.data===hoje2?'#818cf8':'var(--t-primary)'}}>
                        {dataBR(f.data)} {f.vencida?'⚠️':f.data===hoje2?'← hoje':''}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,fontFamily:'monospace',color:f.vencida?'#f87171':'#34d399'}}>{R$(f.valor)}</div>
                    </div>
                  )
                })}
            </div>
            {previsao.length>0&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'var(--t-muted)'}}>Total previsto</span>
                <span style={{fontWeight:700,color:'#fbbf24'}}>{R$(previsao.reduce((s:number,f:any)=>s+f.valor,0))}</span>
              </div>
            )}
          </div>
        </div>

      </>)}

      {modal&&<Modal title={modal.title} onClose={()=>setModal(null)}>{modal.content}</Modal>}
    </div>
  )
}
