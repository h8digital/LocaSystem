// build: 2026-05-29 18:10:30
'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, Badge, ActionButtons, Btn, FormField, inputCls, selectCls, textareaCls, LookupField } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'
import { QuickCreateProduto } from '@/components/quick-create'

const tipoOpts = [
  { value:'corretiva',    label:'Corretiva' },
  { value:'preventiva',   label:'Preventiva' },
  { value:'higienizacao', label:'Higienização' },
  { value:'calibracao',   label:'Calibração' },
  { value:'outro',        label:'Outro' },
]

const tipoLabel = (v: string) => tipoOpts.find(t => t.value === v)?.label ?? v

// ── KPI Card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, accent, sub }: { label:string; value:string|number; accent:string; sub?:string }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
      border:'1px solid rgba(255,255,255,0.10)', borderTop:`2px solid ${accent}`,
      borderRadius:'var(--r-lg)', padding:'14px 16px',
    }}>
      <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.4)',
        textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:600, color: String(value) === '0' || value === 'R$ 0,00' ? 'rgba(255,255,255,0.25)' : accent, lineHeight:1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

export default function ManutencoesPage() {
  const [lista,   setLista]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [kpis,    setKpis]    = useState({ abertas:0, em_andamento:0, concluidas:0, canceladas:0, custo_total:0, vencidas:0 })
  const [panel,   setPanel]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [pats,    setPats]    = useState<any[]>([])
  const [erro,    setErro]    = useState('')

  // Filtros
  const [fBusca,       setFBusca]       = useState('')
  const [fStatus,      setFStatus]      = useState('')
  const [fTipo,        setFTipo]        = useState('')
  const [fEquipId,     setFEquipId]     = useState<number|null>(null)
  const [fEquipNome,   setFEquipNome]   = useState('')
  const [fPatrimonio,  setFPatrimonio]  = useState('')
  const [fSerie,       setFSerie]       = useState('')
  const [fAbertDe,     setFAbertDe]     = useState('')
  const [fAbertAte,    setFAbertAte]    = useState('')
  const [fPrevDe,      setFPrevDe]      = useState('')
  const [fPrevAte,     setFPrevAte]     = useState('')

  // Form
  const [editId,        setEditId]        = useState<number|null>(null)
  const [produtoId,     setProdutoId]     = useState<number|null>(null)
  const [produtoNome,   setProdutoNome]   = useState('')
  const [produto,       setProduto]       = useState<any>(null)
  const [patrimonioId,  setPatrimonioId]  = useState<number|null>(null)
  const [patrimonioNome,setPatrimonioNome]= useState('')
  const [form, setForm] = useState<any>({
    tipo:'corretiva', descricao:'', fornecedor:'', custo:0,
    data_abertura: new Date().toISOString().split('T')[0],
    data_previsao:'', observacoes:'', diagnostico:'', solucao:'',
  })

  const load = useCallback(async () => {
    setLoading(true)

    // KPIs — sem filtros
    const { data: todas } = await supabase.from('manutencoes')
      .select('status, custo, data_previsao')
    const lt = todas ?? []
    const hoje = new Date().toISOString().split('T')[0]
    setKpis({
      abertas:      lt.filter(m => m.status === 'aberto').length,
      em_andamento: lt.filter(m => m.status === 'em_andamento').length,
      concluidas:   lt.filter(m => m.status === 'concluido').length,
      canceladas:   lt.filter(m => m.status === 'cancelado').length,
      custo_total:  lt.filter(m => m.status !== 'cancelado').reduce((s,m) => s + Number(m.custo ?? 0), 0),
      vencidas:     lt.filter(m => m.data_previsao && m.data_previsao < hoje && !['concluido','cancelado'].includes(m.status)).length,
    })

    // Tabela — com filtros
    let q = supabase.from('manutencoes')
      .select('*, produtos(nome,marca), patrimonios(numero_patrimonio,numero_serie)')
      .order('created_at', { ascending: false })

    if (fStatus)  q = q.eq('status', fStatus)
    if (fTipo)    q = q.eq('tipo', fTipo)
    if (fEquipId) q = q.eq('produto_id', fEquipId)
    if (fAbertDe) q = q.gte('data_abertura', fAbertDe)
    if (fAbertAte)q = q.lte('data_abertura', fAbertAte)
    if (fPrevDe)  q = q.gte('data_previsao', fPrevDe)
    if (fPrevAte) q = q.lte('data_previsao', fPrevAte)
    if (fBusca)   q = q.ilike('descricao', `%${fBusca}%`)

    const { data } = await q.limit(300)
    let resultado = data ?? []

    // Filtro client-side por patrimônio e série (campos de tabela relacionada)
    if (fPatrimonio) {
      resultado = resultado.filter(m =>
        (m.patrimonios as any)?.numero_patrimonio?.toLowerCase().includes(fPatrimonio.toLowerCase())
      )
    }
    if (fSerie) {
      resultado = resultado.filter(m =>
        (m.patrimonios as any)?.numero_serie?.toLowerCase().includes(fSerie.toLowerCase())
      )
    }

    setLista(resultado)
    setLoading(false)
  }, [fBusca, fStatus, fTipo, fEquipId, fPatrimonio, fSerie, fAbertDe, fAbertAte, fPrevDe, fPrevAte])

  useEffect(() => { load() }, [load])

  function selecionarProduto(id: number|null, row: any|null) {
    setProdutoId(id); setProduto(row); setProdutoNome(row?.nome ?? '')
    setPatrimonioId(null); setPatrimonioNome(''); setPats([])
    if (id && row?.controla_patrimonio) {
      supabase.from('patrimonios').select('id,numero_patrimonio,numero_serie,status')
        .eq('produto_id', id).then(({ data }) => setPats(data ?? []))
    }
  }

  function abrirNovaOS() {
    setEditId(null); setErro('')
    setProdutoId(null); setProdutoNome(''); setProduto(null)
    setPatrimonioId(null); setPatrimonioNome(''); setPats([])
    setForm({
      tipo:'corretiva', descricao:'', fornecedor:'', custo:0,
      data_abertura: new Date().toISOString().split('T')[0],
      data_previsao:'', observacoes:'', diagnostico:'', solucao:'',
    })
    setPanel(true)
  }

  function abrirEditar(row: any) {
    setEditId(row.id); setErro('')
    setProdutoId(row.produto_id ?? null)
    setProdutoNome((row.produtos as any)?.nome ?? '')
    setProduto(row.produtos ?? null)
    setPatrimonioId(row.patrimonio_id ?? null)
    setPatrimonioNome((row.patrimonios as any)?.numero_patrimonio ?? '')
    setForm({
      tipo:          row.tipo ?? 'corretiva',
      descricao:     row.descricao ?? '',
      fornecedor:    row.fornecedor ?? '',
      custo:         row.custo ?? 0,
      data_abertura: row.data_abertura ?? new Date().toISOString().split('T')[0],
      data_previsao: row.data_previsao ?? '',
      observacoes:   row.observacoes ?? '',
      diagnostico:   row.diagnostico ?? '',
      solucao:       row.solucao ?? '',
    })
    setPanel(true)
  }

  async function salvar() {
    if (!produtoId) { setErro('Selecione um equipamento.'); return }
    if (!form.descricao?.trim()) { setErro('Descrição do problema é obrigatória.'); return }
    setSaving(true); setErro('')
    const payload = {
      produto_id: produtoId, patrimonio_id: patrimonioId || null,
      ...form,
      data_previsao: form.data_previsao || null,
      custo: Number(form.custo) || 0,
    }
    if (editId) {
      await supabase.from('manutencoes').update(payload).eq('id', editId)
    } else {
      await supabase.from('manutencoes').insert({ ...payload, status:'aberto' })
      if (patrimonioId) {
        await supabase.from('patrimonios').update({ status:'manutencao' }).eq('id', patrimonioId)
      }
    }
    setSaving(false); setPanel(false); load()
  }

  async function concluir(m: any) {
    if (!confirm(`Confirmar conclusão da OS #${m.id}?`)) return
    await supabase.from('manutencoes').update({
      status:'concluido', data_conclusao: new Date().toISOString().split('T')[0]
    }).eq('id', m.id)
    if (m.patrimonio_id) {
      await supabase.from('patrimonios').update({ status:'disponivel' }).eq('id', m.patrimonio_id)
    }
    load()
  }

  async function cancelar(m: any) {
    if (!confirm('Cancelar esta OS?')) return
    await supabase.from('manutencoes').update({ status:'cancelado' }).eq('id', m.id)
    if (m.patrimonio_id) {
      await supabase.from('patrimonios').update({ status:'disponivel' }).eq('id', m.patrimonio_id)
    }
    load()
  }

  function limparFiltros() {
    setFBusca(''); setFStatus(''); setFTipo('')
    setFEquipId(null); setFEquipNome(''); setFPatrimonio(''); setFSerie('')
    setFAbertDe(''); setFAbertAte(''); setFPrevDe(''); setFPrevAte('')
  }

  const F = (k: string) => ({
    value: form[k] ?? '',
    onChange: (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))
  })

  const hoje = new Date().toISOString().split('T')[0]

  const Th = ({ children, right }: any) => (
    <th style={{ padding:'8px 14px', textAlign: right?'right':'left',
      fontSize:'var(--fs-xs)', fontWeight:600, color:'rgba(255,255,255,0.38)',
      textTransform:'uppercase', letterSpacing:'0.05em',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      background:'rgba(255,255,255,0.03)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  )
  const Td = ({ children, mono, right, muted }: any) => (
    <td style={{ padding:'10px 14px', textAlign:right?'right':'left',
      fontFamily:mono?'var(--font-mono)':undefined,
      color:muted?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.82)',
      borderBottom:'1px solid rgba(255,255,255,0.05)', verticalAlign:'top' }}>
      {children}
    </td>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      <PageHeader title="Manutenções" subtitle="Ordens de serviço de equipamentos"
        actions={<Btn onClick={abrirNovaOS}>+ Nova OS</Btn>} />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
        <Kpi label="Abertas"       value={kpis.abertas}      accent="#f87171" />
        <Kpi label="Em Andamento"  value={kpis.em_andamento} accent="#fbbf24" />
        <Kpi label="Concluídas"    value={kpis.concluidas}   accent="#34d399" />
        <Kpi label="Canceladas"    value={kpis.canceladas}   accent="#94a3b8" />
        <Kpi label="Custo Total"   value={fmt.money(kpis.custo_total)} accent="#818cf8" />
        <Kpi label="Previsão Vencida" value={kpis.vencidas}  accent="#f87171"
          sub={kpis.vencidas > 0 ? 'OS(s) em atraso' : undefined} />
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'14px 16px' }}>

        {/* Linha 1: busca, status, tipo, equipamento */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end', marginBottom:10 }}>

          <div style={{ flex:'1 1 200px', minWidth:160 }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Descrição</div>
            <input value={fBusca} onChange={e=>setFBusca(e.target.value)}
              className={inputCls} placeholder="Buscar na descrição..." style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 140px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Status</div>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className={selectCls} style={{ width:'100%' }}>
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div style={{ flex:'0 1 150px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Tipo</div>
            <select value={fTipo} onChange={e=>setFTipo(e.target.value)} className={selectCls} style={{ width:'100%' }}>
              <option value="">Todos os tipos</option>
              {tipoOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ flex:'1 1 200px', minWidth:180 }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Equipamento</div>
            <LookupField
              placeholder="Filtrar por equipamento..."
              value={fEquipId} displayValue={fEquipNome}
              onChange={(id, row) => { setFEquipId(id as number|null); setFEquipNome(row?.nome ?? '') }}
              table="produtos" searchColumn="nome" extraColumns="marca" filter={{ ativo:1 }}
              renderOption={row => (
                <div>
                  <div style={{ fontWeight:500 }}>{row.nome}</div>
                  {row.marca && <div style={{ fontSize:'var(--fs-sm)', color:'rgba(255,255,255,0.4)' }}>{row.marca}</div>}
                </div>
              )}
            />
          </div>
        </div>

        {/* Linha 2: patrimônio, série, datas */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>

          <div style={{ flex:'0 1 140px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Nº Patrimônio</div>
            <input value={fPatrimonio} onChange={e=>setFPatrimonio(e.target.value)}
              className={inputCls} placeholder="Ex: 00098" style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 150px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Nº Série</div>
            <input value={fSerie} onChange={e=>setFSerie(e.target.value)}
              className={inputCls} placeholder="Número de série" style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Abertura de</div>
            <input type="date" value={fAbertDe} onChange={e=>setFAbertDe(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Abertura até</div>
            <input type="date" value={fAbertAte} onChange={e=>setFAbertAte(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Previsão de</div>
            <input type="date" value={fPrevDe} onChange={e=>setFPrevDe(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Previsão até</div>
            <input type="date" value={fPrevAte} onChange={e=>setFPrevAte(e.target.value)} className={inputCls} style={{ width:'100%' }} />
          </div>

          <button onClick={limparFiltros} style={{ alignSelf:'flex-end', padding:'7px 14px',
            borderRadius:'var(--r-md)', background:'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)',
            fontSize:'var(--fs-md)', cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
            ✕ Limpar
          </button>
        </div>

        {/* Contador de resultados */}
        {!loading && (
          <div style={{ marginTop:10, fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.3)' }}>
            {lista.length} resultado(s)
          </div>
        )}
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
        {loading ? (
          <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
        ) : lista.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-icon">🔩</div>
            <div className="ds-empty-title">Nenhuma manutenção encontrada.</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-md)' }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Equipamento</Th>
                <Th>Patrimônio</Th>
                <Th>Nº Série</Th>
                <Th>Tipo</Th>
                <Th>Descrição</Th>
                <Th>Fornecedor</Th>
                <Th>Abertura</Th>
                <Th>Previsão</Th>
                <Th right>Custo</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {lista.map(m => {
                const prevVencida = m.data_previsao && m.data_previsao < hoje
                  && !['concluido','cancelado'].includes(m.status)
                return (
                  <tr key={m.id}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(129,140,248,0.06)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <Td mono muted>#{m.id}</Td>
                    <Td>
                      <div style={{ fontWeight:600, color:'rgba(255,255,255,0.88)' }}>
                        {(m.produtos as any)?.nome ?? '—'}
                      </div>
                      {(m.produtos as any)?.marca && (
                        <div style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.35)', marginTop:1 }}>
                          {(m.produtos as any).marca}
                        </div>
                      )}
                    </Td>
                    <Td mono muted>{(m.patrimonios as any)?.numero_patrimonio ?? '—'}</Td>
                    <Td mono muted>{(m.patrimonios as any)?.numero_serie ?? '—'}</Td>
                    <Td>
                      <span className="ds-badge ds-badge-blue">{tipoLabel(m.tipo)}</span>
                    </Td>
                    <Td>
                      <span style={{ color:'rgba(255,255,255,0.65)', display:'block',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
                        {m.descricao}
                      </span>
                    </Td>
                    <Td muted>{m.fornecedor || '—'}</Td>
                    <Td muted>{fmt.date(m.data_abertura)}</Td>
                    <Td>
                      <span style={{ color: prevVencida ? 'var(--c-danger)' : 'rgba(255,255,255,0.55)',
                        fontWeight: prevVencida ? 700 : 400 }}>
                        {m.data_previsao ? fmt.date(m.data_previsao) : '—'}
                        {prevVencida && ' ⚠'}
                      </span>
                    </Td>
                    <td style={{ padding:'10px 14px', textAlign:'right',
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                      fontFamily:'var(--font-mono)', fontWeight:600,
                      color: Number(m.custo)>0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}>
                      {Number(m.custo)>0 ? fmt.money(m.custo) : '—'}
                    </td>
                    <Td><Badge value={m.status} dot /></Td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', whiteSpace:'nowrap' }}>
                      {(() => {
                        const sec: AcaoSecundaria[] = []
                        if (m.status === 'aberto' || m.status === 'em_andamento') {
                          sec.push({
                            label:'✅ Concluir OS', onClick:()=>concluir(m), grupo:1
                          })
                          sec.push({
                            label:'✕ Cancelar OS', onClick:()=>cancelar(m), grupo:1, destrutivo:true
                          })
                        }
                        return (
                          <ActionButtons
                            onEdit={() => abrirEditar(m)}
                            acoesSec={sec}
                          />
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Painel Nova / Editar OS ───────────────────────────────────────── */}
      <SlidePanel
        open={panel} onClose={() => setPanel(false)}
        title={editId ? `Editar OS #${editId}` : 'Nova Ordem de Serviço'}
        subtitle="Registro de manutenção de equipamento" width="md"
        footer={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>
              {editId ? '💾 Salvar Alterações' : '✓ Abrir OS'}
            </Btn>
          </div>
        }>

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
                {row.marca && <div style={{ fontSize:'var(--fs-sm)', color:'rgba(255,255,255,0.4)' }}>{row.marca}</div>}
              </div>
            )}
            createPanelTitle="Novo Produto"
            createPanel={({ onClose, onCreated }: any) =>
              <QuickCreateProduto onClose={onClose}
                onCreated={(r:any) => { selecionarProduto(r.id, r); onCreated(r) }} />
            }
          />

          {pats.length > 0 && (
            <LookupField
              label="Patrimônio (opcional)" placeholder="Selecionar patrimônio..."
              value={patrimonioId} displayValue={patrimonioNome}
              onChange={(id, row) => { setPatrimonioId(id as number); setPatrimonioNome(row?.numero_patrimonio ?? '') }}
              table="patrimonios" searchColumn="numero_patrimonio"
              extraColumns="status,numero_serie" filter={{ produto_id: produtoId! }}
              renderOption={row => (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:500 }}>{row.numero_patrimonio}</span>
                  {row.numero_serie && <span style={{ fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.4)' }}>S/N: {row.numero_serie}</span>}
                  <Badge value={row.status} />
                </div>
              )}
            />
          )}

          <div className="form-grid-2">
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
            <textarea {...F('descricao')} rows={3} className={textareaCls}
              placeholder="Descreva o problema ou serviço a realizar..." />
          </FormField>

          {editId && (
            <>
              <FormField label="Diagnóstico">
                <textarea {...F('diagnostico')} rows={2} className={textareaCls}
                  placeholder="Resultado do diagnóstico técnico..." />
              </FormField>
              <FormField label="Solução Aplicada">
                <textarea {...F('solucao')} rows={2} className={textareaCls}
                  placeholder="Descreva a solução aplicada..." />
              </FormField>
            </>
          )}

          <FormField label="Observações Internas">
            <textarea {...F('observacoes')} rows={2} className={textareaCls} />
          </FormField>

        </div>
      </SlidePanel>
    </div>
  )
}
