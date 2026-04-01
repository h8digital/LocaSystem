'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { Btn, FormField, inputCls, selectCls, textareaCls, SlidePanel } from '@/components/ui'
import LookupField from '@/components/ui/LookupField'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const emptyForm = () => ({
  nome:'', codigo:'', categoria_id:'', marca:'', modelo:'', descricao:'',
  controla_patrimonio: 1, unidade:'un',
  estoque_total: 0, estoque_locacao: 0, estoque_venda: 0,
  custo_reposicao: 0, preco_venda: 0, permite_venda: 0,
  prazo_entrega_dias: 0,
  preco_locacao_diario: 0, preco_fds: 0, preco_locacao_semanal: 0,
  preco_quinzenal: 0, preco_locacao_mensal: 0, preco_trimestral: 0, preco_semestral: 0,
  observacoes:'',
})

function campoPreco(nomePeriodo: string) {
  const n = nomePeriodo.toLowerCase()
  if (n.includes('semes'))  return 'preco_semestral'
  if (n.includes('trimes')) return 'preco_trimestral'
  if (n.includes('mens'))   return 'preco_locacao_mensal'
  if (n.includes('quinz'))  return 'preco_quinzenal'
  if (n.includes('final') || n.includes('fds') || n.includes('weekend')) return 'preco_fds'
  if (n.includes('seman'))  return 'preco_locacao_semanal'
  return 'preco_locacao_diario'
}

const STATUS_PAT: Record<string,{label:string;color:string}> = {
  disponivel: { label:'Disponível', color:'#16a34a' },
  locado:     { label:'Locado',     color:'#0ea5e9' },
  manutencao: { label:'Manutenção', color:'#f59e0b' },
}

