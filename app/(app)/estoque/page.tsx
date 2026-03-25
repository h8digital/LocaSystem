'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Ico, Btn, FormField, inputCls, selectCls, textareaCls, LookupField } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

// ─── tipos ────────────────────────────────────────────────────────────────────
type Produto = {
  id: number; nome: string; codigo?: string; marca?: string; modelo?: string
  controla_patrimonio: number; unidade: string; estoque_total: number; estoque_minimo: number
  custo_reposicao: number; preco_locacao_diario: number; preco_locacao_semanal: number
  preco_quinzenal: number; preco_locacao_mensal: number; preco_trimestral: number; preco_semestral: number
  observacoes?: string; categorias?: { nome: string }
}
type Patrimonio = {
  id: number; produto_id: number; numero_patrimonio: string; numero_serie?: string
  local_armazenagem_id?: number; data_aquisicao?: string; valor_aquisicao?: number
  status: string; observacoes?: string; locais_armazenagem?: { nome: string }
  contrato_ativo?: { id: number; numero: string; status: string } | null
}

const patBg: Record<string, string> = {
  disponivel: 'var(--c-success-light)', locado: 'var(--c-info-light)',
  manutencao: 'var(--c-warning-light)', descartado: '#F1F3F4', reservado: '#FFF3CD'
}


// ─── Painel inline para criar local de armazenagem ────────────────────────────
function NovoLocalPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (r: any) => void }) {
  const [nome, setNome]           = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving]       = useState(false)
  const [erro, setErro]           = useState('')

  async function salvar() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('locais_armazenagem')
      .insert({ nome: nome.trim(), descricao: descricao.trim() || null, ativo: 1 })
      .select().single()
    if (error || !data) { setErro('Erro ao salvar: ' + (error?.message ?? 'Tente novamente.')); setSaving(false); return }
    onCreated(data)
    onClose()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {erro && <div className="ds-alert-error">{erro}</div>}
      <FormField label="Nome do Local" required>
        <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls}
          placeholder="Ex: Galpão A, Prateleira 01, Depósito..." autoFocus
          onKeyDown={e => e.key === 'Enter' && salvar()} />
      </FormField>
      <FormField label="Descrição">
        <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls}
          placeholder="Descrição ou localização adicional (opcional)" />
      </FormField>
      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <Btn variant="secondary" style={{ flex:1 }} onClick={onClose}>Cancelar</Btn>
        <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>Salvar Local</Btn>
      </div>
    </div>
  )
}

