'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, DataTable, Badge, ActionButtons, Btn, SlidePanel, FormField, inputCls, selectCls, Tabs } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'
import dynamic from 'next/dynamic'

// Carregar editor dinamicamente (evita SSR issues)
const RichEditor = dynamic(() => import('@/components/ui/RichEditor'), { ssr: false, loading: () => <div className="border border-gray-200 rounded-xl p-8 text-center text-muted-color">⏳ Carregando editor visual...</div> })

const TIPOS = [
  { value:'contrato', label:'Contrato de Locação',    icon:'📄' },
  { value:'fatura',   label:'Fatura / Cobrança',      icon:'🧾' },
  { value:'recibo',   label:'Recibo',                 icon:'✅' },
  { value:'termo',    label:'Termo / Declaração',     icon:'📋' },
  { value:'carta',    label:'Carta / Comunicado',     icon:'✉️' },
  { value:'outro',    label:'Outro Documento',        icon:'📎' },
  { value:'promissoria', label:'Nota Promissória',       icon:'📝' },
]

const TAGS = [
  { grupo:'🏢 Empresa', tags:[
    {tag:'{{empresa_nome}}',desc:'Nome da empresa'},
    {tag:'{{empresa_cnpj}}',desc:'CNPJ'},
    {tag:'{{empresa_telefone}}',desc:'Telefone'},
    {tag:'{{empresa_email}}',desc:'E-mail'},
    {tag:'{{empresa_endereco}}',desc:'Endereço'},
    {tag:'{{empresa_cidade}}',desc:'Cidade'},
  ]},
  {grupo:'👥 Cliente', tags:[
    {tag:'{{cliente_nome}}',desc:'Nome/Razão Social'},
    {tag:'{{cliente_cpf_cnpj}}',desc:'CPF ou CNPJ'},
    {tag:'{{cliente_tipo_doc}}',desc:'Tipo: CPF/CNPJ'},
    {tag:'{{cliente_email}}',desc:'E-mail'},
    {tag:'{{cliente_telefone}}',desc:'Telefone'},
    {tag:'{{cliente_endereco_completo}}',desc:'Endereço completo'},
  ]},
  {grupo:'📄 Contrato', tags:[
    {tag:'{{contrato_numero}}',desc:'Nº contrato'},
    {tag:'{{contrato_data_inicio}}',desc:'Data início'},
    {tag:'{{contrato_data_fim}}',desc:'Data fim'},
    {tag:'{{contrato_dias}}',desc:'Duração (dias)'},
    {tag:'{{contrato_subtotal}}',desc:'Subtotal'},
    {tag:'{{contrato_desconto}}',desc:'Desconto'},
    {tag:'{{contrato_acrescimo}}',desc:'Acréscimo'},
    {tag:'{{contrato_total}}',desc:'Total'},
    {tag:'{{contrato_frete}}',desc:'Frete'},
    {tag:'{{contrato_caucao}}',desc:'Caução'},
    {tag:'{{contrato_forma_pagamento}}',desc:'Forma pag.'},
    {tag:'{{contrato_observacoes}}',desc:'Observações'},
    {tag:'{{itens_tabela}}',desc:'🔴 Tabela de itens (HTML)'},
  ]},
  {grupo:'🧾 Fatura', tags:[
    {tag:'{{fatura_numero}}',desc:'Nº da fatura'},
    {tag:'{{fatura_vencimento}}',desc:'Vencimento'},
    {tag:'{{fatura_valor}}',desc:'Valor'},
    {tag:'{{fatura_status}}',desc:'Status'},
  ]},
  {grupo:'📅 Datas', tags:[
    {tag:'{{data_geracao}}',desc:'Data atual'},
    {tag:'{{hora_geracao}}',desc:'Hora atual'},
  ]},
  {grupo:'📝 Nota Promissória', tags:[
    {tag:'{{promissoria_itens}}',       desc:'Tabela de itens com custo de reposição (HTML)'},
    {tag:'{{promissoria_total}}',       desc:'Total da nota promissória (soma dos custos de reposição)'},
    {tag:'{{promissoria_valor_extenso}}',desc:'Valor total por extenso'},
  ]},
  {grupo:'💰 Parâmetros', tags:[
    {tag:'{{multa_atraso_percentual}}',desc:'% multa atraso'},
    {tag:'{{multa_por_dia}}',desc:'Valor da multa por dia de atraso (soma das diárias)'},
  ]},
]

