'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { validarDoc, formatarDoc, formatarPhone, formatarCEP } from '@/lib/validators'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Btn, Tabs, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'


function toTitle(s:string){if(!s)return'';const m=new Set(['de','da','do','das','dos','e','a','o','em','com','por','para']);return s.toLowerCase().split(' ').map((w,i)=>(!m.has(w)||i===0)?w.charAt(0).toUpperCase()+w.slice(1):w).join(' ')}

const emptyForm=()=>({tipo:'PF',nome:'',cpf_cnpj:'',rg_ie:'',email:'',telefone:'',celular:'',limite_credito:0,observacoes:'',endereco:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',cep:'',papeis:['cliente'] as string[]})
const emptyEnd =()=>({tipo:'Residencial',cep:'',logradouro:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',ibge:'',principal:false,referencia:'',observacoes:''})
const emptyCt  =()=>({nome:'',cargo:'',telefone:'',celular:'',email:'',autorizado_retirada:false,principal:false,observacoes:''})

export default function ClientesPage() {
  const [lista,setLista]         = useState<any[]>([])
  const [loading,setLoading]     = useState(true)
  const [filters,setFilters]     = useState<Record<string,string>>({busca:'',tipo:'',cpf_cnpj:'',telefone:''})
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
  const [spcData,setSpcData]     = useState<any[]>([])
  const [novaSpc,setNovaSpc]     = useState({resultado:'limpo',observacoes:''})
  const [spcIntervalo,setSpcIntervalo]=useState(30)
  const [tiposEnd,setTiposEnd]   = useState<string[]>([])

  async function load(){
    setLoading(true)
    let q=supabase.from('clientes').select('id,tipo,nome,cpf_cnpj,email,celular,telefone,cidade,estado,ativo,ultima_consulta_spc,status_spc,rg_ie,limite_credito,observacoes,endereco,numero,complemento,bairro,cep,papeis').eq('ativo',1).order('nome')
    if(filters.busca)   q=q.ilike('nome',`%${filters.busca}%`)
    if(filters.tipo)    q=q.eq('tipo',filters.tipo)
    if(filters.cpf_cnpj)q=q.ilike('cpf_cnpj',`%${filters.cpf_cnpj.replace(/\D/g,'')}%`)
    if(filters.telefone) q=q.or(`celular.ilike.%${filters.telefone}%,telefone.ilike.%${filters.telefone}%`)
    const{data}=await q;setLista(data??[]);setLoading(false)
  }
  useEffect(()=>{load()},[filters])
  useEffect(()=>{
    supabase.from('parametros').select('valor').eq('chave','spc_intervalo_dias').single().then(({data})=>{if(data)setSpcIntervalo(Number(data.valor))})
    supabase.from('tipos_endereco_cliente').select('nome').eq('ativo',1).order('ordem').then(({data})=>setTiposEnd(data?.map((t:any)=>t.nome)??['Residencial','Comercial','Sede','Obra','Outros']))
  },[])

  async function buscarCNPJ(cnpj:string){const d=cnpj.replace(/\D/g,'');if(d.length!==14)return;setLoadingCNPJ(true);try{const r=await fetch(`https://publica.cnpj.ws/cnpj/${d}`);if(!r.ok)throw new Error();const data=await r.json();const est=data.estabelecimento;const cepL=(est?.cep??'').replace(/\D/g,'');setForm((f:any)=>({...f,nome:toTitle(data.razao_social??''),email:(est?.email??'').toLowerCase(),telefone:est?.ddd1&&est?.telefone1?formatarPhone(`${est.ddd1}${est.telefone1}`):f.telefone,cep:formatarCEP(cepL),endereco:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),numero:est?.numero??'',complemento:toTitle(est?.complemento??''),bairro:toTitle(est?.bairro??''),cidade:toTitle(est?.cidade?.nome??''),estado:est?.estado?.sigla??''}));setEnderecos([{tipo:'Comercial',cep:formatarCEP(cepL),logradouro:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),numero:est?.numero??'',complemento:toTitle(est?.complemento??''),bairro:toTitle(est?.bairro??''),cidade:toTitle(est?.cidade?.nome??''),estado:est?.estado?.sigla??'',ibge:est?.cidade?.ibge_id??'',principal:true,observacoes:''}])}catch{setErro('CNPJ não encontrado.')}setLoadingCNPJ(false)}
  async function buscarCEP(cep:string,target:'main'|number){const d=cep.replace(/\D/g,'');if(d.length!==8)return;setLoadingCEP(String(target));try{const r=await fetch(`https://viacep.com.br/ws/${d}/json/`);const data=await r.json();if(data.erro)throw new Error();const logr=toTitle(data.logradouro??''),bai=toTitle(data.bairro??''),cid=toTitle(data.localidade??''),uf=data.uf??'';if(target==='main')setForm((f:any)=>({...f,endereco:logr,bairro:bai,cidade:cid,estado:uf}));else setEnderecos(prev=>{const a=[...prev];a[target as number]={...a[target as number],logradouro:logr,bairro:bai,cidade:cid,estado:uf,ibge:data.ibge??''};return a})}catch{setErro('CEP não encontrado.')}setLoadingCEP(null)}

  async function abrir(c?:any){
    setErro('');setTab('dados')
    if(c){setForm({tipo:c.tipo??'PF',nome:c.nome??'',cpf_cnpj:c.cpf_cnpj??'',rg_ie:c.rg_ie??'',email:c.email??'',telefone:c.telefone??'',celular:c.celular??'',limite_credito:c.limite_credito??0,observacoes:c.observacoes??'',endereco:c.endereco??'',numero:c.numero??'',complemento:c.complemento??'',bairro:c.bairro??'',cidade:c.cidade??'',estado:c.estado??'',cep:c.cep??'',papeis:c.papeis??['cliente']});setEditId(c.id);const[{data:ends},{data:cts},{data:spcs}]=await Promise.all([supabase.from('cliente_enderecos').select('*').eq('cliente_id',c.id).eq('ativo',1).order('principal',{ascending:false}),supabase.from('cliente_contatos').select('*').eq('cliente_id',c.id).eq('ativo',1).order('principal',{ascending:false}),supabase.from('cliente_spc').select('*').eq('cliente_id',c.id).order('data_consulta',{ascending:false})]);setEnderecos(ends?.length?ends:[emptyEnd()]);setContatos(cts?.length?cts:[emptyCt()]);setSpcData(spcs??[])}
    else{setForm(emptyForm());setEditId(null);setEnderecos([emptyEnd()]);setContatos([emptyCt()]);setSpcData([])}
    setPanel(true)
  }

  async function salvar(){
    if(!form.nome?.trim()){setErro('Nome é obrigatório!');return}
    if(form.cpf_cnpj){
      const docSemMask=form.cpf_cnpj.replace(/\D/g,'')
      if(docSemMask.length>0&&!validarDoc(form.cpf_cnpj,form.tipo)){
        setErro(form.tipo==='PJ'?'CNPJ inválido! Verifique o número informado.':'CPF inválido! Verifique o número informado.')
        return
      }
    }
    setSaving(true);setErro('')
    try{
      const payload={tipo:form.tipo,nome:form.nome.trim(),cpf_cnpj:form.cpf_cnpj||null,rg_ie:form.rg_ie||null,email:form.email||null,telefone:form.telefone||null,celular:form.celular||null,limite_credito:Number(form.limite_credito)||0,observacoes:form.observacoes||null,endereco:form.endereco||null,numero:form.numero||null,complemento:form.complemento||null,bairro:form.bairro||null,cidade:form.cidade||null,estado:form.estado||null,cep:form.cep||null,ativo:1,updated_at:new Date().toISOString(),papeis:(form.papeis??[]).length>0?form.papeis:['cliente']}
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

  const hasFilter = Object.values(filters).some(Boolean)

  return (
    <div>

      <PageHeader
        title="👤 Clientes"
        subtitle={`${lista.length} cliente(s) cadastrado(s)`}
        actions={<Btn onClick={() => abrir()}>+ Novo Cliente</Btn>}
      />

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="filter-row">
        <div style={{position:'relative',flex:'2 1 180px',minWidth:160}}>
          <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="ds-input" style={{paddingLeft:32}}
            placeholder="Nome do cliente..." value={filters.busca}
            onChange={e=>setFilters(f=>({...f,busca:e.target.value}))} />
        </div>
        <input className="ds-input" style={{flex:'1 1 140px',minWidth:130}}
          placeholder="CPF / CNPJ..." value={filters.cpf_cnpj}
          onChange={e=>setFilters(f=>({...f,cpf_cnpj:e.target.value}))} />
        <input className="ds-input" style={{flex:'1 1 140px',minWidth:130}}
          placeholder="Telefone..." value={filters.telefone}
          onChange={e=>setFilters(f=>({...f,telefone:e.target.value}))} />
        <select className="ds-select" style={{flex:'0 0 auto',width:'auto',minWidth:130}}
          value={filters.tipo} onChange={e=>setFilters(f=>({...f,tipo:e.target.value}))}>
          <option value="">Todos os tipos</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
        {hasFilter && (
          <button className="btn-clear-filter"
            onClick={()=>setFilters({busca:'',tipo:'',cpf_cnpj:'',telefone:''})}>
            ✕ Limpar
          </button>
        )}
      </div>

      <DataTable loading={loading} emptyMessage="Nenhum cliente encontrado."
        columns={[
          {key:'nome', label:'Nome', render:r=>(
            <div>
              <div style={{fontWeight:600}}>{r.nome}</div>
              {r.email && <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:1}}>{r.email}</div>}
            </div>
          )},
          {key:'tipo', label:'Tipo', render:r=><Badge value={r.tipo} />},
          {key:'papeis', label:'Papéis', render:r=>{
            const icons:Record<string,string>={cliente:'👤',fornecedor:'📦',transportador:'🚛',funcionario:'👷',representante:'🤝'}
            const papeis=(r.papeis??['cliente']) as string[]
            return (
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {papeis.map((p:string)=>(
                  <span key={p} style={{display:'inline-flex',alignItems:'center',gap:3,
                    padding:'2px 8px',borderRadius:'var(--r-sm)',fontSize:'var(--fs-xs)',fontWeight:600,
                    background:'var(--c-primary-light,#e8f4f8)',color:'var(--c-primary)',border:'1px solid var(--c-primary)'}}>
                    {icons[p]??'•'} {p.charAt(0).toUpperCase()+p.slice(1)}
                  </span>
                ))}
              </div>
            )
          }},
          {key:'cpf_cnpj', label:'CPF/CNPJ', render:r=>(
            <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--fs-md)'}}>{r.cpf_cnpj||'—'}</span>
          )},
          {key:'contato', label:'Contato', render:r=>(
            <span style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>{r.celular||r.telefone||'—'}</span>
          )},
          {key:'cidade', label:'Cidade / UF', render:r=>(
            <span style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>
              {r.cidade?`${r.cidade}${r.estado?' / '+r.estado:''}` : '—'}
            </span>
          )},
          {key:'spc', label:'SPC', render:r=>alertaSPC(r)==='warning'
            ?<Badge value="pendente" label={r.ultima_consulta_spc?'SPC Vencido':'Pendente'} dot />
            :<Badge value={r.status_spc||'limpo'} label={r.status_spc||'Limpo'} dot />
          },
        ]}
        data={lista}
        onRowClick={row=>abrir(row)}
        actions={row=>(
          <div style={{display:'flex',justifyContent:'center'}}>
            <ActionButtons onDelete={()=>inativar(row.id)} deleteConfirm="Inativar este cliente?" />
          </div>
        )}
      />

      <SlidePanel open={panel} onClose={()=>setPanel(false)} title={editId?'Editar Cliente':'Novo Cliente'} subtitle={editId?form.nome:'Preencha os dados do cliente'} width="lg"
        footer={<div style={{display:'flex',gap:10}}><Btn variant="secondary" style={{flex:1}} onClick={()=>setPanel(false)}>Cancelar</Btn><Btn style={{flex:1}} loading={saving} onClick={salvar}>{editId?'Atualizar':'Salvar'} Cliente</Btn></div>}>
        <Tabs tabs={[{key:'dados',label:'Dados',icon:'👤'},{key:'enderecos',label:'Endereços',icon:'📍'},{key:'contatos',label:'Contatos',icon:'📞'},{key:'spc',label:'SPC',icon:'🔍'}]} active={tab} onChange={setTab} />
        {erro&&<div className="ds-alert-error" style={{marginTop:12}}>{erro}</div>}
        <div style={{marginTop:16}}>
          {tab==='dados'&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
                <FormField label="Tipo"><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,cpf_cnpj:''})} className={selectCls}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></select></FormField>
                <FormField label={form.tipo==='PJ'?'CNPJ':'CPF'}>
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
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <FormField label={form.tipo==='PJ'?'Insc. Estadual':'RG'}><input {...F('rg_ie')} className={inputCls} /></FormField>
                <FormField label="Email"><input type="email" {...F('email')} onChange={e=>setForm({...form,email:e.target.value.toLowerCase()})} className={inputCls} /></FormField>
                <FormField label="Telefone"><input value={form.telefone||''} onChange={e=>setForm({...form,telefone:formatarPhone(e.target.value)})} className={inputCls} placeholder="(00) 0000-0000" /></FormField>
                <FormField label="Celular"><input value={form.celular||''} onChange={e=>setForm({...form,celular:formatarPhone(e.target.value)})} className={inputCls} placeholder="(00) 00000-0000" /></FormField>
                <FormField label="Limite de Crédito (R$)" style={{gridColumn:"span 2"}}><input type="number" step="0.01" min="0" {...F('limite_credito')} className={inputCls} /></FormField>
              </div>
              <div className="ds-inset">
                <div style={{fontSize:'var(--fs-md)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:12}}>📍 Endereço Principal</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10}}>
                  <FormField label="CEP"><input value={form.cep||''} onChange={e=>setForm({...form,cep:formatarCEP(e.target.value)})} onBlur={e=>buscarCEP(e.target.value,'main')} className={inputCls} placeholder="00000-000" />{loadingCEP==='main'&&<div style={{fontSize:'var(--fs-sm)',color:'var(--c-primary)',marginTop:3}}>🔍 Buscando...</div>}</FormField>
                  <FormField label="Endereço"><input {...F('endereco')} className={inputCls} /></FormField>
                  <FormField label="Número"><input {...F('numero')} className={inputCls} /></FormField>
                  <FormField label="Complemento"><input {...F('complemento')} className={inputCls} /></FormField>
                  <FormField label="Bairro"><input {...F('bairro')} className={inputCls} /></FormField>
                  <FormField label="Cidade"><input {...F('cidade')} className={inputCls} /></FormField>
                  <FormField label="UF"><input {...F('estado')} onChange={e=>setForm({...form,estado:e.target.value.toUpperCase().slice(0,2)})} className={inputCls} maxLength={2} placeholder="SP" /></FormField>
                </div>
              </div>
              <FormField label="Observações"><textarea {...F('observacoes')} rows={2} className={textareaCls} /></FormField>
            </div>
          )}
          {tab==='enderecos'&&(
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {enderecos.map((end,i)=>(
                <div key={i} style={{border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'14px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <select value={end.tipo} onChange={e=>{const a=[...enderecos];a[i].tipo=e.target.value;setEnderecos(a)}} className={selectCls} style={{width:'auto'}}>
                        {tiposEnd.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer'}}>
                        <input type="checkbox" checked={!!end.principal} onChange={e=>{const a=enderecos.map((x,j)=>({...x,principal:j===i?e.target.checked:false}));setEnderecos(a)}} style={{accentColor:'var(--c-primary)'}} /> Principal
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
                <div key={i} style={{border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'14px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer'}}><input type="checkbox" checked={!!ct.principal} onChange={e=>{const a=contatos.map((x,j)=>({...x,principal:j===i?e.target.checked:false}));setContatos(a)}} style={{accentColor:'var(--c-primary)'}} />Principal</label>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--fs-base)',cursor:'pointer',padding:'4px 10px',borderRadius:'var(--r-sm)',background:ct.autorizado_retirada?'var(--c-success-light)':'var(--bg-input)',color:ct.autorizado_retirada?'var(--c-success-text)':'var(--t-secondary)',fontWeight:600}}>
                        <input type="checkbox" checked={!!ct.autorizado_retirada} onChange={e=>{const a=[...contatos];a[i].autorizado_retirada=e.target.checked;setContatos(a)}} style={{accentColor:'var(--c-success)'}} />{ct.autorizado_retirada?'✅':'⬜'} Autorizado a Retirar
                      </label>
                    </div>
                    {contatos.length>1&&<button onClick={()=>setContatos(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--c-danger)',cursor:'pointer',fontSize:'var(--fs-base)'}}>× Remover</button>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
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
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {editId?(
                <>
                  <div className="ds-inset">
                    <div style={{fontSize:'var(--fs-md)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--t-muted)',marginBottom:12}}>Nova Consulta SPC</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
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
                        <div><div style={{fontWeight:600,fontSize:'var(--fs-base)'}}>{s.resultado==='limpo'?'✅':s.resultado==='restrito'?'⚠️':'❌'} {s.resultado.charAt(0).toUpperCase()+s.resultado.slice(1)}</div>{s.observacoes&&<div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)',marginTop:2}}>{s.observacoes}</div>}</div>
                        <div style={{fontSize:'var(--fs-md)',fontWeight:600,color:'var(--t-secondary)'}}>{fmt.date(s.data_consulta)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ):<div style={{textAlign:'center',padding:'32px',color:'var(--t-muted)',fontSize:'var(--fs-base)'}}>Salve o cliente primeiro para registrar consultas SPC.</div>}
            </div>
          )}
        </div>
      </SlidePanel>
    </div>
  )
}
