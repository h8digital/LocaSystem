'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Ico, Btn, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

const emptyForm = () => ({
  nome:'', codigo:'', categoria_id:'', marca:'', modelo:'', descricao:'',
  controla_patrimonio:1, unidade:'un', estoque_total:0, estoque_minimo:0,
  custo_reposicao:0, prazo_entrega_dias:0, preco_locacao_diario:0, preco_locacao_semanal:0,
  preco_quinzenal:0, preco_locacao_mensal:0, preco_trimestral:0, preco_semestral:0, observacoes:''
})

function campoPreco(nomeP: string) {
  const n = nomeP.toLowerCase()
  if (n.includes('semes'))  return 'preco_semestral'
  if (n.includes('trimes')) return 'preco_trimestral'
  if (n.includes('mens'))   return 'preco_locacao_mensal'
  if (n.includes('quinz'))  return 'preco_quinzenal'
  if (n.includes('seman'))  return 'preco_locacao_semanal'
  return 'preco_locacao_diario'
}

export default function EquipamentosPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [categorias, setCats]   = useState<any[]>([])
  const [periodos, setPeriodos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filters, setFilters]   = useState<Record<string,string>>({ busca:'', categoria_id:'' })

  // Painel: editar/novo
  const [panel, setPanel]   = useState(false)
  const [editId, setEditId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')
  const [form, setForm]     = useState<any>(emptyForm())

  // Painel: detalhes/visualizar
  const [panelView, setPanelView]   = useState(false)
  const [viewRow,   setViewRow]     = useState<any>(null)
  const [abaView,   setAbaView]     = useState<'dados'|'precos'>('dados')

  // Painel: preços (acesso rápido pelas ações)
  const [panelPrecos, setPanelPrecos] = useState(false)
  const [precosRow,   setPrecosRow]   = useState<any>(null)

  async function load() {
    setLoading(true)
    let q = supabase.from('produtos').select('*, categorias(nome)').eq('ativo',1).order('nome')
    if (filters.busca) q = q.ilike('nome', `%${filters.busca}%`)
    if (filters.categoria_id) q = q.eq('categoria_id', filters.categoria_id)
    const { data } = await q
    setLista(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('categorias').select('*').eq('ativo',1).order('nome').then(({data}) => setCats(data ?? []))
    supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias').then(({data}) => setPeriodos(data ?? []))
  }, [])
  useEffect(() => { load() }, [filters])

  function abrir(p?: any) {
    setErro('')
    setForm(p ? { ...emptyForm(), ...p } : emptyForm())
    setEditId(p?.id ?? null)
    setPanel(true)
  }

  function verDetalhe(row: any, aba: 'dados'|'precos' = 'dados') {
    setViewRow(row)
    setAbaView(aba)
    setPanelView(true)
  }

  async function salvar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório!'); return }
    setSaving(true); setErro('')
    const payload: any = {
      nome: form.nome, codigo: form.codigo||null,
      categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
      marca: form.marca||null, modelo: form.modelo||null, descricao: form.descricao||null,
      controla_patrimonio: Number(form.controla_patrimonio),
      unidade: form.unidade||'un', estoque_total: Number(form.estoque_total)||0,
      estoque_minimo: Number(form.estoque_minimo)||0, custo_reposicao: Number(form.custo_reposicao)||0,
      preco_locacao_diario:  Number(form.preco_locacao_diario)||0,
      preco_locacao_semanal: Number(form.preco_locacao_semanal)||0,
      preco_quinzenal:       Number(form.preco_quinzenal)||0,
      preco_locacao_mensal:  Number(form.preco_locacao_mensal)||0,
      preco_trimestral:      Number(form.preco_trimestral)||0,
      preco_semestral:       Number(form.preco_semestral)||0,
      observacoes: form.observacoes||null, ativo: 1, updated_at: new Date().toISOString()
    }
    const { error } = editId
      ? await supabase.from('produtos').update(payload).eq('id', editId)
      : await supabase.from('produtos').insert(payload)
    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    setSaving(false); setPanel(false); load()
  }

  async function inativar(id: number) {
    if (!confirm('Inativar este produto? Ele não aparecerá mais para seleção.')) return
    await supabase.from('produtos').update({ ativo: 0 }).eq('id', id)
    load()
  }

  const F = (k: string) => ({ value: form[k] ?? '', onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) })

  function acoesProduto(row: any): AcaoSecundaria[] {
    return [
      {
        icon: <Ico.Download />,
        label: 'Preços de Locação',
        grupo: 1,
        onClick: () => verDetalhe(row, 'precos')
      },
      {
        icon: <Ico.Archive />,
        label: 'Ver no Estoque',
        grupo: 1,
        onClick: () => { window.location.href = `/estoque?busca=${encodeURIComponent(row.nome)}` }
      },
    ]
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader
        title="Equipamentos"
        subtitle={`${lista.length} produto(s) cadastrado(s)`}
        actions={<Btn onClick={() => abrir()}>+ Novo Produto</Btn>}
      />

      <Filters
        fields={[
          { type:'text', key:'busca', placeholder:'Buscar por nome do produto...', width:'280px' },
          { type:'select', key:'categoria_id', placeholder:'Todas as categorias',
            options: categorias.map(c => ({ value: String(c.id), label: c.nome })) },
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca:'', categoria_id:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhum produto cadastrado."
        columns={[
          { key:'nome', label:'Produto', render: r => (
            <div>
              <div style={{ fontWeight:600 }}>{r.nome}</div>
              {(r.marca || r.modelo) && (
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  {[r.marca, r.modelo].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          )},
          { key:'categoria', label:'Categoria', render: r => (
            <span style={{ color:'var(--t-secondary)' }}>{(r.categorias as any)?.nome || '—'}</span>
          )},
          { key:'controle', label:'Controle', render: r =>
            r.controla_patrimonio
              ? <Badge value="locado"   label="Patrimônio" />
              : <Badge value="rascunho" label="Quantidade"  />
          },
          { key:'estoque', label:'Disponível', render: r => {
            if (r.controla_patrimonio) return <span style={{ color:'var(--t-muted)' }}>Por patrimônio</span>
            const alerta = r.estoque_minimo > 0 && r.estoque_total <= r.estoque_minimo
            return (
              <span style={{ fontWeight:600, color: alerta ? 'var(--c-danger)' : 'var(--t-primary)' }}>
                {r.estoque_total} {r.unidade}{alerta ? ' ⚠' : ''}
              </span>
            )
          }},
          { key:'preco_locacao_diario', label:'Preço/Dia',    align:'right', render: r => fmt.money(r.preco_locacao_diario) },
          { key:'preco_locacao_mensal', label:'Preço/Mês',    align:'right', render: r => fmt.money(r.preco_locacao_mensal) },
          { key:'custo_reposicao',      label:'Reposição',    align:'right', render: r => fmt.money(r.custo_reposicao) },
        ]}
        data={lista}
        onRowClick={row => verDetalhe(row)}
        actions={row => (
          <ActionButtons
            onView={()  => verDetalhe(row)}
            onEdit={()  => abrir(row)}
            onDelete={() => inativar(row.id)}
            deleteConfirm={`Inativar o produto "${row.nome}"?`}
            acoesSec={acoesProduto(row)}
          />
        )}
      />

      {/* ══ PAINEL: Visualizar Detalhes ═══════════════════════════════════ */}
      <SlidePanel
        open={panelView}
        onClose={() => setPanelView(false)}
        title={viewRow?.nome ?? ''}
        subtitle={[viewRow?.marca, viewRow?.modelo].filter(Boolean).join(' · ') || 'Detalhes do produto'}
        width="md"
        footer={
          <div style={{ display:'flex', gap:8, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelView(false)}>Fechar</Btn>
            <Btn style={{ flex:2 }} onClick={() => { setPanelView(false); abrir(viewRow) }}>Editar Produto</Btn>
          </div>
        }
      >
        {viewRow && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Abas */}
            <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border)' }}>
              {[{ k:'dados', l:'Dados Gerais' }, { k:'precos', l:'Preços de Locação' }].map((a:any) => (
                <button key={a.k} onClick={() => setAbaView(a.k)}
                  style={{
                    padding:'7px 14px', fontSize:'var(--fs-base)', fontWeight:600, border:'none', cursor:'pointer',
                    background:'transparent', borderBottom: abaView === a.k ? '2px solid var(--c-primary)' : '2px solid transparent',
                    color: abaView === a.k ? 'var(--c-primary)' : 'var(--t-muted)', marginBottom:'-2px', transition:'all 150ms'
                  }}>{a.l}</button>
              ))}
            </div>

            {/* Aba Dados Gerais */}
            {abaView === 'dados' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { l:'Código',    v: viewRow.codigo || '—' },
                    { l:'Categoria', v: (viewRow.categorias as any)?.nome || '—' },
                    { l:'Marca',     v: viewRow.marca || '—' },
                    { l:'Modelo',    v: viewRow.modelo || '—' },
                    { l:'Controle',  v: viewRow.controla_patrimonio ? 'Por Patrimônio' : 'Por Quantidade' },
                    { l:'Unidade',   v: viewRow.unidade || '—' },
                    { l:'Estoque Atual',   v: `${viewRow.estoque_total} ${viewRow.unidade}`, destaque: true },
                    { l:'Estoque Mínimo',  v: viewRow.controla_patrimonio ? '—' : `${viewRow.estoque_minimo} ${viewRow.unidade}` },
                    { l:'Custo Reposição', v: fmt.money(viewRow.custo_reposicao) },
                  { l:'Prazo Entrega', v: viewRow.prazo_entrega_dias > 0 ? `${viewRow.prazo_entrega_dias} dia(s)` : '—' },
                  ].map(item => (
                    <div key={item.l} style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)', padding:'10px 12px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:2 }}>{item.l}</div>
                      <div style={{ fontWeight:600, color: (item as any).destaque ? 'var(--c-primary)' : 'var(--t-primary)' }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {viewRow.descricao && (
                  <div style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)', padding:'10px 12px', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:4 }}>Descrição / Observações</div>
                    <div style={{ fontSize:'var(--fs-base)', color:'var(--t-secondary)', lineHeight:1.6 }}>{viewRow.descricao}</div>
                  </div>
                )}
              </div>
            )}

            {/* Aba Preços */}
            {abaView === 'precos' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { l:'Diário',        v: viewRow.preco_locacao_diario },
                  { l:'Semanal',       v: viewRow.preco_locacao_semanal },
                  { l:'Quinzenal',     v: viewRow.preco_quinzenal },
                  { l:'Mensal',        v: viewRow.preco_locacao_mensal },
                  { l:'Trimestral',    v: viewRow.preco_trimestral },
                  { l:'Semestral',     v: viewRow.preco_semestral },
                  { l:'Custo Reposição', v: viewRow.custo_reposicao },
                ].map(item => (
                  <div key={item.l} style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)', padding:'12px 14px', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:4 }}>{item.l}</div>
                    <div style={{ fontWeight:700, fontSize:'var(--fs-lg)', color: item.v > 0 ? 'var(--c-primary)' : 'var(--t-light)' }}>
                      {fmt.money(item.v)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SlidePanel>

      {/* ══ PAINEL: Editar / Novo Produto ════════════════════════════════ */}
      <SlidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title={editId ? 'Editar Produto' : 'Novo Produto'}
        subtitle={editId ? form.nome : 'Preencha os dados do produto'}
        width="lg"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>
              {editId ? 'Atualizar Produto' : 'Salvar Produto'}
            </Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* Identificação */}
          <div>
            <div className="ds-section-title">Identificação</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormField label="Nome do Produto" required style={{ gridColumn:'span 2' }}>
                <input {...F('nome')} className={inputCls} placeholder="Ex: Andaime Tubular 1,5m" autoFocus />
              </FormField>
              <FormField label="Código / SKU">
                <input {...F('codigo')} className={inputCls} placeholder="Ex: AND-001" />
              </FormField>
              <FormField label="Categoria">
                <select {...F('categoria_id')} className={selectCls}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Marca">
                <input {...F('marca')} className={inputCls} />
              </FormField>
              <FormField label="Modelo">
                <input {...F('modelo')} className={inputCls} />
              </FormField>
            </div>
          </div>

          {/* Controle de Estoque */}
          <div>
            <div className="ds-section-title">Controle de Estoque</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              {[
                { v:1, l:'Por Patrimônio',  d:'Cada unidade tem número único (série/patrimônio)' },
                { v:0, l:'Por Quantidade',   d:'Itens sem identificação individual' }
              ].map(o => (
                <label key={o.v} onClick={() => setForm({ ...form, controla_patrimonio: o.v })}
                  style={{
                    border: `2px solid ${Number(form.controla_patrimonio) === o.v ? 'var(--c-primary)' : 'var(--border)'}`,
                    background: Number(form.controla_patrimonio) === o.v ? 'var(--c-primary-light)' : 'var(--bg-card)',
                    borderRadius:'var(--r-md)', padding:'10px 12px', cursor:'pointer', transition:'all 150ms'
                  }}>
                  <div style={{ fontWeight:600, fontSize:'var(--fs-base)', marginBottom:2 }}>{o.l}</div>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>{o.d}</div>
                </label>
              ))}
            </div>
            {Number(form.controla_patrimonio) === 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                <FormField label="Unidade">
                  <input {...F('unidade')} className={inputCls} placeholder="un, kg, m, pç..." />
                </FormField>
                <FormField label="Estoque Atual">
                  <input type="number" min="0" {...F('estoque_total')} className={inputCls} />
                </FormField>
                <FormField label="Estoque Mínimo">
                  <input type="number" min="0" {...F('estoque_minimo')} className={inputCls} />
                </FormField>
              </div>
            )}
          </div>

          {/* Preços */}
          <div>
            <div className="ds-section-title">Preços de Locação por Período</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {periodos.map(p => {
                const campo = campoPreco(p.nome)
                return (
                  <FormField key={p.id} label={`${p.nome} (${p.dias}d)${Number(p.desconto_percentual) > 0 ? ` — ${p.desconto_percentual}% desc` : ''}`}>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0"
                        value={form[campo] ?? 0}
                        onChange={e => setForm({ ...form, [campo]: e.target.value })}
                        className={inputCls} style={{ paddingLeft:30 }} />
                    </div>
                  </FormField>
                )
              })}
              <FormField label="Prazo de Entrega (dias)">
                <input type="number" step="1" min="0" {...F('prazo_entrega_dias')} className={inputCls} placeholder="0" />
              </FormField>
              <FormField label="Custo de Reposição (perda/dano)">
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                  <input type="number" step="0.01" min="0" {...F('custo_reposicao')} className={inputCls} style={{ paddingLeft:30 }} />
                </div>
              </FormField>
            </div>
          </div>

          <FormField label="Descrição / Observações">
            <textarea {...F('observacoes')} rows={2} className={textareaCls} placeholder="Descrição, especificações técnicas..." />
          </FormField>
        </div>
      </SlidePanel>
    </div>
  )
}
