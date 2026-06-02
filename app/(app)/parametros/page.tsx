// build: 2026-06-01
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, PageHeader, FormField, inputCls, textareaCls, Badge, SlidePanel } from '@/components/ui'

const inpSm = inputCls

// ─── Ícones ──────────────────────────────────────────────────────────────────
const IcoUp    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
const IcoDown  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
const IcoEdit  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

const TH = ({ children, center, right }: { children?: React.ReactNode; center?: boolean; right?: boolean }) => (
  <th style={{ padding:'9px 14px', fontSize:'var(--fs-md)', fontWeight:700, color:'var(--t-muted)',
    textTransform:'uppercase' as const, letterSpacing:'.04em',
    textAlign: center ? 'center' as const : right ? 'right' as const : 'left' as const,
    background:'var(--bg-header)', borderBottom:'1px solid var(--border)', borderTop:'1px solid var(--border)' }}>{children}</th>
)
const TD = ({ children, center, muted }: { children?: React.ReactNode; center?: boolean; muted?: boolean }) => (
  <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)',
    textAlign: center ? 'center' as const : 'left' as const,
    color: muted ? 'var(--t-muted)' : 'var(--t-primary)', fontSize:'var(--fs-base)' }}>{children}</td>
)

// ─── Componentes de navegação ─────────────────────────────────────────────────
function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
        color: 'var(--t-muted)', padding: '12px 16px 6px', opacity: 0.6 }}>{label}</div>
      {children}
    </div>
  )
}

function NavItem({ id, active, icon, label, onClick }: { id: string; active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 16px', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
      fontSize: 'var(--fs-base)', fontWeight: active ? 600 : 400, textAlign: 'left',
      background: active ? 'rgba(var(--c-primary-rgb,99,102,241),0.12)' : 'transparent',
      color: active ? 'var(--c-primary)' : 'var(--t-secondary)',
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
      {active && <div style={{ marginLeft:'auto', width:3, height:16, borderRadius:2, background:'var(--c-primary)' }} />}
    </button>
  )
}

function SubTabs({ tabs, active, onChange }: { tabs:{key:string;label:string}[]; active:string; onChange:(k:string)=>void }) {
  return (
    <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--border)', marginBottom:24 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding:'8px 16px', border:'none', cursor:'pointer', fontSize:'var(--fs-md)',
          fontWeight: active===t.key ? 600 : 400,
          color: active===t.key ? 'var(--c-primary)' : 'var(--t-muted)',
          background:'transparent',
          borderBottom: active===t.key ? '2px solid var(--c-primary)' : '2px solid transparent',
          marginBottom:-1, transition:'all 0.15s',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: hint ? 4 : 16 }}>
        <div className="ds-section-title">{title}</div>
        {hint && <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginBottom:16, marginTop:4 }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function InfoBox({ type='info', children }: { type?:'info'|'warning'|'success'; children: React.ReactNode }) {
  const styles: Record<string, {bg:string;border:string;color:string}> = {
    info:    { bg:'var(--c-info-light)',    border:'var(--c-info)',    color:'var(--c-info-text)'    },
    warning: { bg:'var(--c-warning-light)', border:'var(--c-warning)', color:'var(--c-warning-text)' },
    success: { bg:'rgba(52,211,153,0.1)',   border:'rgba(52,211,153,0.3)', color:'#34d399'          },
  }
  const s = styles[type]
  return (
    <div style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:'var(--r-md)',
      padding:'10px 14px', fontSize:'var(--fs-md)', color:s.color }}>{children}</div>
  )
}

// ─── Campos fixos ─────────────────────────────────────────────────────────────
const CAMPOS_EMPRESA = [
  { k:'empresa_nome',     l:'Razão Social',         full:true,  mono:false },
  { k:'empresa_cnpj',     l:'CNPJ',                 full:false, mono:true  },
  { k:'empresa_ie',       l:'Inscrição Estadual',   full:false, mono:true  },
  { k:'empresa_telefone', l:'Telefone / WhatsApp',  full:false, mono:false },
  { k:'empresa_whatsapp', l:'Número WhatsApp (DDI)', full:false, mono:true },
  { k:'empresa_email',    l:'E-mail',               full:true,  mono:false },
  { k:'empresa_facebook', l:'Facebook (URL)',       full:true,  mono:false },
  { k:'empresa_instagram',l:'Instagram (URL)',      full:true,  mono:false },
]