export default function TemplatesPage() {
  const [lista, setLista]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [panel, setPanel]         = useState(false)
  const [editId, setEditId]       = useState<number|null>(null)
  const [saving, setSaving]       = useState(false)
  const [erro, setErro]           = useState('')
  const [editorTab, setEditorTab] = useState<'visual'|'html'|'docx'>('visual')
  const [tagGrupo, setTagGrupo]   = useState(0)
  const [preview, setPreview]     = useState(false)
  const [uploadingDocx, setUploadingDocx] = useState(false)
  const insertTagRef = useRef<((tag: string) => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<any>({
    nome:'', tipo:'contrato', descricao:'', conteudo:'',
    css_customizado:'', ativo:1, padrao:0, tipo_editor:'visual', docx_base64:''
  })

  async function load() {
    setLoading(true)
    const {data} = await supabase.from('doc_templates').select('*').order('tipo').order('padrao',{ascending:false}).order('nome')
    setLista(data??[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  function abrir(t?: any) {
    setErro(''); setPreview(false)
    if(t) {
      setForm({...t})
      setEditorTab(t.tipo_editor ?? 'visual')
      setEditId(t.id)
    } else {
      setForm({ nome:'', tipo:'contrato', descricao:'', conteudo:'', css_customizado:'', ativo:1, padrao:0, tipo_editor:'visual', docx_base64:'' })
      setEditorTab('visual')
      setEditId(null)
    }
    setPanel(true)
  }

  async function salvar() {
    if(!form.nome?.trim()||!form.conteudo?.trim()){setErro('Nome e conteúdo são obrigatórios.');return}
    setSaving(true); setErro('')
    const payload = { nome:form.nome, tipo:form.tipo, descricao:form.descricao||null, conteudo:form.conteudo, css_customizado:form.css_customizado||null, ativo:Number(form.ativo), padrao:Number(form.padrao), tipo_editor:form.tipo_editor||'visual', docx_base64:form.docx_base64||null, updated_at:new Date().toISOString() }
    const {error} = editId ? await supabase.from('doc_templates').update(payload).eq('id',editId) : await supabase.from('doc_templates').insert(payload)
    if(error){setErro('Erro: '+error.message);setSaving(false);return}
    setSaving(false); setPanel(false); load()
  }

  async function duplicar(t: any) {
    await supabase.from('doc_templates').insert({...t,id:undefined,nome:`${t.nome} (cópia)`,padrao:0,created_at:undefined,updated_at:undefined})
    load()
  }

  async function excluir(id: number) {
    if(!confirm('Excluir este template?'))return
    await supabase.from('doc_templates').delete().eq('id',id); load()
  }

  // Upload de DOCX
  async function handleDocxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if(!file) return
    setUploadingDocx(true); setErro('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/templates/upload-docx', { method:'POST', body:formData })
      const result = await res.json()
      if(!result.ok) throw new Error(result.error)

      // Salvar o DOCX em base64 também para geração futura
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1]
        setForm((f:any)=>({ ...f, conteudo:result.html, docx_base64:b64, tipo_editor:'docx' }))
        setEditorTab('visual')
      }
      reader.readAsDataURL(file)

      if(result.warnings?.length) {
        setErro(`Importado com avisos: ${result.warnings.map((w:any)=>w.message).join('; ')}`)
      }
    } catch(e:any) {
      setErro('Erro ao importar DOCX: ' + e.message)
    }
    setUploadingDocx(false)
    if(fileInputRef.current) fileInputRef.current.value = ''
  }

  function inserirTag(tag: string) {
    if(editorTab === 'visual' && insertTagRef.current) {
      insertTagRef.current(tag)
    } else {
      // Inserir no textarea HTML
      const ta = document.getElementById('html-editor') as HTMLTextAreaElement
      if(!ta) { setForm((f:any)=>({...f,conteudo:(f.conteudo||'')+tag})); return }
      const s=ta.selectionStart, e=ta.selectionEnd
      const novo = form.conteudo.substring(0,s)+tag+form.conteudo.substring(e)
      setForm((f:any)=>({...f,conteudo:novo}))
      setTimeout(()=>{ta.focus();ta.setSelectionRange(s+tag.length,s+tag.length)},10)
    }
  }

  const handleInsertTag = useCallback((fn: (tag: string) => void) => {
    insertTagRef.current = fn
  }, [])

  const tipoLabel = (t:string) => TIPOS.find(x=>x.value===t)?.label??t
  const tipoIcon  = (t:string) => TIPOS.find(x=>x.value===t)?.icon??'📄'

  const editorTabs = [
    {key:'visual', label:'Editor Visual', icon:'🖊️'},
    {key:'html',   label:'HTML Direto',   icon:'</>'},
    {key:'docx',   label:'Importar Word', icon:'📁'},
  ]

  // Prévia com dados fictícios
  const DADOS_FICTICIOS: Record<string,string> = {
    '{{empresa_nome}}':'Locadora Kanoff Ltda','{{empresa_cnpj}}':'12.345.678/0001-90','{{empresa_telefone}}':'(11) 99999-9999','{{empresa_email}}':'contato@locadora.com','{{empresa_endereco}}':'Rua das Ferramentas, 123 — São Paulo/SP','{{empresa_cidade}}':'São Paulo','{{cliente_nome}}':'João da Silva','{{cliente_cpf_cnpj}}':'123.456.789-00','{{cliente_tipo_doc}}':'CPF','{{cliente_email}}':'joao@email.com','{{cliente_telefone}}':'(11) 98888-7777','{{cliente_endereco_completo}}':'Av. Paulista, 1000 — São Paulo/SP','{{contrato_numero}}':'LOC2024000001','{{contrato_data_inicio}}':'01/03/2024','{{contrato_data_fim}}':'31/03/2024','{{contrato_dias}}':'30','{{contrato_subtotal}}':'R$ 1.500,00','{{contrato_desconto}}':'R$ 0,00','{{contrato_acrescimo}}':'R$ 0,00','{{contrato_total}}':'R$ 1.500,00','{{contrato_caucao}}':'R$ 500,00','{{contrato_forma_pagamento}}':'PIX','{{contrato_observacoes}}':'Entregar na obra.','{{fatura_numero}}':'FAT2024000001','{{fatura_vencimento}}':'31/03/2024','{{fatura_valor}}':'R$ 1.500,00','{{fatura_status}}':'Pendente','{{multa_atraso_percentual}}':'2','{{data_geracao}}':new Date().toLocaleDateString('pt-BR'),'{{hora_geracao}}':new Date().toLocaleTimeString('pt-BR'),'{{itens_tabela}}':'<tr><td>1</td><td>Andaime Tubular 1,5m <small>(PAT001)</small></td><td style="text-align:center">5</td><td style="text-align:right">R$ 50,00</td><td style="text-align:right">R$ 250,00</td></tr><tr><td>2</td><td>Gerador 5KVA <small>(PAT002)</small></td><td style="text-align:center">1</td><td style="text-align:right">R$ 1.250,00</td><td style="text-align:right">R$ 1.250,00</td></tr>',
  }

  function renderPreview() {
    let html = form.conteudo||''
    Object.entries(DADOS_FICTICIOS).forEach(([k,v])=>{ html=html.replaceAll(k,v) })
    return html
  }

  return (
    <div>
      <PageHeader
        title="Templates de Documentos"
        subtitle={`${lista.length} template(s) — Contratos, Faturas, Recibos e mais`}
        actions={<Btn icon="+" onClick={()=>abrir()}>Novo Template</Btn>}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhum template criado ainda."
        columns={[
          {key:'nome', label:'Template', render:r=>(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span className="text-xl">{tipoIcon(r.tipo)}</span>
              <div>
                <div className="font-semibold flex items-center gap-2" style={{color:"var(--t-primary)"}}>
                  {r.nome}
                  {r.padrao===1&&<span className="ds-badge ds-badge-info" style={{fontSize:10}}>PADRÃO</span>}
                  {r.tipo_editor==='docx'&&<span className="text-[10px] bg-blue-100 text-apple-blue px-1.5 py-0.5 rounded font-bold">WORD</span>}
                </div>
                {r.descricao&&<div className="">{r.descricao}</div>}
              </div>
            </div>
          )},
          {key:'tipo', label:'Tipo', render:r=><span className=" font-medium text-secondary-color">{tipoLabel(r.tipo)}</span>},
          {key:'editor', label:'Editor', render:r=><span className="  text-secondary-color px-2 py-0.5 rounded">{r.tipo_editor==='docx'?'Word (.docx)':r.tipo_editor==='html'?'HTML':'Visual'}</span>},
          {key:'status', label:'Status', render:r=><Badge value={r.ativo?'ativo':'inativo'} dot />},
        ]}
        data={lista}
        onRowClick={row=>abrir(row)}
        actions={row=>(
          <ActionButtons
            onEdit={()=>abrir(row)}
            onDelete={()=>excluir(row.id)}
            acoesSec={[{ label:'Duplicar Template', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>, onClick:()=>duplicar(row) }]}
          />
        )}
      />

      {/* ── SLIDE PANEL EDITOR ─────────────────────── */}
      <SlidePanel
        open={panel}
        onClose={()=>setPanel(false)}
        title={editId?'Editar Template':'Novo Template'}
        subtitle="Editor visual de documentos"
        width="xl"
        footer={
          <div style={{display:"flex",gap:8}}>
            <Btn variant="secondary" onClick={()=>setPanel(false)}>Cancelar</Btn>
            <Btn variant="secondary" onClick={()=>setPreview(!preview)}>
              {preview ? 'Editar' : 'Prévia'}
            </Btn>
            <Btn style={{flex:1}} loading={saving} onClick={salvar}>
              {editId?'Atualizar':'Salvar'} Template
            </Btn>
          </div>
        }>

        {erro&&<div className="mb-3 bg-red-50 border border-red-200 text-apple-red rounded-lg px-4 py-2 ">{erro}</div>}

        {/* Metadados */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <FormField label="Nome do Template" required style={{gridColumn:"span 2"}}>
            <input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className={inputCls} placeholder="Ex: Fatura de Locação Padrão" />
          </FormField>
          <FormField label="Tipo">
            <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} className={selectCls}>
              {TIPOS.map(t=><option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Descrição" style={{gridColumn:"span 2"}}>
            <input value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})} className={inputCls} placeholder="Descrição breve do template" />
          </FormField>
          <div className="flex flex-col gap-2 justify-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked?1:0})} className="w-4 h-4" />
              <span className=" font-medium text-secondary-color">Ativo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.padrao} onChange={e=>setForm({...form,padrao:e.target.checked?1:0})} className="w-4 h-4" />
              <span className=" font-medium text-secondary-color">Template padrão</span>
            </label>
          </div>
        </div>

        {!preview ? (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Tabs tipo de editor */}
            <div className="flex items-center justify-between">
              <div className="flex  rounded-lg p-1 gap-1">
                {editorTabs.map(t=>(
                  <button key={t.key} onClick={()=>setEditorTab(t.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded  font-semibold transition-all ${editorTab===t.key?'bg-white shadow-sm ds-tab-active':'text-secondary-color hover:text-gray-700'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MODO DOCX */}
            {editorTab==='docx' && (
              <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center bg-blue-50/30">
                <div className="text-4xl mb-3">📄</div>
                <h3 className="font-bold text-gray-700 mb-2">Importar Template do Word (.docx)</h3>
                <p className=" text-secondary-color mb-4 max-w-md mx-auto">
                  Crie o template no Word usando as tags <code className="bg-blue-100 px-1 rounded">{'{{variavel}}'}</code> onde quiser os dados dinâmicos. O sistema converte automaticamente para editor visual.
                </p>
                <div className="bg-white border border-blue-200 rounded-lg p-3 mb-4 text-left max-w-sm mx-auto">
                  <p className=" font-bold text-secondary-color mb-2">Exemplos de tags no Word:</p>
                  <div className="space-y-1  font-mono text-blue-700">
                    <div>{'{{cliente_nome}}'} → João da Silva</div>
                    <div>{'{{contrato_numero}}'} → LOC2024000001</div>
                    <div>{'{{contrato_total}}'} → R$ 1.500,00</div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".docx" onChange={handleDocxUpload} className="hidden" id="docx-upload" />
                <Btn onClick={()=>fileInputRef.current?.click()} loading={uploadingDocx} variant="secondary" >
                  {uploadingDocx?'Convertendo...':'Escolher arquivo .docx'}
                </Btn>
                {form.docx_base64 && (
                  <p className=" text-apple-green mt-2">✅ DOCX carregado — você pode editar visualmente abaixo!</p>
                )}
              </div>
            )}

            {/* PALETA DE TAGS */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className=" px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                <span className=" font-bold text-secondary-color uppercase tracking-wider">Inserir Tag</span>
                <span className="">— clique para inserir no cursor do editor</span>
              </div>
              {/* Grupos */}
              <div className="flex border-b border-[var(--border)] overflow-x-auto bg-white">
                {TAGS.map((g,i)=>(
                  <button key={i} onClick={()=>setTagGrupo(i)}
                    className={`px-3 py-2  font-semibold whitespace-nowrap border-b-2 transition-colors ${tagGrupo===i?'border-primary-color text-primary-color':'border-transparent text-muted-color hover:text-secondary-color'}`}>
                    {g.grupo}
                  </button>
                ))}
              </div>
              <div className="p-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto bg-white">
                {TAGS[tagGrupo]?.tags.map(t=>(
                  <button key={t.tag} onClick={()=>inserirTag(t.tag)} title={t.desc}
                    className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] px-2 py-1 rounded-lg font-mono transition-colors border border-blue-100">
                    <span>{t.tag}</span>
                    <span className="font-sans text-blue-400 text-[10px]">· {t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* EDITOR VISUAL */}
            {(editorTab==='visual'||editorTab==='docx') && (
              <RichEditor
                value={form.conteudo||''}
                onChange={v=>setForm((f:any)=>({...f,conteudo:v}))}
                onInsertTag={handleInsertTag}
                minHeight="450px"
              />
            )}

            {/* EDITOR HTML */}
            {editorTab==='html' && (
              <FormField label="Conteúdo HTML">
                <textarea
                  id="html-editor"
                  value={form.conteudo||''}
                  onChange={e=>setForm({...form,conteudo:e.target.value})}
                  rows={24}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3  font-mono  bg-[#1e1e2e] text-[#cdd6f4] resize-none"
                  spellCheck={false}
                />
              </FormField>
            )}
          </div>
        ) : (
          /* PRÉVIA */
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3  text-amber-700 flex items-center gap-2">
              ⚠️ Prévia com <strong>dados fictícios</strong>. Os dados reais serão usados ao gerar o documento.
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-inner">
              <div className=" px-4 py-2 border-b border-[var(--border)]  flex items-center justify-between">
                <span>Prévia do documento</span>
                <span className="text-[10px]">A4 · Times New Roman · 12pt</span>
              </div>
              <div
                className="p-10"
                style={{fontFamily:'Times New Roman,serif',fontSize:'12pt',lineHeight:'1.6',maxWidth:'800px',margin:'0 auto'}}
                dangerouslySetInnerHTML={{__html: renderPreview()}}
              />
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  )
}
