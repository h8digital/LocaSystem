'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notif {
  id: number; tipo: string; titulo: string; mensagem?: string
  referencia_tipo?: string; referencia_id?: number
  lida: boolean; created_at: string
}

const TIPO_ICON: Record<string,string> = {
  cotacao_aprovada:   '✅',
  cotacao_reprovada:  '❌',
  contrato_vencendo:  '⏰',
  manutencao:         '🔧',
  pagamento:          '💰',
  sistema:            'ℹ️',
}

export default function Notificacoes() {
  const [open,       setOpen]       = useState(false)
  const [notifs,     setNotifs]     = useState<Notif[]>([])
  const [naoLidas,   setNaoLidas]   = useState(0)
  const [loading,    setLoading]    = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const router = useRouter()

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/notificacoes')
    const data = await res.json()
    if (data.ok) { setNotifs(data.data); setNaoLidas(data.nao_lidas) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Polling leve a cada 30s (substitui websocket)
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function marcarLida(id: number) {
    await fetch('/api/notificacoes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setNotifs(p => p.map(n => n.id === id ? { ...n, lida: true } : n))
    setNaoLidas(p => Math.max(0, p - 1))
  }

  async function marcarTodas() {
    await fetch('/api/notificacoes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ todas: true }) })
    setNotifs(p => p.map(n => ({ ...n, lida: true })))
    setNaoLidas(0)
  }

  function navegar(n: Notif) {
    marcarLida(n.id)
    setOpen(false)
    if (n.referencia_tipo === 'cotacao' && n.referencia_id) router.push(`/cotacoes/${n.referencia_id}`)
    else if (n.referencia_tipo === 'contrato' && n.referencia_id) router.push(`/contratos/${n.referencia_id}`)
  }

  function tempoRelativo(dt: string) {
    const diff = Date.now() - new Date(dt).getTime()
    const min  = Math.floor(diff / 60000)
    const hrs  = Math.floor(min / 60)
    const dias = Math.floor(hrs / 24)
    if (min < 1)   return 'agora'
    if (min < 60)  return `${min}min`
    if (hrs < 24)  return `${hrs}h`
    return `${dias}d`
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Botão sininho */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        title="Notificações"
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer',
          padding:'6px', borderRadius:'var(--r-md)', color:'var(--t-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'background 150ms' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-header)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {naoLidas > 0 && (
          <span style={{ position:'absolute', top:2, right:2, background:'var(--c-danger)',
            color:'#fff', borderRadius:999, width:16, height:16, fontSize:10, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:340, zIndex:9999,
          background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)',
          boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>
              Notificações {naoLidas > 0 && <span style={{ color:'var(--c-danger)', fontWeight:800 }}>({naoLidas})</span>}
            </span>
            {naoLidas > 0 && (
              <button onClick={marcarTodas}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'var(--fs-sm)',
                  color:'var(--c-primary)', fontWeight:600 }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight:380, overflowY:'auto' }}>
            {loading && notifs.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--t-muted)', fontSize:'var(--fs-md)' }}>
                Carregando...
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding:'32px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                <div style={{ color:'var(--t-muted)', fontSize:'var(--fs-md)' }}>Nenhuma notificação</div>
              </div>
            ) : notifs.map(n => (
              <div key={n.id}
                onClick={() => navegar(n)}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
                  cursor:'pointer', display:'flex', gap:10, alignItems:'flex-start',
                  background: n.lida ? 'transparent' : 'var(--c-primary-light,#e8f4f8)',
                  transition:'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-header)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.lida ? 'transparent' : 'var(--c-primary-light,#e8f4f8)')}
              >
                <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight: n.lida ? 400 : 700, fontSize:'var(--fs-md)',
                    color:'var(--t-primary)', marginBottom:2 }}>
                    {n.titulo}
                  </div>
                  {n.mensagem && (
                    <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {n.mensagem}
                    </div>
                  )}
                  <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:4 }}>
                    {tempoRelativo(n.created_at)}
                  </div>
                </div>
                {!n.lida && (
                  <div style={{ width:8, height:8, borderRadius:999, background:'var(--c-primary)', flexShrink:0, marginTop:5 }}/>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
