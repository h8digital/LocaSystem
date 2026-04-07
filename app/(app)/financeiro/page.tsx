'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { PageHeader, DataTable, Filters, Badge, Btn, SlidePanel, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'

const FORMAS = ['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','cheque']
const fmtForma = (v: string) => v?.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'
const fmtTipo  = (v: string) => v?.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}


export default function FinanceiroPage() {
  const [faturas,   setFaturas]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filters,   setFilters]   = useState<Record<string,string>>({ busca:'', status:'', tipo:'' })
  const [kpis,      setKpis]      = useState({ total:0, recebido:0, pendente:0, vencidas:0, nVencidas:0 })
  const [usuario,   setUsuario]   = useState<any>(null)

  // Painel de edição
  const [painelEdit,    setPainelEdit]    = useState(false)
  const [faturaEdit,    setFaturaEdit]    = useState<any>(null)
  const [formEdit,      setFormEdit]      = useState<any>({})
  const [salvandoEdit,  setSalvandoEdit]  = useState(false)
  const [erroEdit,      setErroEdit]      = useState('')

  // Painel de recebimento
  const [painel,        setPainel]        = useState(false)
  const [faturaAlvo,    setFaturaAlvo]    = useState<any>(null)
  const [recebimentos,  setRecebimentos]  = useState<any[]>([])
  const [loadingRec,    setLoadingRec]    = useState(false)
  const [salvando,      setSalvando]      = useState(false)
  const [erro,          setErro]          = useState('')
  const [formRec, setFormRec] = useState({
    valor:           '',
    data_recebimento:new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix',
    observacoes:     '',
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(d.user) setUsuario(d.user) })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)

    // ── Query SEM filtros → para os KPIs globais ──────────────────────────
    const { data: todas } = await supabase
      .from('faturas')
      .select('valor, valor_recebido, saldo_restante, status, data_vencimento')
      .order('data_vencimento', { ascending: true })

    const hoje = new Date().toISOString().split('T')[0]
    const listaTotal = todas ?? []
    setKpis({
      total:     listaTotal.reduce((s,f) => s + Number(f.valor), 0),
      recebido:  listaTotal.reduce((s,f) => s + Number(f.valor_recebido ?? 0), 0),
      pendente:  listaTotal
        .filter(f => f.status !== 'pago' && f.status !== 'cancelado')
        .reduce((s,f) => s + Number(f.saldo_restante ?? f.valor), 0),
      vencidas:  listaTotal
        .filter(f => f.status === 'pendente' && f.data_vencimento < hoje)
        .reduce((s,f) => s + Number(f.saldo_restante ?? f.valor), 0),
      nVencidas: listaTotal
        .filter(f => f.status === 'pendente' && f.data_vencimento < hoje).length,
    })

    // ── Query COM filtros → para a tabela ─────────────────────────────────
    let q = supabase
      .from('faturas')
      .select('*, contratos(numero, clientes(nome))')
      .order('data_vencimento', { ascending: true })

    if (filters.status) q = q.eq('status', filters.status)
    if (filters.tipo)   q = q.eq('tipo', filters.tipo)
    if (filters.busca)  q = q.or(`numero.ilike.%${filters.busca}%,descricao.ilike.%${filters.busca}%`)

    const { data } = await q.limit(200)
    const lista = data ?? []
    setFaturas(lista)

    // ── Editar fatura ──────────────────────────────────────────────────────────
  function abrirEdicao(fat: any) {
    setFaturaEdit(fat)
    setFormEdit({
      descricao:       fat.descricao ?? '',
      data_vencimento: fat.data_vencimento ?? '',
      forma_pagamento: fat.forma_pagamento ?? '',
      observacoes:     fat.observacoes ?? '',
    })
    setErroEdit('')
    setPainelEdit(true)
  }

  async function salvarEdicao() {
    setSalvandoEdit(true); setErroEdit('')
    try {
      const { error } = await supabase.from('faturas').update({
        descricao:       formEdit.descricao,
        data_vencimento: formEdit.data_vencimento,
        forma_pagamento: formEdit.forma_pagamento || null,
        observacoes:     formEdit.observacoes,
      }).eq('id', faturaEdit.id)
      if (error) throw error
      setPainelEdit(false); load()
    } catch(e: any) { setErroEdit(e.message) }
    finally { setSalvandoEdit(false) }
  }

  async function excluirFatura(fat: any) {
    if (!confirm(`Excluir a fatura ${fat.numero}?\n\nEsta ação é irreversível.`)) return
    // Verificar dependências
    const { data: recs } = await supabase.from('fatura_recebimentos').select('id').eq('fatura_id', fat.id)
    if (recs && recs.length > 0) {
      alert(`Esta fatura possui ${recs.length} recebimento(s) registrado(s) e não pode ser excluída.\nEstorne os recebimentos antes de excluir.`)
      return
    }
    await supabase.from('faturas').delete().eq('id', fat.id)
    load()
  }

  // ── Impressão de recibo / fatura ──────────────────────────────────────────
  async function imprimirRecibo(fat: any) {
    try {
      const res = await fetch('/api/documentos/fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: fat.id, tipo: 'recibo' }),
      })
      const result = await res.json()
      if (!result.ok) { alert('Erro ao gerar recibo: ' + result.error); return }
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.write(result.html)
      w.document.close()
      setTimeout(() => w.print(), 800)
    } catch(e: any) { alert('Erro: ' + e.message) }
  }

  async function imprimirFatura(fat: any) {
    try {
      const res = await fetch('/api/documentos/fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: fat.id, tipo: 'fatura' }),
      })
      const result = await res.json()
      if (!result.ok) { alert('Erro ao gerar fatura: ' + result.error); return }
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.write(result.html)
      w.document.close()
      setTimeout(() => w.print(), 800)
    } catch(e: any) { alert('Erro: ' + e.message) }
  }

    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  async function abrirPainel(fatura: any) {
    setFaturaAlvo(fatura)
    setFormRec({
      valor:            String(fatura.saldo_restante ?? fatura.valor),
      data_recebimento: new Date().toISOString().split('T')[0],
      forma_pagamento:  fatura.forma_pagamento ?? 'pix',
      observacoes:      '',
    })
    setErro('')
    setPainel(true)
    // Buscar recebimentos existentes
    setLoadingRec(true)
    const { data } = await supabase
      .from('fatura_recebimentos')
      .select('*, usuarios(nome)')
      .eq('fatura_id', fatura.id)
      .order('data_recebimento', { ascending: false })
    setRecebimentos(data ?? [])
    setLoadingRec(false)
  }

  async function confirmarRecebimento() {
    const valor = Number(formRec.valor)
    if (!valor || valor <= 0)       { setErro('Informe um valor válido.'); return }
    if (!formRec.data_recebimento)  { setErro('Informe a data.'); return }
    const saldoAtual = Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor)
    if (valor > saldoAtual + 0.01)  { setErro(`Valor não pode exceder o saldo restante de ${fmt.money(saldoAtual)}.`); return }

    setSalvando(true); setErro('')

    // Inserir recebimento
    await supabase.from('fatura_recebimentos').insert({
      fatura_id:        faturaAlvo.id,
      valor,
      data_recebimento: formRec.data_recebimento,
      forma_pagamento:  formRec.forma_pagamento,
      observacoes:      formRec.observacoes || null,
      usuario_id:       usuario?.id ?? null,
    })

    // Recalcular valor_recebido e saldo_restante
    const novoRecebido = Number(faturaAlvo.valor_recebido ?? 0) + valor
    const novoSaldo    = Number(faturaAlvo.valor) - novoRecebido
    const novoStatus   = novoSaldo <= 0.005 ? 'pago' : 'parcial'

    await supabase.from('faturas').update({
      valor_recebido:  novoRecebido,
      saldo_restante:  Math.max(0, novoSaldo),
      status:          novoStatus,
      data_pagamento:  novoStatus === 'pago' ? formRec.data_recebimento : null,
      forma_pagamento: formRec.forma_pagamento,
    }).eq('id', faturaAlvo.id)

    // Atualizar local
    const { data: fatAtualizada } = await supabase
      .from('faturas').select('*, contratos(numero, clientes(nome))').eq('id', faturaAlvo.id).single()
    if (fatAtualizada) {
      setFaturaAlvo(fatAtualizada)
      setFaturas(prev => prev.map(f => f.id === faturaAlvo.id ? fatAtualizada : f))
    }

    // Recarregar recebimentos
    const { data: recs } = await supabase
      .from('fatura_recebimentos').select('*, usuarios(nome)')
      .eq('fatura_id', faturaAlvo.id).order('data_recebimento', { ascending: false })
    setRecebimentos(recs ?? [])

    setFormRec(f => ({ ...f, valor: String(Math.max(0, novoSaldo)), observacoes:'' }))
    setSalvando(false)

    // Recalcular KPIs
    load()
  }

  async function estornarRecebimento(rec: any) {
    if (!confirm(`Estornar recebimento de ${fmt.money(rec.valor)} em ${fmt.date(rec.data_recebimento)}?`)) return

    await supabase.from('fatura_recebimentos').delete().eq('id', rec.id)

    // Recalcular
    const novoRecebido = Math.max(0, Number(faturaAlvo.valor_recebido ?? 0) - Number(rec.valor))
    const novoSaldo    = Number(faturaAlvo.valor) - novoRecebido
    const novoStatus   = novoRecebido <= 0 ? 'pendente' : 'parcial'

    await supabase.from('faturas').update({
      valor_recebido: novoRecebido,
      saldo_restante: novoSaldo,
      status:         novoStatus,
      data_pagamento: null,
    }).eq('id', faturaAlvo.id)

    const { data: fatAtualizada } = await supabase
      .from('faturas').select('*, contratos(numero, clientes(nome))').eq('id', faturaAlvo.id).single()
    if (fatAtualizada) {
      setFaturaAlvo(fatAtualizada)
      setFaturas(prev => prev.map(f => f.id === faturaAlvo.id ? fatAtualizada : f))
    }

    const { data: recs } = await supabase
      .from('fatura_recebimentos').select('*, usuarios(nome)')
      .eq('fatura_id', faturaAlvo.id).order('data_recebimento', { ascending: false })
    setRecebimentos(recs ?? [])
    load()
  }

  // ── Editar fatura ──────────────────────────────────────────────────────────
  function abrirEdicao(fat: any) {
    setFaturaEdit(fat)
    setFormEdit({
      descricao:       fat.descricao ?? '',
      data_vencimento: fat.data_vencimento ?? '',
      forma_pagamento: fat.forma_pagamento ?? '',
      observacoes:     fat.observacoes ?? '',
    })
    setErroEdit('')
    setPainelEdit(true)
  }

  async function salvarEdicao() {
    setSalvandoEdit(true); setErroEdit('')
    try {
      const { error } = await supabase.from('faturas').update({
        descricao:       formEdit.descricao,
        data_vencimento: formEdit.data_vencimento,
        forma_pagamento: formEdit.forma_pagamento || null,
        observacoes:     formEdit.observacoes,
      }).eq('id', faturaEdit.id)
      if (error) throw error
      setPainelEdit(false); load()
    } catch(e: any) { setErroEdit(e.message) }
    finally { setSalvandoEdit(false) }
  }

  async function excluirFatura(fat: any) {
    if (!confirm(`Excluir a fatura ${fat.numero}?\n\nEsta ação é irreversível.`)) return
    // Verificar dependências
    const { data: recs } = await supabase.from('fatura_recebimentos').select('id').eq('fatura_id', fat.id)
    if (recs && recs.length > 0) {
      alert(`Esta fatura possui ${recs.length} recebimento(s) registrado(s) e não pode ser excluída.\nEstorne os recebimentos antes de excluir.`)
      return
    }
    await supabase.from('faturas').delete().eq('id', fat.id)
    load()
  }

  // ── Impressão de recibo / fatura ──────────────────────────────────────────
  async function imprimirRecibo(fat: any) {
    try {
      const res = await fetch('/api/documentos/fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: fat.id, tipo: 'recibo' }),
      })
      const result = await res.json()
      if (!result.ok) { alert('Erro ao gerar recibo: ' + result.error); return }
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.write(result.html)
      w.document.close()
      setTimeout(() => w.print(), 800)
    } catch(e: any) { alert('Erro: ' + e.message) }
  }

  async function imprimirFatura(fat: any) {
    try {
      const res = await fetch('/api/documentos/fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: fat.id, tipo: 'fatura' }),
      })
      const result = await res.json()
      if (!result.ok) { alert('Erro ao gerar fatura: ' + result.error); return }
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.write(result.html)
      w.document.close()
      setTimeout(() => w.print(), 800)
    } catch(e: any) { alert('Erro: ' + e.message) }
  }

  const hoje = new Date().toISOString().split('T')[0]
  const saldo = faturaAlvo ? Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor) : 0

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <PageHeader
        title="Financeiro"
        subtitle="Faturas e recebimentos"
      />

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard label="Total Faturado"   value={fmt.money(kpis.total)}    color="var(--t-primary)" />
        <KpiCard label="Recebido"         value={fmt.money(kpis.recebido)} color="var(--c-success)" />
        <KpiCard label="Em Aberto"        value={fmt.money(kpis.pendente)} color="var(--c-primary)" />
        <KpiCard label="Vencidas"         value={fmt.money(kpis.vencidas)} color="var(--c-danger)"
          sub={kpis.nVencidas > 0 ? `${kpis.nVencidas} fatura(s)` : undefined} />
      </div>

      {/* Filtros */}
      <Filters
        fields={[
          { type:'text',   key:'busca',  placeholder:'Buscar por nº ou descrição...', width:'260px' },
          { type:'select', key:'status', placeholder:'Todos os status',
            options:[
              { value:'pendente', label:'Pendente' },
              { value:'parcial',  label:'Pago Parcial' },
              { value:'pago',     label:'Pago' },
              { value:'cancelado',label:'Cancelado' },
            ]},
          { type:'select', key:'tipo', placeholder:'Todos os tipos',
            options:[
              { value:'locacao',      label:'Locação' },
              { value:'recorrente',   label:'Recorrente' },
              { value:'antecipacao',  label:'Antecipação' },
              { value:'avaria',       label:'Avaria' },
              { value:'multa',        label:'Multa' },
              { value:'frete',        label:'Frete' },
            ]},
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f,[k]:v }))}
        onClear={() => setFilters({ busca:'', status:'', tipo:'' })}
      />

      {/* Tabela */}
      <DataTable
        loading={loading}
        emptyMessage="Nenhuma fatura encontrada."
        columns={[
          { key:'numero', label:'Nº', render: r => (
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{r.numero}</span>
          )},
          { key:'cliente', label:'Cliente', render: r => (
            <div>
              <div style={{ fontWeight:500 }}>{(r.contratos as any)?.clientes?.nome ?? '—'}</div>
              <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', fontFamily:'var(--font-mono)' }}>
                {(r.contratos as any)?.numero}
              </div>
            </div>
          )},
          { key:'tipo',     label:'Tipo',      render: r => <span style={{ fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>{fmtTipo(r.tipo)}</span> },
          { key:'venc',     label:'Vencimento', render: r => (
            <span style={{ color: r.status==='pendente'&&r.data_vencimento<hoje ? 'var(--c-danger)' : 'var(--t-primary)', fontWeight: r.status==='pendente'&&r.data_vencimento<hoje ? 700 : 400 }}>
              {fmt.date(r.data_vencimento)}
              {r.status==='pendente'&&r.data_vencimento<hoje && ' ⚠'}
            </span>
          )},
          { key:'valor',    label:'Valor',    align:'right', render: r => <span style={{ fontWeight:700 }}>{fmt.money(r.valor)}</span> },
          { key:'recebido', label:'Recebido', align:'right', render: r => (
            <span style={{ color: Number(r.valor_recebido)>0 ? 'var(--c-success)' : 'var(--t-muted)' }}>
              {Number(r.valor_recebido)>0 ? fmt.money(r.valor_recebido) : '—'}
            </span>
          )},
          { key:'saldo',    label:'Saldo',    align:'right', render: r => (
            <span style={{ fontWeight:700, color: Number(r.saldo_restante)>0 ? 'var(--c-danger)' : 'var(--c-success)' }}>
              {fmt.money(r.saldo_restante ?? r.valor)}
            </span>
          )},
          { key:'status', label:'Status', render: r => <Badge value={r.status} dot /> },
        ]}
        data={faturas}
        actions={row => (
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {row.status !== 'pago' && row.status !== 'cancelado' && (
              <button onClick={() => abrirPainel(row)}
                style={{background:'var(--c-primary)',color:'#fff',border:'none',borderRadius:'var(--r-sm)',
                  padding:'4px 10px',fontWeight:600,fontSize:'var(--fs-md)',cursor:'pointer'}}>
                Receber
              </button>
            )}
            <div style={{position:'relative',display:'inline-block'}} className="fat-menu-wrap">
              <button
                title="Mais ações"
                onClick={e=>{
                  e.stopPropagation()
                  const m=e.currentTarget.nextElementSibling as HTMLElement
                  if(m.style.display==='block'){m.style.display='none';return}
                  const r=e.currentTarget.getBoundingClientRect()
                  m.style.top=(r.bottom+4)+'px'
                  m.style.right=(window.innerWidth-r.right)+'px'
                  m.style.display='block'
                  // fechar ao clicar fora
                  const close=()=>{m.style.display='none';document.removeEventListener('click',close)}
                  setTimeout(()=>document.addEventListener('click',close),0)
                }}
                style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',
                  padding:'4px 8px',cursor:'pointer',fontWeight:700,fontSize:13,color:'var(--t-secondary)',lineHeight:1}}>
                ⋮
              </button>
              <div style={{display:'none',position:'fixed',right:0,top:0,zIndex:9999,
                background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',
                boxShadow:'var(--shadow-lg)',minWidth:180,padding:'4px 0'}}
                onClick={e=>e.stopPropagation()}>
                {[
                  {l:'✏️ Editar',          fn:()=>{ abrirEdicao(row); (document.querySelectorAll('.fat-menu-wrap div')[0] as any).style.display='none' }},
                  {l:'🖨️ Imprimir Recibo', fn:()=>imprimirRecibo(row)},
                  {l:'📄 Imprimir Fatura', fn:()=>imprimirFatura(row)},
                  {l:'🗑️ Excluir',         fn:()=>excluirFatura(row), danger:true},
                ].map(a=>(
                  <button key={a.l} onClick={()=>{a.fn();(document.querySelectorAll('.fat-menu-wrap div')[0] as any).style.display='none'}}
                    style={{display:'block',width:'100%',textAlign:'left',background:'none',
                      border:'none',padding:'7px 14px',cursor:'pointer',fontSize:'var(--fs-md)',
                      color:a.danger?'var(--c-danger)':'var(--t-primary)',fontWeight:500}}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      />

      {/* ── Painel de Recebimento ──────────────────────────────────────────── */}
      <SlidePanel
        open={painel}
        onClose={() => setPainel(false)}
        title="Registrar Recebimento"
        subtitle={faturaAlvo?.numero}
        width="md"
        footer={
          faturaAlvo?.status !== 'pago' ? (
            <div className="panel-footer-2btn">
              <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainel(false)}>Fechar</Btn>
              <Btn style={{ flex:2 }} loading={salvando} onClick={confirmarRecebimento}>
                Confirmar Recebimento
              </Btn>
            </div>
          ) : (
            <Btn variant="secondary" style={{ width:'100%' }} onClick={() => setPainel(false)}>Fechar</Btn>
          )
        }
      >
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Resumo da fatura */}
          {faturaAlvo && (
            <div style={{ background:'var(--bg-header)', border:'1px solid var(--border)',
              borderRadius:'var(--r-md)', padding:'14px 16px' }}>
              <div className="form-grid-3">
                {[
                  { l:'Fatura',     v: faturaAlvo.numero },
                  { l:'Cliente',    v: (faturaAlvo.contratos as any)?.clientes?.nome ?? '—' },
                  { l:'Contrato',   v: (faturaAlvo.contratos as any)?.numero ?? '—' },
                  { l:'Valor Total',v: fmt.money(faturaAlvo.valor),          c:'var(--t-primary)' },
                  { l:'Recebido',   v: fmt.money(faturaAlvo.valor_recebido ?? 0), c:'var(--c-success)' },
                  { l:'Saldo',      v: fmt.money(saldo),                     c: saldo>0?'var(--c-danger)':'var(--c-success)' },
                ].map(k => (
                  <div key={k.l}>
                    <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginBottom:2 }}>{k.l}</div>
                    <div style={{ fontWeight:700, color:(k as any).c ?? 'var(--t-primary)' }}>{k.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status pago */}
          {faturaAlvo?.status === 'pago' && (
            <div style={{ background:'var(--c-success-light)', border:'1px solid var(--c-success)',
              borderRadius:'var(--r-md)', padding:'12px 16px', fontSize:'var(--fs-md)', color:'var(--c-success-text)',
              fontWeight:600, textAlign:'center' }}>
              ✓ Fatura totalmente recebida
            </div>
          )}

          {/* Formulário de novo recebimento */}
          {faturaAlvo?.status !== 'pago' && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div className="ds-section-title">Novo Recebimento</div>
              {erro && <div className="ds-alert-error">{erro}</div>}

              <div className="form-grid-2">
                <FormField label="Valor a Receber (R$)" required>
                  <input type="number" step="0.01" min="0.01" max={saldo}
                    value={formRec.valor}
                    onChange={e => setFormRec(f => ({ ...f, valor:e.target.value }))}
                    className={inputCls} autoFocus />
                </FormField>
                <FormField label="Data do Recebimento" required>
                  <input type="date" value={formRec.data_recebimento}
                    onChange={e => setFormRec(f => ({ ...f, data_recebimento:e.target.value }))}
                    className={inputCls} />
                </FormField>
              </div>

              <FormField label="Forma de Pagamento">
                <select value={formRec.forma_pagamento}
                  onChange={e => setFormRec(f => ({ ...f, forma_pagamento:e.target.value }))}
                  className={selectCls}>
                  {FORMAS.map(v => (
                    <option key={v} value={v}>{fmtForma(v)}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Observações">
                <textarea value={formRec.observacoes}
                  onChange={e => setFormRec(f => ({ ...f, observacoes:e.target.value }))}
                  className={textareaCls} rows={2}
                  placeholder="Comprovante, banco, referência..." />
              </FormField>

              {/* Preview do saldo após */}
              {Number(formRec.valor) > 0 && (
                <div style={{ background:'var(--c-primary-light)', border:'1px solid var(--c-primary)',
                  borderRadius:'var(--r-sm)', padding:'9px 14px',
                  display:'flex', justifyContent:'space-between', fontSize:'var(--fs-md)' }}>
                  <span style={{ color:'var(--t-secondary)' }}>Saldo após este recebimento:</span>
                  <span style={{ fontWeight:800, color: (saldo - Number(formRec.valor)) <= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {fmt.money(Math.max(0, saldo - Number(formRec.valor)))}
                    {(saldo - Number(formRec.valor)) <= 0 && ' — QUITADA'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Histórico de recebimentos */}
          <div>
            <div className="ds-section-title">Histórico de Recebimentos</div>
            {loadingRec ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--t-muted)',
                fontSize:'var(--fs-md)', padding:'12px 0' }}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",display:"inline-block",verticalAlign:"middle",flexShrink:0}}/> Carregando...
              </div>
            ) : recebimentos.length === 0 ? (
              <div style={{ color:'var(--t-muted)', fontSize:'var(--fs-md)', padding:'12px 0',
                fontStyle:'italic' }}>
                Nenhum recebimento registrado ainda.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', marginTop:4 }}>
                <thead>
                  <tr>
                    {['Data','Valor','Forma','Usuário',''].map(h => (
                      <th key={h} style={{ padding:'7px 10px', fontSize:'var(--fs-sm)', fontWeight:700,
                        color:'var(--t-muted)', textAlign: h==='Valor'?'right':'left',
                        background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
                        textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recebimentos.map((rec, i) => (
                    <tr key={rec.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', borderBottom:'1px solid var(--border)' }}>
                        {fmt.date(rec.data_recebimento)}
                      </td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--c-success)',
                        textAlign:'right', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)' }}>
                        {fmt.money(rec.valor)}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', color:'var(--t-secondary)',
                        borderBottom:'1px solid var(--border)' }}>
                        {fmtForma(rec.forma_pagamento ?? '')}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:'var(--fs-md)', color:'var(--t-muted)',
                        borderBottom:'1px solid var(--border)' }}>
                        {(rec.usuarios as any)?.nome ?? '—'}
                      </td>
                      <td style={{ padding:'8px 6px', borderBottom:'1px solid var(--border)' }}>
                        <button onClick={() => estornarRecebimento(rec)}
                          className="tbl-btn"
                          title="Estornar este recebimento"
                          style={{ color:'var(--c-warning)', fontSize:13, padding:'2px 6px' }}>
                          ↩
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'var(--bg-header)' }}>
                    <td style={{ padding:'8px 10px', fontWeight:700, fontSize:'var(--fs-md)', borderTop:'2px solid var(--border)' }}>
                      Total recebido
                    </td>
                    <td style={{ padding:'8px 10px', fontWeight:800, textAlign:'right', color:'var(--c-success)',
                      borderTop:'2px solid var(--border)', fontFamily:'var(--font-mono)' }}>
                      {fmt.money(recebimentos.reduce((s, r) => s + Number(r.valor), 0))}
                    </td>
                    <td colSpan={3} style={{ borderTop:'2px solid var(--border)' }} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

        </div>
      </SlidePanel>

      {/* ── Painel de Edição ───────────────────────────────────────────────── */}
      <SlidePanel
        open={painelEdit}
        onClose={() => setPainelEdit(false)}
        title="Editar Fatura"
        subtitle={faturaEdit?.numero}
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainelEdit(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvandoEdit} onClick={salvarEdicao}>Salvar</Btn>
          </div>
        }
      >
        {faturaEdit && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {erroEdit && <div style={{background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',borderRadius:'var(--r-md)',padding:'10px 14px',color:'var(--c-danger-text)',fontSize:'var(--fs-md)'}}>{erroEdit}</div>}
            <FormField label="Descrição">
              <input className={inputCls} value={formEdit.descricao} onChange={e=>setFormEdit({...formEdit,descricao:e.target.value})} placeholder="Descrição da fatura" />
            </FormField>
            <FormField label="Vencimento">
              <input type="date" className={inputCls} value={formEdit.data_vencimento} onChange={e=>setFormEdit({...formEdit,data_vencimento:e.target.value})} />
            </FormField>
            <FormField label="Forma de Pagamento">
              <select className={selectCls} value={formEdit.forma_pagamento} onChange={e=>setFormEdit({...formEdit,forma_pagamento:e.target.value})}>
                <option value="">— Selecione —</option>
                {FORMAS.map(f=><option key={f} value={f}>{fmtForma(f)}</option>)}
              </select>
            </FormField>
            <FormField label="Observações">
              <textarea className={textareaCls} rows={3} value={formEdit.observacoes} onChange={e=>setFormEdit({...formEdit,observacoes:e.target.value})} placeholder="Observações internas..." />
            </FormField>
          </div>
        )}
      </SlidePanel>

    </div>
  )
}