// build: 2026-05-26 01:37:21 UTC
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase, fmt } from '@/lib/supabase'
import { PageHeader, Badge, Btn, SlidePanel, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'

const FORMAS = ['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','cheque']
const fmtForma = (v: string) => v?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()) ?? '—'
const fmtTipo  = (v: string) => v?.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()) ?? '—'

// ── Menu ⋮ do financeiro ──────────────────────────────────────────────────────
// Usa dupla proteção: menuRef para não fechar ao clicar no menu,
// e onMouseDown stopPropagation para não fechar antes do click
function FatMenu({ onEditar, onRecibo, onFatura, onExcluir }: {
  onEditar:  () => void | Promise<void>
  onRecibo:  () => void | Promise<void>
  onFatura:  () => void | Promise<void>
  onExcluir: () => void | Promise<void>
  row?:      any
}) {
  const [open,    setOpen]    = useState(false)
  const [pos,     setPos]     = useState({ top: 0, right: 0 })
  const [mounted, setMounted] = useState(false)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function toggle() {
    if (!btnRef.current) return
    if (open) { setOpen(false); return }
    const r = btnRef.current.getBoundingClientRect()
    const vH = window.innerHeight
    const vW = window.innerWidth
    const acima = vH - r.bottom < 180 && r.top > 180
    setPos({
      top:   acima ? r.top - 180 - 4 : r.bottom + 4,
      right: vW - r.right,
    })
    setOpen(true)
  }

  function executar(fn: () => void) {
    setOpen(false)
    // pequeno delay para garantir que o menu fecha antes da ação
    setTimeout(() => { try { fn() } catch(e) { console.error('FatMenu erro:', e) } finally { document.body.style.overflow = '' } }, 50)
  }

  const acoes = [
    { label: '✏️ Editar Fatura',    fn: onEditar,  danger: false },
    { label: '🖨️ Imprimir Recibo', fn: onRecibo,  danger: false },
    { label: '📄 Imprimir Fatura',  fn: onFatura,  danger: false },
    { label: '🗑️ Excluir',          fn: onExcluir, danger: true  },
  ]

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Mais ações"
        style={{
          background: open ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${open ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 'var(--r-sm)', width: 28, height: 28,
          cursor: 'pointer', color: open ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
          fontWeight: 700, fontSize: 16, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s', fontFamily: 'var(--font-sans)',
        }}>
        ⋮
      </button>

      {open && mounted && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: pos.top, right: pos.right,
            zIndex: 99999, minWidth: 190,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
          {acoes.map(a => (
            <button
              key={a.label}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => executar(a.fn)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: 'transparent', border: 'none',
                color: a.danger ? 'var(--c-danger)' : 'rgba(255,255,255,0.85)',
                fontSize: 'var(--fs-md)', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background .12s',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  a.danger ? 'rgba(248,113,113,0.15)' : 'rgba(129,140,248,0.15)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}>
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}


export default function FinanceiroPage() {
  const [faturas,  setFaturas]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [kpis,     setKpis]     = useState({ total:0, recebido:0, pendente:0, vencidas:0, nVencidas:0 })
  const [usuario,  setUsuario]  = useState<any>(null)

  // Filtros
  const [busca,       setBusca]      = useState('')
  const [fStatus,     setFStatus]    = useState('')
  const [fTipo,       setFTipo]      = useState('')
  const [fVencDe,     setFVencDe]    = useState('')
  const [fVencAte,    setFVencAte]   = useState('')
  const [fPagDe,      setFPagDe]     = useState('')
  const [fPagAte,     setFPagAte]    = useState('')

  // Painel de edição
  const [painelEdit,   setPainelEdit]   = useState(false)
  const [faturaEdit,   setFaturaEdit]   = useState<any>(null)
  const [formEdit,     setFormEdit]     = useState<any>({})
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [erroEdit,     setErroEdit]     = useState('')

  // Painel de recebimento
  const [painel,       setPainel]       = useState(false)
  const [faturaAlvo,   setFaturaAlvo]   = useState<any>(null)
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [loadingRec,   setLoadingRec]   = useState(false)
  const [salvando,     setSalvando]     = useState(false)
  const [erro,         setErro]         = useState('')
  const [formRec, setFormRec] = useState({
    valor: '', data_recebimento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix', observacoes: '',
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(d.user) setUsuario(d.user) })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const hoje = new Date().toISOString().split('T')[0]

    // KPIs — sem filtros
    const { data: todas } = await supabase
      .from('faturas')
      .select('valor, valor_recebido, saldo_restante, status, data_vencimento')
    const lt = todas ?? []
    setKpis({
      total:     lt.reduce((s,f) => s + Number(f.valor), 0),
      recebido:  lt.reduce((s,f) => s + Number(f.valor_recebido ?? 0), 0),
      pendente:  lt.filter(f=>f.status!=='pago'&&f.status!=='cancelado')
                   .reduce((s,f) => s + Number(f.saldo_restante ?? f.valor), 0),
      vencidas:  lt.filter(f=>f.status==='pendente'&&f.data_vencimento<hoje)
                   .reduce((s,f) => s + Number(f.saldo_restante ?? f.valor), 0),
      nVencidas: lt.filter(f=>f.status==='pendente'&&f.data_vencimento<hoje).length,
    })

    // Tabela — com filtros
    let q = supabase.from('faturas')
      .select('id,numero,tipo,status,valor,valor_recebido,saldo_restante,data_vencimento,data_pagamento,forma_pagamento,descricao,observacoes,contratos(numero,clientes(nome))')
      .order('data_vencimento', { ascending: true })

    if (fStatus)  q = q.eq('status', fStatus)
    if (fTipo)    q = q.eq('tipo', fTipo)
    if (fVencDe)  q = q.gte('data_vencimento', fVencDe)
    if (fVencAte) q = q.lte('data_vencimento', fVencAte)
    if (fPagDe)   q = q.gte('data_pagamento', fPagDe)
    if (fPagAte)  q = q.lte('data_pagamento', fPagAte)
    const { data: rawData } = await q.limit(500)
    let resultado = rawData ?? []

    // Filtro client-side por nome do cliente (busca livre)
    if (busca.trim()) {
      const b = busca.trim().toLowerCase()
      resultado = resultado.filter((f: any) =>
        (f.numero ?? '').toLowerCase().includes(b) ||
        (f.descricao ?? '').toLowerCase().includes(b) ||
        ((f.contratos as any)?.clientes?.nome ?? '').toLowerCase().includes(b) ||
        ((f.contratos as any)?.numero ?? '').toLowerCase().includes(b)
      )
    }

    setFaturas(resultado)
    setLoading(false)
  }, [busca, fStatus, fTipo, fVencDe, fVencAte, fPagDe, fPagAte])

  useEffect(() => { load() }, [load])

  // ── Painel de recebimento ─────────────────────────────────────────────────
  async function abrirPainel(fatura: any) {
    setFaturaAlvo(fatura)
    setFormRec({
      valor:            String(fatura.saldo_restante ?? fatura.valor),
      data_recebimento: new Date().toISOString().split('T')[0],
      forma_pagamento:  fatura.forma_pagamento ?? 'pix',
      observacoes:      '',
    })
    setErro(''); setPainel(true)
    setLoadingRec(true)
    const { data } = await supabase.from('fatura_recebimentos')
      .select('*, usuarios(nome)').eq('fatura_id', fatura.id)
      .order('data_recebimento', { ascending: false })
    setRecebimentos(data ?? []); setLoadingRec(false)
  }

  async function confirmarRecebimento() {
    const valor = Number(formRec.valor)
    if (!valor || valor <= 0) { setErro('Informe um valor válido.'); return }
    if (!formRec.data_recebimento) { setErro('Informe a data.'); return }
    const saldoAtual = Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor)
    if (valor > saldoAtual + 0.01) { setErro(`Valor excede saldo de ${fmt.money(saldoAtual)}.`); return }
    setSalvando(true); setErro('')
    await supabase.from('fatura_recebimentos').insert({
      fatura_id: faturaAlvo.id, valor,
      data_recebimento: formRec.data_recebimento,
      forma_pagamento:  formRec.forma_pagamento,
      observacoes:      formRec.observacoes || null,
      usuario_id:       usuario?.id ?? null,
    })
    const novoRecebido = Number(faturaAlvo.valor_recebido ?? 0) + valor
    const novoSaldo    = Number(faturaAlvo.valor) - novoRecebido
    const novoStatus   = novoSaldo <= 0.005 ? 'pago' : 'parcial'
    await supabase.from('faturas').update({
      valor_recebido: novoRecebido, saldo_restante: Math.max(0, novoSaldo),
      status: novoStatus,
      data_pagamento: novoStatus === 'pago' ? formRec.data_recebimento : null,
      forma_pagamento: formRec.forma_pagamento,
    }).eq('id', faturaAlvo.id)
    const { data: fat } = await supabase.from('faturas')
      .select('id,numero,tipo,status,valor,valor_recebido,saldo_restante,data_vencimento,data_pagamento,forma_pagamento,descricao,contratos(numero,clientes(nome))')
      .eq('id', faturaAlvo.id).single()
    if (fat) { setFaturaAlvo(fat); setFaturas(p => p.map(f => f.id === fat.id ? fat : f)) }
    const { data: recs } = await supabase.from('fatura_recebimentos')
      .select('*, usuarios(nome)').eq('fatura_id', faturaAlvo.id)
      .order('data_recebimento', { ascending: false })
    setRecebimentos(recs ?? [])
    setFormRec(f => ({ ...f, valor: String(Math.max(0, novoSaldo)), observacoes: '' }))
    setSalvando(false); load()
  }

  async function estornarRecebimento(rec: any) {
    if (!confirm(`Estornar ${fmt.money(rec.valor)}?`)) return
    await supabase.from('fatura_recebimentos').delete().eq('id', rec.id)
    const novoRecebido = Math.max(0, Number(faturaAlvo.valor_recebido ?? 0) - Number(rec.valor))
    const novoSaldo    = Number(faturaAlvo.valor) - novoRecebido
    const novoStatus   = novoRecebido <= 0 ? 'pendente' : 'parcial'
    await supabase.from('faturas').update({
      valor_recebido: novoRecebido, saldo_restante: novoSaldo,
      status: novoStatus, data_pagamento: null,
    }).eq('id', faturaAlvo.id)
    const { data: fat } = await supabase.from('faturas')
      .select('id,numero,tipo,status,valor,valor_recebido,saldo_restante,data_vencimento,data_pagamento,forma_pagamento,contratos(numero,clientes(nome))')
      .eq('id', faturaAlvo.id).single()
    if (fat) { setFaturaAlvo(fat); setFaturas(p => p.map(f => f.id === fat.id ? fat : f)) }
    const { data: recs } = await supabase.from('fatura_recebimentos')
      .select('*, usuarios(nome)').eq('fatura_id', faturaAlvo.id)
      .order('data_recebimento', { ascending: false })
    setRecebimentos(recs ?? []); load()
  }

  // ── Editar fatura ─────────────────────────────────────────────────────────
  function abrirEdicao(fat: any) {
    setFaturaEdit(fat)
    setFormEdit({ descricao: fat.descricao ?? '', data_vencimento: fat.data_vencimento ?? '',
      forma_pagamento: fat.forma_pagamento ?? '', observacoes: fat.observacoes ?? '' })
    setErroEdit(''); setPainelEdit(true)
  }

  async function salvarEdicao() {
    setSalvandoEdit(true); setErroEdit('')
    try {
      const { error } = await supabase.from('faturas').update({
        descricao: formEdit.descricao, data_vencimento: formEdit.data_vencimento,
        forma_pagamento: formEdit.forma_pagamento || null, observacoes: formEdit.observacoes,
      }).eq('id', faturaEdit.id)
      if (error) throw error
      setPainelEdit(false); load()
    } catch(e:any) { setErroEdit(e.message) }
    finally { setSalvandoEdit(false) }
  }

  async function excluirFatura(fat: any) {
    if (!confirm(`Excluir a fatura ${fat.numero}? Esta ação é irreversível.`)) return
    const { data: recs } = await supabase.from('fatura_recebimentos').select('id').eq('fatura_id', fat.id)
    if (recs && recs.length > 0) {
      alert(`Esta fatura possui ${recs.length} recebimento(s) e não pode ser excluída. Estorne antes.`); return
    }
    await supabase.from('faturas').delete().eq('id', fat.id); load()
  }

  async function imprimirRecibo(fat: any) {
    // Fechar painéis antes de abrir nova janela — evita overflow:hidden preso
    setPainel(false); setPainelEdit(false)
    const res = await fetch('/api/documentos/fatura', { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ fatura_id: fat.id, tipo:'recibo' }) })
    const r = await res.json()
    if (!r.ok) { alert('Erro: ' + r.error); return }
    const w = window.open('', '_blank')
    if (w) { w.document.write(r.html); w.document.close(); setTimeout(()=>w.print(), 800) }
    // Garantir restauração do overflow após abrir nova janela
    document.body.style.overflow = ''
  }

  async function imprimirFatura(fat: any) {
    // Fechar painéis antes de abrir nova janela — evita overflow:hidden preso
    setPainel(false); setPainelEdit(false)
    const res = await fetch('/api/documentos/fatura', { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ fatura_id: fat.id, tipo:'fatura' }) })
    const r = await res.json()
    if (!r.ok) { alert('Erro: ' + r.error); return }
    const w = window.open('', '_blank')
    if (w) { w.document.write(r.html); w.document.close(); setTimeout(()=>w.print(), 800) }
    // Garantir restauração do overflow após abrir nova janela
    document.body.style.overflow = ''
  }

  const hoje = new Date().toISOString().split('T')[0]
  const saldo = faturaAlvo ? Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor) : 0

  function limparFiltros() {
    setBusca(''); setFStatus(''); setFTipo('')
    setFVencDe(''); setFVencAte(''); setFPagDe(''); setFPagAte('')
  }

  const Th = ({ children, right }: any) => (
    <th style={{ padding:'8px 14px', textAlign: right?'right':'left',
      fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.38)',
      textTransform:'uppercase', letterSpacing:'0.05em',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      background:'rgba(255,255,255,0.03)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  )
  const Td = ({ children, right, mono }: any) => (
    <td style={{ padding:'10px 14px', textAlign: right?'right':'left',
      fontFamily: mono?'var(--font-mono)':undefined,
      borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      {children}
    </td>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <PageHeader title="Financeiro" subtitle="Faturas e recebimentos" />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {([
          { l:'Total Faturado',  v: fmt.money(kpis.total),    accent:'#94a3b8' },
          { l:'Recebido',        v: fmt.money(kpis.recebido), accent:'#34d399' },
          { l:'Em Aberto',       v: fmt.money(kpis.pendente), accent:'#818cf8' },
          { l:'Vencidas',        v: fmt.money(kpis.vencidas), accent:'#f87171',
            sub: kpis.nVencidas > 0 ? `${kpis.nVencidas} fatura(s)` : undefined },
          { l:'Inadimplência',   v: kpis.total > 0 ? (kpis.vencidas/kpis.total*100).toFixed(1)+'%' : '0%', accent:'#fbbf24' },
        ] as any[]).map(k => (
          <div key={k.l} style={{
            background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
            border:'1px solid rgba(255,255,255,0.10)', borderTop:`2px solid ${k.accent}`,
            borderRadius:'var(--r-lg)', padding:'14px 16px',
          }}>
            <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.4)',
              textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:600, color:k.accent, lineHeight:1 }}>{k.v}</div>
            {k.sub && <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', marginTop:4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div style={{
        background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'14px 16px',
      }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
          {/* Busca */}
          <div style={{ flex:'1 1 200px', minWidth:180 }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Nº / Descrição / Cliente</div>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              className={inputCls} placeholder="Número, descrição ou nome do cliente..." style={{ width:'100%' }} />
          </div>

          {/* Status */}
          <div style={{ flex:'0 1 150px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Status</div>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className={selectCls} style={{ width:'100%' }}>
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="parcial">Pago Parcial</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Tipo */}
          <div style={{ flex:'0 1 150px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Tipo</div>
            <select value={fTipo} onChange={e=>setFTipo(e.target.value)} className={selectCls} style={{ width:'100%' }}>
              <option value="">Todos</option>
              <option value="locacao">Locação</option>
              <option value="antecipacao">Antecipação</option>
              <option value="avaria">Avaria</option>
              <option value="multa">Multa</option>
              <option value="limpeza">Limpeza</option>
              <option value="cobranca">Cobrança</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          {/* Vencimento de / até */}
          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Venc. de</div>
            <input type="date" value={fVencDe} onChange={e=>setFVencDe(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>
          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Venc. até</div>
            <input type="date" value={fVencAte} onChange={e=>setFVencAte(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          {/* Pagamento de / até */}
          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Pago de</div>
            <input type="date" value={fPagDe} onChange={e=>setFPagDe(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>
          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Pago até</div>
            <input type="date" value={fPagAte} onChange={e=>setFPagAte(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          {/* Limpar */}
          <button onClick={limparFiltros} style={{
            alignSelf:'flex-end', padding:'7px 14px', borderRadius:'var(--r-md)',
            background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.6)', fontSize:'var(--fs-md)', cursor:'pointer',
            fontFamily:'var(--font-sans)', transition:'all .15s', whiteSpace:'nowrap',
          }}>✕ Limpar</button>
        </div>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div style={{
        background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', overflow:'hidden',
      }}>
        {loading ? (
          <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
        ) : faturas.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-icon">🧾</div>
            <div className="ds-empty-title">Nenhuma fatura encontrada.</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-md)' }}>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Cliente / Contrato</Th>
                <Th>Tipo</Th>
                <Th>Vencimento</Th>
                <Th right>Valor</Th>
                <Th right>Recebido</Th>
                <Th right>Saldo</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {faturas.map(f => (
                <tr key={f.id}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(129,140,248,0.06)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  <Td mono>
                    <span style={{ fontWeight:700, color:'#818cf8' }}>{f.numero}</span>
                  </Td>
                  <Td>
                    <div style={{ fontWeight:500, color:'rgba(255,255,255,0.85)' }}>
                      {(f.contratos as any)?.clientes?.nome ?? '—'}
                    </div>
                    <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                      {(f.contratos as any)?.numero}
                    </div>
                  </Td>
                  <Td>
                    <span style={{ fontSize:'var(--fs-sm)', color:'rgba(255,255,255,0.55)' }}>
                      {fmtTipo(f.tipo)}
                    </span>
                  </Td>
                  <Td>
                    <span style={{
                      color: f.status==='pendente'&&f.data_vencimento<hoje ? 'var(--c-danger)' : 'rgba(255,255,255,0.75)',
                      fontWeight: f.status==='pendente'&&f.data_vencimento<hoje ? 700 : 400,
                    }}>
                      {fmt.date(f.data_vencimento)}
                      {f.status==='pendente'&&f.data_vencimento<hoje && ' ⚠'}
                    </span>
                  </Td>
                  <Td right>
                    <span style={{ fontWeight:700, color:'rgba(255,255,255,0.85)' }}>
                      {fmt.money(f.valor)}
                    </span>
                  </Td>
                  <Td right>
                    <span style={{ color: Number(f.valor_recebido)>0 ? 'var(--c-success)' : 'rgba(255,255,255,0.25)', fontWeight: Number(f.valor_recebido)>0 ? 600 : 400 }}>
                      {Number(f.valor_recebido)>0 ? fmt.money(f.valor_recebido) : '—'}
                    </span>
                  </Td>
                  <Td right>
                    <span style={{ fontWeight:700, color: Number(f.saldo_restante??f.valor)>0 ? 'var(--c-danger)' : 'var(--c-success)' }}>
                      {fmt.money(f.saldo_restante ?? f.valor)}
                    </span>
                  </Td>
                  <Td>
                    <Badge value={f.status} dot />
                  </Td>
                  <td style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'flex-end' }}>
                      {f.status !== 'pago' && f.status !== 'cancelado' && (
                        <button onClick={() => abrirPainel(f)}
                          style={{ background:'linear-gradient(135deg,#6366f1,#818cf8)',
                            color:'#fff', border:'none', borderRadius:'var(--r-sm)',
                            padding:'4px 10px', fontWeight:600, fontSize:'var(--fs-sm)',
                            cursor:'pointer', whiteSpace:'nowrap' }}>
                          Receber
                        </button>
                      )}
                      <FatMenu row={f}
                        onEditar={() => abrirEdicao(f)}
                        onRecibo={() => imprimirRecibo(f)}
                        onFatura={() => imprimirFatura(f)}
                        onExcluir={() => excluirFatura(f)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Painel de Recebimento ─────────────────────────────────────────── */}
      <SlidePanel
        open={painel} onClose={() => setPainel(false)}
        title="Registrar Recebimento" subtitle={faturaAlvo?.numero} width="md"
        footer={
          faturaAlvo?.status !== 'pago' ? (
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainel(false)}>Fechar</Btn>
              <Btn style={{ flex:2 }} loading={salvando} onClick={confirmarRecebimento}>Confirmar Recebimento</Btn>
            </div>
          ) : (
            <Btn variant="secondary" style={{ width:'100%' }} onClick={() => setPainel(false)}>Fechar</Btn>
          )
        }>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {faturaAlvo && (
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)',
              borderRadius:'var(--r-md)', padding:'14px 16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[
                  { l:'Fatura',      v: faturaAlvo.numero },
                  { l:'Cliente',     v: (faturaAlvo.contratos as any)?.clientes?.nome ?? '—' },
                  { l:'Contrato',    v: (faturaAlvo.contratos as any)?.numero ?? '—' },
                  { l:'Valor Total', v: fmt.money(faturaAlvo.valor),              c:'rgba(255,255,255,0.85)' },
                  { l:'Recebido',    v: fmt.money(faturaAlvo.valor_recebido??0),  c:'var(--c-success)' },
                  { l:'Saldo',       v: fmt.money(saldo), c: saldo>0?'var(--c-danger)':'var(--c-success)' },
                ].map(k => (
                  <div key={k.l}>
                    <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.04em' }}>{k.l}</div>
                    <div style={{ fontWeight:700, color:(k as any).c ?? 'rgba(255,255,255,0.85)' }}>{k.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {faturaAlvo?.status === 'pago' && (
            <div style={{ background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.3)',
              borderRadius:'var(--r-md)', padding:'12px 16px', color:'var(--c-success)',
              fontWeight:600, textAlign:'center' }}>
              ✓ Fatura totalmente recebida
            </div>
          )}

          {faturaAlvo?.status !== 'pago' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.06em' }}>Novo Recebimento</div>
              {erro && <div className="ds-alert-error">{erro}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FormField label="Valor (R$)">
                  <input type="number" step="0.01" min="0.01" max={saldo}
                    value={formRec.valor}
                    onChange={e => setFormRec(f => ({ ...f, valor: e.target.value }))}
                    className={inputCls} autoFocus />
                </FormField>
                <FormField label="Data do Recebimento">
                  <input type="date" value={formRec.data_recebimento}
                    onChange={e => setFormRec(f => ({ ...f, data_recebimento: e.target.value }))}
                    className={inputCls} />
                </FormField>
              </div>
              <FormField label="Forma de Pagamento">
                <select value={formRec.forma_pagamento}
                  onChange={e => setFormRec(f => ({ ...f, forma_pagamento: e.target.value }))}
                  className={selectCls}>
                  {FORMAS.map(v => <option key={v} value={v}>{fmtForma(v)}</option>)}
                </select>
              </FormField>
              <FormField label="Observações">
                <textarea value={formRec.observacoes}
                  onChange={e => setFormRec(f => ({ ...f, observacoes: e.target.value }))}
                  className={textareaCls} rows={2} placeholder="Comprovante, banco, referência..." />
              </FormField>
              {Number(formRec.valor) > 0 && (
                <div style={{ background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.3)',
                  borderRadius:'var(--r-sm)', padding:'9px 14px',
                  display:'flex', justifyContent:'space-between', fontSize:'var(--fs-md)' }}>
                  <span style={{ color:'rgba(255,255,255,0.55)' }}>Saldo após este recebimento:</span>
                  <span style={{ fontWeight:700, color: (saldo-Number(formRec.valor))<=0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {fmt.money(Math.max(0, saldo - Number(formRec.valor)))}
                    {(saldo - Number(formRec.valor)) <= 0 && ' — QUITADA'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Histórico de Recebimentos</div>
            {loadingRec ? (
              <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
            ) : recebimentos.length === 0 ? (
              <div style={{ color:'rgba(255,255,255,0.3)', fontSize:'var(--fs-md)', fontStyle:'italic', padding:'8px 0' }}>
                Nenhum recebimento registrado.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Data','Valor','Forma','Usuário',''].map(h => (
                      <th key={h} style={{ padding:'6px 10px', fontSize:'var(--fs-xs)', fontWeight:600,
                        color:'rgba(255,255,255,0.35)', textAlign: h==='Valor'?'right':'left',
                        background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.08)',
                        textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recebimentos.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>{fmt.date(rec.data_recebimento)}</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--c-success)', textAlign:'right', borderBottom:'1px solid rgba(255,255,255,0.05)', fontFamily:'var(--font-mono)' }}>{fmt.money(rec.valor)}</td>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', color:'rgba(255,255,255,0.55)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>{fmtForma(rec.forma_pagamento ?? '')}</td>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', color:'rgba(255,255,255,0.35)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>{(rec.usuarios as any)?.nome ?? '—'}</td>
                      <td style={{ padding:'6px 8px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <button onClick={() => estornarRecebimento(rec)}
                          className="tbl-btn" title="Estornar"
                          style={{ color:'var(--c-warning)' }}>↩</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ padding:'8px 10px', fontWeight:700, fontSize:'var(--fs-md)', borderTop:'2px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)' }}>Total recebido</td>
                    <td style={{ padding:'8px 10px', fontWeight:800, textAlign:'right', color:'var(--c-success)', borderTop:'2px solid rgba(255,255,255,0.1)', fontFamily:'var(--font-mono)' }}>
                      {fmt.money(recebimentos.reduce((s,r) => s + Number(r.valor), 0))}
                    </td>
                    <td colSpan={3} style={{ borderTop:'2px solid rgba(255,255,255,0.1)' }} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </SlidePanel>

      {/* ── Painel de Edição ──────────────────────────────────────────────── */}
      <SlidePanel
        open={painelEdit} onClose={() => setPainelEdit(false)}
        title="Editar Fatura" subtitle={faturaEdit?.numero} width="sm"
        footer={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainelEdit(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvandoEdit} onClick={salvarEdicao}>Salvar</Btn>
          </div>
        }>
        {faturaEdit && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {erroEdit && <div className="ds-alert-error">{erroEdit}</div>}
            <FormField label="Descrição">
              <input className={inputCls} value={formEdit.descricao}
                onChange={e=>setFormEdit({...formEdit,descricao:e.target.value})} placeholder="Descrição da fatura" />
            </FormField>
            <FormField label="Vencimento">
              <input type="date" className={inputCls} value={formEdit.data_vencimento}
                onChange={e=>setFormEdit({...formEdit,data_vencimento:e.target.value})} />
            </FormField>
            <FormField label="Forma de Pagamento">
              <select className={selectCls} value={formEdit.forma_pagamento}
                onChange={e=>setFormEdit({...formEdit,forma_pagamento:e.target.value})}>
                <option value="">— Selecione —</option>
                {FORMAS.map(f=><option key={f} value={f}>{fmtForma(f)}</option>)}
              </select>
            </FormField>
            <FormField label="Observações">
              <textarea className={textareaCls} rows={3} value={formEdit.observacoes}
                onChange={e=>setFormEdit({...formEdit,observacoes:e.target.value})} />
            </FormField>
          </div>
        )}
      </SlidePanel>

    </div>
  )
}
