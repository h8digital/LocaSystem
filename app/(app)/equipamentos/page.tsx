'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Ico, Btn, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

const emptyForm = () => ({
  nome:'', codigo:'', categoria_id:'', marca:'', modelo:'', descricao:'',
  controla_patrimonio:1, unidade:'un', estoque_total:0, estoque_minimo:0,
  custo_reposicao:0, prazo_entrega_dias:0, preco_locacao_diario:0, preco_fds:0, preco_locacao_semanal:0,
  preco_quinzenal:0, preco_locacao_mensal:0, preco_trimestral:0, preco_semestral:0, observacoes:''
})

function campoPreco(nomeP: string) {
  const n = nomeP.toLowerCase()
  if (n.includes('semes'))  return 'preco_semestral'
  if (n.includes('trimes')) return 'preco_trimestral'
  if (n.includes('mens'))   return 'preco_locacao_mensal'
  if (n.includes('quinz'))  return 'preco_quinzenal'
  if (n.toLowerCase().includes('final') || n.toLowerCase().includes('fds') || n.toLowerCase().includes('weekend')) return 'preco_fds'
  if (n.includes('seman'))  return 'preco_locacao_semanal'
  return 'preco_locacao_diario'
}

export default function EquipamentosPage() {
  const router = useRouter()
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

  // ── Movimentação de Ativos ────────────────────────────────────────────────
  const [modalMov,      setModalMov]      = useState(false)
  const [movProduto,    setMovProduto]    = useState<any>(null)
  const [movTransacoes, setMovTransacoes] = useState<any[]>([])
  const [movLoading,    setMovLoading]    = useState(false)
  const [movTab,        setMovTab]        = useState<'historico'|'nova'>('historico')
  const [movSalvando,   setMovSalvando]   = useState(false)
  const [movErro,       setMovErro]       = useState('')
  const [patrimoniosMov, setPatrimoniosMov] = useState<any[]>([])
  // Para compra/entrada em lote: lista de patrimônios novos
  const emptyPatLine  = () => ({ numero_patrimonio:'', numero_serie:'' })
  const emptyMov = () => ({
    tipo:'compra', valor:'', data_transacao: new Date().toISOString().split('T')[0],
    numero_nota_fiscal:'', garantia_ate:'', depreciacao_meses:'', status_apos:'disponivel',
    observacoes:'',
    patrimonio_id:'',
    quantidade: 1,   // para produtos sem controle de patrimônio
  })
  const [formMov,      setFormMov]      = useState<any>(emptyMov())
  // Linhas de entrada em lote (compra)
  const [linhasEntrada, setLinhasEntrada] = useState<{numero_patrimonio:string,numero_serie:string}[]>([emptyPatLine()])

  async function abrirMovimentacao(prod: any) {
    setMovProduto(prod)
    setMovTab('historico')
    setFormMov(emptyMov())
    setMovErro('')
    setModalMov(true)
    setMovLoading(true)
    const res = await fetch(`/api/asset-transactions?produto_id=${prod.id}`)
    const data = await res.json()
    setMovTransacoes(data.ok ? data.data : [])
    // Carregar patrimônios do produto
    const { data: pats } = await supabase.from('patrimonios')
      .select('id,numero_patrimonio,numero_serie,status').eq('produto_id', prod.id).order('numero_patrimonio')
    setPatrimoniosMov(pats ?? [])
    setMovLoading(false)
  }

  async function salvarMovimentacao() {
    setMovSalvando(true); setMovErro('')
    try {
      const rastreavel = movProduto?.controla_patrimonio === 1
      const isEntrada  = formMov.tipo === 'compra'

      // ── Produto SEM controle de patrimônio (por quantidade) ──────────────
      if (!rastreavel) {
        const qtd = Number(formMov.quantidade) || 0
        if (qtd <= 0) throw new Error('Informe uma quantidade válida.')

        // Atualizar estoque_total diretamente
        const delta = isEntrada ? qtd : -qtd
        const novoTotal = Math.max(0, Number(movProduto.estoque_total || 0) + delta)
        const { error: estoqErr } = await supabase
          .from('produtos').update({ estoque_total: novoTotal }).eq('id', movProduto.id)
        if (estoqErr) throw new Error(estoqErr.message)

        // Registrar em estoque_movimentacoes
        await supabase.from('estoque_movimentacoes').insert({
          produto_id:  movProduto.id,
          tipo:        isEntrada ? 'entrada' : 'saida',
          quantidade:  qtd,
          observacoes: `${formMov.tipo.toUpperCase()} — NF: ${formMov.numero_nota_fiscal||'—'} | ${formMov.observacoes||''}`.trim(),
        })

        // Registrar na tabela asset_transactions (sem patrimônio)
        await fetch('/api/asset-transactions', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ...formMov, produto_id: movProduto.id, patrimonio_id: null })
        })

        // PRD 3.5: atualiza custo de reposição se for compra com valor
        if (isEntrada && Number(formMov.valor) > 0) {
          await supabase.from('produtos').update({ custo_reposicao: Number(formMov.valor) }).eq('id', movProduto.id)
        }

        // Refresh
        const { data: prod } = await supabase.from('produtos')
          .select('id,nome,controla_patrimonio,estoque_total').eq('id', movProduto.id).single()
        if (prod) setMovProduto(prod)
        const res2 = await fetch(`/api/asset-transactions?produto_id=${movProduto.id}`)
        const data2 = await res2.json()
        setMovTransacoes(data2.ok ? data2.data : [])
        setFormMov(emptyMov())
        setMovTab('historico')
        load()
        return
      }

      const isEntrada2 = isEntrada

      if (isEntrada2) {
        // Lote: para cada linha, criar patrimônio + transação
        const linhasValidas = linhasEntrada.filter(l => l.numero_patrimonio.trim())
        if (linhasValidas.length === 0) throw new Error('Informe ao menos um número de patrimônio.')

        for (const linha of linhasValidas) {
          // 1. Criar o patrimônio
          const { data: pat, error: patErr } = await supabase
            .from('patrimonios').insert({
              produto_id:         movProduto.id,
              numero_patrimonio:  linha.numero_patrimonio.trim(),
              numero_serie:       linha.numero_serie.trim() || null,
              status:             formMov.status_apos || 'disponivel',
              valor_aquisicao:    Number(formMov.valor) || 0,
              custo_reposicao:    Number(formMov.valor) || 0,
              data_aquisicao:     formMov.data_transacao,
            }).select('id').single()
          if (patErr) throw new Error(`Erro ao criar patrimônio "${linha.numero_patrimonio}": ${patErr.message}`)

          // 2. Registrar a transação vinculada ao patrimônio criado
          const res = await fetch('/api/asset-transactions', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              ...formMov,
              produto_id:    movProduto.id,
              patrimonio_id: pat.id,
            })
          })
          const data = await res.json()
          if (!data.ok) throw new Error(data.error)
        }
      } else {
        // Saída/Baixa rastreável: patrimônio existente
        if (!formMov.patrimonio_id) throw new Error('Selecione o patrimônio para esta movimentação.')
        const res = await fetch('/api/asset-transactions', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ...formMov, produto_id: movProduto.id })
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error)
      }

      // Refresh
      const res2 = await fetch(`/api/asset-transactions?produto_id=${movProduto.id}`)
      const data2 = await res2.json()
      setMovTransacoes(data2.ok ? data2.data : [])
      const { data: pats } = await supabase.from('patrimonios')
        .select('id,numero_patrimonio,numero_serie,status').eq('produto_id', movProduto.id).order('numero_patrimonio')
      setPatrimoniosMov(pats ?? [])
      setFormMov(emptyMov())
      setLinhasEntrada([emptyPatLine()])
      setMovTab('historico')
      load()
    } catch(e:any) { setMovErro(e.message) }
    finally { setMovSalvando(false) }
  }

  async function excluirTransacao(id: number) {
    if (!confirm('Excluir esta movimentação?')) return
    await fetch(`/api/asset-transactions?id=${id}`, { method:'DELETE' })
    const res = await fetch(`/api/asset-transactions?produto_id=${movProduto.id}`)
    const data = await res.json()
    setMovTransacoes(data.ok ? data.data : [])
  }

  async function load() {
    setLoading(true)
    let q = supabase.from('produtos').select('*, categorias(nome), contrato_itens(quantidade, contratos(status))').eq('ativo',1).order('nome')
    if (filters.busca) q = q.ilike('nome', `%${filters.busca}%`)
    if (filters.categoria_id) q = q.eq('categoria_id', filters.categoria_id)
    const { data } = await q
    // Calcular disponível real = estoque_total − locado em contratos ativos
    const listaComDisponivel = (data ?? []).map((p: any) => {
      if (p.controla_patrimonio) return { ...p, estoque_disponivel: null, qtd_locada: 0 }
      const qtdLocada = (p.contrato_itens ?? [])
        .filter((ci: any) => ci.contratos?.status === 'ativo')
        .reduce((s: number, ci: any) => s + Number(ci.quantidade), 0)
      return {
        ...p,
        qtd_locada: qtdLocada,
        estoque_disponivel: Math.max(0, (p.estoque_total ?? 0) - qtdLocada),
      }
    })
    setLista(listaComDisponivel)
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
      unidade: form.unidade||'un', ...(form.id ? {} : { estoque_total: Number(form.estoque_total)||0 }),
      estoque_minimo: Number(form.estoque_minimo)||0, custo_reposicao: Number(form.custo_reposicao)||0,
      preco_locacao_diario:  Number(form.preco_locacao_diario)||0,
      preco_fds:             Number(form.preco_fds)||0,
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
        onClick: () => router.push(`/estoque/${row.id}`)
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
            const disp   = r.estoque_disponivel ?? r.estoque_total
            const alerta = r.estoque_minimo > 0 && disp <= r.estoque_minimo
            return (
              <div>
                <span style={{ fontWeight:600, color: alerta ? 'var(--c-danger)' : 'var(--t-primary)' }}>
                  {disp} {r.unidade}{alerta ? ' ⚠' : ''}
                </span>
                {(r.qtd_locada ?? 0) > 0 && (
                  <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:1 }}>
                    {r.qtd_locada} locado(s)
                  </div>
                )}
              </div>
            )
          }},
          { key:'preco_locacao_diario', label:'Preço/Dia',    align:'right', render: r => fmt.money(r.preco_locacao_diario) },
          { key:'preco_locacao_mensal', label:'Preço/Mês',    align:'right', render: r => fmt.money(r.preco_locacao_mensal) },
          { key:'custo_reposicao',      label:'Reposição',    align:'right', render: r => fmt.money(r.custo_reposicao) },
        ]}
        data={lista}
        onRowClick={row => verDetalhe(row)}
        actions={row => (
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button onClick={() => abrirMovimentacao(row)}
              title="Movimentação de Ativos"
              style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',
                padding:'4px 9px',cursor:'pointer',fontSize:'var(--fs-md)',color:'var(--t-secondary)',fontWeight:600}}>
              📦
            </button>
            <ActionButtons
            onView={()  => verDetalhe(row)}
            onEdit={()  => abrir(row)}
            onDelete={() => inativar(row.id)}
            deleteConfirm={`Inativar o produto "${row.nome}"?`}
            acoesSec={acoesProduto(row)}
          />
          </div>
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
                    { l:'Total',       v: `${viewRow.estoque_total} ${viewRow.unidade}`,      destaque: false },
                    { l:'Locado',      v: `${viewRow.qtd_locada ?? 0} ${viewRow.unidade}`,        destaque: false },
                    { l:'Disponível',  v: `${viewRow.estoque_disponivel ?? viewRow.estoque_total} ${viewRow.unidade}`, destaque: true },
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
                  { l:'Final de Sem.', v: viewRow.preco_fds },
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
                  <div style={{position:'relative'}}>
                    <input
                      type="number"
                      value={form.estoque_total ?? 0}
                      readOnly
                      className={inputCls}
                      style={{background:'var(--bg-header)',color:'var(--t-muted)',cursor:'not-allowed',paddingRight:32}}
                    />
                    <span title="Altere o estoque pela tela de Movimentação de Ativos (botão 📦)"
                      style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',
                        fontSize:14,cursor:'help',color:'var(--t-muted)'}}>🔒</span>
                  </div>
                  <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:3}}>
                    Altere via Movimentação de Ativos (📦)
                  </div>
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

      {/* ── Modal de Movimentação de Ativos ───────────────────────────────── */}
      {modalMov && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-card)',borderRadius:'var(--r-lg)',width:'100%',maxWidth:720,
            maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)'}}>
            {/* Header */}
            <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:700,fontSize:'var(--fs-lg)'}}>Movimentação de Ativos</div>
                <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>{movProduto?.nome}</div>
              </div>
              <button onClick={()=>setModalMov(false)}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'var(--t-muted)',padding:'4px 8px'}}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid var(--border)',padding:'0 20px'}}>
              {([['historico','📋 Histórico'],['nova','➕ Nova Movimentação']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setMovTab(k)}
                  style={{padding:'10px 16px',border:'none',background:'none',cursor:'pointer',
                    fontWeight:movTab===k?700:400,fontSize:'var(--fs-md)',
                    color:movTab===k?'var(--c-primary)':'var(--t-muted)',
                    borderBottom:movTab===k?'2px solid var(--c-primary)':'2px solid transparent'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{flex:1,overflowY:'auto',padding:20}}>
              {movTab==='historico' && (
                movLoading ? <div style={{textAlign:'center',padding:30,color:'var(--t-muted)'}}>Carregando…</div> :
                movTransacoes.length===0 ? <div style={{textAlign:'center',padding:30,color:'var(--t-muted)'}}>Nenhuma movimentação registrada.</div> :
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--fs-md)'}}>
                  <thead>
                    <tr style={{background:'var(--bg-header)'}}>
                      {['Data','Tipo','Patrimônio','Valor','NF','Garantia até','Responsável',''].map(h=>(
                        <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:'var(--t-muted)',
                          fontSize:'var(--fs-sm)',borderBottom:'1px solid var(--border)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movTransacoes.map((t:any)=>(
                      <tr key={t.id} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'7px 10px'}}>{t.data_transacao}</td>
                        <td style={{padding:'7px 10px',textTransform:'capitalize',fontWeight:600}}>{t.tipo}</td>
                        <td style={{padding:'7px 10px',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)'}}>
                          {t.patrimonios?.numero_patrimonio ?? '—'}
                        </td>
                        <td style={{padding:'7px 10px',fontWeight:700}}>
                          {t.valor>0?`R$ ${Number(t.valor).toFixed(2).replace('.',',')}` : '—'}
                        </td>
                        <td style={{padding:'7px 10px',color:'var(--t-muted)'}}>{t.numero_nota_fiscal??'—'}</td>
                        <td style={{padding:'7px 10px',color:'var(--t-muted)'}}>{t.garantia_ate??'—'}</td>
                        <td style={{padding:'7px 10px',color:'var(--t-muted)'}}>{t.usuarios?.nome??'—'}</td>
                        <td style={{padding:'7px 10px'}}>
                          <button onClick={()=>excluirTransacao(t.id)}
                            style={{background:'none',border:'none',cursor:'pointer',color:'var(--c-danger)',fontSize:'var(--fs-md)'}}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {movTab==='nova' && (() => {
                const rastreavel = movProduto?.controla_patrimonio === 1
                const isEntrada  = formMov.tipo === 'compra'
                return (
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {movErro && <div style={{background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',borderRadius:'var(--r-md)',padding:'10px 14px',color:'var(--c-danger-text)'}}>{movErro}</div>}

                  {/* ── Badge indicando modo de controle ── */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
                    background: rastreavel ? 'var(--c-primary-light,#e8f4f8)' : '#f0fdf4',
                    border:`1px solid ${rastreavel?'var(--c-primary)':'#22c55e'}`,
                    borderRadius:'var(--r-sm)',fontSize:'var(--fs-md)'}}>
                    <span style={{fontSize:16}}>{rastreavel ? '🔖' : '📦'}</span>
                    <span style={{color: rastreavel?'var(--c-primary)':'#16a34a', fontWeight:600}}>
                      {rastreavel
                        ? 'Rastreável por Serial Number — cada item tem número de patrimônio único'
                        : `Controle por Quantidade — estoque atual: ${movProduto?.estoque_total ?? 0} unidades`
                      }
                    </span>
                  </div>

                  {/* ── Linha 1: Tipo + Data ── */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <FormField label="Tipo de Movimentação *">
                      <select className={selectCls} value={formMov.tipo}
                        onChange={e=>{ setFormMov({...formMov,tipo:e.target.value}); setLinhasEntrada([emptyPatLine()]) }}>
                        <option value="compra">{rastreavel ? 'Compra / Entrada (lote com seriais)' : 'Entrada de Estoque'}</option>
                        <option value="venda">Venda / Saída</option>
                        <option value="baixa">Baixa / Descarte</option>
                        <option value="ajuste">Ajuste de Estoque</option>
                      </select>
                    </FormField>
                    <FormField label="Data *">
                      <input type="date" className={inputCls} value={formMov.data_transacao}
                        onChange={e=>setFormMov({...formMov,data_transacao:e.target.value})} />
                    </FormField>
                  </div>

                  {/* ── NÃO RASTREÁVEL: campo de quantidade ── */}
                  {!rastreavel && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <FormField label={isEntrada ? 'Quantidade a Adicionar *' : 'Quantidade a Remover *'}>
                        <input type="number" min="1" step="1" className={inputCls}
                          value={formMov.quantidade}
                          onChange={e=>setFormMov({...formMov,quantidade:e.target.value})}
                          placeholder="Ex: 10" />
                      </FormField>
                      {!isEntrada && (
                        <div style={{padding:'8px 12px',background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',
                          borderRadius:'var(--r-sm)',fontSize:'var(--fs-md)',color:'var(--c-danger-text)',display:'flex',alignItems:'center'}}>
                          ⚠ Estoque disponível: <strong style={{marginLeft:4}}>{movProduto?.estoque_total ?? 0} un.</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── RASTREÁVEL: ENTRADA EM LOTE ── */}
                  {rastreavel && isEntrada && (
                    <div style={{border:'1px solid var(--border)',borderRadius:'var(--r-md)',overflow:'hidden'}}>
                      <div style={{background:'var(--bg-header)',padding:'8px 12px',fontWeight:700,fontSize:'var(--fs-md)',
                        display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid var(--border)'}}>
                        <span>Patrimônios a cadastrar <span style={{color:'var(--c-primary)',fontWeight:800}}>{linhasEntrada.filter(l=>l.numero_patrimonio.trim()).length}</span> item(ns)</span>
                        <button onClick={()=>setLinhasEntrada(p=>[...p,emptyPatLine()])}
                          style={{background:'var(--c-primary)',color:'#fff',border:'none',borderRadius:'var(--r-sm)',
                            padding:'3px 10px',cursor:'pointer',fontSize:'var(--fs-md)',fontWeight:600}}>
                          + Adicionar linha
                        </button>
                      </div>
                      {/* Cabeçalho */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 32px',gap:0,
                        background:'var(--bg-header)',borderBottom:'1px solid var(--border)',padding:'5px 12px'}}>
                        <span style={{fontSize:'var(--fs-sm)',fontWeight:600,color:'var(--t-muted)'}}>Nº Patrimônio *</span>
                        <span style={{fontSize:'var(--fs-sm)',fontWeight:600,color:'var(--t-muted)'}}>Nº Série / Serial</span>
                        <span></span>
                      </div>
                      {/* Linhas */}
                      <div style={{maxHeight:220,overflowY:'auto'}}>
                        {linhasEntrada.map((linha,idx)=>(
                          <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 1fr 32px',gap:6,
                            padding:'6px 12px',borderBottom:'1px solid var(--border)',alignItems:'center',
                            background:idx%2===0?'transparent':'var(--bg-header)'}}>
                            <input className={inputCls} style={{fontSize:'var(--fs-md)',padding:'4px 8px'}}
                              placeholder={`PAT-${String(idx+1).padStart(3,'0')}`}
                              value={linha.numero_patrimonio}
                              onChange={e=>{
                                const novo=[...linhasEntrada]
                                novo[idx]={...novo[idx],numero_patrimonio:e.target.value}
                                setLinhasEntrada(novo)
                              }} />
                            <input className={inputCls} style={{fontSize:'var(--fs-md)',padding:'4px 8px'}}
                              placeholder="Serial (opcional)"
                              value={linha.numero_serie}
                              onChange={e=>{
                                const novo=[...linhasEntrada]
                                novo[idx]={...novo[idx],numero_serie:e.target.value}
                                setLinhasEntrada(novo)
                              }} />
                            <button onClick={()=>setLinhasEntrada(p=>p.filter((_,i)=>i!==idx))}
                              disabled={linhasEntrada.length===1}
                              style={{background:'none',border:'none',cursor:'pointer',color:'var(--c-danger)',
                                fontSize:16,padding:2,opacity:linhasEntrada.length===1?0.3:1}}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── RASTREÁVEL: SAÍDA patrimônio existente ── */}
                  {rastreavel && !isEntrada && (
                    <FormField label="Patrimônio *">
                      <select className={selectCls} value={formMov.patrimonio_id}
                        onChange={e=>setFormMov({...formMov,patrimonio_id:e.target.value})}>
                        <option value="">— Selecione o patrimônio —</option>
                        {patrimoniosMov.filter((p:any)=>p.status!=='descartado').map((p:any)=>(
                          <option key={p.id} value={p.id}>
                            {p.numero_patrimonio}{p.numero_serie?` · ${p.numero_serie}`:''} — {p.status}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}

                  {/* ── Campos comuns ── */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <FormField label={isEntrada ? 'Valor unitário de compra (R$)' : 'Valor (R$)'}>
                      <input type="number" step="0.01" min="0" className={inputCls}
                        value={formMov.valor} onChange={e=>setFormMov({...formMov,valor:e.target.value})}
                        placeholder="0,00" />
                    </FormField>
                    <FormField label="Nº Nota Fiscal">
                      <input className={inputCls} value={formMov.numero_nota_fiscal}
                        onChange={e=>setFormMov({...formMov,numero_nota_fiscal:e.target.value})}
                        placeholder="Ex: NF-e 000123" />
                    </FormField>
                    {rastreavel && isEntrada && (<>
                      <FormField label="Garantia até">
                        <input type="date" className={inputCls} value={formMov.garantia_ate}
                          onChange={e=>setFormMov({...formMov,garantia_ate:e.target.value})} />
                      </FormField>
                      <FormField label="Depreciação (meses)">
                        <input type="number" min="0" className={inputCls}
                          value={formMov.depreciacao_meses}
                          onChange={e=>setFormMov({...formMov,depreciacao_meses:e.target.value})}
                          placeholder="Ex: 60" />
                      </FormField>
                    </>)}
                    <FormField label="Status após movimentação">
                      <select className={selectCls} value={formMov.status_apos}
                        onChange={e=>setFormMov({...formMov,status_apos:e.target.value})}>
                        <option value="disponivel">Disponível</option>
                        <option value="manutencao">Em Manutenção</option>
                        <option value="descartado">Descartado</option>
                        <option value="reservado">Reservado</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Observações">
                    <textarea className={textareaCls} rows={2} value={formMov.observacoes}
                      onChange={e=>setFormMov({...formMov,observacoes:e.target.value})}
                      placeholder="Detalhes da movimentação…" />
                  </FormField>

                  {rastreavel && isEntrada && (
                    <div style={{background:'#e8f4f8',border:'1px solid var(--c-primary)',borderRadius:'var(--r-sm)',
                      padding:'8px 12px',fontSize:'var(--fs-md)',color:'var(--c-primary)'}}>
                      ℹ️ Serão criados <strong>{linhasEntrada.filter((l:{numero_patrimonio:string})=>l.numero_patrimonio.trim()).length} patrimônio(s)</strong> novos.
                      O <strong>Custo de Reposição</strong> do produto será atualizado com o valor unitário.
                    </div>
                  )}
                  {!rastreavel && Number(formMov.valor) > 0 && isEntrada && (
                    <div style={{background:'#e8f4f8',border:'1px solid var(--c-primary)',borderRadius:'var(--r-sm)',
                      padding:'8px 12px',fontSize:'var(--fs-md)',color:'var(--c-primary)'}}>
                      ℹ️ O <strong>Custo de Reposição</strong> do produto será atualizado com o valor unitário informado.
                    </div>
                  )}
                </div>
                )
              })()}
            </div>

            {/* Footer */}
            {movTab==='nova' && (
              <div style={{padding:'14px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:10}}>
                <Btn variant="secondary" onClick={()=>setMovTab('historico')} style={{flex:1}}>Cancelar</Btn>
                <Btn onClick={salvarMovimentacao} loading={movSalvando} style={{flex:2}}>
                  Registrar Movimentação
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}