// build: 2026-05-29 17:55:15
'use client'
import { useEffect, useState, useCallback } from 'react'
import { fmt } from '@/lib/supabase'
import { PageHeader, Btn, inputCls, selectCls } from '@/components/ui'

const NIVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  error: { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: 'ERRO' },
  warn:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'AVISO' },
  info:  { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', label: 'INFO' },
  debug: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', label: 'DEBUG' },
}

export default function SystemLogsPage() {
  const [logs,    setLogs]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fNivel,  setFNivel]  = useState('error')
  const [fOrigem, setFOrigem] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [limpando, setLimpando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limite: '200' })
    if (fNivel)  params.set('nivel', fNivel)
    if (fOrigem) params.set('origem', fOrigem)
    const res  = await fetch(`/api/system/logs?${params}`)
    const data = await res.json()
    setLogs(data.logs ?? [])
    setLoading(false)
  }, [fNivel, fOrigem])

  useEffect(() => { load() }, [load])

  async function limparAntigos() {
    if (!confirm('Remover logs com mais de 30 dias?')) return
    setLimpando(true)
    const res  = await fetch('/api/system/logs', { method: 'DELETE' })
    const data = await res.json()
    alert(`${data.removidos ?? 0} log(s) removido(s).`)
    setLimpando(false); load()
  }

  const nivelInfo = (n: string) => NIVEL_STYLE[n] ?? NIVEL_STYLE.debug

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <PageHeader title="🪵 Log do Sistema" subtitle="Erros e eventos registrados pelas APIs"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={load}>↻ Atualizar</Btn>
            <Btn loading={limpando} onClick={limparAntigos}
              style={{ background: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
              🗑 Limpar &gt; 30d
            </Btn>
          </div>
        }
      />

      {/* Filtros */}
      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '12px 16px',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 1 140px' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Nível</div>
          <select value={fNivel} onChange={e => setFNivel(e.target.value)} className={selectCls} style={{ width: '100%' }}>
            <option value="">Todos</option>
            <option value="error">Erros</option>
            <option value="warn">Avisos</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Origem (API)</div>
          <input value={fOrigem} onChange={e => setFOrigem(e.target.value)}
            className={inputCls} placeholder="Ex: cotacoes/rapida" style={{ width: '100%' }} />
        </div>
        <button onClick={() => { setFNivel('error'); setFOrigem('') }}
          style={{ alignSelf: 'flex-end', padding: '7px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)', fontSize: 'var(--fs-md)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)' }}>✕ Limpar</button>
        {!loading && <div style={{ alignSelf: 'flex-end', fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.3)', paddingBottom: 8 }}>
          {logs.length} registro(s)
        </div>}
      </div>

      {/* Tabela de logs */}
      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
        ) : logs.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-icon">✅</div>
            <div className="ds-empty-title">Nenhum log encontrado.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-md)' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Data/Hora', 'Nível', 'Origem', 'Mensagem', 'Usuário', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left',
                    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.38)',
                    textTransform: 'uppercase', letterSpacing: '.05em',
                    borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const ni   = nivelInfo(log.nivel)
                const open = expanded === log.id
                return (
                  <>
                    <tr key={log.id}
                      onClick={() => setExpanded(open ? null : log.id)}
                      style={{ cursor: 'pointer', borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.06)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)',
                        color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                        {fmt.datetime(log.created_at)}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                          background: ni.bg, color: ni.color, border: `1px solid ${ni.color}40` }}>
                          {ni.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)',
                        color: 'rgba(255,255,255,0.55)' }}>
                        {log.origem}
                      </td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.82)',
                        maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.mensagem}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 'var(--fs-sm)', color: 'rgba(255,255,255,0.35)' }}>
                        {log.usuarios?.nome ?? '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                        {open ? '▲' : '▼'}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={6} style={{ padding: '0 14px 12px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                          {log.detalhe && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
                                letterSpacing: '.05em', marginBottom: 4 }}>Detalhe</div>
                              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                                color: '#f87171', background: 'rgba(248,113,113,0.08)',
                                border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6,
                                padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {log.detalhe}
                              </pre>
                            </div>
                          )}
                          {log.contexto && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
                                letterSpacing: '.05em', marginBottom: 4 }}>Contexto (JSON)</div>
                              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                                color: '#94a3b8', background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                                padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(log.contexto, null, 2)}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