export default function ParametrosPage() {
  const [params,      setParams]      = useState<Record<string,string>>({})
  const [periodos,    setPeriodos]    = useState<any[]>([])
  const [categorias,  setCategorias]  = useState<any[]>([])
  const [tiposEnd,    setTiposEnd]    = useState<any[]>([])
  const [locais,      setLocais]      = useState<any[]>([])
  const [saving,      setSaving]      = useState(false)
  const [savingSite,  setSavingSite]  = useState(false)
  const [okSite,      setOkSite]      = useState(false)
  const [okERP,       setOkERP]       = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [erroLogo,    setErroLogo]    = useState('')

  // Navegação — seção principal e sub-aba do Site
  const [secao, setSecao]   = useState('empresa')
  const [subSite, setSubSite] = useState('geral')

  // Pesquisa
  const [buscaCat, setBuscaCat] = useState('')
  const [buscaEnd, setBuscaEnd] = useState('')
  const [buscaLoc, setBuscaLoc] = useState('')

  // Painéis
  const [painelCat, setPainelCat] = useState(false)
  const [painelEnd, setPainelEnd] = useState(false)
  const [painelLoc, setPainelLoc] = useState(false)
  const [editandoCat, setEditandoCat] = useState<any>(null)
  const [editandoEnd, setEditandoEnd] = useState<any>(null)
  const [editandoLoc, setEditandoLoc] = useState<any>(null)
  const [formCat,  setFormCat]  = useState({ nome:'' })
  const [formEnd,  setFormEnd]  = useState({ nome:'' })
  const [formLoc,  setFormLoc]  = useState({ nome:'', descricao:'' })
  const [salvando,    setSalvando]    = useState(false)
  const [erroPainel,  setErroPainel]  = useState('')

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
    p?.forEach((x:any) => { map[x.chave] = x.valor ?? '' })
    const { data: siteConf } = await supabase.from('site_config').select('chave,valor')
    ;(siteConf ?? []).forEach((r:any) => { map[r.chave] = r.valor ?? '' })
    setParams(map); setPeriodos(per??[]); setCategorias(cat??[]); setTiposEnd(te??[]); setLocais(lo??[])
  }

  const getP = (k: string) => params[k] ?? ''
  const setP = (k: string, v: string) => setParams(prev => ({ ...prev, [k]: v }))

  // ── Salvar ERP ────────────────────────────────────────────────────────────
  async function salvarERP() {
    setSaving(true)
    for (const [chave, valor] of Object.entries(params))
      await supabase.from('parametros').update({ valor }).eq('chave', chave)
    for (const p of periodos)
      if (p.id) await supabase.from('periodos_locacao')
        .update({ nome:p.nome, dias:p.dias, desconto_percentual:p.desconto_percentual, ativo:p.ativo?1:0 }).eq('id',p.id)
    for (const [i,t] of tiposEnd.entries())
      if (t.id) await supabase.from('tipos_endereco_cliente')
        .update({ nome:t.nome, ativo:t.ativo?1:0, ordem:i+1 }).eq('id',t.id)
    setSaving(false); setOkERP(true)
    setTimeout(() => setOkERP(false), 3000)
  }

  // ── Salvar Site ───────────────────────────────────────────────────────────
  async function salvarSite() {
    setSavingSite(true); setOkSite(false)
    const chaves = [
      'hero_titulo','hero_subtitulo','hero_cta_texto','hero_cta2_texto',
      'stat_equipamentos','stat_categorias','stat_prazo',
      'quem_somos_historia','quem_somos_missao','quem_somos_visao',
      'contato_subtitulo','rodape_texto','prazo_resposta',
      'horario_seg_sex','horario_sabado','horario_domingo',
      'meta_titulo_home','meta_descricao_home',
      'politica_privacidade',
    ]
    for (const chave of chaves)
      await supabase.from('site_config').upsert({ chave, valor: params[chave] ?? '' }, { onConflict:'chave' })
    setSavingSite(false); setOkSite(true)
    setTimeout(() => setOkSite(false), 3000)
  }

  // ── Uploads ───────────────────────────────────────────────────────────────
  async function uploadContrato(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Selecione um arquivo PDF.'); return }
    if (file.size > 15*1024*1024) { alert('Arquivo excede 15MB.'); return }
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/contrato-pdf', { method:'POST', body:fd })
    const data = await res.json()
    if (!data.ok) { alert('Erro: ' + data.error); return }
    setP('url_contrato_padrao', data.url)
    alert('✅ Contrato atualizado no site!')
  }

  async function uploadHero(file: File) {
    setUploadingHero(true)
    const ext  = file.name.split('.').pop()
    const path = `site/hero-bg.${ext}`
    const { error } = await supabase.storage.from('produto-fotos').upload(path, file, { upsert:true })
    if (error) { alert('Erro: ' + error.message); setUploadingHero(false); return }
    const { data: urlData } = supabase.storage.from('produto-fotos').getPublicUrl(path)
    await supabase.from('site_config').update({ valor: urlData.publicUrl }).eq('chave', 'hero_bg_url')
    setP('hero_bg_url', urlData.publicUrl)
    setUploadingHero(false)
  }

  // ── Períodos ──────────────────────────────────────────────────────────────
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

  // ── Categorias ────────────────────────────────────────────────────────────
  function abrirCat(cat?: any) { setEditandoCat(cat??null); setFormCat({ nome:cat?.nome??'' }); setErroPainel(''); setPainelCat(true) }
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
    setCategorias(prev => prev.filter(c => c.id!==id))
  }

  // ── Tipos de Endereço ─────────────────────────────────────────────────────
  function abrirEnd(end?: any) { setEditandoEnd(end??null); setFormEnd({ nome:end?.nome??'' }); setErroPainel(''); setPainelEnd(true) }
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
    setTiposEnd(prev => prev.filter(t => t.id!==id))
  }
  function moverEnd(idx:number, dir:-1|1) {
    const arr=[...tiposEnd]; const dest=idx+dir
    if(dest<0||dest>=arr.length) return
    ;[arr[idx],arr[dest]]=[arr[dest],arr[idx]]; setTiposEnd(arr)
  }

  // ── Locais ────────────────────────────────────────────────────────────────
  function abrirLoc(loc?: any) { setEditandoLoc(loc??null); setFormLoc({ nome:loc?.nome??'', descricao:loc?.descricao??'' }); setErroPainel(''); setPainelLoc(true) }
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
    setLocais(prev => prev.filter(l => l.id!==id))
  }

  const catsFiltradas  = categorias.filter(c => !buscaCat || c.nome.toLowerCase().includes(buscaCat.toLowerCase()))
  const endsFiltrados  = tiposEnd.filter(t => !buscaEnd || t.nome.toLowerCase().includes(buscaEnd.toLowerCase()))
  const locaisFiltrados = locais.filter(l => !buscaLoc || l.nome.toLowerCase().includes(buscaLoc.toLowerCase()))

  const isERP  = ['empresa','financeiro','contratos'].includes(secao)
  const isSite = secao === 'site'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      <PageHeader
        title="Parâmetros do Sistema"
        subtitle="Configurações globais do LocaSystem"
        actions={
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {okERP  && <span style={{ fontSize:'var(--fs-sm)', color:'#34d399' }}>✅ Salvo</span>}
            {okSite && <span style={{ fontSize:'var(--fs-sm)', color:'#34d399' }}>✅ Site atualizado</span>}
            {isSite
              ? <Btn loading={savingSite} onClick={salvarSite}>Salvar Site</Btn>
              : isERP
                ? <Btn loading={saving} onClick={salvarERP}>Salvar Alterações</Btn>
                : null
            }
          </div>
        }
      />

      {/* Layout de duas colunas: nav lateral + conteúdo */}
      <div style={{ display:'flex', gap:0, minHeight:'calc(100vh - 120px)' }}>

        {/* ── Navegação lateral ──────────────────────────────────────── */}
        <div style={{ width:220, flexShrink:0, borderRight:'1px solid var(--border)',
          background:'var(--bg-header)', padding:'12px 8px', display:'flex', flexDirection:'column', gap:0 }}>

          <NavGroup label="Configurações">
            <NavItem id="empresa"    active={secao==='empresa'}    icon="🏢" label="Empresa"    onClick={()=>setSecao('empresa')} />
            <NavItem id="financeiro" active={secao==='financeiro'} icon="💰" label="Financeiro"  onClick={()=>setSecao('financeiro')} />
            <NavItem id="contratos"  active={secao==='contratos'}  icon="📄" label="Contratos"  onClick={()=>setSecao('contratos')} />
            <NavItem id="site"       active={secao==='site'}       icon="🌐" label="Site Kanoff" onClick={()=>setSecao('site')} />
          </NavGroup>

          <NavGroup label="Cadastros">
            <NavItem id="periodos"   active={secao==='periodos'}   icon="📅" label="Períodos"          onClick={()=>setSecao('periodos')} />
            <NavItem id="categorias" active={secao==='categorias'} icon="🏷️"  label="Categorias"        onClick={()=>setSecao('categorias')} />
            <NavItem id="enderecos"  active={secao==='enderecos'}  icon="📍" label="Tipos de Endereço"  onClick={()=>setSecao('enderecos')} />
            <NavItem id="locais"     active={secao==='locais'}     icon="🏭" label="Locais de Estoque"  onClick={()=>setSecao('locais')} />
                  </NavGroup>
        </div>

        {/* ── Conteúdo ───────────────────────────────────────────────── */}
        <div style={{ flex:1, padding:'28px 32px', overflow:'auto' }}>

          {/* ══ EMPRESA ══════════════════════════════════════════════════ */}
          {secao === 'empresa' && (
            <div style={{ display:'flex', flexDirection:'column', gap:32, maxWidth:760 }}>

              <Section title="Logotipo">
                <div style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
                  <div style={{ width:120, height:80, border:'1px solid var(--border)', borderRadius:'var(--r-md)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--bg-header)', flexShrink:0, overflow:'hidden' }}>
                    {params['empresa_logo_url']
                      ? <img src={params['empresa_logo_url']} alt="Logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                      : <span style={{ fontSize:32, color:'var(--t-muted)' }}>🏢</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:6, border:'2px dashed var(--border)', borderRadius:'var(--r-md)', padding:'16px',
                      cursor:uploadingLogo?'not-allowed':'pointer', background:'transparent', transition:'border-color 150ms' }}
                      onMouseEnter={e=>{ if(!uploadingLogo) e.currentTarget.style.borderColor='var(--c-primary)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)' }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display:'none' }} disabled={uploadingLogo}
                        onChange={async e => {
                          const file = e.target.files?.[0]; if (!file) return
                          if (file.size > 2*1024*1024) { setErroLogo('Arquivo excede 2MB'); return }
                          setUploadingLogo(true); setErroLogo('')
                          const fd = new FormData(); fd.append('file', file)
                          const res  = await fetch('/api/empresa-logo', { method:'POST', body:fd })
                          const data = await res.json()
                          if (data.ok) setParams(p => ({ ...p, empresa_logo_url: data.url }))
                          else setErroLogo(data.error)
                          setUploadingLogo(false); e.target.value = ''
                        }} />
                      {uploadingLogo
                        ? <><span style={{ fontSize:24 }}>⏳</span><span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>Enviando...</span></>
                        : <><span style={{ fontSize:24 }}>📷</span>
                          <span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', textAlign:'center' }}>
                            Clique para enviar logo<br/>
                            <span style={{ fontSize:'var(--fs-sm)' }}>PNG, JPG, SVG · até 2MB</span>
                          </span></>}
                    </label>
                    {erroLogo && <div style={{ color:'var(--c-danger)', fontSize:'var(--fs-sm)', marginTop:4 }}>{erroLogo}</div>}
                    {params['empresa_logo_url'] && (
                      <button onClick={async()=>{ if(!confirm('Remover o logotipo?')) return; await fetch('/api/empresa-logo',{method:'DELETE'}); setParams(p=>({...p,empresa_logo_url:''})) }}
                        style={{ marginTop:8, background:'none', border:'none', color:'var(--c-danger)', fontSize:'var(--fs-sm)', cursor:'pointer', fontWeight:600 }}>
                        ✕ Remover logo
                      </button>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Dados da Empresa">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {CAMPOS_EMPRESA.map((f:any) => (
                    <div key={f.k} style={{ gridColumn: f.full ? 'span 2' : undefined }}>
                      <FormField label={f.l}>
                        <input value={params[f.k]??''} onChange={e=>setParams(p=>({...p,[f.k]:e.target.value}))}
                          className={inpSm} style={f.mono?{fontFamily:'var(--font-mono)'}:undefined}/>
                      </FormField>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Endereço">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
                  <FormField label="CEP">
                    <input value={params['empresa_cep']??''} className={inpSm} placeholder="00000-000"
                      onChange={e=>setParams(p=>({...p,empresa_cep:e.target.value}))}
                      onBlur={async e=>{
                        const cep=e.target.value.replace(/\D/g,''); if(cep.length!==8) return
                        const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); const d=await r.json()
                        if(!d.erro) setParams(p=>({...p,empresa_logradouro:d.logradouro??p.empresa_logradouro,empresa_bairro:d.bairro??p.empresa_bairro,empresa_cidade:d.localidade??p.empresa_cidade,empresa_estado:d.uf??p.empresa_estado}))
                      }} />
                  </FormField>
                  <div style={{ gridColumn:'span 2' }}>
                    <FormField label="Logradouro">
                      <input value={params['empresa_logradouro']??''} className={inpSm} placeholder="Av. Rubem Berta"
                        onChange={e=>setParams(p=>({...p,empresa_logradouro:e.target.value}))} />
                    </FormField>
                  </div>
                  <FormField label="Número">
                    <input value={params['empresa_numero']??''} className={inpSm} placeholder="495"
                      onChange={e=>setParams(p=>({...p,empresa_numero:e.target.value}))} />
                  </FormField>
                  <div style={{ gridColumn:'span 2' }}>
                    <FormField label="Complemento">
                      <input value={params['empresa_complemento']??''} className={inpSm} placeholder="Sala 1..."
                        onChange={e=>setParams(p=>({...p,empresa_complemento:e.target.value}))} />
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
                    <input value={params['empresa_estado']??''} className={inpSm} maxLength={2} placeholder="RS"
                      onChange={e=>setParams(p=>({...p,empresa_estado:e.target.value.toUpperCase().slice(0,2)}))} />
                  </FormField>
                </div>
              </Section>
            </div>
          )}

          {/* ══ FINANCEIRO ═══════════════════════════════════════════════ */}
          {secao === 'financeiro' && (
            <div style={{ display:'flex', flexDirection:'column', gap:32, maxWidth:700 }}>

              <Section title="Multa e Juros por Atraso no Pagamento"
                hint="Aplicados ao registrar pagamento de fatura vencida. Padrão legal: multa 2% + juros 1% a.m.">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <FormField label="Multa por atraso (%)">
                    <input type="number" step="0.01" min="0" max="100"
                      value={params['multa_pagamento_percentual']??'2.00'}
                      onChange={e=>setP('multa_pagamento_percentual', e.target.value)} className={inpSm} />
                  </FormField>
                  <FormField label="Juros de mora (% ao mês)">
                    <input type="number" step="0.01" min="0" max="100"
                      value={params['juros_pagamento_mensal']??'1.00'}
                      onChange={e=>setP('juros_pagamento_mensal', e.target.value)} className={inpSm} />
                  </FormField>
                </div>
                <InfoBox type="info">
                  <strong>Exemplo:</strong> Fatura de R$ 1.000,00 vencida há 15 dias →
                  Multa: R$ {((1000 * Number(params['multa_pagamento_percentual']??2))/100).toFixed(2)} +
                  Juros: R$ {((1000 * Number(params['juros_pagamento_mensal']??1)/100/30)*15).toFixed(2)} =
                  Total: R$ {(1000+(1000*Number(params['multa_pagamento_percentual']??2))/100+(1000*Number(params['juros_pagamento_mensal']??1)/100/30)*15).toFixed(2)}
                </InfoBox>
              </Section>

              <Section title="Aviso de Vencimento e Consulta SPC">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <FormField label="Dias de aviso antes do vencimento">
                    <input value={params['dias_aviso_vencimento']??''}
                      onChange={e=>setP('dias_aviso_vencimento', e.target.value)} className={inpSm} />
                  </FormField>
                  <FormField label="Intervalo entre consultas SPC (dias)">
                    <input value={params['spc_intervalo_dias']??''}
                      onChange={e=>setP('spc_intervalo_dias', e.target.value)} className={inpSm} />
                  </FormField>
                </div>
                <InfoBox type="info">O sistema alertará quando a última consulta do cliente ultrapassar o intervalo configurado.</InfoBox>
              </Section>

              <Section title="Numeração de Documentos">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                  <FormField label="Prefixo do Contrato">
                    <input value={params['prefixo_contrato']??''}
                      onChange={e=>setP('prefixo_contrato', e.target.value)} className={inpSm} placeholder="CTR-" />
                  </FormField>
                  <FormField label="Prefixo da Fatura">
                    <input value={params['prefixo_fatura']??''}
                      onChange={e=>setP('prefixo_fatura', e.target.value)} className={inpSm} placeholder="FAT-" />
                  </FormField>
                  <FormField label="Símbolo da Moeda">
                    <input value={params['moeda_simbolo']??''}
                      onChange={e=>setP('moeda_simbolo', e.target.value)} className={inpSm} placeholder="R$" />
                  </FormField>
                </div>
              </Section>
            </div>
          )}

          {/* ══ CONTRATOS ════════════════════════════════════════════════ */}
          {secao === 'contratos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:32, maxWidth:700 }}>

              <Section title="Multa por Atraso na Devolução"
                hint="Cobrada quando o cliente devolve o equipamento após o prazo contratado.">
                <FormField label="Cobrar multa por devolução em atraso?">
                  <select value={params['multa_entrega_ativo']??'sim'}
                    onChange={e=>setP('multa_entrega_ativo', e.target.value)}
                    className={inpSm} style={{ maxWidth:300 }}>
                    <option value="sim">Sim — cobrar diária por dia de atraso</option>
                    <option value="nao">Não — não cobrar multa</option>
                  </select>
                </FormField>
              </Section>

              <Section title="Mensagem de Limpeza no Contrato"
                hint="Exibida antes das assinaturas no contrato impresso. Deixe vazio para não exibir.">
                <textarea value={params['mensagem_limpeza_contrato']??''}
                  onChange={e=>setP('mensagem_limpeza_contrato', e.target.value)}
                  rows={5} className={textareaCls} style={{ resize:'vertical' }}
                  placeholder="Ex: Solicitamos que os equipamentos sejam devolvidos limpos..." />
              </Section>

              <Section title="Contrato Padrão (Site e QR Code)"
                hint="URL pública para consulta do contrato. Gerada como QR Code nos documentos impressos.">
                <FormField label="URL do Contrato">
                  <input value={params['url_contrato_padrao']??''}
                    onChange={e=>setP('url_contrato_padrao', e.target.value)}
                    className={inpSm} placeholder="https://www.kanoffsolucoes.com.br/contrato" />
                </FormField>
                <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 18px',
                    borderRadius:'var(--r-md)', cursor:'pointer',
                    background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)',
                    color:'#a5b4fc', fontSize:'var(--fs-md)', fontWeight:600 }}>
                    📄 Fazer upload do PDF
                    <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }}
                      onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadContrato(f) }} />
                  </label>
                  {params['url_contrato_padrao'] && (
                    <a href={params['url_contrato_padrao']} target="_blank" rel="noreferrer"
                      style={{ fontSize:'var(--fs-sm)', color:'var(--c-primary)', textDecoration:'underline' }}>
                      Ver contrato atual ↗
                    </a>
                  )}
                </div>
                <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:8 }}>
                  PDF máx. 15MB. O upload atualiza a URL automaticamente.
                </div>
              </Section>
            </div>
          )}

          {/* ══ SITE KANOFF ══════════════════════════════════════════════ */}
          {secao === 'site' && (
            <div style={{ maxWidth:820 }}>
              <SubTabs
                tabs={[
                  { key:'geral',   label:'Geral & Horários'  },
                  { key:'hero',    label:'Hero & Visual'     },
                  { key:'textos',  label:'Textos do Site'    },
                  { key:'seo',     label:'SEO & Legal'       },
                ]}
                active={subSite}
                onChange={setSubSite}
              />

              {/* SUB: GERAL */}
              {subSite === 'geral' && (
                <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                  <Section title="Horário de Funcionamento" hint="Exibido no rodapé do site. Deixe em branco os dias que não atende.">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                      <FormField label="Segunda a Sexta">
                        <input className={inpSm} value={getP('horario_seg_sex')}
                          onChange={e=>setP('horario_seg_sex', e.target.value)} placeholder="Seg–Sex: 08h às 18h" />
                      </FormField>
                      <FormField label="Sábado">
                        <input className={inpSm} value={getP('horario_sabado')}
                          onChange={e=>setP('horario_sabado', e.target.value)} placeholder="Sáb: 08h às 12h" />
                      </FormField>
                      <FormField label="Domingo">
                        <input className={inpSm} value={getP('horario_domingo')}
                          onChange={e=>setP('horario_domingo', e.target.value)} placeholder="Fechado" />
                      </FormField>
                    </div>
                  </Section>

                  <Section title="Estatísticas do Hero" hint="Números exibidos na seção principal da home.">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                      <FormField label="Equipamentos"><input className={inpSm} value={getP('stat_equipamentos')} onChange={e=>setP('stat_equipamentos',e.target.value)} placeholder="54+" /></FormField>
                      <FormField label="Categorias"><input className={inpSm} value={getP('stat_categorias')} onChange={e=>setP('stat_categorias',e.target.value)} placeholder="10" /></FormField>
                      <FormField label="Prazo de Resposta"><input className={inpSm} value={getP('stat_prazo')} onChange={e=>setP('stat_prazo',e.target.value)} placeholder="2h" /></FormField>
                    </div>
                  </Section>


                  <Section title="Imagem de Fundo (Background)" hint="Deixe vazio para usar as partículas animadas. Recomendado: 1920×1080px, JPG ou WebP.">
                    {getP('hero_bg_url') && (
                      <div style={{ position:'relative', borderRadius:'var(--r-md)', overflow:'hidden', height:140, marginBottom:12 }}>
                        <img src={getP('hero_bg_url')} alt="Hero BG" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ color:'#fff', fontSize:13 }}>Fundo atual</span>
                        </div>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 18px',
                        borderRadius:'var(--r-md)', cursor:'pointer',
                        background:'rgba(129,140,248,0.15)', border:'1px solid rgba(129,140,248,0.35)',
                        color:'#a5b4fc', fontSize:'var(--fs-md)', fontWeight:600 }}>
                        {uploadingHero ? '⏳ Enviando...' : '📸 Enviar imagem'}
                        <input type="file" accept="image/*" style={{ display:'none' }}
                          onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadHero(f) }} disabled={uploadingHero} />
                      </label>
                      {getP('hero_bg_url') && (
                        <button onClick={()=>setP('hero_bg_url','')}
                          style={{ padding:'9px 16px', borderRadius:'var(--r-md)',
                            background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)',
                            color:'#f87171', fontSize:'var(--fs-sm)', cursor:'pointer', fontWeight:600 }}>
                          Remover imagem
                        </button>
                      )}
                    </div>
                  </Section>
                </div>
              )}

              {/* SUB: TEXTOS */}
              {subSite === 'textos' && (
                <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                  <Section title="Página: Quem Somos">
                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                      <FormField label="Texto da história">
                        <textarea className={inpSm} rows={4} value={getP('quem_somos_historia')}
                          onChange={e=>setP('quem_somos_historia',e.target.value)}
                          placeholder="Conte a história da empresa..." style={{ resize:'vertical' }} />
                      </FormField>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <FormField label="Missão">
                          <textarea className={inpSm} rows={3} value={getP('quem_somos_missao')}
                            onChange={e=>setP('quem_somos_missao',e.target.value)}
                            placeholder="Nossa missão é..." style={{ resize:'vertical' }} />
                        </FormField>
                        <FormField label="Visão">
                          <textarea className={inpSm} rows={3} value={getP('quem_somos_visao')}
                            onChange={e=>setP('quem_somos_visao',e.target.value)}
                            placeholder="Nossa visão é..." style={{ resize:'vertical' }} />
                        </FormField>
                      </div>
                    </div>
                  </Section>

                  <Section title="Página: Contato">
                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                      <FormField label="Subtítulo">
                        <input className={inpSm} value={getP('contato_subtitulo')}
                          onChange={e=>setP('contato_subtitulo',e.target.value)}
                          placeholder="Respondemos em até 2 horas úteis..." />
                      </FormField>
                      <FormField label="Prazo de resposta exibido">
                        <input className={inpSm} value={getP('prazo_resposta')}
                          onChange={e=>setP('prazo_resposta',e.target.value)} placeholder="2 horas úteis" />
                      </FormField>
                    </div>
                  </Section>

                  <Section title="Rodapé">
                    <FormField label="Texto descritivo">
                      <input className={inpSm} value={getP('rodape_texto')}
                        onChange={e=>setP('rodape_texto',e.target.value)}
                        placeholder="Soluções completas em locação..." />
                    </FormField>
                  </Section>
                </div>
              )}

              {/* SUB: SEO & LEGAL */}
              {subSite === 'seo' && (
                <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                  <Section title="SEO — Página Inicial" hint="Aparecem nos resultados do Google ao buscar pelo site.">
                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                      <FormField label={`Meta Title (${getP('meta_titulo_home').length}/70 caracteres)`}>
                        <input className={inpSm} value={getP('meta_titulo_home')}
                          onChange={e=>setP('meta_titulo_home', e.target.value.slice(0,70))}
                          placeholder="Kanoff Soluções — Locação de Equipamentos em Sapucaia do Sul" />
                      </FormField>
                      <FormField label={`Meta Description (${getP('meta_descricao_home').length}/160 caracteres)`}>
                        <textarea className={inpSm} rows={3} value={getP('meta_descricao_home')}
                          onChange={e=>setP('meta_descricao_home', e.target.value.slice(0,160))}
                          placeholder="Alugue andaimes, betoneiras e equipamentos. Cotação online rápida."
                          style={{ resize:'vertical' }} />
                      </FormField>
                    </div>
                    <div style={{ marginTop:12 }}>
                      <InfoBox type="info">
                        <strong>Preview Google</strong><br/>
                        <span style={{ color:'#8ab4f8', fontSize:18 }}>{getP('meta_titulo_home') || 'Meta Title aqui'}</span><br/>
                        <span style={{ color:'#3c4043', fontSize:13 }}>kanoffsolucoes.com.br</span><br/>
                        <span style={{ fontSize:14 }}>{getP('meta_descricao_home') || 'Meta description aqui...'}</span>
                      </InfoBox>
                    </div>
                  </Section>

                  <Section title="Política de Privacidade"
                    hint="Conteúdo exibido em kanoffsolucoes.com.br/politica-de-privacidade. Aceita HTML (h2, p, ul, li, strong).">
                    <textarea className={inpSm} rows={22} value={getP('politica_privacidade')}
                      onChange={e=>setP('politica_privacidade', e.target.value)}
                      placeholder="<h2>1. Informações que Coletamos</h2>&#10;<p>...</p>"
                      style={{ resize:'vertical', fontFamily:'var(--font-mono)', fontSize:12 }} />
                  </Section>
                </div>
              )}
            </div>
          )}

          {/* ══ PERÍODOS ═════════════════════════════════════════════════ */}
          {secao === 'periodos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:720 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div className="ds-section-title" style={{ marginBottom:4 }}>Períodos de Locação</div>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>Usados nos preços dos equipamentos e contratos.</div>
                </div>
                <Btn size="sm" onClick={adicionarPeriodo}>+ Novo Período</Btn>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><TH>Nome</TH><TH>Dias</TH><TH center>Desconto (%)</TH><TH center>Ativo</TH><TH center>Ações</TH></tr></thead>
                <tbody>
                  {periodos.length===0 && <tr><td colSpan={5}><div className="ds-empty"><div className="ds-empty-title">Nenhum período cadastrado.</div></div></td></tr>}
                  {periodos.map((p,i)=>(
                    <tr key={p.id} style={{ background:i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD><input value={p.nome} onChange={e=>{const a=[...periodos];a[i].nome=e.target.value;setPeriodos(a)}} className={inpSm} style={{ minWidth:140 }}/></TD>
                      <TD><input type="number" min="1" value={p.dias} onChange={e=>{const a=[...periodos];a[i].dias=Number(e.target.value);setPeriodos(a)}} className={inpSm} style={{ width:80, textAlign:'center' }}/></TD>
                      <TD center><input type="number" min="0" max="100" step="0.01" value={p.desconto_percentual} onChange={e=>{const a=[...periodos];a[i].desconto_percentual=Number(e.target.value);setPeriodos(a)}} className={inpSm} style={{ width:90, textAlign:'center' }}/></TD>
                      <TD center>
                        <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer' }}>
                          <input type="checkbox" checked={!!p.ativo} onChange={e=>{const a=[...periodos];a[i].ativo=e.target.checked?1:0;setPeriodos(a)}} style={{ width:15, height:15, accentColor:'var(--c-primary)', cursor:'pointer' }}/>
                          <span style={{ fontSize:'var(--fs-md)', fontWeight:600, color:p.ativo?'var(--c-success-text)':'var(--t-muted)' }}>{p.ativo?'Ativo':'Inativo'}</span>
                        </label>
                      </TD>
                      <TD center><button onClick={()=>removerPeriodo(p.id)} className="tbl-btn del" title="Remover"><IcoTrash/></button></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
              <InfoBox type="warning">Clique em <strong>Salvar Alterações</strong> (botão superior direito) para confirmar.</InfoBox>
            </div>
          )}

          {/* ══ CATEGORIAS ═══════════════════════════════════════════════ */}
          {secao === 'categorias' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:620 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaCat} onChange={e=>setBuscaCat(e.target.value)} className={inpSm}
                  placeholder="Pesquisar categorias..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirCat()}>+ Nova Categoria</Btn>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><TH>Nome</TH><TH center>Status</TH><TH center>Ações</TH></tr></thead>
                <tbody>
                  {catsFiltradas.length===0 && <tr><td colSpan={3}><div className="ds-empty"><div className="ds-empty-title">{buscaCat?'Nenhuma encontrada.':'Nenhuma categoria cadastrada.'}</div></div></td></tr>}
                  {catsFiltradas.map((cat,i)=>(
                    <tr key={cat.id} style={{ background:i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
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

          {/* ══ TIPOS DE ENDEREÇO ════════════════════════════════════════ */}
          {secao === 'enderecos' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:620 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaEnd} onChange={e=>setBuscaEnd(e.target.value)} className={inpSm}
                  placeholder="Pesquisar..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirEnd()}>+ Novo Tipo</Btn>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><TH>Ordem</TH><TH>Nome</TH><TH center>Status</TH><TH center>Ações</TH></tr></thead>
                <tbody>
                  {endsFiltrados.length===0 && <tr><td colSpan={4}><div className="ds-empty"><div className="ds-empty-title">{buscaEnd?'Nenhum encontrado.':'Nenhum tipo cadastrado.'}</div></div></td></tr>}
                  {endsFiltrados.map((t,i)=>(
                    <tr key={t.id} style={{ background:i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD>
                        <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center', width:28 }}>
                          <button onClick={()=>moverEnd(tiposEnd.indexOf(t),-1)} disabled={tiposEnd.indexOf(t)===0} className="tbl-btn" style={{ height:18, padding:'0 4px', opacity:tiposEnd.indexOf(t)===0?0.3:1 }}><IcoUp/></button>
                          <button onClick={()=>moverEnd(tiposEnd.indexOf(t),1)} disabled={tiposEnd.indexOf(t)===tiposEnd.length-1} className="tbl-btn" style={{ height:18, padding:'0 4px', opacity:tiposEnd.indexOf(t)===tiposEnd.length-1?0.3:1 }}><IcoDown/></button>
                        </div>
                      </TD>
                      <TD><span style={{ fontWeight:500 }}>{t.nome}</span></TD>
                      <TD center><Badge value={t.ativo?'ativo':'inativo'} dot/></TD>
                      <TD center>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={()=>abrirEnd(t)} className="tbl-btn edit" title="Editar"><IcoEdit/></button>
                          <button onClick={()=>toggleEnd(t.id,t.ativo)} className="tbl-btn" title={t.ativo?'Desativar':'Ativar'} style={{ color:t.ativo?'var(--c-success)':'var(--t-muted)', fontSize:14, padding:'3px 6px' }}>{t.ativo?'●':'○'}</button>
                          <button onClick={()=>removerEnd(t.id)} className="tbl-btn del" title="Excluir"><IcoTrash/></button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
              <InfoBox type="warning">Clique em <strong>Salvar Alterações</strong> para confirmar a nova ordem.</InfoBox>
            </div>
          )}

          {/* ══ LOCAIS ═══════════════════════════════════════════════════ */}
          {secao === 'locais' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:680 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input value={buscaLoc} onChange={e=>setBuscaLoc(e.target.value)} className={inpSm}
                  placeholder="Pesquisar locais..." style={{ flex:1, maxWidth:300 }}/>
                <Btn size="sm" onClick={()=>abrirLoc()}>+ Novo Local</Btn>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><TH>Nome</TH><TH>Descrição</TH><TH center>Status</TH><TH center>Ações</TH></tr></thead>
                <tbody>
                  {locaisFiltrados.length===0 && <tr><td colSpan={4}><div className="ds-empty"><div className="ds-empty-title">{buscaLoc?'Nenhum encontrado.':'Nenhum local cadastrado.'}</div></div></td></tr>}
                  {locaisFiltrados.map((l,i)=>(
                    <tr key={l.id} style={{ background:i%2===0?'var(--bg-card)':'var(--bg-header)' }}>
                      <TD><span style={{ fontWeight:500 }}>{l.nome}</span></TD>
                      <TD muted>{l.descricao||'—'}</TD>
                      <TD center><Badge value={l.ativo?'ativo':'inativo'} dot/></TD>
                      <TD center>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={()=>abrirLoc(l)} className="tbl-btn edit" title="Editar"><IcoEdit/></button>
                          <button onClick={()=>toggleLoc(l.id,l.ativo)} className="tbl-btn" title={l.ativo?'Desativar':'Ativar'} style={{ color:l.ativo?'var(--c-success)':'var(--t-muted)', fontSize:14, padding:'3px 6px' }}>{l.ativo?'●':'○'}</button>
                          <button onClick={()=>removerLoc(l.id)} className="tbl-btn del" title="Excluir"><IcoTrash/></button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* ── Painéis ───────────────────────────────────────────────────── */}
      <SlidePanel open={painelCat} onClose={()=>setPainelCat(false)} title={editandoCat?'Editar Categoria':'Nova Categoria'} subtitle="Categorias de equipamentos" width="sm"
        footer={<div className="panel-footer-2btn"><Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelCat(false)}>Cancelar</Btn><Btn style={{ flex:2 }} loading={salvando} onClick={salvarCat}>{editandoCat?'Salvar':'Criar'}</Btn></div>}>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <FormField label="Nome da Categoria" required>
          <input value={formCat.nome} onChange={e=>setFormCat({nome:e.target.value})} className={inpSm} autoFocus placeholder="Ex: Andaimes, Ferramentas..." onKeyDown={e=>e.key==='Enter'&&salvarCat()}/>
        </FormField>
      </SlidePanel>

      <SlidePanel open={painelEnd} onClose={()=>setPainelEnd(false)} title={editandoEnd?'Editar Tipo de Endereço':'Novo Tipo de Endereço'} subtitle="Tipos no cadastro de clientes" width="sm"
        footer={<div className="panel-footer-2btn"><Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelEnd(false)}>Cancelar</Btn><Btn style={{ flex:2 }} loading={salvando} onClick={salvarEnd}>{editandoEnd?'Salvar':'Criar'}</Btn></div>}>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <FormField label="Nome do Tipo" required>
          <input value={formEnd.nome} onChange={e=>setFormEnd({nome:e.target.value})} className={inpSm} autoFocus placeholder="Ex: Residencial, Comercial, Obra..." onKeyDown={e=>e.key==='Enter'&&salvarEnd()}/>
        </FormField>
      </SlidePanel>

      <SlidePanel open={painelLoc} onClose={()=>setPainelLoc(false)} title={editandoLoc?'Editar Local de Armazenagem':'Novo Local de Armazenagem'} subtitle="Locais de estoque e patrimônio" width="sm"
        footer={<div className="panel-footer-2btn"><Btn variant="secondary" style={{ flex:1 }} onClick={()=>setPainelLoc(false)}>Cancelar</Btn><Btn style={{ flex:2 }} loading={salvando} onClick={salvarLoc}>{editandoLoc?'Salvar':'Criar'}</Btn></div>}>
        {erroPainel&&<div className="ds-alert-error" style={{ marginBottom:14 }}>{erroPainel}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <FormField label="Nome do Local" required>
            <input value={formLoc.nome} onChange={e=>setFormLoc(f=>({...f,nome:e.target.value}))} className={inpSm} autoFocus placeholder="Ex: Galpão A, Prateleira 01..."/>
          </FormField>
          <FormField label="Descrição">
            <input value={formLoc.descricao} onChange={e=>setFormLoc(f=>({...f,descricao:e.target.value}))} className={inpSm} placeholder="Localização ou observações (opcional)"/>
          </FormField>
        </div>
      </SlidePanel>
    </div>
  )
}
