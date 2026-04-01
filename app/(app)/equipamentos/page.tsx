'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Ico, Btn, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'
import LookupField from '@/components/ui/LookupField'
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

// ── Mini-componente para criar categoria inline ───────────────────────────────
function CriarCategoriaPanel({ onClose, onCreated }: { onClose:()=>void; onCreated:(r:any)=>void }) {
  const [nome,     setNome]     = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro,     setErro]     = useState('')

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome da categoria.'); return }
    setSalvando(true); setErro('')
    const { data, error } = await supabase
      .from('categorias')
      .insert({ nome: nome.trim(), ativo: 1 })
      .select().single()
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onCreated(data)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'4px 0' }}>
      {erro && (
        <div style={{ background:'var(--c-danger-light)', border:'1px solid var(--c-danger)',
          borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--c-danger-text)',
          fontSize:'var(--fs-md)' }}>{erro}</div>
      )}
      <FormField label="Nome da Categoria" required>
        <input
          className={inputCls}
          placeholder="Ex: Andaimes e Escadas"
          value={nome}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') salvar() }}
          autoFocus
        />
      </FormField>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <Btn variant="secondary" style={{ flex:1 }} onClick={onClose}>Cancelar</Btn>
        <Btn style={{ flex:2 }} loading={salvando} onClick={salvar}>Criar Categoria</Btn>
      </div>
    </div>
  )
}

