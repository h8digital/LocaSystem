// build: 2026-06-02
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notif {
  id: number; tipo: string; titulo: string; mensagem?: string
  referencia_tipo?: string; referencia_id?: number
  lida: boolean; created_at: string
}

const TIPO_ICON: Record<string, string> = {
  cotacao_aprovada:  '✅',
  cotacao_reprovada: '❌',
  contrato_vencendo: '⏰',
  manutencao:        '🔧',
  pagamento:         '💰',
  sistema:           'ℹ️',
}

function tempoRelativo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const min  = Math.floor(diff / 60000)
  const hrs  = Math.floor(min / 60)
  const dias = Math.floor(hrs / 24)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  if (hrs < 24) return `${hrs}h atrás`
  if (dias < 7) return `${dias}d atrás`
  return new Date(dt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
}

export default function Notificacoes() {
  const [open,     setOpen]     = useState(false)
  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const ref    = useRef<HTMLDivElement>(null)
  const router = useRouter()

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/notificacoes')
      const data = await res.json()
      if (data.ok) { setNotifs(data.data ?? []); setNaoLidas(data.nao_lidas ?? 0) }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
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
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifs(p => p.map(n => n.id === id ? { ...n, lida: true } : n))
    setNaoLidas(p => Math.max(0, p - 1))
  }

  async function marcarTodas() {
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true }),
    })
    setNotifs(p => p.map(n => ({ ...n, lida: true })))
    setNaoLidas(0)
  }

  function navegar(n: Notif) {
    marcarLida(n.id)
    setOpen(false)
    if (n.referencia_tipo === 'cotacao'   && n.referencia_id) router.push(`/cotacoes/${n.referencia_id}`)
    if (n.referencia_tipo === 'contrato'  && n.referencia_id) router.push(`/contratos/${n.referencia_id}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Botão sininho — largura total para ficar alinhado com o card de usuário */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        title="Notificações"
        style={{
          position: 'relative', border: 'none', cursor: 'pointer',
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#a5b4fc' : 'var(--t-secondary)',
          background: open ? 'rgba(99,102,241,0.12)' : 'transparent',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#ef4444', color: '#fff', borderRadius: 999,
            minWidth: 16, height: 16, paddingInline: 3,
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {/* Dropdown — abre para CIMA (bottom: 100% + gap) pois está no rodapé */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 320,
          zIndex: 9999,
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-base)', color: 'var(--t-primary)' }}>
              Notificações
              {naoLidas > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff',
                  fontSize: 10, fontWeight: 800, borderRadius: 999,
                  padding: '1px 6px', verticalAlign: 'middle' }}>
                  {naoLidas}
                </span>
              )}
            </span>
            {naoLidas > 0 && (
              <button onClick={marcarTodas}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-sm)', color: 'var(--c-primary)', fontWeight: 600 }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading && notifs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--t-muted)', fontSize: 'var(--fs-md)' }}>
                Carregando...
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <div style={{ color: 'var(--t-muted)', fontSize: 'var(--fs-md)' }}>
                  Nenhuma notificação
                </div>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => navegar(n)}
                  style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: n.lida ? 'transparent' : 'rgba(99,102,241,0.08)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-header)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.lida ? 'transparent' : 'rgba(99,102,241,0.08)')}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {TIPO_ICON[n.tipo] ?? '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: n.lida ? 400 : 700,
                      fontSize: 'var(--fs-md)',
                      color: 'var(--t-primary)',
                      marginBottom: 2,
                      lineHeight: 1.4,
                    }}>
                      {n.titulo}
                    </div>
                    {n.mensagem && (
                      <div style={{
                        fontSize: 'var(--fs-sm)', color: 'var(--t-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                        lineHeight: 1.4,
                      }}>
                        {n.mensagem}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--t-muted)', marginTop: 4 }}>
                      {tempoRelativo(n.created_at)}
                    </div>
                  </div>
                  {!n.lida && (
                    <div style={{
                      width: 8, height: 8, borderRadius: 999,
                      background: '#6366f1', flexShrink: 0, marginTop: 5,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--t-muted)' }}>
                {notifs.length} notificação{notifs.length !== 1 ? 's' : ''}
                {naoLidas > 0 ? ` · ${naoLidas} não lida${naoLidas !== 1 ? 's' : ''}` : ' · todas lidas'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
