'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'

export default function EmailsPage() {
  const [logs,     setLogs]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filtros,  setFiltros]  = useState({ busca:'', status:'' })

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('email_log')
      .select('*, usuarios(nome), contratos(numero)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filtros.status) q = q.eq('status', filtros.status)
    if (filtros.busca)  q = q.or(`para.ilike.%${filtros.busca}%,assunto.ilike.%${filtros.busca}%`)
    const { data } = await q
    setLogs(data ?? [])
    setLoading(false)
  }, [filtros])

  useEffect(() => { load() }, [load])

  const total   = logs.length
  const enviados = logs.filter(l => l.status === 'enviado').length
  const erros    = logs.filter(l => l.status === 'erro').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 0 12px', borderBottom:'1px solid var(--border)', marginBottom:14 }}>
        <div>
          <h1 style={{ fontWeight:700, fontSize:'var(--fs-xl)', color:'var(--t-primary)', margin:0, lineHeight:1.2 }}>
            Log de E-mails
          </h1>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
            Histórico de todos os e-mails enviados pelo sistema
          </div>
        </div>
        <Btn variant="secondary" onClick={load}>↺ Atualizar</Btn>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
        {[
          { l:'Total Enviados',  v: total,    c:'var(--c-primary)'          },
          { l:'Com Sucesso',     v: enviados, c:'var(--c-success,#16a34a)'  },
          { l:'Com Erro',        v: erros,    c:'var(--c-danger)'            },
        ].map(k => (
          <div key={k.l} style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
            borderRadius:'var(--r-md)', padding:'14px 18px', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{k.l}</div>
            <div style={{ fontSize:'var(--fs-kpi)', fontWeight:800, color:k.c, lineHeight:1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Filtros ────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'2 1 200px' }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--t-muted)', pointerEvents:'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input className="ds-input" style={{ paddingLeft:32, width:'100%' }}
            placeholder="Buscar por destinatário ou assunto..."
            value={filtros.busca}
            onChange={e => setFiltros(f => ({ ...f, busca:e.target.value }))} />
        </div>
        <select className="ds-input" style={{ flex:'0 0 auto', minWidth:140 }}
          value={filtros.status}
          onChange={e => setFiltros(f => ({ ...f, status:e.target.value }))}>
          <option value="">Todos os status</option>
          <option value="enviado">✅ Enviados</option>
          <option value="erro">❌ Com erro</option>
        </select>
        {Object.values(filtros).some(Boolean) && (
          <button onClick={() => setFiltros({ busca:'', status:'' })}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
              padding:'6px 12px', cursor:'pointer', fontSize:'var(--fs-md)', color:'var(--t-muted)',
              transition:'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--c-danger)'; e.currentTarget.style.color='var(--c-danger)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--t-muted)' }}>
            ✕ Limpar
          </button>
        )}
      </div>

      {/* ── Tabela ─────────────────────────────────────────────────── */}
      <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden',
        boxShadow:'var(--shadow-sm)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-md)' }}>
          <thead>
            <tr style={{ background:'var(--bg-header)' }}>
              {['Data/Hora','Contrato','Destinatário','Assunto','Usuário','Status'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600,
                  color:'var(--t-muted)', fontSize:'var(--fs-sm)', borderBottom:'1px solid var(--border)',
                  whiteSpace:'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'var(--t-muted)' }}>
                Carregando...
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding:'32px', textAlign:'center', color:'var(--t-muted)' }}>
                Nenhum e-mail encontrado.
              </td></tr>
            ) : logs.map((log, i) => (
              <tr key={log.id} style={{ borderBottom:'1px solid var(--border)',
                background: i%2===0 ? 'transparent' : 'var(--bg-header)' }}>
                <td style={{ padding:'8px 14px', whiteSpace:'nowrap', color:'var(--t-muted)',
                  fontSize:'var(--fs-sm)', fontFamily:'var(--font-mono)' }}>
                  {new Date(log.created_at).toLocaleDateString('pt-BR')}{' '}
                  {new Date(log.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                </td>
                <td style={{ padding:'8px 14px' }}>
                  {log.contratos?.numero
                    ? <a href={`/contratos/${log.contrato_id}`}
                        style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--c-primary)',
                          textDecoration:'none' }}>
                        {log.contratos.numero}
                      </a>
                    : <span style={{ color:'var(--t-muted)' }}>—</span>
                  }
                </td>
                <td style={{ padding:'8px 14px', fontWeight:500 }}>
                  <div>{log.para}</div>
                  {log.cc && <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)' }}>CC: {log.cc}</div>}
                </td>
                <td style={{ padding:'8px 14px', color:'var(--t-secondary)', maxWidth:240,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {log.assunto}
                </td>
                <td style={{ padding:'8px 14px', color:'var(--t-muted)', fontSize:'var(--fs-sm)' }}>
                  {log.usuarios?.nome ?? '—'}
                </td>
                <td style={{ padding:'8px 14px' }}>
                  {log.status === 'enviado' ? (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                      background:'var(--c-success-light,#dcfce7)', color:'var(--c-success,#16a34a)',
                      border:'1px solid var(--c-success,#16a34a)', borderRadius:'var(--r-sm)',
                      padding:'2px 8px', fontSize:'var(--fs-xs)', fontWeight:700 }}>
                      ✅ Enviado
                    </span>
                  ) : (
                    <span title={log.erro_msg}
                      style={{ display:'inline-flex', alignItems:'center', gap:4,
                        background:'var(--c-danger-light)', color:'var(--c-danger)',
                        border:'1px solid var(--c-danger)', borderRadius:'var(--r-sm)',
                        padding:'2px 8px', fontSize:'var(--fs-xs)', fontWeight:700,
                        cursor:'help' }}>
                      ❌ Erro
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length >= 200 && (
        <div style={{ textAlign:'center', padding:'10px', fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
          Exibindo os 200 registros mais recentes.
        </div>
      )}
    </div>
  )
}
