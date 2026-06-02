// build: 2026-06-02
'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { Btn, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string; cor: string }> = {
  rascunho:   { label: 'Rascunho',    cls: 'ds-badge ds-badge-gray',   cor: '#94a3b8' },
  em_analise: { label: 'Em Análise',  cls: 'ds-badge ds-badge-yellow', cor: '#fbbf24' },
  aguardando: { label: 'Aguardando',  cls: 'ds-badge ds-badge-blue',   cor: '#818cf8' },
  aprovada:   { label: 'Aprovada',    cls: 'ds-badge ds-badge-green',  cor: '#34d399' },
  recusada:   { label: 'Recusada',    cls: 'ds-badge ds-badge-red',    cor: '#f87171' },
  expirada:   { label: 'Expirada',    cls: 'ds-badge ds-badge-gray',   cor: '#64748b' },
  convertida: { label: 'Convertida',  cls: 'ds-badge ds-badge-blue',   cor: '#818cf8' },
}
function StatusBadge({ s }: { s: string }) {
  const { cls, label } = STATUS_MAP[s] ?? { cls: 'ds-badge ds-badge-gray', label: s, cor: '#94a3b8' }
  return <span className={cls}><span className="ds-badge-dot" />{label}</span>
}
function AcaoBadge({ a }: { a: string }) {
  const map: Record<string, [string, string]> = {
    visualizou: ['ds-badge ds-badge-gray',   '👁 Visualizou'],
    aprovada:   ['ds-badge ds-badge-green',  '✅ Aprovou'],
    recusada:   ['ds-badge ds-badge-red',    '❌ Recusou'],
    expirada:   ['ds-badge ds-badge-gray',   '⚠️ Expirada'],
  }
  const [cls, label] = map[a] ?? ['ds-badge ds-badge-gray', a]
  return <span className={cls}>{label}</span>
}
function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-md)' }}>
      <span style={{ color: 'var(--t-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--t-primary)' }}>{value}</span>
    </div>
  )
}

// ── Opções fixas ──────────────────────────────────────────────────────────────
const FORMAS_PGTO = ['boleto','pix','cartao_credito','cartao_debito','dinheiro','transferencia','cheque']