// ─── Criar Categoria inline ───────────────────────────────────────────────────
function CriarCatPanel({ onClose, onCreated }:{ onClose:()=>void; onCreated:(r:any)=>void }) {
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('categorias').insert({ nome:nome.trim(), ativo:1 }).select().single()
    setSaving(false)
    if (!error && data) { onCreated(data); onClose() }
  }
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
      <FormField label="Nome da Categoria" required>
        <input value={nome} onChange={e=>setNome(e.target.value)} className={inputCls}
          placeholder="Ex: Ferramentas Elétricas" autoFocus onKeyDown={e=>e.key==='Enter'&&salvar()} />
      </FormField>
      <div style={{display:'flex',gap:8}}>
        <Btn variant="secondary" style={{flex:1}} onClick={onClose}>Cancelar</Btn>
        <Btn style={{flex:2}} loading={saving} onClick={salvar}>Criar Categoria</Btn>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EquipamentosPage() {
  const router = useRouter()

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [lista,    setLista]    = useState<any[]>([])
  const [cats,     setCats]     = useState<any[]>([])
  const [periodos, setPeriodos] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [busca,    setBusca]    = useState('')
  const [catFilt,  setCatFilt]  = useState('')
  const [ctrlFilt, setCtrlFilt] = useState('') // '' | '1' | '0'
  const [pagina,   setPagina]   = useState(1)
  const PER = 25

  // ── Formulário de edição ───────────────────────────────────────────────────
  const [panel,      setPanel]      = useState(false)
  const [form,       setForm]       = useState<any>(emptyForm())
  const [editId,     setEditId]     = useState<number|null>(null)
  const [saving,     setSaving]     = useState(false)
  const [erro,       setErro]       = useState('')
  const [catNome,    setCatNome]    = useState('')
  const [aba,        setAba]        = useState<'info'|'precos'|'inventario'>('info')
  // ── Inventário no painel ──────────────────────────────────────────────────
  const [patsPanel,     setPatsPanel]     = useState<any[]>([])
  const [patsLoading,   setPatsLoading]   = useState(false)
  const [editPat,       setEditPat]       = useState<any>(null)   // patrimônio sendo editado
  const [novoPat,       setNovoPat]       = useState(false)       // formulário de novo
  const [patForm,       setPatForm]       = useState<any>({})
  const [patSaving,     setPatSaving]     = useState(false)
  const [patErro,       setPatErro]       = useState('')

  // ── Painel de preços rápido (hover) ───────────────────────────────────────
  const [precoPainel, setPrecoPainel] = useState<any>(null)

  // ── Fotos ──────────────────────────────────────────────────────────────────
  const [fotos,      setFotos]      = useState<any[]>([])
  const [uploadando, setUploadando] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('produtos')
      .select(`id, nome, codigo, marca, modelo, controla_patrimonio, unidade,
               estoque_total, custo_reposicao, ativo, observacoes,
               preco_locacao_diario, preco_fds, preco_locacao_semanal,
               preco_quinzenal, preco_locacao_mensal, preco_trimestral, preco_semestral,
               prazo_entrega_dias, categoria_id,
               categorias(nome),
               contrato_itens(quantidade, contratos(status)),
               patrimonios(id, status, deleted_at),
               produto_fotos(url, principal)`)
      .eq('ativo', 1).order('nome')
    if (catFilt)  q = q.eq('categoria_id', catFilt)
    if (ctrlFilt) q = q.eq('controla_patrimonio', ctrlFilt)
    if (busca)    q = q.ilike('nome', `%${busca}%`)
    const { data } = await q

    const enriched = (data ?? []).map((p: any) => {
      const patsAtivos = (p.patrimonios ?? []).filter((x:any) => !x.deleted_at)
      const dispPat   = patsAtivos.filter((x:any) => x.status === 'disponivel').length
      const locPat    = patsAtivos.filter((x:any) => x.status === 'locado').length
      const totalPat  = patsAtivos.length
      const qtdLocada = p.controla_patrimonio
        ? locPat
        : (p.contrato_itens ?? []).filter((ci:any) => ci.contratos?.status === 'ativo')
            .reduce((s:number, ci:any) => s + Number(ci.quantidade), 0)
      const disponivel = p.controla_patrimonio
        ? dispPat
        : Math.max(0, (p.estoque_total ?? 0) - qtdLocada)
      const foto = (p.produto_fotos ?? []).find((f:any) => f.principal)?.url ?? null
      return { ...p, dispPat, locPat, totalPat, disponivel, qtdLocada, foto }
    })
    setLista(enriched)
    setLoading(false)
  }, [busca, catFilt, ctrlFilt])

  useEffect(() => {
    supabase.from('categorias').select('*').eq('ativo',1).order('nome').then(({data}) => setCats(data ?? []))
    supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias').then(({data}) => setPeriodos(data ?? []))
  }, [])
  useEffect(() => { setPagina(1); load() }, [busca, catFilt, ctrlFilt])

  // ── Abrir edição ───────────────────────────────────────────────────────────
  async function abrir(p?: any) {
    setErro(''); setAba('info')
    if (p) {
      setForm({ ...emptyForm(), ...p })
      setEditId(p.id)
      const cat = p.categorias?.nome ?? ''
      setCatNome(cat)
      if (!cat && p.categoria_id) {
        supabase.from('categorias').select('nome').eq('id', p.categoria_id).single()
          .then(({ data }) => { if (data) setCatNome(data.nome) })
      }
      // Carregar fotos
      const { data: fs } = await supabase.from('produto_fotos').select('*')
        .eq('produto_id', p.id).order('created_at')
      setFotos(fs ?? [])
    } else {
      setForm(emptyForm()); setEditId(null); setCatNome(''); setFotos([])
      setPatsPanel([])
    }
    setEditPat(null); setNovoPat(false); setPatForm({}); setPatErro('')
    setPanel(true)
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório.'); setAba('info'); return }
    setSaving(true); setErro('')
    const payload = {
      nome:                  form.nome.trim(),
      codigo:                form.codigo || null,
      categoria_id:          form.categoria_id || null,
      marca:                 form.marca || null,
      modelo:                form.modelo || null,
      descricao:             form.observacoes || null,
      controla_patrimonio:   Number(form.controla_patrimonio),
      unidade:               form.unidade || 'un',
      estoque_total:         Number(form.estoque_locacao) || Number(form.estoque_total) || 0,
      estoque_locacao:       Number(form.estoque_locacao) || 0,
      estoque_venda:         Number(form.estoque_venda) || 0,
      permite_venda:         Number(form.permite_venda) || 0,
      preco_venda:           Number(form.preco_venda) || 0,
      custo_reposicao:       Number(form.custo_reposicao) || 0,
      prazo_entrega_dias:    Number(form.prazo_entrega_dias) || 0,
      preco_locacao_diario:  Number(form.preco_locacao_diario) || 0,
      preco_fds:             Number(form.preco_fds) || 0,
      preco_locacao_semanal: Number(form.preco_locacao_semanal) || 0,
      preco_quinzenal:       Number(form.preco_quinzenal) || 0,
      preco_locacao_mensal:  Number(form.preco_locacao_mensal) || 0,
      preco_trimestral:      Number(form.preco_trimestral) || 0,
      preco_semestral:       Number(form.preco_semestral) || 0,
      ativo: 1,
    }
    if (editId) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', editId)
      if (error) { setErro(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('produtos').insert(payload)
      if (error) { setErro(error.message); setSaving(false); return }
    }
    setSaving(false); setPanel(false); load()
  }

  // ── Patrimônios no painel ────────────────────────────────────────────────────
  async function carregarPatsPanel(produtoId: number) {
    setPatsLoading(true)
    const { data } = await supabase
      .from('patrimonios')
      .select('id, numero_patrimonio, numero_serie, status, data_aquisicao, valor_aquisicao, observacoes, contrato_itens!contrato_itens_patrimonio_id_fkey(id, contratos(status))')
      .eq('produto_id', produtoId)
      .is('deleted_at', null)
      .order('numero_patrimonio')
    setPatsPanel(data ?? [])
    setPatsLoading(false)
  }

  async function salvarPat() {
    if (!patForm.numero_patrimonio?.trim()) { setPatErro('Nº Patrimônio é obrigatório.'); return }
    setPatSaving(true); setPatErro('')
    const payload = {
      numero_patrimonio: patForm.numero_patrimonio.trim(),
      numero_serie:      patForm.numero_serie?.trim() || null,
      status:            patForm.status || 'disponivel',
      data_aquisicao:    patForm.data_aquisicao || null,
      valor_aquisicao:   Number(patForm.valor_aquisicao) || null,
      observacoes:       patForm.observacoes?.trim() || null,
    }
    if (editPat) {
      const { error } = await supabase.from('patrimonios').update(payload).eq('id', editPat.id)
      if (error) { setPatErro(error.message); setPatSaving(false); return }
    } else {
      const { error } = await supabase.from('patrimonios').insert({ ...payload, produto_id: editId })
      if (error) { setPatErro(error.message); setPatSaving(false); return }
    }
    setPatSaving(false); setEditPat(null); setNovoPat(false); setPatForm({})
    carregarPatsPanel(editId!)
    load()
  }

  async function excluirPat(pat: any) {
    const temContrato = (pat.contrato_itens ?? []).some((ci: any) =>
      ['ativo','em_devolucao','pendente_manutencao'].includes(ci.contratos?.status)
    )
    if (temContrato) { alert('Este patrimônio possui contrato ativo e não pode ser excluído.'); return }
    if (!confirm(`Excluir patrimônio ${pat.numero_patrimonio}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('patrimonios').update({ deleted_at: new Date().toISOString() }).eq('id', pat.id)
    carregarPatsPanel(editId!)
    load()
  }

  // ── Inativar ───────────────────────────────────────────────────────────────
  async function inativar(id: number, nome: string) {
    if (!confirm(`Inativar o produto "${nome}"? Ele não aparecerá mais nas listagens.`)) return
    await supabase.from('produtos').update({ ativo: 0 }).eq('id', id)
    load()
  }

  // ── Paginação ──────────────────────────────────────────────────────────────
  const totalPags = Math.max(1, Math.ceil(lista.length / PER))
  const pagLista  = lista.slice((pagina - 1) * PER, pagina * PER)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── CABEÇALHO ────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--t-primary)', margin:0 }}>Equipamentos</h1>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
            {lista.length} produto(s) cadastrado(s)
          </div>
        </div>
        <Btn onClick={() => abrir()}>+ Novo Equipamento</Btn>
      </div>

      {/* ── FILTROS ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        {/* Busca */}
        <div style={{ position:'relative', flex:'2 1 240px', minWidth:200 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--t-muted)', fontSize:14, pointerEvents:'none' }}>🔍</span>
          <input value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}}
            placeholder="Buscar por nome..."
            className={inputCls} style={{ paddingLeft:32 }} />
        </div>

        {/* Categoria */}
        <select value={catFilt} onChange={e=>{setCatFilt(e.target.value);setPagina(1)}}
          className={selectCls} style={{ flex:'1 1 180px', minWidth:160 }}>
          <option value="">Todas as categorias</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        {/* Tipo de controle */}
        <select value={ctrlFilt} onChange={e=>{setCtrlFilt(e.target.value);setPagina(1)}}
          className={selectCls} style={{ flex:'1 1 160px', minWidth:140 }}>
          <option value="">Todos os tipos</option>
          <option value="1">Por Patrimônio</option>
          <option value="0">Por Quantidade</option>
        </select>

        {(busca || catFilt || ctrlFilt) && (
          <button onClick={()=>{setBusca('');setCatFilt('');setCtrlFilt('');setPagina(1)}}
            style={{ background:'none', border:'none', color:'var(--t-muted)',
              cursor:'pointer', fontSize:'var(--fs-sm)', fontWeight:600,
              textDecoration:'underline', whiteSpace:'nowrap' }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── TABELA ───────────────────────────────────────────────────────── */}
      <div className="ds-card">
        {loading ? (
          <div style={{ padding:'60px 24px', textAlign:'center', color:'var(--t-muted)' }}>
            <div className="ds-spinner" style={{ margin:'0 auto 12px' }} />
            Carregando equipamentos...
          </div>
        ) : lista.length === 0 ? (
          <div style={{ padding:'60px 24px', textAlign:'center', color:'var(--t-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
            <div style={{ fontWeight:600, fontSize:'var(--fs-base)' }}>
              {busca || catFilt || ctrlFilt ? 'Nenhum resultado para os filtros aplicados.' : 'Nenhum equipamento cadastrado ainda.'}
            </div>
            {!busca && !catFilt && !ctrlFilt && (
              <Btn onClick={() => abrir()} style={{ marginTop:16 }}>+ Cadastrar primeiro equipamento</Btn>
            )}
          </div>
        ) : (
          <>
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ width:44 }}></th>
                  <th>Nome / Código</th>
                  <th style={{ width:140 }}>Categoria</th>
                  <th style={{ width:120 }}>Marca / Modelo</th>
                  <th style={{ width:110 }}>Controle</th>
                  <th style={{ width:90, textAlign:'center' }}>Disponível</th>
                  <th style={{ width:80,  textAlign:'center' }}>Locado</th>
                  <th style={{ width:110, textAlign:'right'  }}>Preço/Dia</th>
                  <th style={{ width:160, textAlign:'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagLista.map((p: any) => (
                  <tr key={p.id}>
                    {/* Foto */}
                    <td style={{ padding:'8px 8px 8px 14px' }}>
                      {p.foto ? (
                        <img src={p.foto} alt="" style={{ width:34, height:34, objectFit:'cover',
                          borderRadius:'var(--r-sm)', border:'1px solid var(--border)', display:'block' }} />
                      ) : (
                        <div style={{ width:34, height:34, borderRadius:'var(--r-sm)',
                          border:'1px solid var(--border)', background:'var(--bg-header)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:18, color:'var(--t-muted)' }}>📦</div>
                      )}
                    </td>

                    {/* Nome / Código */}
                    <td>
                      <div style={{ fontWeight:700, fontSize:'var(--fs-base)', color:'var(--t-primary)',
                        cursor:'pointer' }} onClick={() => abrir(p)}>
                        {p.nome}
                      </div>
                      {p.codigo && (
                        <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)',
                          fontFamily:'var(--font-mono)', marginTop:1 }}>
                          {p.codigo}
                        </div>
                      )}
                    </td>

                    {/* Categoria */}
                    <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)' }}>
                      {p.categorias?.nome ?? <span style={{ color:'var(--t-muted)' }}>—</span>}
                    </td>

                    {/* Marca / Modelo */}
                    <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-secondary)' }}>
                      {[p.marca, p.modelo].filter(Boolean).join(' · ') || <span style={{ color:'var(--t-muted)' }}>—</span>}
                    </td>

                    {/* Controle */}
                    <td>
                      <span style={{ fontSize:'var(--fs-xs)', fontWeight:600, padding:'3px 8px',
                        borderRadius:99, border:'1px solid var(--border)',
                        color:'var(--t-secondary)', background:'var(--bg-header)' }}>
                        {p.controla_patrimonio ? '🏷️ Patrimônio' : '📊 Quantidade'}
                      </span>
                    </td>

                    {/* Disponível */}
                    <td style={{ textAlign:'center' }}>
                      {p.controla_patrimonio ? (
                        <span style={{ fontWeight:700, color: p.dispPat > 0 ? '#16a34a' : 'var(--t-muted)' }}>
                          {p.dispPat} / {p.totalPat}
                        </span>
                      ) : (
                        <span style={{ fontWeight:700, color: p.disponivel > 0 ? '#16a34a' : 'var(--t-muted)' }}>
                          {p.disponivel} {p.unidade}
                        </span>
                      )}
                    </td>

                    {/* Locado */}
                    <td style={{ textAlign:'center' }}>
                      <span style={{ fontWeight:700, color: p.locPat > 0 || p.qtdLocada > 0 ? 'var(--c-primary)' : 'var(--t-muted)' }}>
                        {p.controla_patrimonio ? p.locPat : p.qtdLocada}{p.controla_patrimonio ? '' : ` ${p.unidade}`}
                      </span>
                    </td>

                    {/* Preço/Dia — clicável para ver todos os preços */}
                    <td style={{ textAlign:'right' }}>
                      <button
                        onClick={() => setPrecoPainel(precoPainel?.id === p.id ? null : p)}
                        style={{ background:'none', border:'none', cursor:'pointer',
                          fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'var(--fs-md)',
                          color: p.preco_locacao_diario > 0 ? 'var(--c-primary)' : 'var(--t-muted)',
                          textDecoration: precoPainel?.id === p.id ? 'none' : 'underline dotted',
                          padding:'2px 4px', borderRadius:'var(--r-sm)',
                          backgroundColor: precoPainel?.id === p.id ? 'var(--c-primary-light,#e0f2fe)' : 'transparent',
                        }}
                        title="Clique para ver todos os preços"
                      >
                        {p.preco_locacao_diario > 0 ? fmt.money(p.preco_locacao_diario) : '—'}
                      </button>
                    </td>

                    {/* Ações */}
                    <td style={{ textAlign:'center', padding:'0 12px' }}>
                      <div style={{ display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
                        {/* Editar */}
                        <button onClick={() => abrir(p)} title="Editar"
                          style={{ padding:'5px 10px', borderRadius:'var(--r-sm)',
                            border:'1px solid var(--border)', background:'var(--bg-card)',
                            cursor:'pointer', fontSize:'var(--fs-sm)', color:'var(--t-primary)',
                            fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>
                          ✏️
                        </button>
                        {/* Inventário (só para patrimônio) */}
                        {p.controla_patrimonio === 1 && (
                          <button onClick={() => router.push(`/equipamentos/${p.id}`)} title="Ver inventário"
                            style={{ padding:'5px 10px', borderRadius:'var(--r-sm)',
                              border:'1px solid var(--c-primary)', background:'transparent',
                              cursor:'pointer', fontSize:'var(--fs-sm)', color:'var(--c-primary)',
                              fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                            🏷️
                          </button>
                        )}
                        {/* Inativar */}
                        <button onClick={() => inativar(p.id, p.nome)} title="Inativar produto"
                          style={{ padding:'5px 10px', borderRadius:'var(--r-sm)',
                            border:'1px solid var(--c-danger,#dc2626)', background:'transparent',
                            cursor:'pointer', fontSize:'var(--fs-sm)', color:'var(--c-danger,#dc2626)',
                            fontWeight:600 }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── PAINEL DE PREÇOS RÁPIDO ─────────────────────────────────── */}
            {precoPainel && (
              <div style={{ borderTop:'2px solid var(--c-primary)', background:'var(--bg-card)',
                padding:'16px 20px', animation:'fadeIn .15s ease' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  marginBottom:14 }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:'var(--fs-base)', color:'var(--t-primary)' }}>
                      {precoPainel.nome}
                    </span>
                    <span style={{ marginLeft:10, fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                      — Tabela de Preços de Locação
                    </span>
                  </div>
                  <button onClick={() => setPrecoPainel(null)}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      fontSize:18, color:'var(--t-muted)', lineHeight:1 }}>×</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
                  {[
                    { l:'Diário',      v:precoPainel.preco_locacao_diario,  d:1   },
                    { l:'FDS',         v:precoPainel.preco_fds,              d:2   },
                    { l:'Semanal',     v:precoPainel.preco_locacao_semanal,  d:7   },
                    { l:'Quinzenal',   v:precoPainel.preco_quinzenal,        d:15  },
                    { l:'Mensal',      v:precoPainel.preco_locacao_mensal,   d:30  },
                    { l:'Trimestral',  v:precoPainel.preco_trimestral,       d:90  },
                    { l:'Semestral',   v:precoPainel.preco_semestral,        d:180 },
                    { l:'Custo Repos.',v:precoPainel.custo_reposicao,        d:0   },
                  ].map(item => (
                    <div key={item.l} style={{ padding:'10px 14px',
                      background: item.v > 0 ? 'var(--c-primary-light,#e0f2fe)' : 'var(--bg-header)',
                      borderRadius:'var(--r-md)',
                      border:`1px solid ${item.v > 0 ? 'var(--c-primary)' : 'var(--border)'}`,
                      borderLeft:`3px solid ${item.v > 0 ? 'var(--c-primary)' : 'var(--border)'}` }}>
                      <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--t-muted)',
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                        {item.l}
                      </div>
                      <div style={{ fontWeight:800, fontSize:'var(--fs-lg)',
                        fontFamily:'var(--font-mono)',
                        color: item.v > 0 ? 'var(--c-primary)' : 'var(--t-light)' }}>
                        {item.v > 0 ? fmt.money(item.v) : '—'}
                      </div>
                      {item.v > 0 && item.d > 1 && (
                        <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:3 }}>
                          {fmt.money(item.v / item.d)}/dia
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PAGINAÇÃO ───────────────────────────────────────────────── */}
            {totalPags > 1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', borderTop:'1px solid var(--border)',
                background:'var(--bg-header)' }}>
                <span style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                  {lista.length} produto(s) · página {pagina} de {totalPags}
                </span>
                <div style={{ display:'flex', gap:6 }}>
                  <button disabled={pagina<=1} onClick={() => setPagina(p=>p-1)}
                    style={{ padding:'5px 14px', borderRadius:'var(--r-sm)',
                      border:'1px solid var(--border)', background:'var(--bg-card)',
                      cursor:pagina<=1?'not-allowed':'pointer',
                      color:pagina<=1?'var(--t-muted)':'var(--t-primary)',
                      fontSize:'var(--fs-sm)' }}>
                    ← Anterior
                  </button>
                  {Array.from({length:Math.min(7,totalPags)},(_,i) => {
                    const pg = totalPags<=7 ? i+1 : Math.max(1,Math.min(totalPags-6,pagina-3))+i
                    return (
                      <button key={pg} onClick={() => setPagina(pg)}
                        style={{ padding:'5px 12px', borderRadius:'var(--r-sm)',
                          fontSize:'var(--fs-sm)', cursor:'pointer', border:'1px solid',
                          borderColor:pg===pagina?'var(--c-primary)':'var(--border)',
                          background:pg===pagina?'var(--c-primary)':'var(--bg-card)',
                          color:pg===pagina?'#fff':'var(--t-primary)',
                          fontWeight:pg===pagina?700:400 }}>
                        {pg}
                      </button>
                    )
                  })}
                  <button disabled={pagina>=totalPags} onClick={() => setPagina(p=>p+1)}
                    style={{ padding:'5px 14px', borderRadius:'var(--r-sm)',
                      border:'1px solid var(--border)', background:'var(--bg-card)',
                      cursor:pagina>=totalPags?'not-allowed':'pointer',
                      color:pagina>=totalPags?'var(--t-muted)':'var(--t-primary)',
                      fontSize:'var(--fs-sm)' }}>
                    Próximo →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ PAINEL DE EDIÇÃO / CRIAÇÃO ════════════════════════════════════ */}
      <SlidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title=""
        width="xl"
        footer={
          <div style={{ display:'flex', gap:12, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>
              Descartar
            </Btn>
            <Btn style={{ flex:2, fontWeight:700 }} loading={saving} onClick={salvar}>
              {editId ? 'Salvar Alterações' : 'Criar Equipamento'}
            </Btn>
          </div>
        }
      >
        {/* HERO */}
        <div style={{ paddingBottom:20, borderBottom:'1px solid var(--border)', marginBottom:4 }}>
          <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--t-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            {editId ? `Editar Produto${form.codigo ? ' · ' + form.codigo : ''}` : 'Novo Equipamento'}
          </div>
          <input
            value={form.nome ?? ''}
            onChange={e => setForm((f:any) => ({ ...f, nome: e.target.value }))}
            placeholder="Nome do equipamento..."
            autoFocus={!editId}
            style={{ fontSize:22, fontWeight:700, width:'100%', padding:'0 0 8px 0',
              border:'none', borderBottom:'2px solid var(--border)',
              background:'transparent', outline:'none', color:'var(--t-primary)',
              transition:'border-color .15s' }}
            onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--c-primary)')}
            onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
          />
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:8, minHeight:18 }}>
            {[form.marca, form.modelo].filter(Boolean).join(' · ') ||
              <span style={{ fontStyle:'italic', opacity:.5 }}>Marca e modelo — preencha abaixo</span>}
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:20, gap:0 }}>
          {([
            ['info',      '📋 Informações'],
            ['precos',    '💰 Preços'],
            ...(editId && Number(form.controla_patrimonio)===1
              ? [['inventario', `🏷️ Inventário${patsPanel.length>0?' ('+patsPanel.length+')':''}`]]
              : []),
          ] as ['info'|'precos'|'inventario',string][]).map(([k,l]) => (
            <button key={k} onClick={() => {
              setAba(k)
              if (k==='inventario' && editId && patsPanel.length===0) carregarPatsPanel(editId)
            }}
              style={{ padding:'9px 22px', border:'none', background:'none', cursor:'pointer',
                fontWeight:aba===k?700:500, fontSize:'var(--fs-base)',
                color:aba===k?'var(--c-primary)':'var(--t-muted)',
                borderBottom:aba===k?'2px solid var(--c-primary)':'2px solid transparent',
                marginBottom:-2, transition:'all .15s', whiteSpace:'nowrap' }}>
              {l}
            </button>
          ))}
        </div>

        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}

        {/* ── ABA: INFORMAÇÕES ─────────────────────────────────────────── */}
        {aba === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Identificação */}
            <div className="panel-section">
              <div className="panel-section-header">📋 Identificação</div>
              <div className="panel-section-body">
                <div className="form-grid-2">
                  <FormField label="Código / SKU">
                    <input value={form.codigo??''} onChange={e=>setForm((f:any)=>({...f,codigo:e.target.value}))}
                      className={inputCls} placeholder="Ex: AND-001" />
                  </FormField>
                  <FormField label="Categoria">
                    <LookupField
                      value={form.categoria_id || null} displayValue={catNome}
                      onChange={(id, row) => { setForm((f:any)=>({...f,categoria_id:id})); setCatNome(row?.nome??'') }}
                      table="categorias" searchColumn="nome" filter={{ativo:1}} orderBy="nome"
                      placeholder="Buscar ou criar categoria..."
                      createPanelTitle="Nova Categoria" createPanelWidth="sm"
                      createPanel={({onClose,onCreated}:{onClose:()=>void;onCreated:(r:any)=>void}) => (
                        <CriarCatPanel onClose={onClose} onCreated={onCreated} />
                      )}
                    />
                  </FormField>
                  <FormField label="Marca">
                    <input value={form.marca??''} onChange={e=>setForm((f:any)=>({...f,marca:e.target.value}))}
                      className={inputCls} placeholder="Ex: Bosch" />
                  </FormField>
                  <FormField label="Modelo">
                    <input value={form.modelo??''} onChange={e=>setForm((f:any)=>({...f,modelo:e.target.value}))}
                      className={inputCls} placeholder="Ex: GSH 5-CE" />
                  </FormField>
                </div>
                <FormField label="Descrição / Observações">
                  <textarea value={form.observacoes??''} onChange={e=>setForm((f:any)=>({...f,observacoes:e.target.value}))}
                    className={textareaCls} rows={2} placeholder="Especificações técnicas, observações..." />
                </FormField>
              </div>
            </div>

            {/* Controle de Estoque */}
            <div className="panel-section">
              <div className="panel-section-header">📦 Controle de Estoque</div>
              <div className="panel-section-body">
                <div className="form-grid-2" style={{ marginBottom:14 }}>
                  {[
                    { v:1, l:'Por Patrimônio', icon:'🏷️', d:'Cada unidade tem número único' },
                    { v:0, l:'Por Quantidade',  icon:'📊', d:'Itens sem identificação individual' },
                  ].map(o => (
                    <div key={o.v} onClick={() => setForm((f:any)=>({...f,controla_patrimonio:o.v}))}
                      style={{ border:`2px solid ${Number(form.controla_patrimonio)===o.v?'var(--c-primary)':'var(--border)'}`,
                        borderRadius:'var(--r-md)', padding:'12px 14px', cursor:'pointer',
                        background:Number(form.controla_patrimonio)===o.v?'var(--c-primary-light,#e0f2fe)':'transparent',
                        transition:'all 150ms', display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:22 }}>{o.icon}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:'var(--fs-base)',
                          color:Number(form.controla_patrimonio)===o.v?'var(--c-primary)':'var(--t-primary)' }}>{o.l}</div>
                        <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:1 }}>{o.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {Number(form.controla_patrimonio)===0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div className="form-grid-3">
                      <FormField label="Unidade">
                        <input value={form.unidade??'un'} onChange={e=>setForm((f:any)=>({...f,unidade:e.target.value}))}
                          className={inputCls} placeholder="un, kg, m..." />
                      </FormField>
                      <FormField label="Estoque p/ Locação" hint="Itens que retornam">
                        <input type="number" min="0" value={form.estoque_locacao??0}
                          onChange={e=>setForm((f:any)=>({...f,estoque_locacao:e.target.value}))}
                          className={inputCls} />
                      </FormField>
                      <FormField label="Estoque p/ Venda" hint="Itens consumíveis / acessórios">
                        <input type="number" min="0" value={form.estoque_venda??0}
                          onChange={e=>setForm((f:any)=>({...f,estoque_venda:e.target.value}))}
                          className={inputCls} />
                      </FormField>
                    </div>
                    <div className="form-grid-2">
                      <FormField label="Prazo Entrega (dias)">
                        <input type="number" min="0" value={form.prazo_entrega_dias??0}
                          onChange={e=>setForm((f:any)=>({...f,prazo_entrega_dias:e.target.value}))}
                          className={inputCls} />
                      </FormField>
                      <FormField label="Pode ser vendido/cobrado avulso?">
                        <div style={{display:'flex',gap:8,marginTop:4}}>
                          {[{v:1,l:'Sim'},{v:0,l:'Não'}].map(o=>(
                            <button key={o.v} onClick={()=>setForm((f:any)=>({...f,permite_venda:o.v}))}
                              style={{flex:1,padding:'6px 0',borderRadius:'var(--r-sm)',border:'1px solid',
                                borderColor:Number(form.permite_venda)===o.v?'var(--c-primary)':'var(--border)',
                                background:Number(form.permite_venda)===o.v?'var(--c-primary)':'transparent',
                                color:Number(form.permite_venda)===o.v?'#fff':'var(--t-muted)',
                                fontWeight:600,cursor:'pointer',fontSize:'var(--fs-sm)'}}>
                              {o.l}
                            </button>
                          ))}
                        </div>
                      </FormField>
                    </div>
                  </div>
                )}
                {Number(form.controla_patrimonio)===1 && (
                  <div className="form-grid-2">
                    <FormField label="Prazo Entrega (dias)">
                      <input type="number" min="0" value={form.prazo_entrega_dias??0}
                        onChange={e=>setForm((f:any)=>({...f,prazo_entrega_dias:e.target.value}))}
                        className={inputCls} />
                    </FormField>
                    <FormField label="Custo de Reposição (R$)">
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                          color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                        <input type="number" step="0.01" min="0" value={form.custo_reposicao??0}
                          onChange={e=>setForm((f:any)=>({...f,custo_reposicao:e.target.value}))}
                          className={inputCls} style={{ paddingLeft:30 }} />
                      </div>
                    </FormField>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ── ABA: PREÇOS ──────────────────────────────────────────────── */}
        {aba === 'precos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)',
              padding:'10px 14px', background:'var(--bg-header)',
              borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
              💡 Preencha apenas os períodos que deseja cobrar. Períodos com valor zero não serão exibidos.
            </div>
            <div className="form-grid-3">
              {periodos.length > 0 ? periodos.map((p:any) => {
                const campo = campoPreco(p.nome)
                const val = Number(form[campo] ?? 0)
                return (
                  <FormField key={p.id} label={`${p.nome} (${p.dias}d)`}>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                        color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0" value={form[campo]??0}
                        onChange={e=>setForm((f:any)=>({...f,[campo]:e.target.value}))}
                        className={inputCls}
                        style={{ paddingLeft:30, borderColor:val>0?'var(--c-primary)':undefined }} />
                    </div>
                    {val>0 && p.dias>1 && (
                      <div style={{ fontSize:'var(--fs-xs)', color:'var(--c-primary)', marginTop:3, fontWeight:600 }}>
                        {fmt.money(val/p.dias)}/dia
                      </div>
                    )}
                  </FormField>
                )
              }) : (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'24px',
                  color:'var(--t-muted)', fontSize:'var(--fs-md)' }}>
                  Nenhum período cadastrado. Configure em Parâmetros → Períodos de Locação.
                </div>
              )}
            </div>
            {/* Custo reposição + Preço de venda */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
              <div className="form-grid-2">
                <FormField label="Custo de Reposição (R$)" hint="Cobrado em caso de perda ou dano">
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                      color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                    <input type="number" step="0.01" min="0" value={form.custo_reposicao??0}
                      onChange={e=>setForm((f:any)=>({...f,custo_reposicao:e.target.value}))}
                      className={inputCls} style={{ paddingLeft:30 }} />
                  </div>
                </FormField>
                {Number(form.permite_venda)===1 && (
                  <FormField label="Preço de Venda / Avulso (R$)" hint="Quando cobrado como acessório no contrato">
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                        color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0" value={form.preco_venda??0}
                        onChange={e=>setForm((f:any)=>({...f,preco_venda:e.target.value}))}
                        className={inputCls} style={{ paddingLeft:30,
                          borderColor:Number(form.preco_venda)>0?'var(--c-primary)':undefined }} />
                    </div>
                  </FormField>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: INVENTÁRIO ─────────────────────────────────────────── */}
        {aba === 'inventario' && editId && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Resumo + botão novo */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', gap:12 }}>
                {[
                  { l:'Disponível', v: patsPanel.filter(p=>p.status==='disponivel').length, c:'#16a34a' },
                  { l:'Locado',     v: patsPanel.filter(p=>p.status==='locado').length,     c:'var(--c-primary)' },
                  { l:'Manutenção', v: patsPanel.filter(p=>p.status==='manutencao').length, c:'#f59e0b' },
                  { l:'Total',      v: patsPanel.length,                                    c:'var(--t-secondary)' },
                ].map(k => (
                  <div key={k.l} style={{ textAlign:'center', padding:'8px 14px',
                    background:'var(--bg-header)', border:'1px solid var(--border)',
                    borderRadius:'var(--r-md)', minWidth:70 }}>
                    <div style={{ fontWeight:800, fontSize:20, color:k.c }}>{k.v}</div>
                    <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', fontWeight:600,
                      textTransform:'uppercase', letterSpacing:'0.04em' }}>{k.l}</div>
                  </div>
                ))}
              </div>
              <Btn onClick={() => { setNovoPat(true); setEditPat(null); setPatForm({ status:'disponivel' }); setPatErro('') }}>
                + Novo Patrimônio
              </Btn>
            </div>

            {/* Formulário de novo / edição de patrimônio */}
            {(novoPat || editPat) && (
              <div style={{ border:'2px solid var(--c-primary)', borderRadius:'var(--r-md)',
                padding:'16px', background:'var(--c-primary-light,#e0f2fe)' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-base)', marginBottom:14, color:'var(--c-primary)' }}>
                  {editPat ? `Editar patrimônio ${editPat.numero_patrimonio}` : 'Novo Patrimônio'}
                </div>
                {patErro && <div className="ds-alert-error" style={{ marginBottom:12 }}>{patErro}</div>}
                <div className="form-grid-3">
                  <FormField label="Nº Patrimônio" required>
                    <input value={patForm.numero_patrimonio??''} autoFocus
                      onChange={e=>setPatForm((f:any)=>({...f,numero_patrimonio:e.target.value}))}
                      className={inputCls} placeholder="Ex: 00080" />
                  </FormField>
                  <FormField label="Nº Série">
                    <input value={patForm.numero_serie??''}
                      onChange={e=>setPatForm((f:any)=>({...f,numero_serie:e.target.value}))}
                      className={inputCls} placeholder="Ex: SN-12345" />
                  </FormField>
                  <FormField label="Status">
                    <select value={patForm.status??'disponivel'}
                      onChange={e=>setPatForm((f:any)=>({...f,status:e.target.value}))}
                      className={inputCls}>
                      <option value="disponivel">Disponível</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </FormField>
                  <FormField label="Data de Aquisição">
                    <input type="date" value={patForm.data_aquisicao??''}
                      onChange={e=>setPatForm((f:any)=>({...f,data_aquisicao:e.target.value}))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Valor de Aquisição (R$)">
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                        color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0" value={patForm.valor_aquisicao??''}
                        onChange={e=>setPatForm((f:any)=>({...f,valor_aquisicao:e.target.value}))}
                        className={inputCls} style={{ paddingLeft:30 }} />
                    </div>
                  </FormField>
                  <FormField label="Observações">
                    <input value={patForm.observacoes??''}
                      onChange={e=>setPatForm((f:any)=>({...f,observacoes:e.target.value}))}
                      className={inputCls} placeholder="Ex: Revisado em 03/2026" />
                  </FormField>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:14 }}>
                  <Btn variant="secondary" style={{ flex:1 }}
                    onClick={() => { setNovoPat(false); setEditPat(null); setPatForm({}); setPatErro('') }}>
                    Cancelar
                  </Btn>
                  <Btn style={{ flex:2 }} loading={patSaving} onClick={salvarPat}>
                    {editPat ? 'Salvar Alterações' : 'Adicionar Patrimônio'}
                  </Btn>
                </div>
              </div>
            )}

            {/* Lista de patrimônios */}
            {patsLoading ? (
              <div style={{ textAlign:'center', padding:'32px', color:'var(--t-muted)' }}>
                <div className="ds-spinner" style={{ margin:'0 auto 10px' }} />Carregando...
              </div>
            ) : patsPanel.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 24px', color:'var(--t-muted)',
                border:'2px dashed var(--border)', borderRadius:'var(--r-md)' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>🏷️</div>
                <div style={{ fontWeight:600, marginBottom:4 }}>Nenhum patrimônio cadastrado</div>
                <div style={{ fontSize:'var(--fs-sm)' }}>Clique em "+ Novo Patrimônio" para começar</div>
              </div>
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width:130 }}>Nº Patrimônio</th>
                    <th style={{ width:130 }}>Nº Série</th>
                    <th style={{ width:120 }}>Status</th>
                    <th style={{ width:110 }}>Aquisição</th>
                    <th style={{ width:120, textAlign:'right' }}>Valor Aquis.</th>
                    <th>Observações</th>
                    <th style={{ width:120, textAlign:'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {patsPanel.map((pat: any) => {
                    const temContratoAtivo = (pat.contrato_itens ?? []).some((ci: any) =>
                      ['ativo','em_devolucao','pendente_manutencao'].includes(ci.contratos?.status)
                    )
                    const statusColors: Record<string,string> = {
                      disponivel: '#16a34a', locado: 'var(--c-primary)',
                      manutencao: '#f59e0b', inativo: 'var(--t-muted)'
                    }
                    const statusLabels: Record<string,string> = {
                      disponivel: 'Disponível', locado: 'Locado',
                      manutencao: 'Manutenção', inativo: 'Inativo'
                    }
                    const sc = statusColors[pat.status] ?? 'var(--t-muted)'
                    return (
                      <tr key={pat.id}
                        style={{ background: editPat?.id===pat.id ? 'var(--c-primary-light,#e0f2fe)' : undefined }}>
                        <td className="tbl-mono" style={{ fontWeight:700 }}>{pat.numero_patrimonio}</td>
                        <td className="tbl-mono" style={{ color:'var(--t-muted)' }}>{pat.numero_serie||'—'}</td>
                        <td>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                            fontWeight:600, fontSize:'var(--fs-xs)', padding:'3px 9px',
                            borderRadius:99, background:sc+'18', color:sc }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:sc }} />
                            {statusLabels[pat.status] ?? pat.status}
                            {temContratoAtivo && (
                              <span style={{ fontSize:10, opacity:.7, marginLeft:2 }} title="Contrato ativo">🔒</span>
                            )}
                          </span>
                        </td>
                        <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                          {pat.data_aquisicao ? new Date(pat.data_aquisicao+'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="tbl-mono" style={{ textAlign:'right', fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                          {pat.valor_aquisicao > 0 ? fmt.money(pat.valor_aquisicao) : '—'}
                        </td>
                        <td style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)' }}>
                          {pat.observacoes || '—'}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                            {/* Editar — sempre disponível */}
                            <button
                              onClick={() => {
                                setEditPat(pat)
                                setNovoPat(false)
                                setPatErro('')
                                setPatForm({
                                  numero_patrimonio: pat.numero_patrimonio,
                                  numero_serie:      pat.numero_serie ?? '',
                                  status:            pat.status,
                                  data_aquisicao:    pat.data_aquisicao ?? '',
                                  valor_aquisicao:   pat.valor_aquisicao ?? '',
                                  observacoes:       pat.observacoes ?? '',
                                })
                              }}
                              title="Editar patrimônio"
                              style={{ padding:'4px 10px', borderRadius:'var(--r-sm)',
                                border:'1px solid var(--border)', background:'var(--bg-card)',
                                cursor:'pointer', fontSize:'var(--fs-sm)', color:'var(--t-primary)' }}>
                              ✏️
                            </button>
                            {/* Excluir — apenas se não tem contrato ativo */}
                            <button
                              onClick={() => excluirPat(pat)}
                              disabled={temContratoAtivo}
                              title={temContratoAtivo ? 'Patrimônio com contrato ativo — não pode ser excluído' : 'Excluir patrimônio'}
                              style={{ padding:'4px 10px', borderRadius:'var(--r-sm)',
                                border:`1px solid ${temContratoAtivo ? 'var(--border)' : 'var(--c-danger,#dc2626)'}`,
                                background:'transparent', cursor:temContratoAtivo?'not-allowed':'pointer',
                                fontSize:'var(--fs-sm)',
                                color: temContratoAtivo ? 'var(--t-muted)' : 'var(--c-danger,#dc2626)',
                                opacity: temContratoAtivo ? 0.4 : 1 }}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </SlidePanel>
    </div>
  )
}
