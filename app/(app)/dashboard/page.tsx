'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ contratos:0, clientes:0, equipamentos:0, faturas_pendentes:0, valor_pendente:0, manutencoes:0 })
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c,cl,eq,fp,ma] = await Promise.all([
        supabase.from('contratos').select('id',{count:'exact',head:true}).eq('status','ativo'),
        supabase.from('clientes').select('id',{count:'exact',head:true}).eq('ativo',1),
        supabase.from('produtos').select('id',{count:'exact',head:true}).eq('ativo',1),
        supabase.from('faturas').select('id,valor').eq('status','pendente'),
        supabase.from('manutencoes').select('id',{count:'exact',head:true}).eq('status','aberto'),
      ])
      const vp=(fp.data??[]).reduce((s:number,f:any)=>s+Number(f.valor),0)
      setStats({contratos:c.count??0,clientes:cl.count??0,equipamentos:eq.count??0,faturas_pendentes:fp.data?.length??0,valor_pendente:vp,manutencoes:ma.count??0})
      const {data:ct}=await supabase.from('contratos').select('*, clientes(nome)').eq('status','ativo').order('created_at',{ascending:false}).limit(6)
      setContratos(ct??[])
      setLoading(false)
    }
    load()
  },[])

  const kpis = [
    {label:'Contratos Ativos',   value:stats.contratos,         icon:'📄',color:'#17A2B8',href:'/contratos'},
    {label:'Clientes',           value:stats.clientes,          icon:'👥',color:'#28A745',href:'/clientes'},
    {label:'Equipamentos',       value:stats.equipamentos,      icon:'🔧',color:'#FFC107',href:'/equipamentos'},
    {label:'Faturas Pendentes',  value:stats.faturas_pendentes, icon:'🧾',color:'#DC3545',href:'/faturas', sub:fmt.money(stats.valor_pendente)},
    {label:'Manutenções Abertas',value:stats.manutencoes,       icon:'🔩',color:'#6F42C1',href:'/manutencoes'},
  ]

  const atalhos = [
    {href:'/contratos/criar',icon:'📄',label:'Novo Contrato'},
    {href:'/clientes',       icon:'👥',label:'Novo Cliente'},
    {href:'/equipamentos',   icon:'🔧',label:'Novo Equipamento'},
    {href:'/devolucoes',     icon:'↩', label:'Registrar Devolução'},
    {href:'/manutencoes',    icon:'🔩',label:'Abrir Manutenção'},
    {href:'/estoque',        icon:'📦',label:'Movimentar Estoque'},
  ]

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:10}}>
      <div className="ds-spinner" style={{width:20,height:20}}/>
      <span style={{color:'var(--t-muted)',fontSize:'var(--fs-base)'}}>Carregando...</span>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="ds-page-header">
        <div>
          <div className="ds-page-title">⊞ Dashboard</div>
          <div className="ds-page-subtitle">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <Link href="/contratos/criar"><button className="ds-btn ds-btn-primary btn">+ Novo Contrato</button></Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:16}}>
        {kpis.map(k=>(
          <Link key={k.label} href={k.href} style={{textDecoration:'none'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'12px 14px',boxShadow:'var(--shadow-sm)',cursor:'pointer',transition:'all 150ms',borderLeft:`3px solid ${k.color}`}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow='var(--shadow-md)';(e.currentTarget as HTMLElement).style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow='var(--shadow-sm)';(e.currentTarget as HTMLElement).style.transform='none'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:'var(--fs-icon)'}}>{k.icon}</span>
                {k.sub&&<span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',background:'var(--bg-header)',padding:'1px 6px',borderRadius:2,fontWeight:500}}>{k.sub}</span>}
              </div>
              <div style={{fontSize:'var(--fs-kpi)',fontWeight:700,color:'var(--t-primary)',lineHeight:1,marginBottom:3}}>{k.value}</div>
              <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',fontWeight:500}}>{k.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:12,alignItems:'start'}}>
        {/* Contratos recentes */}
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:6,boxShadow:'var(--shadow-sm)',overflow:'hidden'}}>
          <div style={{background:'var(--bg-header)',borderBottom:'1px solid var(--border)',padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'var(--fs-base)',fontWeight:700,color:'var(--t-primary)'}}>📄 Contratos Recentes</span>
            <Link href="/contratos" style={{fontSize:'var(--fs-sm)',color:'var(--c-primary)',fontWeight:500}}>Ver todos</Link>
          </div>
          <table className="ds-table">
            <thead><tr>
              {['Nº','Cliente','Período','Total','Status'].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {contratos.length===0
                ?<tr><td colSpan={5} style={{textAlign:'center',padding:'24px',color:'var(--t-muted)'}}>Nenhum contrato ativo.</td></tr>
                :contratos.map((c,i)=>(
                  <tr key={c.id} onClick={()=>window.location.href=`/contratos/${c.id}`} style={{cursor:'pointer'}}>
                    <td style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:'var(--fs-md)',color:'var(--c-primary)'}}>{c.numero}</td>
                    <td style={{fontWeight:500}}>{(c.clientes as any)?.nome}</td>
                    <td style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>{fmt.date(c.data_inicio)} → {fmt.date(c.data_fim)}</td>
                    <td style={{fontWeight:700}}>{fmt.money(c.total)}</td>
                    <td><span className="ds-badge ds-badge-green">Ativo</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Atalhos rápidos */}
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:6,boxShadow:'var(--shadow-sm)',overflow:'hidden'}}>
          <div style={{background:'var(--bg-header)',borderBottom:'1px solid var(--border)',padding:'9px 14px'}}>
            <span style={{fontSize:'var(--fs-base)',fontWeight:700,color:'var(--t-primary)'}}>⚡ Ações Rápidas</span>
          </div>
          <div style={{padding:'6px 8px',display:'flex',flexDirection:'column',gap:1}}>
            {atalhos.map(a=>(
              <Link key={a.href} href={a.href} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 8px',borderRadius:4,textDecoration:'none',transition:'background 150ms',color:'var(--t-primary)'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-row-hover)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                <span style={{fontSize:'var(--fs-base)',width:20,textAlign:'center'}}>{a.icon}</span>
                <span style={{fontSize:'var(--fs-base)',fontWeight:500}}>{a.label}</span>
                <span style={{marginLeft:'auto',color:'var(--t-muted)',fontSize:'var(--fs-xs)'}}>›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