export default function CotacaoDetalhePage() {
  const router = useRouter()
  const params = useParams() as { id: string }

  const [cot,        setCot]        = useState<any>(null)
  const [logs,       setLogs]       = useState<any[]>([])
  const [periodos,   setPeriodos]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'dados'|'analise'|'log'>('dados')
  const [editando,   setEditando]   = useState(false)
  const [salvando,   setSalvando]   = useState(false)
  const [copiado,    setCopiado]    = useState(false)

  // Form de edição
  const [form, setForm] = useState<any>({})
  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  async function load() {
    const [{ data: cotData }, { data: logsData }, { data: perData }] = await Promise.all([
      supabase.from('cotacoes')
        .select('*, clientes(id,nome,cpf_cnpj,email,celular,telefone,cidade), usuarios(nome), periodos_locacao(nome,dias), cotacao_itens(*, produtos(nome,unidade,codigo,produto_fotos(url,principal)))')
        .eq('id', params.id).maybeSingle(),
      supabase.from('cotacao_logs')
        .select('*').eq('cotacao_id', params.id).order('created_at', { ascending: false }),
      supabase.from('periodos_locacao').select('*').eq('ativo', 1).order('dias'),
    ])
    setCot(cotData)
    setLogs(logsData ?? [])
    setPeriodos(perData ?? [])
    if (cotData) {
      setForm({
        periodo_id:            cotData.periodo_id ?? '',
        periodo_nome:          cotData.periodo_nome ?? '',
        data_inicio:           cotData.data_inicio ?? '',
        data_fim:              cotData.data_fim ?? '',
        data_necessidade:      cotData.data_necessidade ?? '',
        forma_pagamento:       cotData.forma_pagamento ?? '',
        condicao_pagamento:    cotData.condicao_pagamento ?? '',
        desconto_pct:          cotData.desconto_pct ?? 0,
        acrescimo:             cotData.acrescimo ?? 0,
        local_uso_cep:         cotData.local_uso_cep ?? '',
        local_uso_endereco:    cotData.local_uso_endereco ?? '',
        local_uso_numero:      cotData.local_uso_numero ?? '',
        local_uso_complemento: cotData.local_uso_complemento ?? '',
        local_uso_bairro:      cotData.local_uso_bairro ?? '',
        local_uso_cidade:      cotData.local_uso_cidade ?? '',
        local_uso_estado:      cotData.local_uso_estado ?? '',
        observacoes:           cotData.observacoes ?? '',
        observacoes_internas:  cotData.observacoes_internas ?? '',
      })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  // ── Salvar edição ─────────────────────────────────────────────────────────
  async function salvar() {
    setSalvando(true)
    const subtotal  = (cot.cotacao_itens ?? []).reduce((s: number, i: any) => s + Number(i.total_item), 0)
    const desconto  = Number(form.desconto_pct ?? 0) / 100 * subtotal
    const acrescimo = Number(form.acrescimo ?? 0)
    const total     = subtotal - desconto + acrescimo

    const periodoSel = periodos.find((p: any) => String(p.id) === String(form.periodo_id))

    await supabase.from('cotacoes').update({
      periodo_id:            form.periodo_id || null,
      periodo_nome:          periodoSel?.nome || form.periodo_nome || null,
      data_inicio:           form.data_inicio   || null,
      data_fim:              form.data_fim       || null,
      data_necessidade:      form.data_necessidade || null,
      forma_pagamento:       form.forma_pagamento  || null,
      condicao_pagamento:    form.condicao_pagamento || null,
      desconto_pct:          Number(form.desconto_pct ?? 0),
      desconto:              Number(desconto.toFixed(2)),
      acrescimo:             Number(acrescimo),
      subtotal:              Number(subtotal.toFixed(2)),
      total:                 Number(total.toFixed(2)),
      local_uso_cep:         form.local_uso_cep         || null,
      local_uso_endereco:    form.local_uso_endereco     || null,
      local_uso_numero:      form.local_uso_numero       || null,
      local_uso_complemento: form.local_uso_complemento || null,
      local_uso_bairro:      form.local_uso_bairro       || null,
      local_uso_cidade:      form.local_uso_cidade       || null,
      local_uso_estado:      form.local_uso_estado       || null,
      observacoes:           form.observacoes            || null,
      observacoes_internas:  form.observacoes_internas   || null,
      updated_at:            new Date().toISOString(),
    }).eq('id', cot.id)

    setSalvando(false)
    setEditando(false)
    load()
  }

  // ── Enviar para o cliente (rascunho/em_analise → aguardando) ─────────────
  async function enviarParaCliente() {
    // Verificações
    if (!cot.periodo_nome && !form.periodo_nome && !form.periodo_id) {
      alert('Defina o período de locação antes de enviar.')
      return
    }

    let token = cot.token_aprovacao
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b: number) => b.toString(16).padStart(2, '0')).join('')
    }

    await supabase.from('cotacoes').update({
      status:          'aguardando',
      token_aprovacao: token,
      updated_at:      new Date().toISOString(),
    }).eq('id', cot.id)

    // Montar link e abrir WhatsApp
    const link     = `${window.location.origin}/minha-cotacao/${token}`
    const celular  = cot.clientes?.celular || cot.clientes?.telefone || ''
    const numero   = celular.replace(/\D/g, '')
    const fone     = numero.startsWith('55') ? numero : `55${numero}`
    const texto    = encodeURIComponent(
      `Olá ${cot.clientes?.nome ?? ''}! Preparamos sua proposta de locação *${cot.numero}* no valor de *${fmt.money(cot.total)}*.\n\nAcesse o link abaixo para visualizar e nos dar sua resposta:\n${link}`
    )
    window.open(fone ? `https://wa.me/${fone}?text=${texto}` : `https://wa.me/?text=${texto}`, '_blank')
    load()
  }

  // ── Copiar link ───────────────────────────────────────────────────────────
  async function copiarLink() {
    if (!cot.token_aprovacao) { alert('Envie para o cliente primeiro para gerar o link.'); return }
    const link = `${window.location.origin}/minha-cotacao/${cot.token_aprovacao}`
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  // ── Aprovação/Recusa manual ───────────────────────────────────────────────
  async function aprovarManual() {
    if (!confirm('Marcar como aprovada manualmente?')) return
    await supabase.from('cotacoes').update({
      status: 'aprovada', data_resposta: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', cot.id)
    load()
  }

  async function recusarManual() {
    const motivo = prompt('Motivo da recusa (opcional):') ?? ''
    await supabase.from('cotacoes').update({
      status: 'recusada', motivo_recusa: motivo || null,
      data_resposta: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', cot.id)
    load()
  }

  // ── Converter em contrato ─────────────────────────────────────────────────
  async function converter() {
    if (!confirm(`Converter ${cot.numero} em contrato?`)) return
    const r = await fetch('/api/cotacoes/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotacao_id: cot.id }),
    })
    const d = await r.json()
    if (d.error) return alert('Erro: ' + d.error)
    if (confirm(`✅ Contrato ${d.numero} criado! Deseja abri-lo?`))
      router.push(`/contratos/${d.contrato_id}`)
    else load()
  }

  // ── Busca CEP ─────────────────────────────────────────────────────────────
  async function buscarCep(cep: string) {
    const c = cep.replace(/\D/g,'')
    if (c.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm((p: any) => ({...p,
          local_uso_endereco: d.logradouro ?? p.local_uso_endereco,
          local_uso_bairro:   d.bairro     ?? p.local_uso_bairro,
          local_uso_cidade:   d.localidade ?? p.local_uso_cidade,
          local_uso_estado:   d.uf         ?? p.local_uso_estado,
        }))
      }
    } catch {}
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:40, color:'var(--t-muted)' }}>
      Carregando...
    </div>
  )
  if (!cot) return <div style={{ padding:40, color:'var(--t-muted)' }}>Cotação não encontrada.</div>

  const podeEditar   = ['rascunho','em_analise'].includes(cot.status)
  const podeEnviar   = ['rascunho','em_analise'].includes(cot.status)
  const podeAprovar  = ['aguardando'].includes(cot.status)
  const podeConverter= ['aprovada'].includes(cot.status) && !cot.contrato_id

  const logAprov = logs.find(l => l.acao === 'aprovada')
  const logRecus = logs.find(l => l.acao === 'recusada')

  // Subtotal calculado dos itens
  const subtotalCalc = (cot.cotacao_itens ?? []).reduce((s: number, i: any) => s + Number(i.total_item), 0)
  const descontoCalc = Number(form.desconto_pct ?? 0) / 100 * subtotalCalc
  const totalCalc    = subtotalCalc - descontoCalc + Number(form.acrescimo ?? 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => router.push('/cotacoes')}
            style={{ background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, color:'var(--t-secondary)' }}>←</button>
          <div>
            <div style={{ fontSize:'var(--fs-lg)', fontWeight:700, color:'var(--t-primary)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {cot.numero}
              <StatusBadge s={cot.status} />
              {cot.origem === 'site' && (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24' }}>
                  🌐 SITE
                </span>
              )}
              {cot.visualizacoes > 0 && (
                <span style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', fontWeight:400 }}>
                  👁 {cot.visualizacoes} visualização{cot.visualizacoes > 1 ? 'ões' : ''}
                </span>
              )}
              {cot.contrato_id && (
                <span className="ds-badge ds-badge-blue" style={{ cursor:'pointer' }}
                  onClick={() => router.push(`/contratos/${cot.contrato_id}`)}>
                  📄 Ver Contrato
                </span>
              )}
            </div>
            <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
              {cot.clientes?.nome} · Emitida em {fmt.date(cot.data_emissao)} · Válida até {fmt.date(cot.data_validade)}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* Editar */}
          {podeEditar && !editando && (
            <Btn size="sm" variant="secondary" onClick={() => setEditando(true)}>✏️ Editar Cotação</Btn>
          )}
          {editando && (
            <>
              <Btn size="sm" variant="secondary" onClick={() => { setEditando(false); load() }}>Cancelar</Btn>
              <Btn size="sm" loading={salvando} onClick={salvar}>💾 Salvar</Btn>
            </>
          )}

          {/* Enviar para cliente */}
          {podeEnviar && !editando && (
            <button onClick={enviarParaCliente}
              style={{ display:'inline-flex', alignItems:'center', gap:6, height:30, padding:'0 14px', background:'#25D366', color:'#fff', border:'none', borderRadius:'var(--r-sm)', fontSize:'var(--fs-sm)', fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar para Cliente
            </button>
          )}

          {/* Copiar link */}
          {cot.token_aprovacao && (
            <Btn size="sm" variant="secondary" onClick={copiarLink}>
              {copiado ? '✅ Copiado!' : '🔗 Copiar Link'}
            </Btn>
          )}

          {/* Aprovação manual */}
          {podeAprovar && (
            <>
              <Btn size="sm" variant="primary" onClick={aprovarManual}>✅ Aprovar</Btn>
              <Btn size="sm" variant="danger"  onClick={recusarManual}>❌ Recusar</Btn>
            </>
          )}

          {/* Converter */}
          {podeConverter && (
            <Btn size="sm" onClick={converter}>➡️ Converter em Contrato</Btn>
          )}
        </div>
      </div>

      {/* Banner de alerta — cotação em análise do site */}
      {cot.status === 'em_analise' && cot.origem === 'site' && (
        <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:'var(--r-md)', padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span style={{ fontSize:20 }}>🌐</span>
          <div>
            <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:4 }}>Cotação recebida pelo site — aguarda sua análise</div>
            <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)', lineHeight:1.6 }}>
              Complete os dados faltantes (período, local de uso, forma de pagamento), analise o crédito do cliente e ajuste preços se necessário.
              Quando estiver pronto, clique em <strong>"Enviar para Cliente"</strong> — ele receberá o link pelo WhatsApp para aprovar ou recusar.
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', gap:0 }}>
        {([
          ['dados',   '📋 Dados da Cotação'],
          ['analise', '🔍 Análise de Crédito'],
          ['log',     `📜 Histórico${logs.length > 0 ? ` (${logs.length})` : ''}`],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            style={{ padding:'9px 18px', fontSize:'var(--fs-base)', fontWeight: tab===k ? 600 : 400, color: tab===k ? 'var(--c-primary)' : 'var(--t-secondary)', background:'none', border:'none', borderBottom:`2px solid ${tab===k ? 'var(--c-primary)' : 'transparent'}`, cursor:'pointer', fontFamily:'var(--font)', marginBottom:-2, whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ TAB: DADOS ══════════════════════════════════════════════════════ */}
      {tab === 'dados' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16, alignItems:'start' }}>

          {/* Coluna principal */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Dados gerais — visualização ou edição */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
              <div style={{ background:'var(--bg-header)', borderBottom:'1px solid var(--border)', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'var(--t-primary)' }}>📋 Dados da Cotação</span>
                {editando && <span style={{ fontSize:'var(--fs-sm)', color:'var(--c-primary)', fontWeight:600 }}>Modo edição ativo</span>}
              </div>

              {editando ? (
                <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    <FormField label="Período de Locação">
                      <select className={selectCls} value={form.periodo_id}
                        onChange={e => {
                          const p = periodos.find((x: any) => String(x.id) === e.target.value)
                          setF('periodo_id', e.target.value)
                          if (p) setF('periodo_nome', p.nome)
                        }}>
                        <option value="">Selecionar...</option>
                        {periodos.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.nome} ({p.dias}d)</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Data Início">
                      <input type="date" className={inputCls} value={form.data_inicio} onChange={e => setF('data_inicio', e.target.value)} />
                    </FormField>
                    <FormField label="Data Fim">
                      <input type="date" className={inputCls} value={form.data_fim} onChange={e => setF('data_fim', e.target.value)} />
                    </FormField>
                    <FormField label="Forma de Pagamento">
                      <select className={selectCls} value={form.forma_pagamento} onChange={e => setF('forma_pagamento', e.target.value)}>
                        <option value="">Selecionar...</option>
                        {FORMAS_PGTO.map(f => <option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Condição (ex: 0+3x)">
                      <input className={inputCls} value={form.condicao_pagamento} onChange={e => setF('condicao_pagamento', e.target.value)} placeholder="0+2x, 30/60/90..." />
                    </FormField>
                    <FormField label="Data de Necessidade">
                      <input type="date" className={inputCls} value={form.data_necessidade} onChange={e => setF('data_necessidade', e.target.value)} />
                    </FormField>
                  </div>

                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                    <div style={{ fontSize:'var(--fs-sm)', fontWeight:700, color:'var(--t-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>📍 Local de Uso dos Equipamentos</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:10 }}>
                      <FormField label="CEP">
                        <input className={inputCls} value={form.local_uso_cep} placeholder="00000-000"
                          onChange={e => setF('local_uso_cep', e.target.value)}
                          onBlur={e => buscarCep(e.target.value)} />
                      </FormField>
                      <FormField label="Logradouro">
                        <input className={inputCls} value={form.local_uso_endereco} onChange={e => setF('local_uso_endereco', e.target.value)} />
                      </FormField>
                      <FormField label="Número">
                        <input className={inputCls} value={form.local_uso_numero} onChange={e => setF('local_uso_numero', e.target.value)} />
                      </FormField>
                      <FormField label="Complemento">
                        <input className={inputCls} value={form.local_uso_complemento} onChange={e => setF('local_uso_complemento', e.target.value)} />
                      </FormField>
                      <FormField label="Bairro">
                        <input className={inputCls} value={form.local_uso_bairro} onChange={e => setF('local_uso_bairro', e.target.value)} />
                      </FormField>
                      <FormField label="Cidade / UF">
                        <div style={{ display:'flex', gap:6 }}>
                          <input className={inputCls} value={form.local_uso_cidade} onChange={e => setF('local_uso_cidade', e.target.value)} style={{ flex:3 }} />
                          <input className={inputCls} value={form.local_uso_estado} onChange={e => setF('local_uso_estado', e.target.value.toUpperCase().slice(0,2))} placeholder="UF" style={{ flex:1, textAlign:'center' }} maxLength={2} />
                        </div>
                      </FormField>
                    </div>
                  </div>

                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <FormField label="Desconto (%)">
                        <input type="number" min="0" max="100" step="0.1" className={inputCls}
                          value={form.desconto_pct} onChange={e => setF('desconto_pct', e.target.value)} />
                      </FormField>
                      <FormField label="Acréscimo (R$)">
                        <input type="number" min="0" step="0.01" className={inputCls}
                          value={form.acrescimo} onChange={e => setF('acrescimo', e.target.value)} />
                      </FormField>
                    </div>
                  </div>

                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                    <FormField label="Observações para o Cliente">
                      <textarea className={textareaCls} rows={3} value={form.observacoes}
                        onChange={e => setF('observacoes', e.target.value)}
                        placeholder="Texto que aparecerá na proposta enviada ao cliente..." />
                    </FormField>
                    <div style={{ marginTop:10 }}>
                      <FormField label="Observações Internas (não aparece para o cliente)">
                        <textarea className={textareaCls} rows={2} value={form.observacoes_internas}
                          onChange={e => setF('observacoes_internas', e.target.value)}
                          placeholder="Anotações internas, análise de crédito, condições especiais..." />
                      </FormField>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding:14 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
                    {[
                      { l:'Cliente',      v: cot.clientes?.nome },
                      { l:'CPF / CNPJ',  v: cot.clientes?.cpf_cnpj, mono:true },
                      { l:'Vendedor',    v: cot.usuarios?.nome ?? '—' },
                      { l:'Período',     v: cot.periodos_locacao?.nome ?? cot.periodo_nome ?? '—' },
                      { l:'Início',      v: fmt.date(cot.data_inicio) || '—' },
                      { l:'Fim',         v: fmt.date(cot.data_fim)    || '—' },
                      { l:'Pagamento',   v: cot.forma_pagamento?.replace(/_/g,' ') || '—' },
                      { l:'Condição',    v: cot.condicao_pagamento || '—' },
                      { l:'Necessidade', v: fmt.date(cot.data_necessidade) || '—' },
                    ].map(i => (
                      <div key={i.l}>
                        <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--t-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{i.l}</div>
                        <div style={{ fontSize:'var(--fs-base)', color:'var(--t-primary)', fontFamily:(i as any).mono?'var(--font-mono)':undefined }}>{i.v || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {(cot.local_uso_endereco || cot.local_uso_cidade) && (
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                      <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--t-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>📍 Local de Uso</div>
                      <div style={{ fontSize:'var(--fs-base)', color:'var(--t-primary)' }}>
                        {[cot.local_uso_endereco, cot.local_uso_numero, cot.local_uso_complemento, cot.local_uso_bairro, cot.local_uso_cidade, cot.local_uso_estado].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Equipamentos */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
              <div style={{ background:'var(--bg-header)', borderBottom:'1px solid var(--border)', padding:'10px 16px' }}>
                <span style={{ fontWeight:700, color:'var(--t-primary)' }}>📦 Equipamentos ({cot.cotacao_itens?.length ?? 0})</span>
              </div>
              <table className="ds-table">
                <thead><tr>
                  <th>Equipamento</th>
                  <th style={{ textAlign:'center', width:60 }}>Qtd</th>
                  <th style={{ textAlign:'right', width:130 }}>Preço/Un.</th>
                  <th style={{ textAlign:'right', width:130 }}>Total</th>
                </tr></thead>
                <tbody>
                  {(cot.cotacao_itens ?? []).map((it: any) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight:500 }}>{it.descricao || it.produtos?.nome || '—'}</td>
                      <td style={{ textAlign:'center' }}>{it.quantidade}</td>
                      <td style={{ textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt.money(it.preco_unitario)}</td>
                      <td style={{ textAlign:'right', fontWeight:700, fontFamily:'var(--font-mono)' }}>{fmt.money(it.total_item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Alertas */}
            {[
              cot.observacoes         && { cls:'ds-alert-info',    icon:'💬', title:'Observações ao Cliente', text:cot.observacoes },
              cot.observacoes_internas && { cls:'ds-alert-warning', icon:'🔒', title:'Observações Internas',   text:cot.observacoes_internas },
              cot.motivo_recusa       && { cls:'ds-alert-error',   icon:'❌', title:'Motivo da Recusa',       text:cot.motivo_recusa },
            ].filter(Boolean).map((a: any, i) => (
              <div key={i} className={a.cls} style={{ padding:'10px 14px' }}>
                <strong style={{ display:'block', marginBottom:4, fontSize:'var(--fs-sm)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{a.icon} {a.title}</strong>
                {a.text}
              </div>
            ))}
          </div>

          {/* Sidebar financeira */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Resumo */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
              <div style={{ background:'var(--c-primary)', padding:'10px 14px' }}>
                <div style={{ color:'rgba(255,255,255,.85)', fontSize:'var(--fs-sm)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Resumo Financeiro</div>
              </div>
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <Row label="Subtotal" value={fmt.money(editando ? subtotalCalc : cot.subtotal)} />
                {(editando ? Number(form.desconto_pct) > 0 : Number(cot.desconto_pct) > 0) && (
                  <Row label={`Desconto (${editando ? form.desconto_pct : cot.desconto_pct}%)`}
                    value={`− ${fmt.money(editando ? descontoCalc : cot.desconto)}`}
                    color="var(--c-danger)" />
                )}
                {(editando ? Number(form.acrescimo) > 0 : Number(cot.acrescimo) > 0) && (
                  <Row label="Acréscimo" value={`+ ${fmt.money(editando ? form.acrescimo : cot.acrescimo)}`} />
                )}
                <div style={{ borderTop:'2px solid var(--border)', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'var(--t-primary)' }}>Total</span>
                  <span style={{ fontWeight:800, fontSize:'var(--fs-kpi)', color:'var(--c-primary)' }}>
                    {fmt.money(editando ? totalCalc : cot.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Campos incompletos — alerta */}
            {podeEditar && (() => {
              const faltam = [
                !cot.periodo_nome && !cot.periodo_id && 'Período de locação',
                !cot.forma_pagamento && 'Forma de pagamento',
                !cot.local_uso_cidade && 'Local de uso',
              ].filter(Boolean)
              return faltam.length > 0 ? (
                <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'var(--r-md)', padding:'12px 14px' }}>
                  <div style={{ fontSize:'var(--fs-sm)', fontWeight:700, color:'#fbbf24', marginBottom:8 }}>⚠️ Dados incompletos</div>
                  {faltam.map((f: any) => (
                    <div key={f} style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)', marginBottom:4 }}>
                      · {f}
                    </div>
                  ))}
                  <button onClick={() => setEditando(true)}
                    style={{ marginTop:8, width:'100%', padding:'7px', borderRadius:'var(--r-sm)', border:'1px solid rgba(251,191,36,0.4)', background:'rgba(251,191,36,0.1)', color:'#fbbf24', cursor:'pointer', fontSize:'var(--fs-sm)', fontWeight:600 }}>
                    Completar agora
                  </button>
                </div>
              ) : null
            })()}

            {/* Link */}
            {cot.token_aprovacao && (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:'var(--fs-sm)', fontWeight:700, color:'var(--t-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>🔗 Link da Proposta</div>
                <button onClick={copiarLink}
                  style={{ background:'var(--c-primary-light)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'7px 10px', cursor:'pointer', fontSize:'var(--fs-sm)', color:'var(--c-primary-text)', fontWeight:500, textAlign:'left', wordBreak:'break-all', fontFamily:'var(--font)' }}>
                  {copiado ? '✅ Copiado!' : '📋 Clique para copiar'}
                </button>
              </div>
            )}

            {/* Resposta do cliente */}
            {(logAprov || logRecus) && (
              <div style={{ background: logAprov ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border:`1px solid ${logAprov ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius:'var(--r-md)', padding:'12px 14px' }}>
                <div style={{ fontWeight:700, color: logAprov ? '#34d399' : '#f87171', marginBottom:6 }}>
                  {logAprov ? '✅ Cliente aprovou' : '❌ Cliente recusou'}
                </div>
                <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                  {new Date((logAprov || logRecus)!.created_at).toLocaleString('pt-BR')}
                </div>
                {logRecus?.motivo_recusa && (
                  <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)', marginTop:6 }}>
                    Motivo: {logRecus.motivo_recusa}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: ANÁLISE DE CRÉDITO ═════════════════════════════════════════ */}
      {tab === 'analise' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:16 }}>
            <div style={{ fontWeight:700, marginBottom:14, color:'var(--t-primary)' }}>👤 Dados do Cliente</div>
            {[
              { l:'Nome',     v: cot.clientes?.nome },
              { l:'CPF/CNPJ', v: cot.clientes?.cpf_cnpj, mono:true },
              { l:'Telefone', v: cot.clientes?.celular || cot.clientes?.telefone },
              { l:'E-mail',   v: cot.clientes?.email },
              { l:'Cidade',   v: cot.clientes?.cidade },
            ].map(i => (
              <div key={i.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'var(--fs-md)' }}>
                <span style={{ color:'var(--t-muted)', fontWeight:600 }}>{i.l}</span>
                <span style={{ color:'var(--t-primary)', fontFamily:(i as any).mono?'var(--font-mono)':undefined }}>{i.v || '—'}</span>
              </div>
            ))}
          </div>

          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:16 }}>
            <div style={{ fontWeight:700, marginBottom:14, color:'var(--t-primary)' }}>🔍 Situação de Crédito</div>
            <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', lineHeight:1.7 }}>
              Nenhuma consulta de crédito integrada. Use o campo abaixo para registrar manualmente.
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:'var(--fs-sm)', fontWeight:700, color:'var(--t-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Obs. Internas</div>
              <textarea className={textareaCls} rows={4}
                value={form.observacoes_internas}
                onChange={e => setF('observacoes_internas', e.target.value)}
                placeholder="Anote aqui: resultado da consulta, histórico do cliente, condições especiais..."
                onBlur={async () => {
                  await supabase.from('cotacoes').update({ observacoes_internas: form.observacoes_internas, updated_at: new Date().toISOString() }).eq('id', cot.id)
                }}
              />
              <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:4 }}>Salvo automaticamente ao sair do campo.</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: HISTÓRICO ══════════════════════════════════════════════════ */}
      {tab === 'log' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {(logAprov || logRecus) && (() => {
            const l = logAprov || logRecus!
            return (
              <div style={{ background: logAprov ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border:`1px solid ${logAprov ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius:'var(--r-md)', padding:'16px 20px' }}>
                <div style={{ fontSize:'var(--fs-base)', fontWeight:700, color: logAprov ? '#34d399' : '#f87171', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                  {logAprov ? '✅ Proposta Aprovada' : '❌ Proposta Recusada'}
                  <span style={{ fontWeight:400, fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                    em {new Date(l.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
                  {[
                    { k:'Nome',      v:l.nome_respondente },
                    { k:'Telefone',  v:l.telefone_respondente },
                    { k:'IP',        v:l.ip, mono:true },
                    { k:'Dispositivo', v:l.dispositivo },
                    { k:'Sistema',   v:l.sistema },
                    { k:'Navegador', v:l.navegador },
                  ].filter(i => i.v).map(i => (
                    <div key={i.k}>
                      <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--t-muted)', textTransform:'uppercase', marginBottom:2 }}>{i.k}</div>
                      <div style={{ fontSize:'var(--fs-md)', fontFamily:(i as any).mono?'var(--font-mono)':undefined }}>{i.v}</div>
                    </div>
                  ))}
                </div>
                {l.motivo_recusa && <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,.08)' }}><strong>Motivo:</strong> {l.motivo_recusa}</div>}
              </div>
            )
          })()}

          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
            <div style={{ background:'var(--bg-header)', borderBottom:'1px solid var(--border)', padding:'10px 16px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:700, color:'var(--t-primary)' }}>📜 Histórico de Eventos</span>
              <span style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>{logs.length} evento(s)</span>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding:32, textAlign:'center', color:'var(--t-muted)' }}>Nenhum evento ainda.</div>
            ) : (
              <table className="ds-table">
                <thead><tr>
                  <th>Data / Hora</th>
                  <th>Ação</th>
                  <th>Nome</th>
                  <th>Dispositivo</th>
                  <th>IP</th>
                </tr></thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:'var(--fs-md)', whiteSpace:'nowrap' }}>
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td><AcaoBadge a={l.acao} /></td>
                      <td>{l.nome_respondente || '—'}</td>
                      <td style={{ fontSize:'var(--fs-md)' }}>{[l.dispositivo, l.sistema, l.navegador].filter(Boolean).join(' · ') || '—'}</td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:'var(--fs-md)' }}>{l.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
