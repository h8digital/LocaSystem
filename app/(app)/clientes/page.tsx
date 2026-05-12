'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { validarDoc, formatarDoc, formatarPhone, formatarCEP } from '@/lib/validators'
import { SlidePanel, PageHeader, Badge, ActionButtons, Btn, Tabs, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'


function toTitle(s:string){if(!s)return'';const m=new Set(['de','da','do','das','dos','e','a','o','em','com','por','para']);return s.toLowerCase().split(' ').map((w,i)=>(!m.has(w)||i===0)?w.charAt(0).toUpperCase()+w.slice(1):w).join(' ')}

const emptyForm=()=>({tipo:'PF',nome:'',cpf_cnpj:'',rg_ie:'',email:'',telefone:'',celular:'',limite_credito:0,observacoes:'',papeis:['cliente'] as string[]})
const emptyEnd =()=>({tipo:'Residencial',cep:'',logradouro:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',ibge:'',principal:false,referencia:'',observacoes:''})
const emptyCt  =()=>({nome:'',cargo:'',telefone:'',celular:'',email:'',autorizado_retirada:false,principal:false,observacoes:''})

export default function ClientesPage() {
  const [lista,setLista]         = useState<any[]>([])
  const [loading,setLoading]     = useState(true)
  const [panel,setPanel]         = useState(false)
  const [editId,setEditId]       = useState<number|null>(null)
  const [tab,setTab]             = useState('dados')
  const [saving,setSaving]       = useState(false)
  const [erro,setErro]           = useState('')
  const [loadingCNPJ,setLoadingCNPJ]=useState(false)
  const [loadingCEP,setLoadingCEP]  =useState<string|null>(null)
  const [form,setForm]           = useState<any>(emptyForm())
  const [enderecos,setEnderecos] = useState<any[]>([emptyEnd()])
  const [contatos,setContatos]   = useState<any[]>([emptyCt()])
  const [docs,        setDocs]        = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploadando,  setUploadando]  = useState(false)
  const [errDoc,      setErrDoc]      = useState('')
  const [editDoc,     setEditDoc]     = useState<any>(null)
  const [formDoc,     setFormDoc]     = useState({ tipo_documento:'', descricao:'' })
  const [fileInput,   setFileInput]   = useState<File|null>(null)
  const [spcData,setSpcData]     = useState<any[]>([])
  const [novaSpc,setNovaSpc]     = useState({resultado:'limpo',observacoes:''})
  const [spcIntervalo,setSpcIntervalo]=useState(30)
  const [tiposEnd,setTiposEnd]   = useState<string[]>([])
  const [kpis, setKpis] = useState({ total:0, pf:0, pj:0, spc_restrito:0, spc_pendente:0, limite_total:0 })

  // Filtros
  const [fBusca,    setFBusca]    = useState('')
  const [fTipo,     setFTipo]     = useState('')
  const [fCpfCnpj,  setFCpfCnpj]  = useState('')
  const [fTelefone, setFTelefone] = useState('')
  const [fCidade,   setFCidade]   = useState('')
  const [fSPC,      setFSPC]      = useState('')
  const [fPapel,    setFPapel]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    // KPIs — sem filtros
    const { data: todos } = await supabase.from('clientes')
      .select('tipo,status_spc,ultima_consulta_spc,limite_credito,papeis')
      .eq('ativo', 1)
    const lt = todos ?? []
    const hoje = new Date()
    setKpis({
      total:        lt.length,
      pf:           lt.filter(c => c.tipo === 'PF').length,
      pj:           lt.filter(c => c.tipo === 'PJ').length,
      spc_restrito: lt.filter(c => c.status_spc === 'restrito').length,
      spc_pendente: lt.filter(c => !c.ultima_consulta_spc ||
        (hoje.getTime() - new Date(c.ultima_consulta_spc).getTime()) / 86400000 > spcIntervalo
      ).length,
      limite_total: lt.reduce((s,c) => s + Number(c.limite_credito ?? 0), 0),
    })

    // Tabela — com filtros
    let q = supabase.from('clientes')
      .select('id,tipo,nome,cpf_cnpj,email,celular,telefone,cidade,estado,ativo,ultima_consulta_spc,status_spc,rg_ie,limite_credito,observacoes,papeis')
      .eq('ativo', 1).order('nome')
    if (fBusca)    q = q.ilike('nome', `%${fBusca}%`)
    if (fTipo)     q = q.eq('tipo', fTipo)
    if (fCpfCnpj)  q = q.ilike('cpf_cnpj', `%${fCpfCnpj.replace(/\D/g,'')}%`)
    if (fTelefone) q = q.or(`celular.ilike.%${fTelefone}%,telefone.ilike.%${fTelefone}%`)
    if (fCidade)   q = q.ilike('cidade', `%${fCidade}%`)
    if (fSPC)      q = q.eq('status_spc', fSPC)
    const { data } = await q

    let resultado = data ?? []
    if (fPapel) {
      resultado = resultado.filter(c => (c.papeis ?? ['cliente']).includes(fPapel))
    }

    setLista(resultado)
    setLoading(false)
  }, [fBusca, fTipo, fCpfCnpj, fTelefone, fCidade, fSPC, fPapel, spcIntervalo])

  useEffect(() => { load() }, [load])
  useEffect(()=>{
    supabase.from('parametros').select('valor').eq('chave','spc_intervalo_dias').single().then(({data})=>{if(data)setSpcIntervalo(Number(data.valor))})
    supabase.from('tipos_endereco_cliente').select('nome').eq('ativo',1).order('ordem').then(({data})=>setTiposEnd(data?.map((t:any)=>t.nome)??['Residencial','Comercial','Sede','Obra','Outros']))
  },[])

  async function buscarCNPJ(cnpj:string){const d=cnpj.replace(/\D/g,'');if(d.length!==14)return;setLoadingCNPJ(true);try{const r=await fetch(`https://publica.cnpj.ws/cnpj/${d}`);if(!r.ok)throw new Error();const data=await r.json();const est=data.estabelecimento;const cepL=(est?.cep??'').replace(/\D/g,'');setForm((f:any)=>({...f,nome:toTitle(data.razao_social??''),email:(est?.email??'').toLowerCase(),telefone:est?.ddd1&&est?.telefone1?formatarPhone(`${est.ddd1}${est.telefone1}`):f.telefone,cep:formatarCEP(cepL),endereco:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),numero:est?.numero??'',complemento:toTitle(est?.complemento??''),bairro:toTitle(est?.bairro??''),cidade:toTitle(est?.cidade?.nome??''),estado:est?.estado?.sigla??''}));setEnderecos([{tipo:'Comercial',cep:formatarCEP(cepL),logradouro:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),numero:est?.numero??'',complemento:toTitle(est?.complemento??''),bairro:toTitle(est?.bairro??''),cidade:toTitle(est?.cidade?.nome??''),estado:est?.estado?.sigla??'',ibge:est?.cidade?.ibge_id??'',principal:true,observacoes:''}])}catch{setErro('CNPJ não encontrado.')}setLoadingCNPJ(false)}
  async function buscarCEP(cep:string,target:'main'|number){const d=cep.replace(/\D/g,'');if(d.length!==8)return;setLoadingCEP(String(target));try{const r=await fetch(`https://viacep.com.br/ws/${d}/json/`);const data=await r.json();if(data.erro)throw new Error();const logr=toTitle(data.logradouro??''),bai=toTitle(data.bairro??''),cid=toTitle(data.localidade??''),uf=data.uf??'';if(target==='main')setForm((f:any)=>({...f,endereco:logr,bairro:bai,cidade:cid,estado:uf}));else setEnderecos(prev=>{const a=[...prev];a[target as number]={...a[target as number],logradouro:logr,bairro:bai,cidade:cid,estado:uf,ibge:data.ibge??''};return a})}catch{setErro('CEP não encontrado.')}setLoadingCEP(null)}

  async function abrir(c?:any){
    setErro('');setTab('dados')
    if(c){setForm({tipo:c.tipo??'PF',nome:c.nome??'',cpf_cnpj:c.cpf_cnpj??'',rg_ie:c.rg_ie??'',email:c.email??'',telefone:c.telefone??'',celular:c.celular??'',limite_credito:c.limite_credito??0,observacoes:c.observacoes??'',endereco:c.endereco??'',numero:c.numero??'',complemento:c.complemento??'',bairro:c.bairro??'',cidade:c.cidade??'',estado:c.estado??'',cep:c.cep??'',papeis:c.papeis??['cliente']});setEditId(c.id);const[{data:ends},{data:cts},{data:spcs}]=await Promise.all([supabase.from('cliente_enderecos').select('*').eq('cliente_id',c.id).eq('ativo',1).order('principal',{ascending:false}),supabase.from('cliente_contatos').select('*').eq('cliente_id',c.id).eq('ativo',1).order('principal',{ascending:false}),supabase.from('cliente_spc').select('*').eq('cliente_id',c.id).order('data_consulta',{ascending:false})]);setEnderecos(ends?.length
          ? (ends.some((e:any)=>e.principal) ? ends : ends.map((e:any,i:number)=>({...e,principal:i===0})))
          : [{...emptyEnd(),principal:true}]);setContatos(cts?.length?cts:[emptyCt()]);setSpcData(spcs??[])
      // Carregar documentos de crédito
      const { data: docsData } = await supabase.from('cliente_documentos')
        .select('*, usuarios(nome)').eq('cliente_id',c.id).order('created_at',{ascending:false})
      setDocs(docsData??[])
    }
    else{setForm(emptyForm());setEditId(null);setEnderecos([{...emptyEnd(),principal:true}]);setContatos([emptyCt()]);setSpcData([]);setDocs([]);setFormDoc({tipo_documento:'',descricao:''});setFileInput(null);setErrDoc('')}
    setPanel(true)
  }

  async function salvar(){
    if(!form.nome?.trim()){setErro('Nome é obrigatório!');return}
    // CPF obrigatório para PF, CNPJ obrigatório para PJ
    if(!form.cpf_cnpj?.trim()){
      setErro(form.tipo==='PJ'?'CNPJ é obrigatório para Pessoa Jurídica!':'CPF é obrigatório para Pessoa Física!')
      return
    }
    const docSemMask=form.cpf_cnpj.replace(/\D/g,'')
    if(!validarDoc(form.cpf_cnpj,form.tipo)){
      setErro(form.tipo==='PJ'?'CNPJ inválido! Verifique o número informado.':'CPF inválido! Verifique o número informado.')
      return
    }
    // Validar: ao menos 1 endereço principal obrigatório
    const endValidos = enderecos.filter(e => e.logradouro?.trim() || e.cep?.trim())
    if (endValidos.length === 0) {
      setErro('Informe ao menos um endereço para o cliente.'); setTab('enderecos'); return
    }
    const temPrincipal = endValidos.some(e => e.principal)
    if (!temPrincipal) {
      setErro('Marque um dos endereços como Principal.'); setTab('enderecos'); return
    }
    setSaving(true);setErro('')
    try{
      const payload={tipo:form.tipo,nome:form.nome.trim(),cpf_cnpj:form.cpf_cnpj||null,rg_ie:form.rg_ie||null,email:form.email||null,telefone:form.telefone||null,celular:form.celular||null,limite_credito:Number(form.limite_credito)||0,observacoes:form.observacoes||null,ativo:1,updated_at:new Date().toISOString(),papeis:(form.papeis??[]).length>0?form.papeis:['cliente']}
      let id=editId
      if(editId){const{error}=await supabase.from('clientes').update(payload).eq('id',editId);if(error)throw new Error(error.message)}
      else{const{data,error}=await supabase.from('clientes').insert(payload).select('id').single();if(error)throw new Error(error.message);id=data.id}
      if(editId)await supabase.from('cliente_enderecos').update({ativo:0}).eq('cliente_id',editId)
      for(const end of enderecos){if(!end.cep&&!end.logradouro&&!end.cidade)continue;const{id:endId,created_at,...d}=end;if(endId&&editId)await supabase.from('cliente_enderecos').update({...d,ativo:1}).eq('id',endId);else await supabase.from('cliente_enderecos').insert({...d,cliente_id:id})}
      if(editId)await supabase.from('cliente_contatos').update({ativo:0}).eq('cliente_id',editId)
      for(const ct of contatos){if(!ct.nome?.trim())continue;const{id:_,created_at,updated_at,...d}=ct;if(_&&editId)await supabase.from('cliente_contatos').update({...d,ativo:1}).eq('id',_);else await supabase.from('cliente_contatos').insert({...d,cliente_id:id})}
      setSaving(false);setPanel(false);load()
    }catch(e:any){setErro('Erro: '+e.message);setSaving(false)}
  }

  async function registrarSPC(){
    if(!editId)return
    const hoje=new Date().toISOString().split('T')[0]
    await supabase.from('cliente_spc').insert({cliente_id:editId,data_consulta:hoje,resultado:novaSpc.resultado,observacoes:novaSpc.observacoes})
    await supabase.from('clientes').update({ultima_consulta_spc:hoje,status_spc:novaSpc.resultado}).eq('id',editId)
    const{data:spcs}=await supabase.from('cliente_spc').select('*').eq('cliente_id',editId).order('data_consulta',{ascending:false})
    setSpcData(spcs??[]);setNovaSpc({resultado:'limpo',observacoes:''});load()
  }

  async function inativar(id:number){if(!confirm('Inativar este cliente?'))return;await supabase.from('clientes').update({ativo:0}).eq('id',id);load()}
  function alertaSPC(c:any){if(!c.ultima_consulta_spc)return'warning';return Math.floor((Date.now()-new Date(c.ultima_consulta_spc).getTime())/86400000)>spcIntervalo?'warning':'ok'}
  const F=(k:string)=>({value:form[k]??'',onChange:(e:any)=>setForm({...form,[k]:e.target.value})})

  const hasFilter = !!(fBusca||fTipo||fCpfCnpj||fTelefone||fCidade||fSPC||fPapel)

    // ── Tipos de documento disponíveis ─────────────────────────────────────────
  const TIPOS_DOC = [
    'CNH','RG','CPF','Comprovante de Residência','Comprovante de Renda',
    'Contrato Social','Procuração','CNPJ / Cartão CNPJ','Certidão Negativa',
    'Balanço Patrimonial','Nota Promissória','Outro',
  ]

  // ── Upload de novo documento ───────────────────────────────────────────────
  async function uploadDoc() {
    if (!formDoc.tipo_documento) { setErrDoc('Selecione o tipo do documento.'); return }
    if (!fileInput)              { setErrDoc('Selecione um arquivo.'); return }
    if (fileInput.size > 10 * 1024 * 1024) {
      setErrDoc(`Arquivo muito grande (${(fileInput.size/1024/1024).toFixed(1)}MB). Limite: 10MB.`); return
    }
    setUploadando(true); setErrDoc('')
    try {
      const fd = new FormData()
      fd.append('cliente_id',     String(editId))
      fd.append('tipo_documento', formDoc.tipo_documento)
      fd.append('descricao',      formDoc.descricao)
      fd.append('arquivo',        fileInput)
      const res  = await fetch('/api/clientes/documentos', { method:'POST', body: fd })
      const data = await res.json()
      if (!data.ok) { setErrDoc(data.error); setUploadando(false); return }
      setDocs(prev => [data.data, ...prev])
      setFormDoc({ tipo_documento:'', descricao:'' })
      setFileInput(null)
      // Limpar input file
      const inp = document.getElementById('file-doc-input') as HTMLInputElement
      if (inp) inp.value = ''
    } catch(e:any) { setErrDoc(e.message) }
    setUploadando(false)
  }

  // ── Salvar edição (tipo e descrição) ──────────────────────────────────────
  async function salvarEdicaoDoc() {
    if (!editDoc || !formDoc.tipo_documento) { setErrDoc('Tipo obrigatório.'); return }
    setUploadando(true); setErrDoc('')
    try {
      const res  = await fetch('/api/clientes/documentos', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id: editDoc.id, tipo_documento: formDoc.tipo_documento, descricao: formDoc.descricao }),
      })
      const data = await res.json()
      if (!data.ok) { setErrDoc(data.error); setUploadando(false); return }
      setDocs(prev => prev.map(d => d.id === editDoc.id ? data.data : d))
      setEditDoc(null); setFormDoc({ tipo_documento:'', descricao:'' })
    } catch(e:any) { setErrDoc(e.message) }
    setUploadando(false)
  }

  // ── Alterar status (aprovar / rejeitar) ──────────────────────────────────
  async function alterarStatusDoc(doc: any, novoStatus: string) {
    const res  = await fetch('/api/clientes/documentos', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: doc.id, status: novoStatus }),
    })
    const data = await res.json()
    if (data.ok) setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: novoStatus } : d))
  }

  // ── Excluir documento ────────────────────────────────────────────────────
  async function excluirDoc(doc: any) {
    if (!confirm(`Excluir o documento "${doc.tipo_documento} — ${doc.nome_arquivo}"?\n\nEsta ação é irreversível.`)) return
    const res  = await fetch(`/api/clientes/documentos?id=${doc.id}`, { method:'DELETE' })
    const data = await res.json()
    if (data.ok) setDocs(prev => prev.filter(d => d.id !== doc.id))
    else alert('Erro ao excluir: ' + data.error)
  }




