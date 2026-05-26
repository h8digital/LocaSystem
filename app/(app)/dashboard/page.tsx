// build: 2026-05-26 12:49:03
'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    contratos: 0, clientes: 0, equipamentos: 0,
    faturas_pendentes: 0, valor_pendente: 0, manutencoes: 0,
  })
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const [c, cl, eq, fp, ma] = await Promise.all([
        supabase.from('contratos').select('id', { count:'exact', head:true }).eq('status','ativo'),
        supabase.from('clientes').select('id',  { count:'exact', head:true }).eq('ativo', 1),
        supabase.from('produtos').select('id',  { count:'exact', head:true }).eq('ativo', 1),
        supabase.from('faturas').select('id,valor').eq('status','pendente'),
        supabase.from('manutencoes').select('id', { count:'exact', head:true }).eq('status','aberto'),
      ])
      const vp = (fp.data ?? []).reduce((s: number, f: any) => s + Number(f.valor), 0)
      setStats({
        contratos: c.count ?? 0, clientes: cl.count ?? 0,
        equipamentos: eq.count ?? 0, faturas_pendentes: fp.data?.length ?? 0,
        valor_pendente: vp, manutencoes: ma.count ?? 0,
      })
      const { data: ct } = await supabase
        .from('contratos').select('*, clientes(nome)')
        .eq('status','ativo').order('created_at',{ ascending:false }).limit(6)
      setContratos(ct ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const kpis = [
    { label:'Contratos Ativos',    value: stats.contratos,          icon:'📄', accent:'#818cf8', href:'/contratos',    sub: null },
    { label:'Clientes',            value: stats.clientes,           icon:'👥', accent:'#34d399', href:'/clientes',     sub: null },
    { label:'Equipamentos',        value: stats.equipamentos,       icon:'🔧', accent:'#fbbf24', href:'/equipamentos', sub: null },
    { label:'Faturas Pendentes',   value: stats.faturas_pendentes,  icon:'🧾', accent:'#f87171', href:'/financeiro',   sub: fmt.money(stats.valor_pendente) },
    { label:'Manutenções Abertas', value: stats.manutencoes,        icon:'🔩', accent:'#a78bfa', href:'/manutencoes',  sub: null },
  ]

  const atalhos = [
    { href:'/contratos/criar', icon:'📄', label:'Novo Contrato' },
    { href:'/clientes',        icon:'👥', label:'Novo Cliente' },
    { href:'/equipamentos',    icon:'🔧', label:'Novo Equipamento' },
    { href:'/contratos',       icon:'↩',  label:'Registrar Devolução' },
    { href:'/manutencoes',     icon:'🔩', label:'Abrir Manutenção' },
  ]

  if (loading) return (
    <div className="ds-loading">
      <div className="ds-dots"><span/><span/><span/></div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Header */}
      <div className="ds-page-header">
        <div>
          <div className="ds-page-title">Dashboard</div>
          <div className="ds-page-subtitle">
            {new Date().toLocaleDateString('pt-BR', {
              weekday:'long', day:'numeric', month:'long', year:'numeric',
              timeZone:'America/Sao_Paulo',
            })}
          </div>
        </div>
        <Link href="/contratos/criar">
          <button className="ds-btn ds-btn-primary">+ Novo Contrato</button>
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {kpis.map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration:'none' }}>
            <div style={{
              background:'rgba(255,255,255,0.05)',
              backdropFilter:'blur(12px)',
              border:`1px solid rgba(255,255,255,0.10)`,
              borderTop:`2px solid ${k.accent}`,
              borderRadius:'var(--r-lg)',
              padding:'14px 16px',
              cursor:'pointer',
              transition:'all 0.2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255,255,255,0.09)'
                el.style.transform  = 'translateY(-2px)'
                el.style.boxShadow  = `0 8px 24px rgba(0,0,0,0.4)`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255,255,255,0.05)'
                el.style.transform  = 'none'
                el.style.boxShadow  = 'none'
              }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:22 }}>{k.icon}</span>
                {k.sub && (
                  <span style={{
                    fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.5)',
                    background:'rgba(255,255,255,0.07)',
                    padding:'2px 6px', borderRadius:4, fontWeight:500,
                  }}>{k.sub}</span>
                )}
              </div>
              <div style={{ fontSize:28, fontWeight:600, color:'#fff', lineHeight:1, marginBottom:5 }}>
                {k.value}
              </div>
              <div style={{ fontSize:'var(--fs-sm)', color:'rgba(255,255,255,0.5)', fontWeight:500 }}>
                {k.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Linha principal: contratos + atalhos */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:12, alignItems:'start' }}>

        {/* Contratos recentes */}
        <div style={{
          background:'rgba(255,255,255,0.05)',
          backdropFilter:'blur(12px)',
          border:'1px solid rgba(255,255,255,0.10)',
          borderRadius:'var(--r-lg)',
          overflow:'hidden',
        }}>
          <div style={{
            background:'rgba(255,255,255,0.04)',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
            padding:'11px 16px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <span style={{ fontSize:'var(--fs-base)', fontWeight:600, color:'rgba(255,255,255,0.9)' }}>
              Contratos Recentes
            </span>
            <Link href="/contratos" style={{ fontSize:'var(--fs-sm)', color:'var(--c-primary)', fontWeight:500 }}>
              Ver todos →
            </Link>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-md)' }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,0.03)' }}>
                {['Nº','Cliente','Período','Total','Status'].map(h => (
                  <th key={h} style={{
                    padding:'8px 14px', textAlign:'left',
                    fontSize:'var(--fs-xs)', fontWeight:600,
                    color:'rgba(255,255,255,0.35)',
                    textTransform:'uppercase', letterSpacing:'0.05em',
                    borderBottom:'1px solid rgba(255,255,255,0.07)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratos.length === 0
                ? <tr><td colSpan={5} style={{ textAlign:'center', padding:'28px', color:'rgba(255,255,255,0.3)' }}>
                    Nenhum contrato ativo.
                  </td></tr>
                : contratos.map(c => (
                  <tr key={c.id}
                    onClick={() => window.location.href = `/contratos/${c.id}`}
                    style={{ cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={{
                      padding:'10px 14px',
                      fontFamily:'var(--font-mono)', fontSize:'var(--fs-sm)',
                      fontWeight:600, color:'#818cf8',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                    }}>{c.numero}</td>
                    <td style={{
                      padding:'10px 14px', fontWeight:500,
                      color:'rgba(255,255,255,0.85)',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                    }}>{(c.clientes as any)?.nome}</td>
                    <td style={{
                      padding:'10px 14px', fontSize:'var(--fs-sm)',
                      color:'rgba(255,255,255,0.45)',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                    }}>{fmt.date(c.data_inicio)} → {fmt.date(c.data_fim)}</td>
                    <td style={{
                      padding:'10px 14px', fontWeight:600,
                      color:'rgba(255,255,255,0.85)',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                    }}>{fmt.money(c.total)}</td>
                    <td style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      <span className="ds-badge ds-badge-green">Ativo</span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Ações rápidas */}
        <div style={{
          background:'rgba(255,255,255,0.05)',
          backdropFilter:'blur(12px)',
          border:'1px solid rgba(255,255,255,0.10)',
          borderRadius:'var(--r-lg)',
          overflow:'hidden',
        }}>
          <div style={{
            background:'rgba(255,255,255,0.04)',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
            padding:'11px 16px',
          }}>
            <span style={{ fontSize:'var(--fs-base)', fontWeight:600, color:'rgba(255,255,255,0.9)' }}>
              Ações Rápidas
            </span>
          </div>
          <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:2 }}>
            {atalhos.map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'9px 10px', borderRadius:'var(--r-md)',
                  color:'rgba(255,255,255,0.75)',
                  transition:'all 0.15s',
                  cursor:'pointer',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'rgba(129,140,248,0.12)'
                    el.style.color      = '#fff'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'transparent'
                    el.style.color      = 'rgba(255,255,255,0.75)'
                  }}>
                  <span style={{ fontSize:16, width:22, textAlign:'center' }}>{a.icon}</span>
                  <span style={{ fontSize:'var(--fs-md)', fontWeight:500 }}>{a.label}</span>
                  <span style={{ marginLeft:'auto', color:'rgba(255,255,255,0.25)', fontSize:14 }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