export default function EquipamentosPage() {
  const router = useRouter()
  const [lista, setLista]       = useState<any[]>([])
  const [categorias, setCats]   = useState<any[]>([])
  const [periodos, setPeriodos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filters, setFilters]   = useState<Record<string,string>>({ busca:'', categoria_id:'', codigo:'', patrimonio:'' })

  // Painel: editar/novo
  const [panel, setPanel]   = useState(false)
  const [editId, setEditId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')
  const [form, setForm]     = useState<any>(emptyForm())

  // Painel: detalhes/visualizar
  const [panelView, setPanelView]   = useState(false)
  const [viewRow,   setViewRow]     = useState<any>(null)
  const [abaView,       setAbaView]       = useState<'estoque'|'precos'>('estoque')
  const [viewContratos, setViewContratos] = useState<any[]>([])
  const [viewOS,        setViewOS]        = useState<any[]>([])
  const [viewMovs,      setViewMovs]      = useState<any[]>([])
  const [viewLoadingEx, setViewLoadingEx] = useState(false)
  const [viewPats,      setViewPats]      = useState<any[]>([])

  // Painel: preços (acesso rápido pelas ações)
  const [panelPrecos, setPanelPrecos] = useState(false)
  const [precosRow,   setPrecosRow]   = useState<any>(null)

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const [abaForm,      setAbaForm]      = useState<'dados'|'fotos'>('dados')
  const [catNome,      setCatNome]      = useState('')  // display value para LookupField de categoria
  const [fotos,        setFotos]        = useState<any[]>([])
  const [uploadando,   setUploadando]   = useState(false)
  const [erroFoto,     setErroFoto]     = useState('')

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
  const [conflitos,     setConflitos]     = useState<Record<number,string>>({})

  async function abrirMovimentacao(prod: any) {
    // Limpar TODO o estado da movimentação anterior antes de abrir
    setMovProduto(prod)
    setMovTab('historico')
    setFormMov(emptyMov())
    setLinhasEntrada([emptyPatLine()])
    setConflitos({})
    setMovErro('')
    setModalMov(true)
    setMovLoading(true)
    const res = await fetch(`/api/asset-transactions?produto_id=${prod.id}`)
    const data = await res.json()
    setMovTransacoes(data.ok ? data.data : [])
    // Carregar patrimônios do produto
    const { data: pats } = await supabase.from('patrimonios')
      .select('id,numero_patrimonio,numero_serie,status')
      .eq('produto_id', prod.id)
      .is('deleted_at', null)
      .order('numero_patrimonio')
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

        // Verificar conflitos de unicidade antes de salvar
        const checkResults = await Promise.all(linhasValidas.map(l =>
          fetch('/api/asset-transactions', {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ numero_patrimonio: l.numero_patrimonio.trim() })
          }).then(r => r.json())
        ))
        const conflitosEncontrados = checkResults
          .map((r, i) => r.disponivel === false ? linhasValidas[i].numero_patrimonio : null)
          .filter(Boolean)
        if (conflitosEncontrados.length > 0) {
          throw new Error('Patrimônio(s) já existente(s): ' + conflitosEncontrados.join(', ') + '. Exclua a movimentação anterior antes de recadastrar.')
        }

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
        .select('id,numero_patrimonio,numero_serie,status')
        .eq('produto_id', movProduto.id)
        .is('deleted_at', null)
        .order('numero_patrimonio')
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
    let q = supabase.from('produtos').select('*, categorias(nome), contrato_itens(quantidade, contratos(status)), patrimonios(numero_patrimonio,numero_serie,status,deleted_at)').eq('ativo',1).order('nome')
    if (filters.busca)       q = q.ilike('nome',   `%${filters.busca}%`)
    if (filters.categoria_id) q = q.eq('categoria_id', filters.categoria_id)
    if (filters.codigo)       q = q.ilike('codigo', `%${filters.codigo}%`)
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

    // Carregar foto principal de cada produto
    const prodIds = listaComDisponivel.map((p:any) => p.id)
    let fotosMap: Record<number,string> = {}
    if (prodIds.length > 0) {
      const { data: fotosData } = await supabase
        .from('produto_fotos').select('produto_id, url')
        .in('produto_id', prodIds).eq('principal', true)
      ;(fotosData ?? []).forEach((f:any) => { fotosMap[f.produto_id] = f.url })
    }

    let enriched = listaComDisponivel.map((p:any) => ({ ...p, foto_url: fotosMap[p.id] ?? null }))
    // Post-filter by patrimônio number
    if (filters.patrimonio) {
      const term = filters.patrimonio.toLowerCase()
      enriched = enriched.filter((p:any) =>
        (p.patrimonios ?? []).filter((pat:any) => !pat.deleted_at).some((pat:any) =>
          (pat.numero_patrimonio ?? '').toLowerCase().includes(term) ||
          (pat.numero_serie ?? '').toLowerCase().includes(term)
        )
      )
    }
    setLista(enriched)
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

  async function verDetalhe(row: any, aba: 'estoque'|'precos' = 'estoque') {
    setViewRow(row)
    setAbaView(aba)
    setPanelView(true)
    setViewLoadingEx(true)
    setViewContratos([]); setViewOS([]); setViewMovs([]); setViewPats([])
    // Buscar dados frescos do produto (estoque, locado, disponível)
    const { data: prodFresh } = await supabase
      .from('produtos')
      .select('*, contrato_itens(quantidade, contratos(status)), patrimonios(id,status,deleted_at)')
      .eq('id', row.id)
      .single()
    if (prodFresh) {
      const patsAtivos = (prodFresh.patrimonios ?? []).filter((p:any) => !p.deleted_at)
      const qtdLocada = prodFresh.controla_patrimonio
        ? patsAtivos.filter((p:any) => p.status === 'locado').length
        : (prodFresh.contrato_itens ?? [])
            .filter((ci:any) => ci.contratos?.status === 'ativo')
            .reduce((s:number, ci:any) => s + Number(ci.quantidade), 0)
      const estDisp = prodFresh.controla_patrimonio
        ? patsAtivos.filter((p:any) => p.status === 'disponivel').length
        : Math.max(0, (prodFresh.estoque_total ?? 0) - qtdLocada)
      setViewRow({ ...prodFresh, qtd_locada: qtdLocada, estoque_disponivel: estDisp })
    }
    const [contratosRes, osRes, movsRes, patsRes] = await Promise.all([
      supabase.from('contrato_itens')
        .select('quantidade, preco_unitario, contratos(numero, status, data_inicio, data_fim, clientes(nome))')
        .eq('produto_id', row.id)
        .in('contratos.status', ['ativo','em_devolucao','pendente_manutencao']),
      supabase.from('manutencoes')
        .select('id, status, tipo, descricao, data_abertura, custo')
        .eq('produto_id', row.id)
        .in('status', ['aberto','em_andamento'])
        .order('data_abertura', { ascending: false })
        .limit(5),
      supabase.from('estoque_movimentacoes')
        .select('tipo, quantidade, observacoes, created_at')
        .eq('produto_id', row.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('patrimonios')
        .select('id, numero_patrimonio, numero_serie, status, data_aquisicao, valor_aquisicao, contrato_itens!contrato_itens_patrimonio_id_fkey(contratos(numero,status))')
        .eq('produto_id', row.id)
        .is('deleted_at', null)
        .order('numero_patrimonio'),
    ])
    setViewContratos((contratosRes.data ?? []).filter((ci:any) => ci.contratos))
    setViewOS(osRes.data ?? [])
    setViewMovs(movsRes.data ?? [])
    setViewPats(patsRes.data ?? [])
    setViewLoadingEx(false)
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
        icon: <Ico.Archive />,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Título compacto sem PageHeader ─────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 0 12px', borderBottom:'1px solid var(--border)', marginBottom:14 }}>
        <div>
          <h1 style={{ fontWeight:700, fontSize:'var(--fs-xl)', color:'var(--t-primary)', margin:0, lineHeight:1.2 }}>
            Equipamentos
          </h1>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
            {lista.length} produto(s) cadastrado(s)
          </div>
        </div>
        <Btn onClick={() => abrir()}>+ Novo Produto</Btn>
      </div>

      {/* ── Filtros em linha única ──────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
        {/* Busca por nome */}
        <div style={{ position:'relative', flex:'2 1 180px', minWidth:160 }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--t-muted)', pointerEvents:'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input className="ds-input" style={{ paddingLeft:32, width:'100%' }}
            placeholder="Nome do produto..." value={filters.busca}
            onChange={e => setFilters(f => ({ ...f, busca: e.target.value }))} />
        </div>

        {/* Busca por código */}
        <div style={{ position:'relative', flex:'1 1 120px', minWidth:110 }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--t-muted)', pointerEvents:'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <input className="ds-input" style={{ paddingLeft:32, width:'100%' }}
            placeholder="Código / SKU..." value={filters.codigo}
            onChange={e => setFilters(f => ({ ...f, codigo: e.target.value }))} />
        </div>

        {/* Busca por patrimônio */}
        <div style={{ position:'relative', flex:'1 1 140px', minWidth:120 }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--t-muted)', pointerEvents:'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <input className="ds-input" style={{ paddingLeft:32, width:'100%' }}
            placeholder="Nº Patrimônio / Serial..." value={filters.patrimonio}
            onChange={e => setFilters(f => ({ ...f, patrimonio: e.target.value }))} />
        </div>

        {/* Categoria */}
        <select className="ds-input" style={{ flex:'1 1 160px', minWidth:140 }}
          value={filters.categoria_id}
          onChange={e => setFilters(f => ({ ...f, categoria_id: e.target.value }))}>
          <option value="">Todas as categorias</option>
          {categorias.map((cat:any) => (
            <option key={cat.id} value={String(cat.id)}>{cat.nome}</option>
          ))}
        </select>

        {/* Limpar */}
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ busca:'', categoria_id:'', codigo:'', patrimonio:'' })}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
              padding:'6px 12px', cursor:'pointer', fontSize:'var(--fs-md)', color:'var(--t-muted)',
              whiteSpace:'nowrap', transition:'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--c-danger)'; e.currentTarget.style.color='var(--c-danger)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--t-muted)' }}>
            ✕ Limpar
          </button>
        )}
      </div>

      <DataTable
        loading={loading}
        emptyMessage="Nenhum produto encontrado."
        columns={[
          { key:'foto', label:'', render: r => (
            r.foto_url
              ? <img src={r.foto_url} alt="" style={{width:36,height:36,objectFit:'cover',
                  borderRadius:'var(--r-sm)',border:'1px solid var(--border)',display:'block',flexShrink:0}} />
              : <div style={{width:36,height:36,borderRadius:'var(--r-sm)',border:'1px solid var(--border)',
                  background:'var(--bg-header)',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,color:'var(--t-muted)',flexShrink:0}}>📦</div>
          )},
          { key:'nome', label:'Produto', render: r => (
            <div>
              <div className="tbl-cell-main">{r.nome}</div>
              {r.codigo && (
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', fontFamily:'var(--font-mono)',
                  marginTop:1, letterSpacing:'.02em' }}>
                  {r.codigo}
                </div>
              )}
            </div>
          )},
          { key:'categoria', label:'Categoria', render: r => (
            <span style={{ color:'var(--t-secondary)', fontSize:'var(--fs-md)' }}>
              {(r.categorias as any)?.nome || '—'}
            </span>
          )},
          { key:'disponivel', label:'Disponível', render: r => {
            if (r.controla_patrimonio) {
              const pats  = (r.patrimonios ?? []).filter((p:any) => !p.deleted_at)
              const total = pats.length
              const disp  = pats.filter((p:any) => p.status === 'disponivel').length
              return (
                <span style={{ fontWeight:600, color: disp > 0 ? 'var(--c-primary)' : 'var(--t-muted)' }}>
                  {disp} / {total} un
                </span>
              )
            }
            const disp   = r.estoque_disponivel ?? r.estoque_total
            const alerta = r.estoque_minimo > 0 && disp <= r.estoque_minimo
            return (
              <span style={{ fontWeight:600, color: alerta ? 'var(--c-danger)' : disp > 0 ? 'var(--c-primary)' : 'var(--t-muted)' }}>
                {disp} {r.unidade}{alerta ? ' ⚠' : ''}
              </span>
            )
          }},
          { key:'locado', label:'Locado', render: r => {
            if (r.controla_patrimonio) {
              const qtd = (r.patrimonios ?? []).filter((p:any) => !p.deleted_at && p.status === 'locado').length
              return <span style={{ fontWeight:600, color: qtd > 0 ? 'var(--c-warning,#f59e0b)' : 'var(--t-muted)' }}>{qtd} un</span>
            }
            const qtd = r.qtd_locada ?? 0
            return <span style={{ fontWeight:600, color: qtd > 0 ? 'var(--c-warning,#f59e0b)' : 'var(--t-muted)' }}>{qtd} {r.unidade}</span>
          }},
          { key:'preco_locacao_diario', label:'Preço/Dia', align:'right',
            render: r => <span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{fmt.money(r.preco_locacao_diario)}</span> },
          { key:'preco_locacao_mensal', label:'Preço/Mês', align:'right',
            render: r => <span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{fmt.money(r.preco_locacao_mensal)}</span> },
          { key:'custo_reposicao', label:'Reposição', align:'right',
            render: r => <span style={{ fontFamily:'var(--font-mono)', color:'var(--t-muted)' }}>{fmt.money(r.custo_reposicao)}</span> },
        ]}
        data={lista}
        onRowClick={row => verDetalhe(row)}
        actions={row => (
          <div style={{ display:'flex', justifyContent:'center' }}>
            <ActionButtons
              onDelete={() => inativar(row.id)}
              deleteConfirm={`Inativar o produto "${row.nome}"?`}
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
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelView(false)}>Fechar</Btn>
            <Btn style={{ flex:2 }} onClick={() => { setPanelView(false); abrir(viewRow) }}>Editar Produto</Btn>
          </div>
        }
      >
        {viewRow && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* ── Abas ── */}
            <div style={{display:'flex',gap:2,borderBottom:'2px solid var(--border)'}}>
              {([['estoque','📦 Estoque'],['precos','💰 Preços']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setAbaView(k)}
                  style={{padding:'7px 14px',fontSize:'var(--fs-base)',fontWeight:600,border:'none',cursor:'pointer',
                    background:'transparent',marginBottom:'-2px',transition:'all 150ms',
                    borderBottom:abaView===k?'2px solid var(--c-primary)':'2px solid transparent',
                    color:abaView===k?'var(--c-primary)':'var(--t-muted)'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* ══ ABA ESTOQUE ═════════════════════════════════════════════ */}
            {abaView==='estoque' && (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>

                {/* KPIs de estoque */}
                <div className="kpi-grid">
                  {[
                    {l:'Total',      v:`${viewRow.estoque_total??0} ${viewRow.unidade}`,     c:'var(--t-primary)'},
                    {l:'Locado',     v:`${viewRow.qtd_locada??0} ${viewRow.unidade}`,         c:'var(--c-warning,#f59e0b)'},
                    {l:'Disponível', v:`${viewRow.estoque_disponivel??viewRow.estoque_total??0} ${viewRow.unidade}`, c:'var(--c-primary)'},
                    {l:'Mínimo',     v:viewRow.controla_patrimonio?'—':`${viewRow.estoque_minimo??0} ${viewRow.unidade}`, c:'var(--t-muted)'},
                  ].map(k=>(
                    <div key={k.l} style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',
                      padding:'10px 12px',border:'1px solid var(--border)',textAlign:'center'}}>
                      <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginBottom:4}}>{k.l}</div>
                      <div style={{fontWeight:700,fontSize:'var(--fs-lg)',color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Info básica do produto */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {l:'Código',          v:viewRow.codigo||'—'},
                    {l:'Categoria',       v:(viewRow.categorias as any)?.nome||'—'},
                    {l:'Controle',        v:viewRow.controla_patrimonio?'Por Patrimônio':'Por Quantidade'},
                    {l:'Custo Reposição', v:fmt.money(viewRow.custo_reposicao)},
                    {l:'Prazo Entrega',   v:viewRow.prazo_entrega_dias>0?`${viewRow.prazo_entrega_dias} dia(s)`:'—'},
                    {l:'Marca / Modelo',  v:[viewRow.marca,viewRow.modelo].filter(Boolean).join(' · ')||'—'},
                  ].map(k=>(
                    <div key={k.l} style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',
                      padding:'8px 12px',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginBottom:2}}>{k.l}</div>
                      <div style={{fontWeight:600,fontSize:'var(--fs-md)'}}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Contratos ativos */}
                <div className="panel-section">
                  <div style={{padding:'8px 12px',background:'var(--bg-header)',fontWeight:700,
                    fontSize:'var(--fs-md)',borderBottom:'1px solid var(--border)',
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>Itens Locados em Contratos Ativos</span>
                    <span style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',fontWeight:400}}>
                      {viewContratos.length} contrato(s)
                    </span>
                  </div>
                  {viewLoadingEx ? (
                    <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Carregando…</div>
                  ) : viewContratos.length===0 ? (
                    <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Nenhum item locado no momento.</div>
                  ) : (
                    <table className="ds-table">
                      <thead>
                        <tr style={{background:'var(--bg-header)'}}>
                          {['Contrato','Cliente','Qtd','Status'].map(h=>(
                            <th key={h} style={{padding:'6px 10px',textAlign:'left',fontWeight:600,
                              color:'var(--t-muted)',fontSize:'var(--fs-sm)',borderBottom:'1px solid var(--border)'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewContratos.map((ci:any,i:number)=>(
                          <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                            <td style={{padding:'6px 10px',fontFamily:'var(--font-mono)',fontWeight:600,fontSize:'var(--fs-sm)'}}>
                              {(ci.contratos as any)?.numero}
                            </td>
                            <td style={{padding:'6px 10px'}}>{(ci.contratos as any)?.clientes?.nome??'—'}</td>
                            <td style={{padding:'6px 10px',fontWeight:700}}>{ci.quantidade}</td>
                            <td style={{padding:'6px 10px'}}>
                              <span style={{fontSize:'var(--fs-xs)',fontWeight:700,padding:'2px 7px',borderRadius:'var(--r-sm)',
                                background:'var(--c-success-light,#dcfce7)',color:'var(--c-success,#16a34a)'}}>
                                {(ci.contratos as any)?.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Patrimônios / Inventário */}
                {viewRow?.controla_patrimonio===1 && (
                  <div className="panel-section">
                    <div style={{padding:'8px 12px',background:'var(--bg-header)',fontWeight:700,
                      fontSize:'var(--fs-md)',borderBottom:'1px solid var(--border)',
                      display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>Inventário de Patrimônios</span>
                      <span style={{fontWeight:400,fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>
                        {viewPats.filter((p:any)=>p.status==='disponivel').length} disponível /
                        {' '}{viewPats.filter((p:any)=>p.status==='locado').length} locado /
                        {' '}{viewPats.length} total
                      </span>
                    </div>
                    {viewLoadingEx ? (
                      <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Carregando…</div>
                    ) : viewPats.length === 0 ? (
                      <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>
                        Nenhum patrimônio cadastrado. Use o botão <strong>+ Movimentação</strong> para registrar entradas.
                      </div>
                    ) : (
                      <table className="ds-table">
                        <thead>
                          <tr style={{background:'var(--bg-header)'}}>
                            {['Nº Patrimônio','Nº Série','Status','Aquisição','Contrato Atual'].map(h=>(
                              <th key={h} style={{padding:'6px 10px',textAlign:'left',fontWeight:600,
                                color:'var(--t-muted)',fontSize:'var(--fs-sm)',borderBottom:'1px solid var(--border)'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {viewPats.map((pat:any,i:number)=>{
                            // Tenta link direto (patrimonio_id em contrato_itens)
                            const contratoAtivo = (pat.contrato_itens ?? [])
                              .find((ci:any) => ['ativo','em_devolucao','pendente_manutencao'].includes(ci.contratos?.status))
                            // Fallback: se está locado mas sem link direto, busca pelo produto
                            const contratoFallback = !contratoAtivo && pat.status === 'locado'
                              ? viewContratos.find((ci:any) => ['ativo','em_devolucao','pendente_manutencao'].includes(ci.contratos?.status))
                              : null
                            const contratoExibir = contratoAtivo ?? contratoFallback
                            const statusColor = pat.status==='disponivel'?'var(--c-success,#16a34a)':
                              pat.status==='locado'?'var(--c-primary)':
                              pat.status==='manutencao'?'var(--c-warning,#f59e0b)':'var(--t-muted)'
                            return (
                              <tr key={pat.id} style={{borderBottom:'1px solid var(--border)',
                                background:i%2===0?'transparent':'var(--bg-header)'}}>
                                <td style={{padding:'7px 10px',fontFamily:'var(--font-mono)',fontWeight:700,fontSize:'var(--fs-sm)'}}>
                                  {pat.numero_patrimonio}
                                </td>
                                <td style={{padding:'7px 10px',color:'var(--t-muted)',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)'}}>
                                  {pat.numero_serie || '—'}
                                </td>
                                <td style={{padding:'7px 10px'}}>
                                  <span style={{fontWeight:600,fontSize:'var(--fs-xs)',
                                    padding:'2px 8px',borderRadius:'var(--r-sm)',
                                    background:statusColor+'22',color:statusColor,textTransform:'capitalize'}}>
                                    {pat.status}
                                  </span>
                                </td>
                                <td style={{padding:'7px 10px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>
                                  {pat.data_aquisicao ? new Date(pat.data_aquisicao).toLocaleDateString('pt-BR') : '—'}
                                </td>
                                <td style={{padding:'7px 10px',fontSize:'var(--fs-sm)'}}>
                                  {contratoExibir
                                    ? <span style={{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--c-primary)'}}>
                                        {contratoExibir.contratos?.numero}
                                        {!contratoAtivo && <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginLeft:4}}>(via produto)</span>}
                                      </span>
                                    : <span style={{color:'var(--t-muted)'}}>—</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* OS abertas */}
                {(viewLoadingEx || viewOS.length>0) && (
                  <div className="panel-section">
                    <div style={{padding:'8px 12px',background:'var(--bg-header)',fontWeight:700,
                      fontSize:'var(--fs-md)',borderBottom:'1px solid var(--border)',color:'var(--c-warning,#f59e0b)'}}>
                      ⚠ Ordens de Serviço em Aberto ({viewOS.length})
                    </div>
                    {viewOS.map((os:any)=>(
                      <div key={os.id} style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',fontSize:'var(--fs-md)'}}>
                        <div className="tbl-cell-main">{os.tipo?.toUpperCase()} — {os.status}</div>
                        <div style={{color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{os.descricao||'—'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Últimas movimentações */}
                <div className="panel-section">
                  <div style={{padding:'8px 12px',background:'var(--bg-header)',fontWeight:700,
                    fontSize:'var(--fs-md)',borderBottom:'1px solid var(--border)',
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>Últimas Movimentações</span>
                    <button
                      onClick={()=>{ setPanelView(false); abrirMovimentacao(viewRow) }}
                      style={{background:'var(--c-primary)',color:'#fff',border:'none',
                        borderRadius:'var(--r-sm)',padding:'4px 12px',cursor:'pointer',
                        fontSize:'var(--fs-md)',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                      + Movimentação
                    </button>
                  </div>
                  {viewLoadingEx ? (
                    <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Carregando…</div>
                  ) : viewMovs.length===0 ? (
                    <div style={{padding:'16px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Nenhuma movimentação registrada.</div>
                  ) : (
                    viewMovs.map((m:any,i:number)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        padding:'7px 12px',borderBottom:'1px solid var(--border)',fontSize:'var(--fs-md)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:16}}>{m.tipo==='entrada'?'📥':'📤'}</span>
                          <div>
                            <div style={{fontWeight:600,textTransform:'capitalize'}}>{m.tipo}</div>
                            <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>{m.observacoes||'—'}</div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontWeight:700,color:m.tipo==='entrada'?'var(--c-success,#16a34a)':'var(--c-danger)'}}>
                            {m.tipo==='entrada'?'+':'-'}{m.quantidade}
                          </div>
                          <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {viewRow.observacoes && (
                  <div style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',padding:'10px 12px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginBottom:4}}>Observações</div>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)',lineHeight:1.6}}>{viewRow.observacoes}</div>
                  </div>
                )}
              </div>
            )}

            {/* ══ ABA PREÇOS ══════════════════════════════════════════════ */}
            {abaView==='precos' && (
              <div className="form-grid-2">
                {[
                  {l:'Diário',          v:viewRow.preco_locacao_diario},
                  {l:'Final de Sem.',   v:viewRow.preco_fds},
                  {l:'Semanal',         v:viewRow.preco_locacao_semanal},
                  {l:'Quinzenal',       v:viewRow.preco_quinzenal},
                  {l:'Mensal',          v:viewRow.preco_locacao_mensal},
                  {l:'Trimestral',      v:viewRow.preco_trimestral},
                  {l:'Semestral',       v:viewRow.preco_semestral},
                  {l:'Custo Reposição', v:viewRow.custo_reposicao},
                ].map(item=>(
                  <div key={item.l} style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',
                    padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:4}}>{item.l}</div>
                    <div style={{fontWeight:700,fontSize:'var(--fs-lg)',color:item.v>0?'var(--c-primary)':'var(--t-light)'}}>
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
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>
              {editId ? 'Atualizar Produto' : 'Salvar Produto'}
            </Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}

        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* ── Tabs: Dados / Fotos (só aparece em modo edição) ── */}
          {form.id && (
            <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:4,gap:0,marginTop:-8}}>
              {([['dados','📋 Dados'],['fotos',`🖼️ Fotos${fotos.length>0?' ('+fotos.length+')':''}`]] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setAbaForm(k)}
                  style={{padding:'8px 18px',border:'none',background:'none',cursor:'pointer',
                    fontWeight:abaForm===k?700:400,fontSize:'var(--fs-md)',
                    color:abaForm===k?'var(--c-primary)':'var(--t-muted)',
                    borderBottom:abaForm===k?'2px solid var(--c-primary)':'2px solid transparent',
                    marginBottom:-1}}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* ══ ABA FOTOS ═══════════════════════════════════════════════════ */}
          {abaForm==='fotos' && form.id && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {erroFoto && (
                <div style={{background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',
                  borderRadius:'var(--r-md)',padding:'10px 14px',color:'var(--c-danger-text)',fontSize:'var(--fs-md)'}}>
                  {erroFoto}
                </div>
              )}
              <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                gap:8,border:'2px dashed var(--border)',borderRadius:'var(--r-md)',padding:'28px 16px',
                cursor:uploadando?'not-allowed':'pointer',
                background:uploadando?'var(--bg-header)':'transparent',transition:'border-color 150ms'}}
                onMouseEnter={e=>{ if(!uploadando) e.currentTarget.style.borderColor='var(--c-primary)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)' }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{display:'none'}}
                  disabled={uploadando}
                  onChange={async e=>{
                    const files=Array.from(e.target.files??[])
                    if(!files.length) return
                    setUploadando(true); setErroFoto('')
                    for(const file of files){
                      if(file.size>5*1024*1024){setErroFoto(`"${file.name}" excede 5MB`);continue}
                      const fd=new FormData()
                      fd.append('produto_id',String(form.id))
                      fd.append('file',file)
                      fd.append('principal',fotos.length===0?'true':'false')
                      const res=await fetch('/api/produto-fotos',{method:'POST',body:fd})
                      const data=await res.json()
                      if(data.ok) setFotos((p:any[])=>[...p,data.data])
                      else setErroFoto(data.error)
                    }
                    setUploadando(false); e.target.value=''
                  }}
                />
                {uploadando
                  ? <><span style={{fontSize:32}}>⏳</span><span style={{color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Enviando…</span></>
                  : <><span style={{fontSize:32}}>📷</span>
                    <span style={{color:'var(--t-muted)',fontSize:'var(--fs-md)',textAlign:'center'}}>
                      Clique para adicionar fotos<br/>
                      <span style={{fontSize:'var(--fs-sm)'}}>JPG, PNG, WEBP · até 5MB cada</span>
                    </span></>
                }
              </label>
              {fotos.length>0 ? (
                <div className="kpi-grid">
                  {fotos.map((foto:any)=>(
                    <div key={foto.id} style={{position:'relative',borderRadius:'var(--r-md)',overflow:'hidden',
                      border:`2px solid ${foto.principal?'var(--c-primary)':'var(--border)'}`,
                      aspectRatio:'1',background:'var(--bg-header)'}}>
                      <img src={foto.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      {foto.principal && (
                        <div style={{position:'absolute',top:4,left:4,background:'var(--c-primary)',color:'#fff',
                          fontSize:'var(--fs-xs)',fontWeight:700,padding:'2px 6px',borderRadius:'var(--r-sm)'}}>
                          ★ Principal
                        </div>
                      )}
                      <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',gap:4,
                        padding:5,background:'linear-gradient(transparent,rgba(0,0,0,0.65))'}}>
                        {!foto.principal && (
                          <button onClick={async()=>{
                              const res=await fetch(`/api/produto-fotos?id=${foto.id}`,{method:'PATCH',
                                headers:{'Content-Type':'application/json'},body:JSON.stringify({produto_id:form.id})})
                              if((await res.json()).ok) setFotos((p:any[])=>p.map((f:any)=>({...f,principal:f.id===foto.id})))
                            }}
                            style={{flex:1,background:'rgba(255,255,255,0.88)',border:'none',borderRadius:'var(--r-sm)',
                              padding:'3px 0',cursor:'pointer',fontSize:'var(--fs-xs)',fontWeight:700}}>
                            ★ Tornar Principal
                          </button>
                        )}
                        <button onClick={async()=>{
                            if(!confirm('Excluir esta foto?')) return
                            const res=await fetch(`/api/produto-fotos?id=${foto.id}`,{method:'DELETE'})
                            if((await res.json()).ok) setFotos((p:any[])=>p.filter((f:any)=>f.id!==foto.id))
                          }}
                          style={{background:'rgba(220,38,38,0.85)',border:'none',borderRadius:'var(--r-sm)',
                            padding:'3px 8px',cursor:'pointer',color:'#fff',fontSize:'var(--fs-xs)',fontWeight:700}}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{textAlign:'center',padding:'12px 0',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>
                  Nenhuma foto ainda. Adicione a primeira acima.
                </div>
              )}
            </div>
          )}

          {/* ══ ABA DADOS ═══════════════════════════════════════════════════ */}
          {(abaForm==='dados'||!form.id) && (
            <div style={{display:'contents'}}>

              <div>
                <div className="ds-section-title">Identificação</div>
                <div className="form-grid-2">
                  <FormField label="Nome do Produto" required style={{ gridColumn:'span 2' }}>
                    <input {...F('nome')} className={inputCls} placeholder="Ex: Andaime Tubular 1,5m" autoFocus />
                  </FormField>
                  <FormField label="Código / SKU">
                    <input {...F('codigo')} className={inputCls} placeholder="Ex: AND-001" />
                  </FormField>
                  <FormField label="Categoria">
                    <LookupField
                      value={form.categoria_id || null}
                      displayValue={catNome}
                      onChange={(id, row) => {
                        setForm((f:any) => ({ ...f, categoria_id: id }))
                        setCatNome(row?.nome ?? '')
                      }}
                      table="categorias"
                      searchColumn="nome"
                      filter={{ ativo: 1 }}
                      orderBy="nome"
                      placeholder="Buscar ou criar categoria..."
                      createPanelTitle="Nova Categoria"
                      createPanelWidth="sm"
                      createPanel={({ onClose, onCreated }: { onClose:()=>void; onCreated:(r:any)=>void }) => (
                        <CriarCategoriaPanel onClose={onClose} onCreated={onCreated} />
                      )}
                    />
                  </FormField>
                  <FormField label="Marca">
                    <input {...F('marca')} className={inputCls} placeholder="Ex: Tramontina" />
                  </FormField>
                  <FormField label="Modelo">
                    <input {...F('modelo')} className={inputCls} placeholder="Ex: Pro 1.5m" />
                  </FormField>
                </div>
              </div>

              <div>
                <div className="ds-section-title">Controle de Estoque</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {[
                    { v:1, l:'Por Patrimônio',  d:'Cada unidade tem número único (série/patrimônio)' },
                    { v:0, l:'Por Quantidade',   d:'Itens sem identificação individual' },
                  ].map(o => (
                    <div key={o.v} onClick={()=>setForm({...form,controla_patrimonio:o.v})}
                      style={{ border:`2px solid ${Number(form.controla_patrimonio)===o.v?'var(--c-primary)':'var(--border)'}`,
                        borderRadius:'var(--r-md)', padding:'10px 14px', cursor:'pointer',
                        background:Number(form.controla_patrimonio)===o.v?'var(--c-primary-light,#e8f4f8)':'transparent',
                        transition:'all 150ms' }}>
                      <div style={{ fontWeight:600, fontSize:'var(--fs-base)', marginBottom:2 }}>{o.l}</div>
                      <div style={{ fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>{o.d}</div>
                    </div>
                  ))}
                </div>
                {Number(form.controla_patrimonio)===0 && (
                  <div className="kpi-grid">
                    <FormField label="Unidade">
                      <input {...F('unidade')} className={inputCls} placeholder="un, kg, m, pç..." />
                    </FormField>
                    <FormField label="Estoque Atual">
                      <div style={{position:'relative'}}>
                        <input type="number" value={form.estoque_total??0} readOnly className={inputCls}
                          style={{background:'var(--bg-header)',color:'var(--t-muted)',cursor:'not-allowed',paddingRight:32}} />
                        <span title="Altere pela tela de Movimentação de Ativos (📦)"
                          style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',fontSize:14,cursor:'help',color:'var(--t-muted)'}}>🔒</span>
                      </div>
                      <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:3}}>Altere via Movimentação de Ativos (📦)</div>
                    </FormField>
                    <FormField label="Estoque Mínimo">
                      <input type="number" min="0" {...F('estoque_minimo')} className={inputCls} />
                    </FormField>
                  </div>
                )}
              </div>

              <div>
                <div className="ds-section-title">Preços de Locação por Período</div>
                <div className="form-grid-2">
                  {periodos.map(p => {
                    const campo = campoPreco(p.nome)
                    return (
                      <FormField key={p.id} label={`${p.nome} (${p.dias}d)${Number(p.desconto_percentual)>0?` — ${p.desconto_percentual}% desc`:''}`}>
                        <div style={{ position:'relative' }}>
                          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                            color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                          <input type="number" step="0.01" min="0"
                            value={form[campo]??0}
                            onChange={e=>setForm({...form,[campo]:e.target.value})}
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
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                        color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0" {...F('custo_reposicao')} className={inputCls} style={{ paddingLeft:30 }} />
                    </div>
                  </FormField>
                </div>
              </div>

              <FormField label="Descrição / Observações">
                <textarea {...F('observacoes')} rows={2} className={textareaCls} placeholder="Descrição, especificações técnicas..." />
              </FormField>

            </div>
          )}

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
              <button onClick={()=>{
                  setModalMov(false)
                  setFormMov(emptyMov())
                  setLinhasEntrada([emptyPatLine()])
                  setConflitos({})
                  setMovErro('')
                }}
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
                <table className="ds-table">
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
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
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
                  <div className="form-grid-2">
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
                    <div className="form-grid-2">
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
                    <div className="panel-section">
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
                            <div style={{position:'relative',flex:1}}>
                            <input className={inputCls} style={{fontSize:'var(--fs-md)',padding:'4px 8px',
                              borderColor:conflitos[idx]?'var(--c-danger)':undefined,width:'100%'}}
                              placeholder={`PAT-${String(idx+1).padStart(3,'0')}`}
                              value={linha.numero_patrimonio}
                              onChange={e=>{
                                const novo=[...linhasEntrada]
                                novo[idx]={...novo[idx],numero_patrimonio:e.target.value}
                                setLinhasEntrada(novo)
                                // Limpar conflito ao editar
                                setConflitos(p=>({...p,[idx]:''}))
                              }}
                              onBlur={async e=>{
                                const val = e.target.value.trim()
                                if (!val) return
                                const res = await fetch('/api/asset-transactions',{
                                  method:'PATCH',headers:{'Content-Type':'application/json'},
                                  body:JSON.stringify({numero_patrimonio:val})
                                })
                                const data = await res.json()
                                if (data.disponivel===false) {
                                  setConflitos(p=>({...p,[idx]:data.mensagem}))
                                } else {
                                  setConflitos(p=>({...p,[idx]:''}))
                                }
                              }}
                            />
                            {conflitos[idx] && (
                              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:10,
                                background:'var(--c-danger)',color:'#fff',fontSize:'var(--fs-xs)',
                                padding:'3px 7px',borderRadius:'0 0 var(--r-sm) var(--r-sm)',fontWeight:600}}>
                                ⚠ {conflitos[idx]}
                              </div>
                            )}
                            </div>
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
                  <div className="form-grid-2">
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