return (
    <div>

      <PageHeader
        title="👤 Clientes"
        subtitle={`${lista.length} cliente(s) cadastrado(s)`}
        actions={<Btn onClick={() => abrir()}>+ Novo Cliente</Btn>}
      />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
        {([
          {l:'Total de Clientes', v:kpis.total,        accent:'#94a3b8'},
          {l:'Pessoa Física',     v:kpis.pf,            accent:'#818cf8', sub:'PF', onClick:()=>setFTipo('PF')},
          {l:'Pessoa Jurídica',   v:kpis.pj,            accent:'#a78bfa', sub:'PJ', onClick:()=>setFTipo('PJ')},
          {l:'Limite de Crédito', v:fmt.money(kpis.limite_total), accent:'#34d399'},
          {l:'SPC Restrito',      v:kpis.spc_restrito,  accent:'#f87171',
            onClick:()=>setFSPC('restrito')},
          {l:'SPC Pendente',      v:kpis.spc_pendente,  accent:'#fbbf24',
            sub:kpis.spc_pendente>0?'Consulta necessária':undefined},
        ] as any[]).map((k:any)=>(
          <div key={k.l} onClick={k.onClick}
            style={{background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)',
              border:'1px solid rgba(255,255,255,0.10)',borderTop:`2px solid ${k.accent}`,
              borderRadius:'var(--r-lg)',padding:'14px 16px',
              cursor:k.onClick?'pointer':'default',transition:'all .2s'}}
            onMouseEnter={e=>{if(k.onClick)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.09)'}}
            onMouseLeave={e=>{if(k.onClick)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}}>
            <div style={{fontSize:'var(--fs-xs)',fontWeight:600,color:'rgba(255,255,255,0.4)',
              textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{k.l}</div>
            <div style={{fontSize:24,fontWeight:600,lineHeight:1,
              color:Number(k.v)===0||k.v==='R$ 0,00'?'rgba(255,255,255,0.22)':k.accent}}>{k.v}</div>
            {k.sub&&<div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.35)',marginTop:4}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div style={{background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)',borderRadius:'var(--r-lg)',padding:'14px 16px'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:10}}>
          {[
            {label:'Nome',        value:fBusca,    set:setFBusca,    placeholder:'Nome do cliente...', flex:'2 1 200px'},
            {label:'CPF / CNPJ',  value:fCpfCnpj,  set:setFCpfCnpj,  placeholder:'000.000.000-00',    flex:'1 1 150px'},
            {label:'Telefone',    value:fTelefone, set:setFTelefone, placeholder:'(51) 9...',          flex:'1 1 140px'},
            {label:'Cidade',      value:fCidade,   set:setFCidade,   placeholder:'São Leopoldo...',    flex:'1 1 150px'},
          ].map(fi=>(
            <div key={fi.label} style={{flex:fi.flex,minWidth:130}}>
              <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.4)',
                textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5,fontWeight:600}}>{fi.label}</div>
              <input value={fi.value} onChange={e=>fi.set(e.target.value)}
                className={inputCls} placeholder={fi.placeholder} style={{width:'100%'}} />
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:'0 1 150px'}}>
            <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5,fontWeight:600}}>Tipo</div>
            <select value={fTipo} onChange={e=>setFTipo(e.target.value)} className={selectCls} style={{width:'100%'}}>
              <option value="">Todos</option>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </select>
          </div>
          <div style={{flex:'0 1 160px'}}>
            <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5,fontWeight:600}}>Papel</div>
            <select value={fPapel} onChange={e=>setFPapel(e.target.value)} className={selectCls} style={{width:'100%'}}>
              <option value="">Todos os papéis</option>
              <option value="cliente">Cliente</option>
              <option value="fornecedor">Fornecedor</option>
              <option value="transportador">Transportador</option>
              <option value="funcionario">Funcionário</option>
            </select>
          </div>
          <div style={{flex:'0 1 160px'}}>
            <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5,fontWeight:600}}>Status SPC</div>
            <select value={fSPC} onChange={e=>setFSPC(e.target.value)} className={selectCls} style={{width:'100%'}}>
              <option value="">Todos</option>
              <option value="limpo">Limpo</option>
              <option value="restrito">Restrito</option>
              <option value="pendente">Pendente consulta</option>
            </select>
          </div>
          <button onClick={()=>{setFBusca('');setFTipo('');setFCpfCnpj('');setFTelefone('');setFCidade('');setFSPC('');setFPapel('')}}
            style={{alignSelf:'flex-end',padding:'7px 14px',borderRadius:'var(--r-md)',
              background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
              color:'rgba(255,255,255,0.6)',fontSize:'var(--fs-md)',cursor:'pointer',
              fontFamily:'var(--font-sans)',whiteSpace:'nowrap'}}>
            ✕ Limpar
          </button>
        </div>
        <div style={{marginTop:10,fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.3)'}}>
          {lista.length} resultado(s)
        </div>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div style={{background:'rgba(255,255,255,0.05)',backdropFilter:'blur(12px)',
        border:'1px solid rgba(255,255,255,0.10)',borderRadius:'var(--r-lg)',overflow:'hidden'}}>
        {loading ? (
          <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
        ) : lista.length === 0 ? (
          <div className="ds-empty">
            <div className="ds-empty-icon">👥</div>
            <div className="ds-empty-title">Nenhum cliente encontrado.</div>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--fs-md)'}}>
            <thead>
              <tr>
                {(['Nome','Tipo','Papéis','CPF / CNPJ','Contato','Cidade / UF','SPC',''] as string[]).map(h=>(
                  <th key={h} style={{padding:'8px 14px',textAlign:h===''?'center':'left',
                    fontSize:'var(--fs-xs)',fontWeight:600,color:'rgba(255,255,255,0.38)',
                    textTransform:'uppercase',letterSpacing:'0.05em',
                    borderBottom:'1px solid rgba(255,255,255,0.08)',
                    background:'rgba(255,255,255,0.03)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(r=>{
                const icons:Record<string,string>={cliente:'👤',fornecedor:'📦',transportador:'🚛',funcionario:'👷',representante:'🤝'}
                const papeis=(r.papeis??['cliente']) as string[]
                const spcStatus = alertaSPC(r)
                return (
                  <tr key={r.id} onClick={()=>abrir(r)} style={{cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(129,140,248,0.06)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{fontWeight:600,color:'rgba(255,255,255,0.88)'}}>{r.nome}</div>
                      {r.email&&<div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.35)',marginTop:1}}>{r.email}</div>}
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <span style={{padding:'2px 8px',borderRadius:99,fontSize:'var(--fs-xs)',fontWeight:600,
                        background:r.tipo==='PJ'?'rgba(167,139,250,0.15)':'rgba(129,140,248,0.15)',
                        color:r.tipo==='PJ'?'#a78bfa':'#818cf8',
                        border:`1px solid ${r.tipo==='PJ'?'rgba(167,139,250,0.3)':'rgba(129,140,248,0.3)'}`}}>
                        {r.tipo}
                      </span>
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {papeis.map((p:string)=>(
                          <span key={p} style={{display:'inline-flex',alignItems:'center',gap:3,
                            padding:'2px 7px',borderRadius:4,fontSize:10,fontWeight:600,
                            background:'rgba(129,140,248,0.12)',color:'#a5b4fc',
                            border:'1px solid rgba(129,140,248,0.25)'}}>
                            {icons[p]??'•'} {p.charAt(0).toUpperCase()+p.slice(1)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',
                      fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)',color:'rgba(255,255,255,0.45)'}}>
                      {r.cpf_cnpj||'—'}
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',
                      fontSize:'var(--fs-sm)',color:'rgba(255,255,255,0.55)'}}>
                      {r.celular||r.telefone||'—'}
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',
                      fontSize:'var(--fs-sm)',color:'rgba(255,255,255,0.45)'}}>
                      {r.cidade?`${r.cidade}${r.estado?' / '+r.estado:''}` : '—'}
                    </td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      {spcStatus==='warning'
                        ?<Badge value="pendente" label={r.ultima_consulta_spc?'SPC Vencido':'Pendente'} dot/>
                        :<Badge value={r.status_spc||'limpo'} label={r.status_spc||'Limpo'} dot/>}
                    </td>
                    <td style={{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}
                      onClick={e=>e.stopPropagation()}>
                      <ActionButtons onDelete={()=>inativar(r.id)} deleteConfirm="Inativar este cliente?" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>


      <SlidePanel open={panel} onClose={()=>setPanel(false)} title={editId?'Editar Cliente':'Novo Cliente'} subtitle={editId?form.nome:'Preencha os dados do cliente'} width="lg"
        footer={<div style={{display:'flex',gap:10}}><Btn variant="secondary" style={{flex:1}} onClick={()=>setPanel(false)}>Cancelar</Btn><Btn style={{flex:1}} loading={saving} onClick={salvar}>{editId?'Atualizar':'Salvar'} Cliente</Btn></div>}>
        <Tabs tabs={[{key:'dados',label:'Dados',icon:'👤'},{key:'enderecos',label:'Endereços',icon:'📍'},{key:'contatos',label:'Contatos',icon:'📞'},{key:'spc',label:'SPC',icon:'🔍'},{key:'documentos',label:'Documentos',icon:'📎'}]} active={tab} onChange={setTab} />
        {erro&&<div className="ds-alert-error" style={{marginTop:12}}>{erro}</div>}
        <div style={{marginTop:16}}>
          {tab==='dados'&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
                <FormField label="Tipo"><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,cpf_cnpj:''})} className={selectCls}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></select></FormField>
                <FormField label={form.tipo==='PJ'?'CNPJ *':'CPF *'}>
                  <div style={{display:'flex',gap:8}}><input value={form.cpf_cnpj||''} onChange={e=>setForm({...form,cpf_cnpj:formatarDoc(e.target.value,form.tipo)})} onBlur={e=>{if(form.tipo==='PJ')buscarCNPJ(e.target.value)}} className={`${inputCls} flex-1`} style={{fontFamily:'var(--font-mono)'}} placeholder={form.tipo==='PJ'?'00.000.000/0001-00':'000.000.000-00'}/>{form.tipo==='PJ'&&<Btn size="sm" variant="secondary" onClick={()=>buscarCNPJ(form.cpf_cnpj)} loading={loadingCNPJ}>🔍</Btn>}</div>
                </FormField>
              </div>

              {/* ── Papéis ── */}
              <FormField label="Papéis">
                <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'2px 0'}}>
                  {([
                    {v:'cliente',       l:'Cliente',       icon:'👤'},
                    {v:'fornecedor',    l:'Fornecedor',    icon:'📦'},
                    {v:'transportador', l:'Transportador', icon:'🚛'},
                    {v:'funcionario',   l:'Funcionário',   icon:'👷'},
                    {v:'representante', l:'Representante', icon:'🤝'},
                  ]).map((p:any)=>{
                    const ativo=(form.papeis??[]).includes(p.v)
                    return (
                      <label key={p.v}
                        style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',userSelect:'none',
                          padding:'5px 12px',borderRadius:'var(--r-md)',transition:'all 150ms',
                          fontWeight:ativo?600:400,fontSize:'var(--fs-md)',
                          border:`1px solid ${ativo?'var(--c-primary)':'var(--border)'}`,
                          background:ativo?'var(--c-primary-light,#e8f4f8)':'transparent',
                          color:ativo?'var(--c-primary)':'var(--t-secondary)'}}>
                        <input type="checkbox" checked={ativo}
                          onChange={e=>{
                            const curr=(form.papeis??[]) as string[]
                            setForm({...form, papeis: e.target.checked
                              ? [...curr, p.v]
                              : curr.filter((x:string)=>x!==p.v)
                            })
                          }}
                          style={{accentColor:'var(--c-primary)',width:14,height:14}} />
                        {p.icon} {p.l}
                      </label>
                    )
                  })}
                </div>
              </FormField>

              <FormField label="Nome / Razão Social" required><input {...F('nome')} className={inputCls} /></FormField>
              <div className="form-grid-2">
                <FormField label={form.tipo==='PJ'?'Insc. Estadual':'RG'}><input {...F('rg_ie')} className={inputCls} /></FormField>
                <FormField label="Email"><input type="email" {...F('email')} onChange={e=>setForm({...form,email:e.target.value.toLowerCase()})} className={inputCls} /></FormField>
                <FormField label="Telefone"><input value={form.telefone||''} onChange={e=>setForm({...form,telefone:formatarPhone(e.target.value)})} className={inputCls} placeholder="(00) 0000-0000" /></FormField>
                <FormField label="Celular"><input value={form.celular||''} onChange={e=>setForm({...form,celular:formatarPhone(e.target.value)})} className={inputCls} placeholder="(00) 00000-0000" /></FormField>
                <FormField label="Limite de Crédito (R$)" style={{gridColumn:"span 2"}}><input type="number" step="0.01" min="0" {...F('limite_credito')} className={inputCls} /></FormField>
              </div>
              
              <FormField label="Observações"><textarea {...F('observacoes')} rows={2} className={textareaCls} /></FormField>
            </div>
          )}
          {tab==='enderecos'&&(
            <div style={{display:'flex', flexDirection:'column', gap:14}}>

              {/* Aviso de validação */}
              {(() => {
                const validos = enderecos.filter(e => e.logradouro?.trim() || e.cep?.trim())
                const temPrincipal = validos.some(e => e.principal)
                if (validos.length === 0) return (
                  <div style={{background:'var(--c-warning-light)',border:'1px solid var(--c-warning)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:'var(--fs-md)',color:'var(--c-warning-text)',display:'flex',alignItems:'center',gap:8}}>
                    <span>⚠️</span>
                    <span><strong>Endereço obrigatório.</strong> Adicione ao menos um endereço e marque-o como Principal para salvar.</span>
                  </div>
                )
                if (!temPrincipal) return (
                  <div style={{background:'var(--c-warning-light)',border:'1px solid var(--c-warning)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:'var(--fs-md)',color:'var(--c-warning-text)',display:'flex',alignItems:'center',gap:8}}>
                    <span>⚠️</span>
                    <span><strong>Nenhum endereço marcado como Principal.</strong> Marque um endereço como Principal para salvar.</span>
                  </div>
                )
                return (
                  <div style={{background:'var(--c-success-light)',border:'1px solid var(--c-success)',borderRadius:'var(--r-md)',padding:'8px 14px',fontSize:'var(--fs-md)',color:'var(--c-success-text)',display:'flex',alignItems:'center',gap:8}}>
                    <span>✅</span>
                    <span>Endereço principal definido.</span>
                  </div>
                )
              })()}

              {enderecos.map((end,i)=>(
                <div key={i} style={{border:`2px solid ${end.principal?'var(--c-primary)':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'14px',background:end.principal?'var(--c-primary-light,#e0f2fe)':'var(--bg-card)',transition:'all .15s'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <select value={end.tipo} onChange={e=>{const a=[...enderecos];a[i].tipo=e.target.value;setEnderecos(a)}} className={selectCls} style={{width:'auto'}}>
                        {tiposEnd.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer'}}>
                        <input type="checkbox" checked={!!end.principal} onChange={e=>{
                          // Se estiver marcando, desmarcar todos os outros
                          const novoValor = e.target.checked
                          if (!novoValor) {
                            // Não permite desmarcar o único principal
                            const outros = enderecos.filter((_,j)=>j!==i&&(_.logradouro?.trim()||_.cep?.trim()))
                            if (outros.length === 0 || !outros.some(x=>x.principal)) {
                              alert('O endereço principal não pode ser desmarcado. Marque outro endereço como principal primeiro.'); return
                            }
                          }
                          const a=enderecos.map((x,j)=>({...x,principal:j===i?novoValor:novoValor?false:x.principal}));setEnderecos(a)
                        }} style={{accentColor:'var(--c-primary)',width:16,height:16,cursor:'pointer'}} /> Principal
                      </label>
                    </div>
                    {enderecos.length>1&&<button onClick={()=>setEnderecos(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--c-danger)',cursor:'pointer',fontSize:'var(--fs-base)'}}>× Remover</button>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10}}>
                    <div><label className="ds-label">CEP</label><input value={end.cep||''} onChange={e=>{const a=[...enderecos];a[i].cep=formatarCEP(e.target.value);setEnderecos(a)}} onBlur={e=>buscarCEP(e.target.value,i)} className={inputCls} placeholder="00000-000" />{loadingCEP===String(i)&&<div style={{fontSize:'var(--fs-sm)',color:'var(--c-primary)',marginTop:3}}>🔍 Buscando...</div>}</div>
                    <div><label className="ds-label">Logradouro</label><input value={end.logradouro||''} onChange={e=>{const a=[...enderecos];a[i].logradouro=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Número</label><input value={end.numero||''} onChange={e=>{const a=[...enderecos];a[i].numero=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Complemento</label><input value={end.complemento||''} onChange={e=>{const a=[...enderecos];a[i].complemento=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Bairro</label><input value={end.bairro||''} onChange={e=>{const a=[...enderecos];a[i].bairro=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Cidade</label><input value={end.cidade||''} onChange={e=>{const a=[...enderecos];a[i].cidade=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">UF</label><input value={end.estado||''} onChange={e=>{const a=[...enderecos];a[i].estado=e.target.value.toUpperCase().slice(0,2);setEnderecos(a)}} className={inputCls} maxLength={2} placeholder="SP" /></div>
                    <div style={{gridColumn:'span 2'}}><label className="ds-label">Ponto de Referência <span style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',fontWeight:400}}>(para auxiliar na entrega)</span></label><input value={end.referencia||''} onChange={e=>{const a=[...enderecos];a[i].referencia=e.target.value;setEnderecos(a)}} className={inputCls} placeholder="Ex: Portão azul, 2º andar, solicitar João, próximo ao mercado..." /></div>
                    <div>
                      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'var(--fs-base)'}}>
                        <input type="checkbox" checked={!!end.flag_obra_entrega}
                          onChange={e=>{const a=[...enderecos];a[i].flag_obra_entrega=e.target.checked;setEnderecos(a)}}
                          style={{accentColor:'var(--c-primary)',width:14,height:14}} />
                        <span style={{fontWeight:600}}>Endereço de Entrega / Obra</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={()=>setEnderecos(prev=>[...prev,emptyEnd()])} className="ds-add-dashed">+ Adicionar Endereço</button>
            </div>
          )}
          {tab==='contatos'&&(
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {contatos.map((ct,i)=>(
                <div key={i} style={{border:`2px solid ${ct.principal?'var(--c-primary)':'var(--border)'}`,borderRadius:'var(--r-lg)',padding:'14px',background:ct.principal?'var(--c-primary-light,#e0f2fe)':'var(--bg-card)',transition:'all .15s'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer'}}><input type="checkbox" checked={!!ct.principal} onChange={e=>{const a=contatos.map((x,j)=>({...x,principal:j===i?e.target.checked:false}));setContatos(a)}} style={{accentColor:'var(--c-primary)'}} />Principal</label>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer',padding:'4px 10px',borderRadius:'var(--r-sm)',background:ct.autorizado_retirada?'var(--c-success-light)':'var(--bg-input)',color:ct.autorizado_retirada?'var(--c-success-text)':'var(--t-secondary)',fontWeight:600}}>
                        <input type="checkbox" checked={!!ct.autorizado_retirada} onChange={e=>{const a=[...contatos];a[i].autorizado_retirada=e.target.checked;setContatos(a)}} style={{accentColor:'var(--c-success)'}} />{ct.autorizado_retirada?'✅':'⬜'} Autorizado a Retirar
                      </label>
                    </div>
                    {contatos.length>1&&<button onClick={()=>setContatos(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--c-danger)',cursor:'pointer',fontSize:'var(--fs-base)'}}>× Remover</button>}
                  </div>
                  <div className="form-grid-2">
                    <div><label className="ds-label">Nome *</label><input value={ct.nome||''} onChange={e=>{const a=[...contatos];a[i].nome=e.target.value;setContatos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Cargo</label><input value={ct.cargo||''} onChange={e=>{const a=[...contatos];a[i].cargo=e.target.value;setContatos(a)}} className={inputCls} /></div>
                    <div><label className="ds-label">Celular</label><input value={ct.celular||''} onChange={e=>{const a=[...contatos];a[i].celular=formatarPhone(e.target.value);setContatos(a)}} className={inputCls} placeholder="(00) 00000-0000" /></div>
                    <div><label className="ds-label">Telefone</label><input value={ct.telefone||''} onChange={e=>{const a=[...contatos];a[i].telefone=formatarPhone(e.target.value);setContatos(a)}} className={inputCls} placeholder="(00) 0000-0000" /></div>
                    <div style={{gridColumn:'span 2'}}><label className="ds-label">Email</label><input type="email" value={ct.email||''} onChange={e=>{const a=[...contatos];a[i].email=e.target.value.toLowerCase();setContatos(a)}} className={inputCls} /></div>
                    <div style={{gridColumn:'span 2'}}>
                      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'var(--fs-base)'}}>
                        <input type="checkbox" checked={!!ct.tomador_decisao}
                          onChange={e=>{const a=[...contatos];a[i].tomador_decisao=e.target.checked;setContatos(a)}}
                          style={{accentColor:'var(--c-primary)',width:14,height:14}} />
                        <div>
                          <span style={{fontWeight:600}}>Tomador de Decisão</span>
                          <span style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginLeft:6}}>Este contato aprova contratos e propostas</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={()=>setContatos(prev=>[...prev,emptyCt()])} className="ds-add-dashed">+ Adicionar Contato</button>
            </div>
          )}
          {tab==='spc'&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {editId?(
                <>
                  <div className="ds-inset">
                    <div style={{fontSize:'var(--fs-md)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:12}}>Nova Consulta SPC</div>
                    <div className="form-grid-2">
                      <FormField label="Resultado"><select value={novaSpc.resultado} onChange={e=>setNovaSpc({...novaSpc,resultado:e.target.value})} className={selectCls}><option value="limpo">✅ Limpo</option><option value="restrito">⚠️ Restrito</option><option value="negativado">❌ Negativado</option></select></FormField>
                      <FormField label="Data"><input type="date" value={new Date().toISOString().split('T')[0]} readOnly className={inputCls} style={{opacity:0.6}} /></FormField>
                      <FormField label="Protocolo / Obs." style={{gridColumn:"span 2"}}><input value={novaSpc.observacoes} onChange={e=>setNovaSpc({...novaSpc,observacoes:e.target.value})} className={inputCls} placeholder="Número do protocolo..." /></FormField>
                    </div>
                    <Btn size="sm" style={{marginTop:12}} onClick={registrarSPC}>🔍 Registrar</Btn>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {spcData.length===0?<div style={{textAlign:'center',padding:'24px',color:'var(--t-muted)',fontSize:'var(--fs-base)'}}>Nenhuma consulta registrada.</div>
                    :spcData.map(s=>(
                      <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius:'var(--r-lg)',background:s.resultado==='limpo'?'var(--c-success-light)':s.resultado==='restrito'?'var(--c-warning-light)':'var(--c-danger-light)',border:`1px solid ${s.resultado==='limpo'?'rgba(52,199,89,0.2)':s.resultado==='restrito'?'rgba(255,149,0,0.2)':'rgba(255,59,48,0.2)'}`}}>
                        <div><div className="tbl-cell-main">{s.resultado==='limpo'?'✅':s.resultado==='restrito'?'⚠️':'❌'} {s.resultado.charAt(0).toUpperCase()+s.resultado.slice(1)}</div>{s.observacoes&&<div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)',marginTop:2}}>{s.observacoes}</div>}</div>
                        <div style={{fontSize:'var(--fs-md)',fontWeight:600,color:'var(--t-secondary)'}}>{fmt.date(s.data_consulta)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ):<div style={{textAlign:'center',padding:'32px',color:'var(--t-muted)',fontSize:'var(--fs-base)'}}>Salve o cliente primeiro para registrar consultas SPC.</div>}
            </div>
          )}
          {tab==='documentos'&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>

              {/* ── Formulário de upload ─────────────────────────────── */}
              <div className="ds-card" style={{padding:'16px 20px'}}>
                <div className="ds-section-title">
                  {editDoc ? '✏️ Editar Documento' : '📎 Enviar Novo Documento'}
                </div>
                {errDoc && <div className="ds-alert-error" style={{marginBottom:12}}>{errDoc}</div>}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <FormField label="Tipo de Documento *">
                    <select value={formDoc.tipo_documento}
                      onChange={e=>setFormDoc({...formDoc,tipo_documento:e.target.value})}
                      className={selectCls}>
                      <option value="">Selecione...</option>
                      {TIPOS_DOC.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Descrição / Observação">
                    <input value={formDoc.descricao}
                      onChange={e=>setFormDoc({...formDoc,descricao:e.target.value})}
                      className={inputCls} placeholder="Ex: RG frente e verso, CNH vencida..." />
                  </FormField>
                </div>
                {!editDoc && (
                  <FormField label="Arquivo (máx. 10MB — PDF, imagem, Word, etc.)">
                    <input id="file-doc-input" type="file"
                      onChange={e=>setFileInput(e.target.files?.[0]??null)}
                      className={inputCls} style={{paddingTop:6}} />
                    {fileInput && (
                      <div style={{marginTop:6,fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>
                        {fileInput.name} — {(fileInput.size/1024/1024).toFixed(2)}MB
                        {fileInput.size > 10*1024*1024 && (
                          <span style={{color:'var(--c-danger)',marginLeft:8}}>⚠ Excede o limite de 10MB</span>
                        )}
                      </div>
                    )}
                  </FormField>
                )}
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <Btn loading={uploadando}
                    onClick={editDoc ? salvarEdicaoDoc : uploadDoc}
                    disabled={!formDoc.tipo_documento || (!editDoc && !fileInput)}>
                    {editDoc ? '💾 Salvar Alteração' : '📤 Enviar Documento'}
                  </Btn>
                  {editDoc && (
                    <Btn variant="secondary" onClick={()=>{setEditDoc(null);setFormDoc({tipo_documento:'',descricao:''});setErrDoc('')}}>
                      Cancelar
                    </Btn>
                  )}
                </div>
              </div>

              {/* ── Tabela de documentos ─────────────────────────────── */}
              {docs.length === 0 ? (
                <div className="ds-card" style={{padding:'32px',textAlign:'center',color:'var(--t-muted)'}}>
                  <div style={{fontSize:36,marginBottom:8}}>📂</div>
                  <div style={{fontWeight:600}}>Nenhum documento enviado ainda.</div>
                  <div style={{fontSize:'var(--fs-sm)',marginTop:4}}>Use o formulário acima para enviar documentos de análise de crédito.</div>
                </div>
              ) : (
                <div className="ds-card" style={{overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'var(--bg-header)'}}>
                        {['Tipo','Descrição','Arquivo','Tamanho','Status','Enviado por','Data','Ações'].map(h=>(
                          <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'var(--fs-xs)',
                            fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',
                            letterSpacing:'0.05em',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map(doc=>{
                        const statusCor: Record<string,string> = {
                          pendente:'var(--c-warning-text)', aprovado:'var(--c-success-text)', rejeitado:'var(--c-danger)'
                        }
                        const statusBg: Record<string,string> = {
                          pendente:'var(--c-warning-light)', aprovado:'var(--c-success-light)', rejeitado:'var(--c-danger-light)'
                        }
                        const statusLabel: Record<string,string> = {
                          pendente:'⏳ Pendente', aprovado:'✅ Aprovado', rejeitado:'❌ Rejeitado'
                        }
                        return (
                          <tr key={doc.id} style={{borderBottom:'1px solid var(--border)'}}>
                            <td style={{padding:'10px 14px',fontWeight:600,fontSize:'var(--fs-md)'}}>
                              {doc.tipo_documento}
                            </td>
                            <td style={{padding:'10px 14px',color:'var(--t-secondary)',fontSize:'var(--fs-md)'}}>
                              {doc.descricao || '—'}
                            </td>
                            <td style={{padding:'10px 14px',maxWidth:180}}>
                              <a href={doc.url} target="_blank" rel="noopener"
                                style={{color:'var(--c-primary)',fontSize:'var(--fs-sm)',
                                  textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontWeight:500}}
                                title={doc.nome_arquivo}>
                                📄 <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130,display:'inline-block'}}>
                                  {doc.nome_arquivo}
                                </span>
                              </a>
                            </td>
                            <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)',whiteSpace:'nowrap'}}>
                              {doc.tamanho_bytes ? (doc.tamanho_bytes/1024/1024).toFixed(2)+'MB' : '—'}
                            </td>
                            <td style={{padding:'10px 14px'}}>
                              <span style={{fontSize:'var(--fs-xs)',fontWeight:700,padding:'3px 10px',
                                borderRadius:99,color:statusCor[doc.status],background:statusBg[doc.status]}}>
                                {statusLabel[doc.status]??doc.status}
                              </span>
                            </td>
                            <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>
                              {doc.usuarios?.nome??'—'}
                            </td>
                            <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)',whiteSpace:'nowrap'}}>
                              {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>
                              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                {/* Visualizar */}
                                <a href={doc.url} target="_blank" rel="noopener"
                                  style={{padding:'4px 8px',borderRadius:'var(--r-sm)',border:'1px solid var(--border)',
                                    background:'var(--bg-card)',color:'var(--t-secondary)',fontSize:13,
                                    textDecoration:'none',lineHeight:1,display:'flex',alignItems:'center'}}
                                  title="Visualizar">👁️</a>
                                {/* Aprovar */}
                                {doc.status!=='aprovado'&&(
                                  <button onClick={()=>alterarStatusDoc(doc,'aprovado')}
                                    title="Aprovar" style={{padding:'4px 8px',borderRadius:'var(--r-sm)',
                                      border:'1px solid var(--c-success)',background:'var(--c-success-light)',
                                      color:'var(--c-success-text)',fontSize:13,cursor:'pointer',lineHeight:1}}>✅</button>
                                )}
                                {/* Rejeitar */}
                                {doc.status!=='rejeitado'&&(
                                  <button onClick={()=>alterarStatusDoc(doc,'rejeitado')}
                                    title="Rejeitar" style={{padding:'4px 8px',borderRadius:'var(--r-sm)',
                                      border:'1px solid var(--c-danger)',background:'var(--c-danger-light)',
                                      color:'var(--c-danger)',fontSize:13,cursor:'pointer',lineHeight:1}}>❌</button>
                                )}
                                {/* Editar */}
                                <button onClick={()=>{setEditDoc(doc);setFormDoc({tipo_documento:doc.tipo_documento,descricao:doc.descricao??''});setErrDoc('')}}
                                  title="Editar tipo/descrição" style={{padding:'4px 8px',borderRadius:'var(--r-sm)',
                                    border:'1px solid var(--border)',background:'var(--bg-card)',
                                    color:'var(--c-primary)',fontSize:13,cursor:'pointer',lineHeight:1}}>✏️</button>
                                {/* Excluir */}
                                <button onClick={()=>excluirDoc(doc)}
                                  title="Excluir" style={{padding:'4px 8px',borderRadius:'var(--r-sm)',
                                    border:'1px solid var(--c-danger)',background:'var(--c-danger-light)',
                                    color:'var(--c-danger)',fontSize:13,cursor:'pointer',lineHeight:1}}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </SlidePanel>
    </div>
  )
}
