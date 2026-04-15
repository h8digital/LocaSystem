'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, PageHeader, Tabs, FormField, inputCls, textareaCls, Badge, SlidePanel } from '@/components/ui'

const inpSm = inputCls

// ─── Ícones ──────────────────────────────────────────────────────────────────
const IcoUp    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
const IcoDown  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
const IcoEdit  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

// ─── Cabeçalho de tabela padronizado ─────────────────────────────────────────
const TH = ({ children, center, right }: { children?: React.ReactNode; center?: boolean; right?: boolean }) => (
  <th style={{ padding:'9px 14px', fontSize:'var(--fs-md)', fontWeight:700, color:'var(--t-muted)',
    textTransform:'uppercase' as const, letterSpacing:'.04em',
    textAlign: center ? 'center' as const : right ? 'right' as const : 'left' as const,
    background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
    borderTop:'1px solid var(--border)' }}>{children}</th>
)
const TD = ({ children, center, muted }: { children?: React.ReactNode; center?: boolean; muted?: boolean }) => (
  <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)',
    textAlign: center ? 'center' as const : 'left' as const,
    color: muted ? 'var(--t-muted)' : 'var(--t-primary)',
    fontSize: 'var(--fs-base)' }}>{children}</td>
)


export default function ParametrosPage() {
  const [params,     setParams]     = useState<Record<string,string>>({})
  const [periodos,   setPeriodos]   = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [tiposEnd,   setTiposEnd]   = useState<any[]>([])
  const [locais,     setLocais]     = useState<any[]>([])
  const [saving,     setSaving]     = useState(false)
  const [aba,        setAba]        = useState<string>('empresa')
  const [uploadandoLogo, setUploadandoLogo] = useState(false)
  const [tabelas,       setTabelas]       = useState<any[]>([])
  const [formTabela,    setFormTabela]    = useState({ nome:'', descricao:'', padrao:false })
  const [salvandoTab,   setSalvandoTab]   = useState(false)
  const [erroLogo,       setErroLogo]       = useState('')

  // ── Pesquisa por aba ────────────────────────────────────────────────────────
  const [buscaCat,  setBuscaCat]  = useState('')
  const [buscaEnd,  setBuscaEnd]  = useState('')
  const [buscaLoc,  setBuscaLoc]  = useState('')

  // ── Painéis de edição ───────────────────────────────────────────────────────
  const [painelCat,  setPainelCat]  = useState(false)
  const [painelEnd,  setPainelEnd]  = useState(false)
  const [painelLoc,  setPainelLoc]  = useState(false)
  const [editandoCat, setEditandoCat] = useState<any>(null)
  const [editandoEnd, setEditandoEnd] = useState<any>(null)
  const [editandoLoc, setEditandoLoc] = useState<any>(null)
  const [formCat,  setFormCat]  = useState({ nome:'' })
  const [formEnd,  setFormEnd]  = useState({ nome:'' })
  const [formLoc,  setFormLoc]  = useState({ nome:'', descricao:'' })
  const [salvando, setSalvando] = useState(false)
  const [erroPainel, setErroPainel] = useState('')

  const TABS = [
    { key:'empresa',    label:'Empresa'              },
    { key:'financeiro', label:'Financeiro / SPC'     },
    { key:'periodos',   label:'Períodos'              },
    { key:'categorias', label:'Categorias'            },
    { key:'enderecos',  label:'Tipos de Endereço'    },
    { key:'tabelas',    label:'Tabelas de Preço'       },
    { key:'locais',     label:'Locais de Armazenagem' },
    { key:'contratos',  label:'Contratos' },
  ]

  const CAMPOS_EMPRESA = [
    { k:'empresa_nome',      l:'Nome da Empresa',    full:true,  mono:false },
    { k:'empresa_cnpj',      l:'CNPJ',               full:false, mono:true  },
    { k:'empresa_ie',        l:'Inscrição Estadual',  full:false, mono:true  },
    { k:'empresa_telefone',  l:'Telefone',            full:false, mono:false },
    { k:'empresa_email',     l:'E-mail',              full:true,  mono:false },
  ]

  const CAMPOS_FIN = [
    { k:'multa_atraso_percentual', l:'Multa por Atraso (% ao dia)'          },
    { k:'juros_atraso_percentual', l:'Juros por Atraso (% ao dia)'          },
    { k:'dias_aviso_vencimento',   l:'Dias de Aviso Antes do Vencimento'    },
    { k:'spc_intervalo_dias',      l:'Intervalo Entre Consultas SPC (dias)' },
    { k:'prefixo_contrato',        l:'Prefixo Número de Contrato'           },
    { k:'prefixo_fatura',          l:'Prefixo Número de Fatura'             },
    { k:'moeda_simbolo',           l:'Símbolo da Moeda'                     },
  ]

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data:p }, { data:per }, { data:cat }, { data:te }, { data:lo }] = await Promise.all([
      supabase.from('parametros').select('*'),
      supabase.from('periodos_locacao').select('*').order('dias'),
      supabase.from('categorias').select('*').order('nome'),
      supabase.from('tipos_endereco_cliente').select('*').order('ordem'),
      supabase.from('locais_armazenagem').select('*').order('nome'),
    ])
    const map: Record<string,string> = {}
    p?.forEach(x => { map[x.chave] = x.valor ?? '' })
    setParams(map); setPeriodos(per??[]); setCategorias(cat??[])
    setTiposEnd(te??[]); setLocais(lo??[])
    // Carregar tabelas de preço
    fetch('/api/tabelas-preco').then(r=>r.json()).then(d=>{ if(d.ok) setTabelas(d.data) })
  }

  async function salvar() {
    setSaving(true)
    for (const [chave, valor] of Object.entries(params))
      await supabase.from('parametros').update({ valor }).eq('chave', chave)
    for (const p of periodos)
      if (p.id) await supabase.from('periodos_locacao')
        .update({ nome:p.nome, dias:p.dias, desconto_percentual:p.desconto_percentual, ativo:p.ativo?1:0 }).eq('id',p.id)
    for (const [i,t] of tiposEnd.entries())
      if (t.id) await supabase.from('tipos_endereco_cliente')
        .update({ nome:t.nome, ativo:t.ativo?1:0, ordem:i+1 }).eq('id',t.id)
    setSaving(false)
    alert('Parâmetros salvos com sucesso!')
  }

  // ── Períodos ────────────────────────────────────────────────────────────────
  async function adicionarPeriodo() {
    const { data } = await supabase.from('periodos_locacao')
      .insert({ nome:'Novo Período', dias:30, desconto_percentual:0, ativo:1 }).select().single()
    if (data) setPeriodos(prev => [...prev, data])
  }
  async function removerPeriodo(id:number) {
    if (!confirm('Remover este período?')) return
    await supabase.from('periodos_locacao').delete().eq('id', id)
    setPeriodos(prev => prev.filter(p => p.id !== id))
  }

  // ── Categorias ──────────────────────────────────────────────────────────────
  function abrirCat(cat?: any) {
    setEditandoCat(cat ?? null)
    setFormCat({ nome: cat?.nome ?? '' })
    setErroPainel('')
    setPainelCat(true)
  }
  async function salvarCat() {
    if (!formCat.nome.trim()) { setErroPainel('Nome é obrigatório.'); return }
    setSalvando(true)
    if (editandoCat) {
      await supabase.from('categorias').update({ nome:formCat.nome.trim() }).eq('id', editandoCat.id)
      setCategorias(prev => prev.map(c => c.id===editandoCat.id ? {...c,...formCat} : c))
    } else {
      const { data } = await supabase.from('categorias').insert({ nome:formCat.nome.trim(), ativo:1 }).select().single()
      if (data) setCategorias(prev => [...prev, data])
    }
    setSalvando(false); setPainelCat(false)
  }
  async function toggleCat(id:number, ativo:number) {
    await supabase.from('categorias').update({ ativo:ativo?0:1 }).eq('id',id)
    setCategorias(prev => prev.map(c => c.id===id ? {...c,ativo:ativo?0:1} : c))
  }
  async function removerCat(id:number) {
    if (!confirm('Remover esta categoria?')) return
    await supabase.from('categorias').delete().eq('id',id)
    setCategorias(prev => prev.filter(c => c.id !== id))
  }

  // ── Tipos de Endereço ───────────────────────────────────────────────────────
  function abrirEnd(end?: any) {
    setEditandoEnd(end ?? null)
    setFormEnd({ nome: end?.nome ?? '' })
    setErroPainel('')
    setPainelEnd(true)
  }
  async function salvarEnd() {
    if (!formEnd.nome.trim()) { setErroPainel('Nome é obrigatório.'); return }
    setSalvando(true)
    if (editandoEnd) {
      await supabase.from('tipos_endereco_cliente').update({ nome:formEnd.nome.trim() }).eq('id', editandoEnd.id)
      setTiposEnd(prev => prev.map(t => t.id===editandoEnd.id ? {...t,...formEnd} : t))
    } else {
      const { data } = await supabase.from('tipos_endereco_cliente')
        .insert({ nome:formEnd.nome.trim(), ativo:1, ordem:tiposEnd.length+1 }).select().single()
      if (data) setTiposEnd(prev => [...prev, data])
    }
    setSalvando(false); setPainelEnd(false)
  }
  async function toggleEnd(id:number, ativo:number) {
    await supabase.from('tipos_endereco_cliente').update({ ativo:ativo?0:1 }).eq('id',id)
    setTiposEnd(prev => prev.map(t => t.id===id ? {...t,ativo:ativo?0:1} : t))
  }
  async function removerEnd(id:number) {
    if (!confirm('Remover este tipo de endereço?')) return
    await supabase.from('tipos_endereco_cliente').delete().eq('id',id)
    setTiposEnd(prev => prev.filter(t => t.id !== id))
  }
  function moverEnd(idx:number, dir:-1|1) {
    const arr=[...tiposEnd]; const dest=idx+dir
    if(dest<0||dest>=arr.length) return
    ;[arr[idx],arr[dest]]=[arr[dest],arr[idx]]; setTiposEnd(arr)
  }

  // ── Locais ──────────────────────────────────────────────────────────────────
  function abrirLoc(loc?: any) {
    setEditandoLoc(loc ?? null)
    setFormLoc({ nome:loc?.nome??'', descricao:loc?.descricao??'' })
    setErroPainel('')
    setPainelLoc(true)
  }
  async function salvarLoc() {
    if (!formLoc.nome.trim()) { setErroPainel('Nome é obrigatório.'); return }
    setSalvando(true)
    if (editandoLoc) {
      await supabase.from('locais_armazenagem').update({ nome:formLoc.nome.trim(), descricao:formLoc.descricao||null }).eq('id', editandoLoc.id)
      setLocais(prev => prev.map(l => l.id===editandoLoc.id ? {...l,...formLoc} : l))
    } else {
      const { data } = await supabase.from('locais_armazenagem').insert({ nome:formLoc.nome.trim(), descricao:formLoc.descricao||null, ativo:1 }).select().single()
      if (data) setLocais(prev => [...prev, data])
    }
    setSalvando(false); setPainelLoc(false)
  }
  async function toggleLoc(id:number, ativo:number) {
    await supabase.from('locais_armazenagem').update({ ativo:ativo?0:1 }).eq('id',id)
    setLocais(prev => prev.map(l => l.id===id ? {...l,ativo:ativo?0:1} : l))
  }
  async function removerLoc(id:number) {
    if (!confirm('Remover este local?')) return
    await supabase.from('locais_armazenagem').delete().eq('id',id)
    setLocais(prev => prev.filter(l => l.id !== id))
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const catsFiltradas = categorias.filter(c => !buscaCat || c.nome.toLowerCase().includes(buscaCat.toLowerCase()))
  const endsFiltrados  = tiposEnd.filter(t => !buscaEnd || t.nome.toLowerCase().includes(buscaEnd.toLowerCase()))
  const locaisFiltrados = locais.filter(l => !buscaLoc || l.nome.toLowerCase().includes(buscaLoc.toLowerCase()))

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <PageHeader
        title="Parâmetros do Sistema"
        subtitle="Configurações globais do LocaSystem"
        actions={<Btn loading={saving} onClick={salvar}>Salvar Alterações</Btn>}
      />

      <div className="ds-card" style={{ overflow:'hidden' }}>
        <Tabs tabs={TABS} active={aba} onChange={setAba} />

        <div style={{ padding:'24px' }}>

          {/* ═══ EMPRESA ══════════════════════════════════════════════ */}
          {aba === 'empresa' && (
            <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

              {/* ── Logo ─────────────────────────────────────────────── */}
              <div>
                <div className="ds-section-title">Logotipo</div>
                <div style={{ display:'flex', alignItems:'flex-start', gap:20, marginTop:12 }}>
                  {/* Preview */}
                  <div style={{ width:120, height:80, border:'1px solid var(--border)', borderRadius:'var(--r-md)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--bg-header)', flexShrink:0, overflow:'hidden' }}>
                    {params['empresa_logo_url']
                      ? <img src={params['empresa_logo_url']} alt="Logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                      : <span style={{ fontSize:32, color:'var(--t-muted)' }}>🏢</span>
                    }
                  </div>
                  {/* Upload area */}
                  <div style={{ flex:1 }}>
                    <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:6, border:'2px dashed var(--border)', borderRadius:'var(--r-md)', padding:'16px',
                      cursor:uploadandoLogo?'not-allowed':'pointer', background:'transparent', transition:'border-color 150ms' }}
                      onMouseEnter={e=>{ if(!uploadandoLogo) e.currentTarget.style.borderColor='var(--c-primary)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)' }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        style={{ display:'none' }} disabled={uploadandoLogo}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 2*1024*1024) { setErroLogo('Arquivo excede 2MB'); return }
                          setUploadandoLogo(true); setErroLogo('')
                          const fd = new FormData(); fd.append('file', file)
                          const res  = await fetch('/api/empresa-logo', { method:'POST', body:fd })
                          const data = await res.json()
                          if (data.ok) setParams(p => ({ ...p, empresa_logo_url: data.url }))
                          else setErroLogo(data.error)
                          setUploadandoLogo(false); e.target.value = ''
                        }}
                      />
                      {uploadandoLogo
                        ? <><span style={{ fontSize:24 }}>⏳</span><span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>Enviando...</span></>
                        : <><span style={{ fontSize:24 }}>📷</span>
                          <span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', textAlign:'center' }}>
                            Clique para enviar logo<br/>
                            <span style={{ fontSize:'var(--fs-sm)' }}>PNG, JPG, SVG · até 2MB · fundo transparente recomendado</span>
                          </span></>
                      }
                    </label>
                    {erroLogo && <div style={{ color:'var(--c-danger)', fontSize:'var(--fs-sm)', marginTop:4 }}>{erroLogo}</div>}
                    {params['empresa_logo_url'] && (
                      <button onClick={async()=>{
                          if(!confirm('Remover o logotipo atual?')) return
                          await fetch('/api/empresa-logo', { method:'DELETE' })
                          setParams(p=>({ ...p, empresa_logo_url:'' }))
                        }}
                        style={{ marginTop:8, background:'none', border:'none', color:'var(--c-danger)',
                          fontSize:'var(--fs-sm)', cursor:'pointer', fontWeight:600 }}>
                        ✕ Remover logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Dados Principais ─────────────────────────────────── */}
              <div>
                <div className="ds-section-title">Dados Principais</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:12 }}>
                  {CAMPOS_EMPRESA.map((f:any) => (
                    <div key={f.k} style={{ gridColumn: f.full ? 'span 2' : undefined }}>
                      <FormField label={f.l}>
                        <input value={params[f.k]??''} onChange={e=>setParams(p=>({...p,[f.k]:e.target.value}))}
                          className={inpSm} style={f.mono?{fontFamily:'var(--font-mono)'}:undefined}/>
                      </FormField>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Endereço Desmembrado ──────────────────────────────── */}
              <div>
                <div className="ds-section-title">Endereço</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginTop:12 }}>
                  <FormField label="CEP">
                    <input value={params['empresa_cep']??''} className={inpSm}
                      onChange={e=>setParams(p=>({...p,empresa_cep:e.target.value}))}
                      onBlur={async e=>{
                        const cep=e.target.value.replace(/\D/g,'')
                        if(cep.length!==8) return
                        const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`)
                        const d=await r.json()
                        if(!d.erro) setParams(p=>({...p,
                          empresa_logradouro: d.logradouro??p.empresa_logradouro,
                          empresa_bairro:     d.bairro??p.empresa_bairro,
                          empresa_cidade:     d.localidade??p.empresa_cidade,
                          empresa_estado:     d.uf??p.empresa_estado,
                        }))
                      }}
                      placeholder="00000-000"
                    />
                  </FormField>
                  <div style={{ gridColumn:'span 2' }}>
                    <FormField label="Logradouro">
                      <input value={params['empresa_logradouro']??''} className={inpSm}
                        onChange={e=>setParams(p=>({...p,empresa_logradouro:e.target.value}))}
                        placeholder="Av. Rubem Berta" />
                    </FormField>
                  </div>
                  <FormField label="Número">
                    <input value={params['empresa_numero']??''} className={inpSm}
                      onChange={e=>setParams(p=>({...p,empresa_numero:e.target.value}))} placeholder="495" />
                  </FormField>
                  <div style={{ gridColumn:'span 2' }}>
                    <FormField label="Complemento">
                      <input value={params['empresa_complemento']??''} className={inpSm}
                        onChange={e=>setParams(p=>({...p,empresa_complemento:e.target.value}))} placeholder="Sala 1, 2º Andar..." />
                    </FormField>
                  </div>
                  <FormField label="Bairro">
                    <input value={params['empresa_bairro']??''} className={inpSm}
                      onChange={e=>setParams(p=>({...p,empresa_bairro:e.target.value}))} />
                  </FormField>
                  <div style={{ gridColumn:'span 2' }}>
                    <FormField label="Cidade">
                      <input value={params['empresa_cidade']??''} className={inpSm}
                        onChange={e=>setParams(p=>({...p,empresa_cidade:e.target.value}))} />
                    </FormField>
                  </div>
                  <FormField label="Estado (UF)">
                    <input value={params['empresa_estado']??''} className={inpSm} maxLength={2}
                      onChange={e=>setParams(p=>({...p,empresa_estado:e.target.value.toUpperCase().slice(0,2)}))}
                      placeholder="RS" />
                  </FormField>
                </div>
              </div>

            </div>
          )}




          {/* ══ TABELAS DE PREÇO ═══════════════════════════════════════════ */}
          {aba === 'tabelas' && (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div className="ds-section-title">Tabelas de Preço por Segmento</div>
              <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginTop:-14}}>
                Crie tabelas diferenciadas por tipo de cliente (ex: Padrão, Grandes Construtoras, Parceiros).
                Associe a tabela no cadastro do cliente.
              </div>

              {/* Nova tabela */}
              <div style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:16,display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
                <FormField label="Nome da tabela *" style={{flex:'2 1 160px'}}>
                  <input className={inpSm} value={formTabela.nome}
                    onChange={e=>setFormTabela(f=>({...f,nome:e.target.value}))}
                    placeholder="Ex: Tabela Grandes Construtoras" />
                </FormField>
                <FormField label="Descrição" style={{flex:'3 1 200px'}}>
                  <input className={inpSm} value={formTabela.descricao}
                    onChange={e=>setFormTabela(f=>({...f,descricao:e.target.value}))}
                    placeholder="Uso interno" />
                </FormField>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'var(--fs-md)',paddingBottom:2}}>
                  <input type="checkbox" checked={formTabela.padrao}
                    onChange={e=>setFormTabela(f=>({...f,padrao:e.target.checked}))}
                    style={{accentColor:'var(--c-primary)'}} />
                  Tabela padrão
                </label>
                <Btn size="sm" loading={salvandoTab} onClick={async()=>{
                  if (!formTabela.nome.trim()) return
                  setSalvandoTab(true)
                  const res  = await fetch('/api/tabelas-preco',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formTabela)})
                  const data = await res.json()
                  if (data.ok) {
                    setTabelas((p:any[])=>[...p,data.data])
                    setFormTabela({nome:'',descricao:'',padrao:false})
                  }
                  setSalvandoTab(false)
                }}>+ Criar</Btn>
              </div>

              {/* Lista de tabelas */}
              {tabelas.length === 0
                ? <div style={{textAlign:'center',padding:24,color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Nenhuma tabela cadastrada.</div>
                : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {tabelas.map((t:any)=>(
                      <div key={t.id} style={{border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'12px 16px',
                        display:'flex',justifyContent:'space-between',alignItems:'center',
                        background: t.padrao ? 'var(--c-primary-light,#e8f4f8)' : 'transparent'}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:'var(--fs-base)',display:'flex',alignItems:'center',gap:8}}>
                            {t.nome}
                            {t.padrao && <span style={{fontSize:'var(--fs-xs)',background:'var(--c-primary)',color:'#fff',padding:'2px 8px',borderRadius:'var(--r-sm)',fontWeight:700}}>PADRÃO</span>}
                          </div>
                          {t.descricao && <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginTop:2}}>{t.descricao}</div>}
                          <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:4}}>
                            {(t.tabela_preco_regras ?? []).length} regras de preço configuradas
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          {!t.padrao && (
                            <button onClick={async()=>{
                                await fetch('/api/tabelas-preco',{method:'POST',headers:{'Content-Type':'application/json'},
                                  body:JSON.stringify({nome:t.nome,descricao:t.descricao,padrao:true})})
                                fetch('/api/tabelas-preco').then(r=>r.json()).then(d=>{ if(d.ok) setTabelas(d.data) })
                              }}
                              style={{background:'none',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',
                                padding:'4px 10px',cursor:'pointer',fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>
                              Tornar padrão
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}
          {/* ═══ FINANCEIRO ═══════════════════════════════════════════ */}
          {aba === 'financeiro' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div className="ds-section-title">Regras Financeiras e SPC</div>
              <div className="form-grid-2">
                {CAMPOS_FIN.map(f => (
                  <FormField key={f.k} label={f.l}>
                    <input value={params[f.k]??''} onChange={e=>setParams(p=>({...p,[f.k]:e.target.value}))} className={inpSm}/>
                  </FormField>
                ))}
              </div>
              <div style={{ background:'var(--c-info-light)', border:'1px solid var(--c-info)', borderRadius:'var(--r-md)', padding:'12px 16px', fontSize:'var(--fs-md)', color:'var(--c-info-text)' }}>
                <strong>SPC:</strong> O sistema alertará quando a última consulta do cliente ultrapassar o intervalo configurado.
              </div>
            </div>
          )}

          

          {/* ═══ PERÍODOS ═════════════════════════════════════════════ */}
          {aba === 'periodos' && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div className="ds-section-title" style={{ marginBottom:4 }}>Períodos de Locação</div>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>Usados nos preços dos equipamentos e na criação de contratos.</div>
                </div>
                <Btn size="sm" onClick={adicionarPeriodo}>+ Novo Período</Btn>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <TH>Nome</TH><TH>Dias</TH><TH center>Desconto (%)</TH><TH center>Ativo</TH><TH center>Ações</TH>
                </tr></thead>
                <tbody>
                  {periodos.length === 0 && <tr><td colSpan={5}><div className="ds-empty"><div className="ds-empty-title">Nenhum período cadastrado.</div></div></td></tr>}
                  {periodos.map((p, i) => (
                    <tr key={p.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD><input value={p.nome} onChange={e=>{ const a=[...periodos]; a[i].nome=e.target.value; setPeriodos(a) }} className={inpSm} style={{ minWidth:140 }}/></TD>
                      <TD><input type="number" min="1" value={p.dias} onChange={e=>{ const a=[...periodos]; a[i].dias=Number(e.target.value); setPeriodos(a) }} className={inpSm} style={{ width:80, textAlign:'center' }}/></TD>
                      <TD center><input type="number" min="0" max="100" step="0.01" value={p.desconto_percentual} onChange={e=>{ const a=[...periodos]; a[i].desconto_percentual=Number(e.target.value); setPeriodos(a) }} className={inpSm} style={{ width:90, textAlign:'center' }}/></TD>
                      <TD center>
                        <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer' }}>
                          <input type="checkbox" checked={!!p.ativo} onChange={e=>{ const a=[...periodos]; a[i].ativo=e.target.checked?1:0; setPeriodos(a) }} style={{ width:15, height:15, accentColor:'var(--c-primary)', cursor:'pointer' }}/>
                          <span style={{ fontSize:'var(--fs-md)', fontWeight:600, color:p.ativo?'var(--c-success-text)':'var(--t-muted)' }}>{p.ativo?'Ativo':'Inativo'}</span>
                        </label>
                      </TD>
                      <TD center>
                        <button onClick={()=>removerPeriodo(p.id)} className="tbl-btn del" title="Remover"><IcoTrash/></button>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ background:'var(--c-warning-light)', border:'1px solid var(--c-warning)', borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)', color:'var(--c-warning-text)' }}>
                Clique em <strong>Salvar Alterações</strong> (botão superior) para confirmar as edições dos períodos.
              </div>
            </div>
          )}

          {/* ═══ CATEGORIAS ═══════════════════════════════════════════ */}
          {aba === 'categorias' && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Barra de ação */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaCat} onChange={e=>setBuscaCat(e.target.value)} className={inpSm}
                  placeholder="Pesquisar categorias..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirCat()}>+ Nova Categoria</Btn>
              </div>

              {/* Tabela */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <TH>Nome</TH><TH center>Status</TH><TH center>Ações</TH>
                </tr></thead>
                <tbody>
                  {catsFiltradas.length===0 && <tr><td colSpan={3}><div className="ds-empty"><div className="ds-empty-title">{buscaCat?'Nenhuma categoria encontrada.':'Nenhuma categoria cadastrada.'}</div></div></td></tr>}
                  {catsFiltradas.map((cat,i) => (
                    <tr key={cat.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD><span style={{ fontWeight:500 }}>{cat.nome}</span></TD>
                      <TD center><Badge value={cat.ativo?'ativo':'inativo'} dot/></TD>
                      <TD center>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={()=>abrirCat(cat)} className="tbl-btn edit" title="Editar"><IcoEdit/></button>
                          <button onClick={()=>toggleCat(cat.id,cat.ativo)} className="tbl-btn"
                            title={cat.ativo?'Desativar':'Ativar'}
                            style={{ color:cat.ativo?'var(--c-success)':'var(--t-muted)', fontSize:14, padding:'3px 6px' }}>
                            {cat.ativo?'●':'○'}
                          </button>
                          <button onClick={()=>removerCat(cat.id)} className="tbl-btn del" title="Excluir"><IcoTrash/></button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ TIPOS DE ENDEREÇO ════════════════════════════════════ */}
          {aba === 'enderecos' && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Barra de ação */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaEnd} onChange={e=>setBuscaEnd(e.target.value)} className={inpSm}
                  placeholder="Pesquisar tipos de endereço..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirEnd()}>+ Novo Tipo</Btn>
              </div>

              {/* Tabela */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <TH>Ordem</TH><TH>Nome</TH><TH center>Status</TH><TH center>Ações</TH>
                </tr></thead>
                <tbody>
                  {endsFiltrados.length===0 && <tr><td colSpan={4}><div className="ds-empty"><div className="ds-empty-title">{buscaEnd?'Nenhum tipo encontrado.':'Nenhum tipo de endereço cadastrado.'}</div></div></td></tr>}
                  {endsFiltrados.map((t,i) => (
                    <tr key={t.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD>
                        <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center', width:28 }}>
                          <button onClick={()=>moverEnd(tiposEnd.indexOf(t),-1)} disabled={tiposEnd.indexOf(t)===0}
                            className="tbl-btn" style={{ height:18, padding:'0 4px', opacity:tiposEnd.indexOf(t)===0?0.3:1 }}><IcoUp/></button>
                          <button onClick={()=>moverEnd(tiposEnd.indexOf(t),1)} disabled={tiposEnd.indexOf(t)===tiposEnd.length-1}
                            className="tbl-btn" style={{ height:18, padding:'0 4px', opacity:tiposEnd.indexOf(t)===tiposEnd.length-1?0.3:1 }}><IcoDown/></button>
                        </div>
                      </TD>
                      <TD><span style={{ fontWeight:500 }}>{t.nome}</span></TD>
                      <TD center><Badge value={t.ativo?'ativo':'inativo'} dot/></TD>
                      <TD center>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={()=>abrirEnd(t)} className="tbl-btn edit" title="Editar"><IcoEdit/></button>
                          <button onClick={()=>toggleEnd(t.id,t.ativo)} className="tbl-btn"
                            title={t.ativo?'Desativar':'Ativar'}
                            style={{ color:t.ativo?'var(--c-success)':'var(--t-muted)', fontSize:14, padding:'3px 6px' }}>
                            {t.ativo?'●':'○'}
                          </button>
                          <button onClick={()=>removerEnd(t.id)} className="tbl-btn del" title="Excluir"><IcoTrash/></button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ background:'var(--c-warning-light)', border:'1px solid var(--c-warning)', borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)', color:'var(--c-warning-text)' }}>
                Clique em <strong>Salvar Alterações</strong> (botão superior) para confirmar a nova ordem dos tipos.
              </div>
            </div>
          )}

          {/* ═══ LOCAIS DE ARMAZENAGEM ════════════════════════════════ */}
          {aba === 'locais' && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Barra de ação */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaLoc} onChange={e=>setBuscaLoc(e.target.value)} className={inpSm}
                  placeholder="Pesquisar locais..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirLoc()}>+ Novo Local</Btn>
              </div>

              {/* Tabela */}
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <TH>Nome</TH><TH>Descrição</TH><TH center>Status</TH><TH center>Ações</TH>
                </tr></thead>
                <tbody>
                  {locaisFiltrados.length===0 && <tr><td colSpan={4}><div className="ds-empty"><div className="ds-empty-title">{buscaLoc?'Nenhum local encontrado.':'Nenhum local cadastrado.'}</div></div></td></tr>}
                  {locaisFiltrados.map((l,i) => (
                    <tr key={l.id} style={{ background: i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD><span style={{ fontWeight:500 }}>{l.nome}</span></TD>
                      <TD muted>{l.descricao || '—'}</TD>
                      <TD center><Badge value={l.ativo?'ativo':'inativo'} dot/></TD>
                      <TD center>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={()=>abrirLoc(l)} className="tbl-btn edit" title="Editar"><IcoEdit/></button>
                          <button onClick={()=>toggleLoc(l.id,l.ativo)} className="tbl-btn"
                            title={l.ativo?'Desativar':'Ativar'}
                            style={{ color:l.ativo?'var(--c-success)':'var(--t-muted)', fontSize:14, padding:'3px 6px' }}>
                            {l.ativo?'●':'○'}
                          </button>
                          <button onClick={()=>removerLoc(l.id)} className="tbl-btn del" title="Excluir"><IcoTrash/></button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aba === 'contratos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div className="ds-section-title">Textos e Mensagens do Contrato</div>

              {/* Mensagem de limpeza */}
              <div className="ds-card" style={{ padding:'16px 20px' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-base)', marginBottom:6 }}>
                  🧹 Mensagem de Limpeza dos Equipamentos
                </div>
                <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginBottom:12 }}>
                  Texto exibido no contrato de locação antes das assinaturas. Deixe em branco para não exibir.
                </div>
                <textarea
                  value={params['mensagem_limpeza_contrato'] ?? ''}
                  onChange={e => setParams(p => ({ ...p, mensagem_limpeza_contrato: e.target.value }))}
                  rows={5}
                  className={textareaCls}
                  placeholder="Ex: Prezados clientes, solicitamos gentilmente que os equipamentos sejam devolvidos limpos..."
                  style={{ resize:'vertical' }}
                />
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:6 }}>
                  Este texto aparece em destaque no contrato impresso, logo antes do espaço de assinaturas.
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ── Painel: Categoria ─────────────────────────────────────────────── */}
      <SlidePanel open={painelCat} onClose={()=>setPainelCat(false)}
        title={editandoCat?'Editar Categoria':'Nova Categoria'}
        subtitle="Categorias de equipamentos"
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelCat(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvando} onClick={salvarCat}>{editandoCat?'Salvar Alterações':'Criar Categoria'}</Btn>
          </div>
        }>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <FormField label="Nome da Categoria" required>
          <input value={formCat.nome} onChange={e=>setFormCat({nome:e.target.value})}
            className={inpSm} autoFocus placeholder="Ex: Andaimes, Ferramentas, Geradores..."
            onKeyDown={e=>e.key==='Enter'&&salvarCat()}/>
        </FormField>
      </SlidePanel>

      {/* ── Painel: Tipo de Endereço ──────────────────────────────────────── */}
      <SlidePanel open={painelEnd} onClose={()=>setPainelEnd(false)}
        title={editandoEnd?'Editar Tipo de Endereço':'Novo Tipo de Endereço'}
        subtitle="Tipos disponíveis no cadastro de clientes"
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelEnd(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvando} onClick={salvarEnd}>{editandoEnd?'Salvar Alterações':'Criar Tipo'}</Btn>
          </div>
        }>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <FormField label="Nome do Tipo" required>
          <input value={formEnd.nome} onChange={e=>setFormEnd({nome:e.target.value})}
            className={inpSm} autoFocus placeholder="Ex: Residencial, Comercial, Obra, Praia..."
            onKeyDown={e=>e.key==='Enter'&&salvarEnd()}/>
        </FormField>
      </SlidePanel>

      {/* ── Painel: Local de Armazenagem ──────────────────────────────────── */}
      <SlidePanel open={painelLoc} onClose={()=>setPainelLoc(false)}
        title={editandoLoc?'Editar Local de Armazenagem':'Novo Local de Armazenagem'}
        subtitle="Locais de estoque e patrimônio"
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelLoc(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvando} onClick={salvarLoc}>{editandoLoc?'Salvar Alterações':'Criar Local'}</Btn>
          </div>
        }>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FormField label="Nome do Local" required>
            <input value={formLoc.nome} onChange={e=>setFormLoc(f=>({...f,nome:e.target.value}))}
              className={inpSm} autoFocus placeholder="Ex: Galpão A, Prateleira 01, Depósito..."/>
          </FormField>
          <FormField label="Descrição">
            <input value={formLoc.descricao} onChange={e=>setFormLoc(f=>({...f,descricao:e.target.value}))}
              className={inpSm} placeholder="Localização adicional ou observações (opcional)"/>
          </FormField>
        </div>
      </SlidePanel>

    </div>
  )
}