export default function EstoquePage() {
  const router = useRouter()
  const [lista, setLista]       = useState<Produto[]>([])
  const [periodos, setPeriodos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filters, setFilters]   = useState<Record<string,string>>({ busca:'', tipo:'' })

  // Painel: detalhe do produto
  const [panelDetalhe, setPanelDetalhe]   = useState(false)
  const [prodDetalhe,  setProdDetalhe]    = useState<Produto | null>(null)
  const [patrimonios,  setPatrimonios]    = useState<Patrimonio[]>([])
  const [loadingPats,  setLoadingPats]    = useState(false)
  const [abaDetalhe,   setAbaDetalhe]     = useState<'patrimonios'|'movimentacoes'|'precos'>('patrimonios')
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])

  // Painel: novo patrimônio (a partir do detalhe)
  const [panelPat,  setPanelPat]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [erro,      setErro]      = useState('')

  // Formulário de patrimônio — suporta múltiplos
  const [modoMultiplo, setModoMultiplo] = useState(false)
  const [serialsTexto, setSerialsTexto] = useState('') // um por linha (número série)
  const [patnsTexto,   setPatnsTexto]   = useState('') // um por linha (número patrimônio)
  const [formPat, setFormPat] = useState({
    numero_patrimonio:'', numero_serie:'', local_armazenagem_id:'',
    data_aquisicao:'', valor_aquisicao: '', observacoes:''
  })

  // Painel: movimentação (a partir do detalhe - apenas qty)
  const [panelMov, setPanelMov] = useState(false)
  const [formMov, setFormMov]   = useState({ tipo:'entrada', quantidade:1, local_armazenagem_id:'', observacoes:'' })
  const [formMovLocalNome, setFormMovLocalNome] = useState('')
  const [formPatLocalNome, setFormPatLocalNome] = useState('')

  // Painel: preços de locação
  const [panelPrecos, setPanelPrecos] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('produtos').select('*, categorias(nome)').eq('ativo', 1)
    if (filters.busca) q = q.ilike('nome', `%${filters.busca}%`)
    if (filters.tipo === 'patrimonio') q = q.eq('controla_patrimonio', 1)
    if (filters.tipo === 'quantidade') q = q.eq('controla_patrimonio', 0)
    const { data } = await q.order('nome')
    setLista(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('periodos_locacao').select('*').eq('ativo', 1).order('dias').then(({ data }) => setPeriodos(data ?? []))
  }, [])
  useEffect(() => { load() }, [filters])

  // ── Abrir detalhe do produto ───────────────────────────────────────────────
  async function abrirDetalhe(prod: Produto, aba: 'patrimonios'|'movimentacoes'|'precos' = 'patrimonios') {
    setProdDetalhe(prod)
    setAbaDetalhe(aba)
    setPanelDetalhe(true)
    if (prod.controla_patrimonio) {
      await carregarPatrimonios(prod.id)
    } else {
      await carregarMovimentacoes(prod.id)
    }
  }

  async function carregarPatrimonios(prodId: number) {
    setLoadingPats(true)
    const { data: pats } = await supabase
      .from('patrimonios')
      .select('*, locais_armazenagem(nome)')
      .eq('produto_id', prodId)
      .order('numero_patrimonio')

    // Para cada patrimônio locado, buscar o contrato ativo
    const patsEnriquecidos = await Promise.all((pats ?? []).map(async (p) => {
      if (p.status !== 'locado') return { ...p, contrato_ativo: null }
      const { data: ci } = await supabase
        .from('contrato_itens')
        .select('contrato_id, contratos(id, numero, status)')
        .eq('patrimonio_id', p.id)
        .eq('contratos.status', 'ativo')
        .limit(1)
        .maybeSingle()
      const contrato = ci ? (ci.contratos as any) : null
      return { ...p, contrato_ativo: contrato?.status === 'ativo' ? contrato : null }
    }))

    setPatrimonios(patsEnriquecidos)
    setLoadingPats(false)
  }

  async function carregarMovimentacoes(prodId: number) {
    const { data } = await supabase
      .from('estoque_movimentacoes')
      .select('*, locais_armazenagem(nome)')
      .eq('produto_id', prodId)
      .order('created_at', { ascending: false })
      .limit(30)
    setMovimentacoes(data ?? [])
  }

  // ── Abrir painel de novo patrimônio (contexto = produto atual do detalhe) ──
  function abrirNovoPat() {
    setErro('')
    setModoMultiplo(false)
    setSerialsTexto('')
    setPatnsTexto('')
    setFormPat({ numero_patrimonio:'', numero_serie:'', local_armazenagem_id:'', data_aquisicao:'', valor_aquisicao:'', observacoes:'' })
    setFormPatLocalNome('')
    setPanelPat(true)
  }

  // ── Salvar patrimônio(s) ───────────────────────────────────────────────────
  async function salvarPatrimonio() {
    if (!prodDetalhe) return
    setErro(''); setSaving(true)

    try {
      if (modoMultiplo) {
        // Modo múltiplo: cada linha = um número de patrimônio (e opcionalmente série)
        const linhasPatn = patnsTexto.split('\n').map(l => l.trim()).filter(Boolean)
        const linhasSerie = serialsTexto.split('\n').map(l => l.trim())
        if (linhasPatn.length === 0) { setErro('Informe ao menos um número de patrimônio.'); setSaving(false); return }
        const rows = linhasPatn.map((patn, i) => ({
          produto_id: prodDetalhe.id,
          numero_patrimonio: patn,
          numero_serie: linhasSerie[i] || null,
          local_armazenagem_id: formPat.local_armazenagem_id ? Number(formPat.local_armazenagem_id) : null,
          data_aquisicao: formPat.data_aquisicao || null,
          valor_aquisicao: formPat.valor_aquisicao ? Number(formPat.valor_aquisicao) : null,
          status: 'disponivel'
        }))
        const { error } = await supabase.from('patrimonios').insert(rows)
        if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
        // Atualiza estoque_total
        await supabase.from('produtos').update({ estoque_total: (prodDetalhe.estoque_total ?? 0) + rows.length }).eq('id', prodDetalhe.id)
      } else {
        if (!formPat.numero_patrimonio.trim()) { setErro('Número de patrimônio é obrigatório.'); setSaving(false); return }
        const { error } = await supabase.from('patrimonios').insert({
          produto_id: prodDetalhe.id,
          numero_patrimonio: formPat.numero_patrimonio,
          numero_serie: formPat.numero_serie || null,
          local_armazenagem_id: formPat.local_armazenagem_id ? Number(formPat.local_armazenagem_id) : null,
          data_aquisicao: formPat.data_aquisicao || null,
          valor_aquisicao: formPat.valor_aquisicao ? Number(formPat.valor_aquisicao) : null,
          status: 'disponivel'
        })
        if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
        await supabase.from('produtos').update({ estoque_total: (prodDetalhe.estoque_total ?? 0) + 1 }).eq('id', prodDetalhe.id)
      }
      setSaving(false); setPanelPat(false)
      await carregarPatrimonios(prodDetalhe.id)
      load()
    } catch (e: any) { setErro(e.message); setSaving(false) }
  }

  // ── Salvar movimentação ────────────────────────────────────────────────────
  async function salvarMovimentacao() {
    if (!prodDetalhe) return
    setErro(''); setSaving(true)
    const sinal = formMov.tipo === 'entrada' ? 1 : formMov.tipo === 'saida' ? -1 : 0
    const novoEstoque = Math.max(0, (prodDetalhe.estoque_total ?? 0) + sinal * Number(formMov.quantidade))
    await supabase.from('produtos').update({ estoque_total: novoEstoque }).eq('id', prodDetalhe.id)
    await supabase.from('estoque_movimentacoes').insert({
      produto_id: prodDetalhe.id, ...formMov,
      local_armazenagem_id: formMov.local_armazenagem_id ? Number(formMov.local_armazenagem_id) : null
    })
    // atualiza objeto local
    setProdDetalhe(p => p ? { ...p, estoque_total: novoEstoque } : p)
    setSaving(false); setPanelMov(false)
    await carregarMovimentacoes(prodDetalhe.id)
    load()
  }

  // ── Toggle status patrimônio ───────────────────────────────────────────────
  async function toggleStatus(pat: Patrimonio) {
    const novo = pat.status === 'disponivel' ? 'descartado' : 'disponivel'
    await supabase.from('patrimonios').update({ status: novo }).eq('id', pat.id)
    if (prodDetalhe) await carregarPatrimonios(prodDetalhe.id)
  }

  // ── Ações da tabela ───────────────────────────────────────────────────────
  function acoesProduto(row: Produto): AcaoSecundaria[] {
    const base: AcaoSecundaria[] = [
      {
        icon: <Ico.Download />,
        label: 'Preços de Locação',
        grupo: 1,
        onClick: () => { setProdDetalhe(row); setAbaDetalhe('precos'); setPanelDetalhe(true) }
      },
    ]
    if (row.controla_patrimonio) {
      base.push({
        icon: <Ico.Archive />,
        label: 'Ver Patrimônios',
        grupo: 1,
        onClick: () => abrirDetalhe(row, 'patrimonios')
      })
    } else {
      base.push({
        icon: <Ico.Convert />,
        label: 'Movimentar Estoque',
        grupo: 1,
        onClick: () => { setProdDetalhe(row); setPanelMov(true); setFormMov({ tipo:'entrada', quantidade:1, local_armazenagem_id:'', observacoes:'' }); setFormMovLocalNome('') }
      })
    }
    return base
  }

  // ── Quantos patrimônios serão inseridos no modo múltiplo ──────────────────
  const qtdMultiplo = patnsTexto.split('\n').filter(l => l.trim()).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <PageHeader
        title="Estoque"
        subtitle={`${lista.length} produto(s)`}
      />

      <Filters
        fields={[
          { type:'text',   key:'busca', placeholder:'Buscar produto...', width:'260px' },
          { type:'select', key:'tipo',  placeholder:'Todos os tipos', options:[
            { value:'patrimonio', label:'Por Patrimônio' },
            { value:'quantidade', label:'Por Quantidade' },
          ]},
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca:'', tipo:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhum produto no estoque."
        columns={[
          { key:'nome', label:'Produto', render: r => (
            <div>
              <div style={{ fontWeight:600 }}>{r.nome}</div>
              <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                {r.codigo ? `${r.codigo} · ` : ''}{(r.categorias as any)?.nome ?? 'Sem categoria'}
              </div>
            </div>
          )},
          { key:'controle', label:'Tipo', render: r =>
            r.controla_patrimonio
              ? <Badge value="locado"   label="Patrimônio" />
              : <Badge value="rascunho" label="Quantidade"  />
          },
          { key:'estoque', label:'Disponível', render: r => {
            if (r.controla_patrimonio) {
              return (
                <button
                  onClick={e => { e.stopPropagation(); abrirDetalhe(r, 'patrimonios') }}
                  className="ds-btn ds-btn-sm ds-btn-secondary"
                  style={{ fontSize:'var(--fs-md)' }}
                >Ver patrimônios</button>
              )
            }
            const alerta = r.estoque_minimo > 0 && r.estoque_total <= r.estoque_minimo
            return (
              <span style={{ fontWeight:600, color: alerta ? 'var(--c-danger)' : 'var(--t-primary)' }}>
                {r.estoque_total} {r.unidade}{alerta ? ' ⚠' : ''}
              </span>
            )
          }},
          { key:'minimo',    label:'Mínimo',    render: r => r.controla_patrimonio ? '—' : `${r.estoque_minimo} ${r.unidade}` },
          { key:'preco',     label:'Preço/Dia', align:'right', render: r => fmt.money(r.preco_locacao_diario) },
          { key:'reposicao', label:'Reposição', align:'right', render: r => fmt.money(r.custo_reposicao) },
        ]}
        data={lista}
        onRowClick={row => abrirDetalhe(row)}
        actions={row => (
          <ActionButtons
            onView={() => abrirDetalhe(row)}
            onEdit={() => { /* redireciona para equipamentos */ window.location.href = `/equipamentos?edit=${row.id}` }}
            acoesSec={acoesProduto(row)}
          />
        )}
      />

      {/* ══ PAINEL: Detalhe do Produto ════════════════════════════════════ */}
      <SlidePanel
        open={panelDetalhe}
        onClose={() => setPanelDetalhe(false)}
        title={prodDetalhe?.nome ?? ''}
        subtitle={[prodDetalhe?.marca, prodDetalhe?.modelo].filter(Boolean).join(' · ') || 'Detalhes do produto'}
        width="lg"
        footer={
          prodDetalhe?.controla_patrimonio
            ? (
              <div style={{ display:'flex', gap:8, width:'100%' }}>
                <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelDetalhe(false)}>Fechar</Btn>
                <Btn style={{ flex:2 }} onClick={abrirNovoPat}>+ Cadastrar Patrimônio</Btn>
              </div>
            )
            : (
              <div style={{ display:'flex', gap:8, width:'100%' }}>
                <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelDetalhe(false)}>Fechar</Btn>
                <Btn style={{ flex:2 }} onClick={() => { setPanelMov(true); setFormMov({ tipo:'entrada', quantidade:1, local_armazenagem_id:'', observacoes:'' }); setFormMovLocalNome('') }}>
                  + Movimentar Estoque
                </Btn>
              </div>
            )
        }
      >
        {prodDetalhe && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Resumo */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { l:'Código', v: prodDetalhe.codigo || '—' },
                { l:'Categoria', v: (prodDetalhe.categorias as any)?.nome || '—' },
                { l:'Controle', v: prodDetalhe.controla_patrimonio ? 'Por Patrimônio' : 'Por Quantidade' },
                { l:'Estoque Atual', v: `${prodDetalhe.estoque_total} ${prodDetalhe.unidade}`, destaque: true },
                { l:'Estoque Mínimo', v: prodDetalhe.controla_patrimonio ? '—' : `${prodDetalhe.estoque_minimo} ${prodDetalhe.unidade}` },
                { l:'Custo Reposição', v: fmt.money(prodDetalhe.custo_reposicao) },
              ].map(item => (
                <div key={item.l} style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)', padding:'10px 12px', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:2 }}>{item.l}</div>
                  <div style={{ fontWeight:600, fontSize:'var(--fs-base)', color: (item as any).destaque ? 'var(--c-primary)' : 'var(--t-primary)' }}>{item.v}</div>
                </div>
              ))}
            </div>

            {/* Abas */}
            <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border)' }}>
              {(prodDetalhe.controla_patrimonio
                ? [{ k:'patrimonios', l:'Patrimônios' }, { k:'precos', l:'Preços de Locação' }]
                : [{ k:'movimentacoes', l:'Movimentações' }, { k:'precos', l:'Preços de Locação' }]
              ).map((a:any) => (
                <button key={a.k} onClick={() => {
                  setAbaDetalhe(a.k)
                  if (a.k === 'movimentacoes' && prodDetalhe) carregarMovimentacoes(prodDetalhe.id)
                }}
                  style={{
                    padding:'7px 14px', fontSize:'var(--fs-base)', fontWeight:600, border:'none', cursor:'pointer',
                    background:'transparent', borderBottom: abaDetalhe === a.k ? '2px solid var(--c-primary)' : '2px solid transparent',
                    color: abaDetalhe === a.k ? 'var(--c-primary)' : 'var(--t-muted)', marginBottom:'-2px', transition:'all 150ms'
                  }}>{a.l}</button>
              ))}
            </div>

            {/* Aba: Patrimônios */}
            {abaDetalhe === 'patrimonios' && (
              loadingPats
                ? <div style={{ textAlign:'center', padding:24, color:'var(--t-muted)' }}>Carregando...</div>
                : patrimonios.length === 0
                  ? <div className="ds-empty"><div className="ds-empty-icon" style={{fontSize:28}}>📦</div><div className="ds-empty-title">Nenhum patrimônio cadastrado.</div></div>
                  : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {patrimonios.map(p => (
                        <div key={p.id} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'9px 14px',
                          background: patBg[p.status] ?? 'var(--bg-card)',
                        }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            <div style={{ fontFamily:'var(--font-mono, monospace)', fontWeight:700, fontSize:'var(--fs-base)' }}>
                              {p.numero_patrimonio}
                            </div>
                            <div style={{ display:'flex', gap:10, fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>
                              {p.numero_serie && <span>S/N: {p.numero_serie}</span>}
                              {(p.locais_armazenagem as any)?.nome && <span>Local: {(p.locais_armazenagem as any).nome}</span>}
                              {p.data_aquisicao && <span>Aq.: {fmt.date(p.data_aquisicao)}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Badge value={p.status} dot />
                            {p.status === 'locado' && p.contrato_ativo && (
                              <button
                                onClick={() => { setPanelDetalhe(false); router.push(`/contratos/${p.contrato_ativo!.id}`) }}
                                className="ds-btn ds-btn-sm ds-btn-secondary"
                                style={{ fontSize:'var(--fs-md)', color:'var(--c-primary)', fontWeight:600 }}
                                title={`Ver Contrato ${p.contrato_ativo!.numero}`}
                              >
                                {p.contrato_ativo!.numero} →
                              </button>
                            )}
                            {p.status !== 'locado' && p.status !== 'manutencao' && (
                              <button
                                onClick={() => toggleStatus(p)}
                                className={`ds-btn ds-btn-sm ${p.status === 'disponivel' ? 'ds-btn-ghost' : 'ds-btn-secondary'}`}
                                style={{ fontSize:'var(--fs-md)', color: p.status === 'disponivel' ? 'var(--c-danger)' : 'var(--c-success)' }}
                              >
                                {p.status === 'disponivel' ? 'Descartar' : 'Reativar'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
            )}

            {/* Aba: Movimentações */}
            {abaDetalhe === 'movimentacoes' && (
              movimentacoes.length === 0
                ? <div className="ds-empty"><div className="ds-empty-title">Nenhuma movimentação registrada.</div></div>
                : (
                  <table className="ds-table">
                    <thead><tr>
                      <th>Data</th><th>Tipo</th><th style={{textAlign:'right'}}>Qtd</th><th>Local</th><th>Observações</th>
                    </tr></thead>
                    <tbody>
                      {movimentacoes.map(m => (
                        <tr key={m.id}>
                          <td style={{fontSize:'var(--fs-md)'}}>{fmt.datetime(m.created_at)}</td>
                          <td><Badge value={m.tipo} label={m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste'} /></td>
                          <td style={{textAlign:'right', fontWeight:600}}>{m.quantidade}</td>
                          <td style={{fontSize:'var(--fs-md)', color:'var(--t-muted)'}}>{(m.locais_armazenagem as any)?.nome ?? '—'}</td>
                          <td style={{fontSize:'var(--fs-md)', color:'var(--t-secondary)'}}>{m.observacoes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}

            {/* Aba: Preços */}
            {abaDetalhe === 'precos' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {[
                  { l:'Diário',    v: prodDetalhe.preco_locacao_diario },
                  { l:'Semanal',   v: prodDetalhe.preco_locacao_semanal },
                  { l:'Quinzenal', v: prodDetalhe.preco_quinzenal },
                  { l:'Mensal',    v: prodDetalhe.preco_locacao_mensal },
                  { l:'Trimestral',v: prodDetalhe.preco_trimestral },
                  { l:'Semestral', v: prodDetalhe.preco_semestral },
                  { l:'Custo de Reposição', v: prodDetalhe.custo_reposicao },
                ].map(item => (
                  <div key={item.l} style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)', padding:'10px 14px', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:2 }}>{item.l}</div>
                    <div style={{ fontWeight:700, fontSize:'var(--fs-lg)', color: item.v > 0 ? 'var(--c-primary)' : 'var(--t-light)' }}>
                      {fmt.money(item.v)}
                    </div>
                  </div>
                ))}
                {periodos.length > 0 && (
                  <div style={{ gridColumn:'span 2', marginTop:4 }}>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:8 }}>
                      Preços configurados com base nos períodos de locação em Parâmetros.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SlidePanel>

      {/* ══ PAINEL: Cadastrar Patrimônio ══════════════════════════════════ */}
      <SlidePanel
        open={panelPat} onClose={() => setPanelPat(false)}
        title="Cadastrar Patrimônio"
        subtitle={prodDetalhe?.nome ?? ''}
        width="md"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelPat(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvarPatrimonio}>
              {modoMultiplo && qtdMultiplo > 0 ? `Cadastrar ${qtdMultiplo} Patrimônio(s)` : 'Cadastrar Patrimônio'}
            </Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}

        {/* Toggle: simples / múltiplo */}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {[{ k:false, l:'Cadastro Individual' }, { k:true, l:'Cadastro em Lote' }].map(o => (
            <button key={String(o.k)}
              onClick={() => setModoMultiplo(o.k as boolean)}
              className="ds-btn ds-btn-sm"
              style={{
                background: modoMultiplo === o.k ? 'var(--c-primary)' : 'var(--bg-header)',
                color:      modoMultiplo === o.k ? '#fff' : 'var(--t-secondary)',
                border:     `1px solid ${modoMultiplo === o.k ? 'var(--c-primary)' : 'var(--border)'}`,
              }}>{o.l}</button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Campos comuns */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <LookupField
              label="Local de Armazenagem"
              table="locais_armazenagem"
              searchColumn="nome"
              filter={{ ativo: 1 }}
              placeholder="Selecionar local..."
              value={formPat.local_armazenagem_id || null}
              displayValue={formPatLocalNome}
              onChange={(id, row) => {
                setFormPat(f => ({ ...f, local_armazenagem_id: id != null ? String(id) : '' }))
                setFormPatLocalNome(row?.nome ?? '')
              }}
              createPanelTitle="Novo Local de Armazenagem"
              createPanel={({ onClose, onCreated }: any) => (
                <NovoLocalPanel onClose={onClose} onCreated={(r: any) => {
                  setFormPat(f => ({ ...f, local_armazenagem_id: String(r.id) }))
                  setFormPatLocalNome(r.nome)
                  onCreated(r)
                }} />
              )}
            />
            <FormField label="Data de Aquisição">
              <input type="date" value={formPat.data_aquisicao}
                onChange={e => setFormPat(f => ({ ...f, data_aquisicao: e.target.value }))}
                className={inputCls} />
            </FormField>
            <FormField label="Valor de Aquisição (R$)" style={{ gridColumn:'span 2' }}>
              <input type="number" step="0.01" min="0" value={formPat.valor_aquisicao}
                onChange={e => setFormPat(f => ({ ...f, valor_aquisicao: e.target.value }))}
                className={inputCls} placeholder="0,00" />
            </FormField>
          </div>

          {!modoMultiplo ? (
            /* Individual */
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormField label="Número de Patrimônio" required>
                <input value={formPat.numero_patrimonio}
                  onChange={e => setFormPat(f => ({ ...f, numero_patrimonio: e.target.value }))}
                  className={inputCls} placeholder="Ex: PAT-001" autoFocus />
              </FormField>
              <FormField label="Número de Série">
                <input value={formPat.numero_serie}
                  onChange={e => setFormPat(f => ({ ...f, numero_serie: e.target.value }))}
                  className={inputCls} placeholder="Ex: SN-ABC-123" />
              </FormField>
            </div>
          ) : (
            /* Lote */
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormField label="Números de Patrimônio (um por linha)" required>
                <textarea
                  value={patnsTexto}
                  onChange={e => setPatnsTexto(e.target.value)}
                  rows={8} className={textareaCls}
                  placeholder={"PAT-001\nPAT-002\nPAT-003"} />
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:4 }}>
                  {qtdMultiplo > 0 ? `${qtdMultiplo} patrimônio(s) serão cadastrados` : 'Digite um número por linha'}
                </div>
              </FormField>
              <FormField label="Números de Série (opcional, um por linha)">
                <textarea
                  value={serialsTexto}
                  onChange={e => setSerialsTexto(e.target.value)}
                  rows={8} className={textareaCls}
                  placeholder={"SN-001\nSN-002\n(deixe em branco para pular)"} />
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:4 }}>
                  Deve ter a mesma quantidade de linhas ou menos
                </div>
              </FormField>
            </div>
          )}

          <FormField label="Observações">
            <textarea value={formPat.observacoes}
              onChange={e => setFormPat(f => ({ ...f, observacoes: e.target.value }))}
              rows={2} className={textareaCls} />
          </FormField>
        </div>
      </SlidePanel>

      {/* ══ PAINEL: Movimentação ══════════════════════════════════════════ */}
      <SlidePanel
        open={panelMov} onClose={() => setPanelMov(false)}
        title="Movimentação de Estoque"
        subtitle={prodDetalhe?.nome ?? ''}
        width="sm"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanelMov(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvarMovimentacao}>Registrar</Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}
        {prodDetalhe && (
          <div className="ds-inset" style={{ marginBottom:14 }}>
            <span style={{ color:'var(--t-secondary)', fontSize:'var(--fs-md)' }}>Estoque atual: </span>
            <span style={{ fontWeight:700 }}>{prodDetalhe.estoque_total} {prodDetalhe.unidade}</span>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <FormField label="Tipo de Movimentação">
            <select value={formMov.tipo} onChange={e => setFormMov(f => ({ ...f, tipo: e.target.value }))} className={selectCls}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </FormField>
          <FormField label="Quantidade">
            <input type="number" min="1" value={formMov.quantidade}
              onChange={e => setFormMov(f => ({ ...f, quantidade: Number(e.target.value) }))}
              className={inputCls} />
          </FormField>
          <LookupField
            label="Local de Armazenagem"
            table="locais_armazenagem"
            searchColumn="nome"
            filter={{ ativo: 1 }}
            placeholder="Selecionar local..."
            value={formMov.local_armazenagem_id || null}
            displayValue={formMovLocalNome}
            onChange={(id, row) => {
              setFormMov(f => ({ ...f, local_armazenagem_id: id != null ? String(id) : '' }))
              setFormMovLocalNome(row?.nome ?? '')
            }}
            createPanelTitle="Novo Local de Armazenagem"
            createPanel={({ onClose, onCreated }: any) => (
              <NovoLocalPanel onClose={onClose} onCreated={(r: any) => {
                setFormMov(f => ({ ...f, local_armazenagem_id: String(r.id) }))
                setFormMovLocalNome(r.nome)
                onCreated(r)
              }} />
            )}
          />
          <FormField label="Observações">
            <textarea value={formMov.observacoes}
              onChange={e => setFormMov(f => ({ ...f, observacoes: e.target.value }))}
              rows={3} className={textareaCls} />
          </FormField>
        </div>
      </SlidePanel>
    </div>
  )
}
