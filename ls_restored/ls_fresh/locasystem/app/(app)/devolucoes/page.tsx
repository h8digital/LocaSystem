'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, Btn, FormField, inputCls, selectCls, textareaCls, LookupField } from '@/components/ui'

export default function DevolucoesPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string,string>>({ busca:'', status:'' })
  const [panel, setPanel]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [erro,   setErro]     = useState('')
  const [itensContrato, setItensContrato] = useState<any[]>([])
  const [itensDev,      setItensDev]      = useState<any[]>([])

  const [contratoId,  setContratoId]  = useState<number|null>(null)
  const [contratoNum, setContratoNum] = useState('')
  const [contrato,    setContrato]    = useState<any>(null)

  const [form, setForm] = useState({
    dias_atraso:0, multa_atraso:0, valor_avarias:0, caucao_devolvido:0, observacoes:''
  })

  async function load() {
    setLoading(true)
    let q = supabase.from('devolucoes')
      .select('*, contratos(numero, clientes(nome))')
      .order('created_at', { ascending:false })
    if (filters.status) q = q.eq('status', filters.status)
    const { data } = await q
    setLista(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filters])

  async function selecionarContrato(id: number|null, row: any|null) {
    setContratoId(id); setContrato(row); setContratoNum(row?.numero ?? '')
    setItensContrato([]); setItensDev([])
    if (!id) return
    const { data } = await supabase.from('contrato_itens')
      .select('*, produtos(nome), patrimonios(numero_patrimonio)')
      .eq('contrato_id', id)
    const its = data ?? []
    setItensContrato(its)
    setItensDev(its.map(i => ({
      contrato_item_id: i.id,
      produto_nome:     (i.produtos as any)?.nome,
      patrimonio_id:    i.patrimonio_id,
      patrimonio_num:   (i.patrimonios as any)?.numero_patrimonio,
      quantidade_devolvida: i.quantidade,
      condicao:   'bom',
      custo_avaria: 0,
    })))
    setForm(f => ({ ...f, caucao_devolvido: row?.caucao ?? 0 }))
  }

  async function salvar() {
    if (!contratoId)           { setErro('Selecione o contrato.'); return }
    if (itensDev.length === 0) { setErro('Nenhum item para devolver.'); return }
    setSaving(true); setErro('')
    try {
      const res = await fetch('/api/devolucoes/registrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contratoId, ...form, itens: itensDev }),
      })
      const r = await res.json()
      if (!r.ok) throw new Error(r.error)
      setPanel(false)
      setContratoId(null); setContratoNum(''); setContrato(null)
      setItensContrato([]); setItensDev([])
      setForm({ dias_atraso:0, multa_atraso:0, valor_avarias:0, caucao_devolvido:0, observacoes:'' })
      load()
    } catch (e: any) { setErro('Erro: ' + e.message) }
    setSaving(false)
  }

  function abrirPanel() {
    setErro('')
    setContratoId(null); setContratoNum(''); setContrato(null)
    setItensContrato([]); setItensDev([])
    setForm({ dias_atraso:0, multa_atraso:0, valor_avarias:0, caucao_devolvido:0, observacoes:'' })
    setPanel(true)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <PageHeader
        title="Devoluções"
        subtitle={`${lista.length} devolução(ões) registrada(s)`}
        actions={<Btn onClick={abrirPanel}>+ Registrar Devolução</Btn>}
      />

      <Filters
        fields={[
          { type:'text', key:'busca', placeholder:'Buscar por contrato...', width:'260px' },
          { type:'select', key:'status', placeholder:'Todos os status', options:[
            { value:'completa',    label:'Completa' },
            { value:'parcial',     label:'Parcial' },
            { value:'com_avaria',  label:'Com Avaria' },
            { value:'com_atraso',  label:'Com Atraso' },
          ]},
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca:'', status:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhuma devolução registrada."
        columns={[
          { key:'id', label:'#', width:'60px', render: r => (
            <span style={{ fontFamily:'var(--font-mono)', color:'var(--t-muted)' }}>#{r.id}</span>
          )},
          { key:'contrato', label:'Contrato / Cliente', render: r => (
            <div>
              <div style={{ fontWeight:600, fontFamily:'var(--font-mono)' }}>{(r.contratos as any)?.numero}</div>
              <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>{(r.contratos as any)?.clientes?.nome}</div>
            </div>
          )},
          { key:'data',    label:'Data', render: r => fmt.datetime(r.data_devolucao) },
          { key:'atraso',  label:'Atraso', align:'right', render: r =>
            r.dias_atraso > 0
              ? <span style={{ color:'var(--c-danger)', fontWeight:600 }}>{r.dias_atraso}d</span>
              : <span style={{ color:'var(--t-muted)' }}>—</span>
          },
          { key:'multa',   label:'Multa', align:'right', render: r =>
            r.multa_atraso > 0 ? <span style={{ color:'var(--c-danger)' }}>{fmt.money(r.multa_atraso)}</span> : '—'
          },
          { key:'avarias', label:'Avarias', align:'right', render: r =>
            r.valor_avarias > 0 ? <span style={{ color:'var(--c-warning)' }}>{fmt.money(r.valor_avarias)}</span> : '—'
          },
          { key:'status', label:'Status', render: r => <Badge value={r.status} dot /> },
        ]}
        data={lista}
      />

      <SlidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title="Registrar Devolução"
        subtitle="Confira os itens e condições antes de confirmar"
        width="lg"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar} disabled={!contratoId}>
              ✓ Confirmar Devolução
            </Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <LookupField
            label="Contrato Ativo" required placeholder="Pesquisar por número do contrato..."
            value={contratoId} displayValue={contratoNum}
            onChange={(id, row) => selecionarContrato(id as number, row)}
            table="contratos" searchColumn="numero"
            extraColumns="caucao,data_fim,total" filter={{ status:'ativo' }}
            renderOption={row => (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{row.numero}</div>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                    Fim: {fmt.date(row.data_fim)}
                  </div>
                </div>
                <div style={{ fontWeight:700, color:'var(--c-primary)', whiteSpace:'nowrap' }}>{fmt.money(row.total)}</div>
              </div>
            )}
          />

          {itensDev.length > 0 && (
            <>
              <div>
                <div className="ds-section-title">Condição dos Itens Devolvidos</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {itensDev.map((item, i) => (
                    <div key={i} style={{ border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ fontWeight:600, flex:1, fontSize:'var(--fs-base)' }}>{item.produto_nome}</span>
                        {item.patrimonio_num && (
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:'var(--fs-md)', background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-xs)', padding:'2px 6px' }}>
                            {item.patrimonio_num}
                          </span>
                        )}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                        <FormField label="Condição">
                          <select value={item.condicao}
                            onChange={e => { const a = [...itensDev]; a[i].condicao = e.target.value; setItensDev(a) }}
                            className={selectCls}>
                            <option value="bom">✅ Bom estado</option>
                            <option value="avariado">⚠️ Avariado</option>
                            <option value="perdido">❌ Perdido</option>
                          </select>
                        </FormField>
                        {!itensDev[i].patrimonio_id && (
                          <FormField label="Qtd devolvida">
                            <input type="number" min="0" value={item.quantidade_devolvida}
                              onChange={e => { const a = [...itensDev]; a[i].quantidade_devolvida = Number(e.target.value); setItensDev(a) }}
                              className={inputCls} />
                          </FormField>
                        )}
                        {item.condicao === 'avariado' && (
                          <FormField label="Custo avaria (R$)">
                            <input type="number" step="0.01" min="0" value={item.custo_avaria}
                              onChange={e => { const a = [...itensDev]; a[i].custo_avaria = Number(e.target.value); setItensDev(a) }}
                              className={inputCls} />
                          </FormField>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="ds-section-title">Valores Financeiros</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { l:'Dias de Atraso',       f:'dias_atraso',       type:'number', step:'1' },
                    { l:'Multa por Atraso (R$)', f:'multa_atraso',     type:'number', step:'0.01' },
                    { l:'Valor Avarias (R$)',    f:'valor_avarias',    type:'number', step:'0.01' },
                    { l:'Caução Devolvido (R$)', f:'caucao_devolvido', type:'number', step:'0.01' },
                  ].map(x => (
                    <FormField key={x.f} label={x.l}>
                      <input type={x.type} step={x.step} min="0"
                        value={(form as any)[x.f]}
                        onChange={e => setForm(f => ({ ...f, [x.f]: Number(e.target.value) }))}
                        className={inputCls} />
                    </FormField>
                  ))}
                  <FormField label="Observações" style={{ gridColumn:'span 2' }}>
                    <textarea value={form.observacoes}
                      onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      rows={2} className={textareaCls} />
                  </FormField>
                </div>
              </div>
            </>
          )}
        </div>
      </SlidePanel>
    </div>
  )
}
