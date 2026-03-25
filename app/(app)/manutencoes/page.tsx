'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Btn, FormField, inputCls, selectCls, textareaCls, LookupField } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'
import { QuickCreateProduto } from '@/components/quick-create'

const tipoOpts = [
  { value:'corretiva',   label:'Corretiva' },
  { value:'preventiva',  label:'Preventiva' },
  { value:'higienizacao',label:'Higienização' },
  { value:'calibracao',  label:'Calibração' },
  { value:'outro',       label:'Outro' },
]

export default function ManutencoesPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string,string>>({ status:'', busca:'' })
  const [panel, setPanel]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [pats, setPats]       = useState<any[]>([])
  const [erro, setErro]       = useState('')

  const [produtoId,     setProdutoId]     = useState<number|null>(null)
  const [produtoNome,   setProdutoNome]   = useState('')
  const [produto,       setProduto]       = useState<any>(null)
  const [patrimonioId,  setPatrimonioId]  = useState<number|null>(null)
  const [patrimonioNome,setPatrimonioNome]= useState('')

  const [form, setForm] = useState<any>({
    tipo:'corretiva', descricao:'', fornecedor:'', custo:0,
    data_abertura: new Date().toISOString().split('T')[0],
    data_previsao:'', observacoes:''
  })

  async function load() {
    setLoading(true)
    let q = supabase.from('manutencoes')
      .select('*, produtos(nome), patrimonios(numero_patrimonio)')
      .order('created_at', { ascending:false })
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.busca)  q = q.ilike('descricao', `%${filters.busca}%`)
    const { data } = await q
    setLista(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filters])

  function selecionarProduto(id: number|null, row: any|null) {
    setProdutoId(id); setProduto(row); setProdutoNome(row?.nome ?? '')
    setPatrimonioId(null); setPatrimonioNome(''); setPats([])
    if (id && row?.controla_patrimonio) {
      supabase.from('patrimonios').select('id,numero_patrimonio,status').eq('produto_id', id)
        .then(({ data }) => setPats(data ?? []))
    }
  }

  function abrirPanel() {
    setErro('')
    setProdutoId(null); setProdutoNome(''); setProduto(null)
    setPatrimonioId(null); setPatrimonioNome(''); setPats([])
    setForm({
      tipo:'corretiva', descricao:'', fornecedor:'', custo:0,
      data_abertura: new Date().toISOString().split('T')[0],
      data_previsao:'', observacoes:''
    })
    setPanel(true)
  }

  async function salvar() {
    if (!produtoId) { setErro('Selecione um equipamento.'); return }
    if (!form.descricao?.trim()) { setErro('Descrição do problema é obrigatória.'); return }
    setSaving(true); setErro('')
    await supabase.from('manutencoes').insert({
      produto_id: produtoId, patrimonio_id: patrimonioId || null,
      ...form, status:'aberto',
      data_previsao: form.data_previsao || null,
      custo: Number(form.custo) || 0
    })
    if (patrimonioId) {
      await supabase.from('patrimonios').update({ status:'manutencao' }).eq('id', patrimonioId)
    }
    setSaving(false); setPanel(false); load()
  }

  async function concluir(m: any) {
    if (!confirm(`Confirmar conclusão da manutenção #${m.id}?`)) return
    await supabase.from('manutencoes').update({
      status:'concluido', data_conclusao: new Date().toISOString().split('T')[0]
    }).eq('id', m.id)
    if (m.patrimonio_id) {
      await supabase.from('patrimonios').update({ status:'disponivel' }).eq('id', m.patrimonio_id)
    }
    load()
  }

  async function cancelar(m: any) {
    if (!confirm('Cancelar esta manutenção?')) return
    await supabase.from('manutencoes').update({ status:'cancelado' }).eq('id', m.id)
    if (m.patrimonio_id) {
      await supabase.from('patrimonios').update({ status:'disponivel' }).eq('id', m.patrimonio_id)
    }
    load()
  }

  const F = (k: string) => ({ value: form[k] ?? '', onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) })

  const abertas = lista.filter(m => m.status === 'aberto').length
  const em_and  = lista.filter(m => m.status === 'em_andamento').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <PageHeader
        title="Manutenções"
        subtitle={`${abertas} aberta(s)${em_and ? ` · ${em_and} em andamento` : ''}`}
        actions={<Btn onClick={abrirPanel}>+ Nova OS</Btn>}
      />

      <Filters
        fields={[
          { type:'text',   key:'busca',  placeholder:'Buscar na descrição...', width:'260px' },
          { type:'select', key:'status', placeholder:'Todos os status', options:[
            { value:'aberto',       label:'Aberto' },
            { value:'em_andamento', label:'Em andamento' },
            { value:'concluido',    label:'Concluído' },
            { value:'cancelado',    label:'Cancelado' },
          ]},
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ status:'', busca:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhuma manutenção registrada."
        columns={[
          { key:'id', label:'#', width:'56px', render: r => (
            <span style={{ fontFamily:'var(--font-mono)', color:'var(--t-muted)' }}>#{r.id}</span>
          )},
          { key:'equip', label:'Equipamento', render: r => (
            <div>
              <div style={{ fontWeight:600 }}>{(r.produtos as any)?.nome}</div>
              {(r.patrimonios as any)?.numero_patrimonio && (
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', fontFamily:'var(--font-mono)' }}>
                  Pat: {(r.patrimonios as any)?.numero_patrimonio}
                </div>
              )}
            </div>
          )},
          { key:'tipo', label:'Tipo', render: r => (
            <span className="ds-badge ds-badge-blue">
              {tipoOpts.find(t => t.value === r.tipo)?.label ?? r.tipo}
            </span>
          )},
          { key:'descricao', label:'Descrição', render: r => (
            <span style={{ color:'var(--t-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220, display:'block' }}>
              {r.descricao}
            </span>
          )},
          { key:'custo', label:'Custo', align:'right', render: r => fmt.money(r.custo) },
          { key:'previsao', label:'Previsão', render: r => fmt.date(r.data_previsao) || '—' },
          { key:'status', label:'Status', render: r => <Badge value={r.status} dot /> },
        ]}
        data={lista}
        actions={row => {
          const sec: AcaoSecundaria[] = []
          if (row.status === 'aberto' || row.status === 'em_andamento') {
            sec.push({ label:'Concluir OS', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, onClick:()=>concluir(row), grupo:1 })
            sec.push({ label:'Cancelar OS', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>, onClick:()=>cancelar(row), grupo:1, destrutivo:true })
          }
          return (
            <ActionButtons
              onEdit={() => {
                setForm({
                  tipo: row.tipo ?? 'corretiva',
                  descricao: row.descricao ?? '',
                  fornecedor: row.fornecedor ?? '',
                  custo: row.custo ?? 0,
                  data_abertura: row.data_abertura ?? new Date().toISOString().split('T')[0],
                  data_previsao: row.data_previsao ?? '',
                  observacoes: row.observacoes ?? '',
                })
                setProdutoId(row.produto_id ?? null)
                setProdutoNome((row.produtos as any)?.nome ?? '')
                setErro('')
                setPanel(true)
              }}
              acoesSec={sec}
            />
          )
        }}
      />

      <SlidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title="Nova Ordem de Serviço"
        subtitle="Registro de manutenção de equipamento"
        width="md"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>✓ Abrir OS</Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <LookupField
            label="Equipamento" required placeholder="Pesquisar equipamento..."
            value={produtoId} displayValue={produtoNome}
            onChange={(id, row) => selecionarProduto(id as number, row)}
            table="produtos" searchColumn="nome"
            extraColumns="controla_patrimonio,marca" filter={{ ativo:1 }}
            renderOption={row => (
              <div>
                <div style={{ fontWeight:500 }}>{row.nome}</div>
                {row.marca && <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>{row.marca}</div>}
              </div>
            )}
            createPanelTitle="Novo Produto"
            createPanel={({ onClose, onCreated }: any) =>
              <QuickCreateProduto onClose={onClose} onCreated={r => { selecionarProduto(r.id, r); onCreated(r) }} />
            }
          />

          {pats.length > 0 && (
            <LookupField
              label="Patrimônio (opcional)" placeholder="Selecionar patrimônio específico..."
              value={patrimonioId} displayValue={patrimonioNome}
              onChange={(id, row) => { setPatrimonioId(id as number); setPatrimonioNome(row?.numero_patrimonio ?? '') }}
              table="patrimonios" searchColumn="numero_patrimonio"
              extraColumns="status,numero_serie" filter={{ produto_id: produtoId! }}
              renderOption={row => (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{row.numero_patrimonio}</span>
                  <Badge value={row.status} />
                </div>
              )}
            />
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormField label="Tipo de Manutenção">
              <select {...F('tipo')} className={selectCls}>
                {tipoOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Custo Estimado (R$)">
              <input type="number" step="0.01" min="0" {...F('custo')} className={inputCls} />
            </FormField>
            <FormField label="Data de Abertura">
              <input type="date" {...F('data_abertura')} className={inputCls} />
            </FormField>
            <FormField label="Previsão de Conclusão">
              <input type="date" {...F('data_previsao')} className={inputCls} min={form.data_abertura} />
            </FormField>
          </div>
          <FormField label="Fornecedor / Técnico Responsável">
            <input {...F('fornecedor')} className={inputCls} placeholder="Nome da oficina ou técnico" />
          </FormField>
          <FormField label="Descrição do Problema" required>
            <textarea {...F('descricao')} rows={3} className={textareaCls} placeholder="Descreva o problema ou serviço a realizar..." />
          </FormField>
          <FormField label="Observações Internas">
            <textarea {...F('observacoes')} rows={2} className={textareaCls} />
          </FormField>
        </div>
      </SlidePanel>
    </div>
  )
}
