'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LookupField, FormField, inputCls, selectCls, textareaCls, Btn } from '@/components/ui'
import QuickCreateCliente from '@/components/quick-create/QuickCreateCliente'

// ─── Parser de condição de pagamento ─────────────────────────────────────────
interface Parcela { dias:number; label:string }
function parsearCondicao(expr:string):Parcela[] {
  const str=expr.trim().toLowerCase().replace(/\s+/g,'')
  if(!str) return []
  const parcelas:Parcela[]=[]
  if(/^[\d+]+$/.test(str)&&str.includes('+')){
    const dias=str.split('+').map(Number).filter(d=>!isNaN(d))
    if(dias.length>1){dias.forEach(d=>parcelas.push({dias:d,label:d===0?'À Vista':`${d} dias`}));return parcelas}
  }
  if(/^0$/.test(str)){parcelas.push({dias:0,label:'À Vista'});return parcelas}
  const onlyNx=str.match(/^(\d+)x$/)
  if(onlyNx){const n=parseInt(onlyNx[1]);for(let i=1;i<=n;i++)parcelas.push({dias:i*30,label:`${i*30} dias`});return parcelas}
  const entradaMais=str.match(/^(\d+)\+(\d+)x$/)
  if(entradaMais){
    const entrada=parseInt(entradaMais[1]),n=parseInt(entradaMais[2])
    parcelas.push({dias:entrada,label:entrada===0?'À Vista':`${entrada} dias`})
    for(let i=1;i<=n;i++)parcelas.push({dias:entrada+i*30,label:`${entrada+i*30} dias`})
    return parcelas
  }
  if(/^[\d,]+$/.test(str)){
    str.split(',').map(Number).filter(d=>!isNaN(d)&&d>=0).forEach(d=>parcelas.push({dias:d,label:d===0?'À Vista':`${d} dias`}))
    return parcelas
  }
  return []
}
interface FinanceiroParcela{num:number;descricao:string;dias:number;vencimento:string;valor:number}
function calcularParcelas(expr:string,total:number,dataBase:string):FinanceiroParcela[]{
  const bases=parsearCondicao(expr)
  if(!bases.length)return[]
  const vp=Number((total/bases.length).toFixed(2))
  const diff=Number((total-vp*bases.length).toFixed(2))
  const base=dataBase?new Date(dataBase+'T00:00:00'):new Date()
  return bases.map((p,i)=>{
    const venc=new Date(base);venc.setDate(venc.getDate()+p.dias)
    return{num:i+1,descricao:p.label,dias:p.dias,vencimento:venc.toISOString().slice(0,10),valor:i===bases.length-1?vp+diff:vp}
  })
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
const PASSOS=[
  {n:1,label:'Cliente e Período'},
  {n:2,label:'Equipamentos'},
  {n:3,label:'Local e Pagamento'},
  {n:4,label:'Revisão'},
]
function Stepper({passo}:{passo:number}){
  return(
    <div style={{display:'flex',alignItems:'flex-start',marginBottom:28}}>
      {PASSOS.map((p,idx)=>{
        const ativo=passo===p.n,concluido=passo>p.n
        return(
          <div key={p.n} style={{display:'flex',alignItems:'center',flex:idx<PASSOS.length-1?1:'none' as any}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,minWidth:80}}>
              <div style={{
                width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,fontSize:'var(--fs-md)',flexShrink:0,
                background:concluido?'var(--c-success)':ativo?'var(--c-primary)':'var(--bg-header)',
                color:concluido?'#fff':ativo?'#fff':'var(--t-muted)',
                border:`2px solid ${concluido?'var(--c-success)':ativo?'var(--c-primary)':'var(--border)'}`,
                transition:'all 250ms',
              }}>{concluido?'✓':p.n}</div>
              <div style={{fontSize:'var(--fs-sm)',fontWeight:ativo?700:400,whiteSpace:'nowrap',textAlign:'center',
                color:ativo?'var(--c-primary)':concluido?'var(--c-success)':'var(--t-muted)'}}>{p.label}</div>
            </div>
            {idx<PASSOS.length-1&&(
              <div style={{flex:1,height:2,margin:'0 8px',marginBottom:22,
                background:concluido?'var(--c-success)':'var(--border)',transition:'background 300ms'}}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CriarCotacaoPage(){
  const router=useRouter()
  const [passo,  setPasso]  =useState(1)
  const [saving, setSaving] =useState(false)
  const [erro,   setErro]   =useState('')
  const [periodos,setPeriodos]=useState<any[]>([])
  const [user,   setUser]   =useState<any>(null)
  const [loadingUser,setLoadingUser]=useState(true)

  // Passo 1 — cliente e período
  const [clienteId,   setClienteId]  =useState<number|null>(null)
  const [clienteNome, setClienteNome]=useState('')
  const [periodoId,   setPeriodoId]  =useState<number|null>(null)
  const [periodoNome, setPeriodoNome]=useState('')
  const [periododias, setPeriododias]=useState(0)
  const [dataInicio,  setDataInicio] =useState(()=>new Date().toISOString().slice(0,10))
  const [dataFim,     setDataFim]    =useState('')
  const [dataValidade,setDataValidade]=useState(()=>{const d=new Date();d.setDate(d.getDate()+7);return d.toISOString().slice(0,10)})
  const [observacoes, setObservacoes]=useState('')
  const [obsInternas, setObsInternas]=useState('')

  // Passo 2 — equipamentos
  const [itens,   setItens]  =useState<any[]>([])
  const [qtdNova, setQtdNova]=useState(1)
  const [prodSel, setProdSel]=useState<any>(null)

  // Passo 3 — local e pagamento
  const [localEnd,setLocalEnd]=useState({cep:'',endereco:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',referencia:''})
  const [enderecos,setEnderecos]=useState<any[]>([])
  const [formaPgto,setFormaPgto]=useState('pix')
  const [condicaoPgto,setCondicaoPgto]=useState('0')
  const [showParcelas,setShowParcelas]=useState(false)
  const [desconto,   setDesconto]   =useState(0)
  const [descontoPct,setDescontoPct]=useState(0)
  const [acrescimo,  setAcrescimo]  =useState(0)

  // Derived
  const subtotal  =itens.reduce((s,i)=>s+i.total_item,0)
  const totalFinal=subtotal-Number(desconto)+Number(acrescimo)
  const duracao   =dataInicio&&dataFim?Math.ceil((new Date(dataFim).getTime()-new Date(dataInicio+'T00:00:00').getTime())/86400000)+1:null

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(d.user)setUser(d.user)}).finally(()=>setLoadingUser(false))
  },[])
  useEffect(()=>{
    supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias').then(({data})=>setPeriodos(data??[]))
  },[])
  useEffect(()=>{
    if(!clienteId){setEnderecos([]);return}
    supabase.from('cliente_enderecos').select('*').eq('cliente_id',clienteId).eq('ativo',1)
      .order('principal',{ascending:false}).then(({data})=>setEnderecos(data??[]))
  },[clienteId])
  useEffect(()=>{
    if(dataInicio&&periododias>0){
      const d=new Date(dataInicio+'T00:00:00');d.setDate(d.getDate()+periododias)
      setDataFim(d.toISOString().slice(0,10))
    }
  },[dataInicio,periododias])
  useEffect(()=>{
    if(itens.length===0)return
    setItens(prev=>prev.map(it=>{
      if(!it._produto||it._precoBloqueado)return it
      const novoPreco=getPrecoParaPeriodo(it._produto,periododias)
      return{...it,preco_unitario:novoPreco,total_item:Number((novoPreco*it.quantidade).toFixed(2))}
    }))
  },[periodoId,periododias])

  function getPrecoParaPeriodo(prod:any,dias:number):number{
    if(!prod)return 0
    if(dias>=180&&prod.preco_semestral>0)   return Number(prod.preco_semestral)
    if(dias>=90 &&prod.preco_trimestral>0)  return Number(prod.preco_trimestral)
    if(dias>=30 &&prod.preco_locacao_mensal>0)return Number(prod.preco_locacao_mensal)
    if(dias>=15 &&prod.preco_quinzenal>0)   return Number(prod.preco_quinzenal)
    if(dias>=7  &&prod.preco_locacao_semanal>0)return Number(prod.preco_locacao_semanal)
    return Number(prod.preco_locacao_diario??0)
  }

  function adicionarItem(){
    if(!prodSel)return
    const preco=getPrecoParaPeriodo(prodSel,periododias)
    const existing=itens.findIndex(i=>i.produto_id===prodSel.id)
    if(existing>=0){
      const arr=[...itens]
      arr[existing].quantidade+=qtdNova
      arr[existing].total_item=Number((arr[existing].preco_unitario*arr[existing].quantidade).toFixed(2))
      setItens(arr)
    }else{
      setItens(prev=>[...prev,{
        produto_id:prodSel.id,produto_nome:prodSel.nome,unidade:prodSel.unidade,
        quantidade:qtdNova,preco_unitario:Number(preco),desconto_item:0,
        total_item:Number((Number(preco)*qtdNova).toFixed(2)),
        _produto:prodSel,_precoBloqueado:false,
      }])
    }
    setProdSel(null);setQtdNova(1)
  }
  function editarPreco(idx:number,preco:number){
    const arr=[...itens];arr[idx].preco_unitario=preco;arr[idx].total_item=Number((preco*arr[idx].quantidade).toFixed(2));arr[idx]._precoBloqueado=true;setItens(arr)
  }
  function editarQtd(idx:number,qtd:number){
    const arr=[...itens];arr[idx].quantidade=qtd;arr[idx].total_item=Number((arr[idx].preco_unitario*qtd).toFixed(2));setItens(arr)
  }
  function calcDescPct(pct:number){setDescontoPct(pct);setDesconto(Number(((subtotal*pct)/100).toFixed(2)))}
  function calcDescVal(val:number){setDesconto(val);setDescontoPct(subtotal>0?Number(((val/subtotal)*100).toFixed(2)):0)}

  function validar():string{
    if(passo===1){
      if(!clienteId)return'Selecione o cliente.'
      if(!dataValidade)return'Informe a data de validade.'
    }
    if(passo===2){
      if(itens.length===0)return'Adicione pelo menos um equipamento.'
    }
    return''
  }
  function avancar(){const msg=validar();if(msg){setErro(msg);return}setErro('');setPasso(p=>p+1);window.scrollTo(0,0)}
  function voltar(){setErro('');setPasso(p=>p-1);window.scrollTo(0,0)}

  async function salvar(statusSalvar:'rascunho'|'aguardando'){
    if(!clienteId){setErro('Selecione o cliente.');setPasso(1);return}
    if(itens.length===0){setErro('Adicione pelo menos um equipamento.');setPasso(2);return}
    if(!user){setErro('Não foi possível identificar o usuário. Recarregue a página.');return}
    setSaving(true);setErro('')
    try{
      const token=statusSalvar==='aguardando'
        ?Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('')
        :null
      const {data:cot,error:cotErr}=await supabase.from('cotacoes').insert({
        cliente_id:clienteId,usuario_id:user.id,periodo_id:periodoId||null,
        status:statusSalvar,data_emissao:new Date().toISOString().slice(0,10),
        data_validade:dataValidade,data_inicio:dataInicio||null,data_fim:dataFim||null,
        subtotal:Number(subtotal.toFixed(2)),desconto:Number(desconto),desconto_pct:Number(descontoPct),
        acrescimo:Number(acrescimo),total:Number(totalFinal.toFixed(2)),
        forma_pagamento:formaPgto||null,condicao_pagamento:condicaoPgto||null,
        observacoes:observacoes||null,observacoes_internas:obsInternas||null,
        token_aprovacao:token,
        local_uso_cep:localEnd.cep||null,local_uso_endereco:localEnd.endereco||null,
        local_uso_numero:localEnd.numero||null,local_uso_complemento:localEnd.complemento||null,
        local_uso_bairro:localEnd.bairro||null,local_uso_cidade:localEnd.cidade||null,
        local_uso_estado:localEnd.estado||null,local_uso_referencia:localEnd.referencia||null,
      }).select('id,numero,token_aprovacao').single()
      if(cotErr||!cot)throw new Error(cotErr?.message??'Erro ao salvar cotação')
      const {error:itErr}=await supabase.from('cotacao_itens').insert(itens.map(i=>({
        cotacao_id:cot.id,produto_id:i.produto_id,quantidade:i.quantidade,
        preco_unitario:i.preco_unitario,desconto_item:i.desconto_item,total_item:i.total_item,
      })))
      if(itErr)throw new Error(itErr.message)
      if(statusSalvar==='aguardando'&&cot.token_aprovacao){
        const link=`${window.location.origin}/cotacao/${cot.token_aprovacao}`
        await navigator.clipboard.writeText(link).catch(()=>{})
        alert(`Cotação ${cot.numero} enviada!\n\nLink copiado:\n${link}`)
      }
      router.push('/cotacoes')
    }catch(e:any){setErro(e.message);setSaving(false)}
  }

  return(
    <div style={{maxWidth:800,margin:'0 auto',paddingBottom:60}}>

      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>router.push('/cotacoes')}
          style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',
            background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',
            cursor:'pointer',color:'var(--t-secondary)',fontSize:16,flexShrink:0}}>←</button>
        <div>
          <h1 style={{margin:0,fontSize:'var(--fs-lg)',fontWeight:700,color:'var(--t-primary)'}}>Nova Cotação</h1>
          <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginTop:2}}>Proposta de locação de equipamentos</div>
        </div>
      </div>

      <Stepper passo={passo}/>

      {loadingUser&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:12}}><div className="ds-spinner" style={{width:13,height:13}}/>Carregando sessão...</div>}
      {erro&&<div className="ds-alert-error" style={{marginBottom:16}}>{erro}</div>}

      {/* ══ PASSO 1 — CLIENTE E PERÍODO ══════════════════════════════════ */}
      {passo===1&&(
        <div className="ds-card" style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
          <div className="ds-section-title">Cliente</div>
          <LookupField
            label="Cliente" required table="clientes" searchColumn="nome" extraColumns="cpf_cnpj"
            filter={{ativo:1}} value={clienteId} displayValue={clienteNome}
            onChange={(id,r)=>{setClienteId(id as number|null);setClienteNome(r?.nome??'')}}
            renderOption={r=>(
              <div>
                <div style={{fontWeight:500}}>{r.nome}</div>
                <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',fontFamily:'var(--font-mono)'}}>{r.cpf_cnpj}</div>
              </div>
            )}
            createPanelTitle="Novo Cliente" createPanelWidth="lg"
            createPanel={({onClose,onCreated}:any)=><QuickCreateCliente onClose={onClose} onCreated={r=>{setClienteId(r.id);setClienteNome(r.nome);onCreated(r)}}/>}
          />

          <div className="ds-section-title" style={{marginTop:4}}>Período e Datas</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <FormField label="Período de Locação">
              <select className={selectCls} value={periodoId??''} onChange={e=>{
                const id=Number(e.target.value)||null;setPeriodoId(id)
                const p=periodos.find(p=>p.id===id);setPeriodoNome(p?.nome??'');setPeriododias(p?.dias??0)
              }}>
                <option value="">Selecione...</option>
                {periodos.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.dias}d)</option>)}
              </select>
            </FormField>
            <FormField label="Validade da Cotação" required>
              <input type="date" className={inputCls} value={dataValidade} onChange={e=>setDataValidade(e.target.value)} min={new Date().toISOString().slice(0,10)}/>
            </FormField>
            <FormField label="Data de Início">
              <input type="date" className={inputCls} value={dataInicio} onChange={e=>setDataInicio(e.target.value)}/>
            </FormField>
            <FormField label="Data de Fim">
              <input type="date" className={inputCls} value={dataFim} onChange={e=>setDataFim(e.target.value)} min={dataInicio}/>
            </FormField>
          </div>
          {duracao!==null&&(
            <div style={{background:'var(--c-info-light)',border:'1px solid var(--c-info)',borderRadius:'var(--r-sm)',padding:'8px 14px',fontSize:'var(--fs-md)',color:'var(--c-info-text)',fontWeight:500}}>
              Duração: <strong>{duracao} dia(s)</strong>
            </div>
          )}
          <FormField label="Observações (visível ao cliente)">
            <textarea className={textareaCls} value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={2} placeholder="Condições especiais, informações ao cliente..."/>
          </FormField>
          <FormField label="Observações Internas">
            <textarea className={textareaCls} value={obsInternas} onChange={e=>setObsInternas(e.target.value)} rows={2} placeholder="Notas internas (não visíveis ao cliente)..."/>
          </FormField>
        </div>
      )}

      {/* ══ PASSO 2 — EQUIPAMENTOS ═══════════════════════════════════════ */}
      {passo===2&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Linha de adição */}
          <div className="ds-card" style={{padding:'14px 16px'}}>
            <div className="ds-section-title">
              Adicionar Equipamento
              {periodoNome&&<span style={{marginLeft:10,fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--c-primary)',background:'var(--c-primary-light)',padding:'2px 8px',borderRadius:'var(--r-xs)',textTransform:'none' as const}}>Preços: {periodoNome}</span>}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div style={{flex:1}}>
                <LookupField label="" table="produtos" searchColumn="nome" filter={{ativo:1}}
                  extraColumns="codigo,unidade,preco_locacao_diario,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_trimestral,preco_semestral"
                  value={prodSel?.id??null} displayValue={prodSel?.nome}
                  onChange={(_id,r)=>setProdSel(r)}
                  renderOption={r=>{
                    const preco=getPrecoParaPeriodo(r,periododias)
                    return(
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                        <div>
                          <div style={{fontWeight:500}}>{r.nome}</div>
                          <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',fontFamily:'var(--font-mono)'}}>{r.codigo}</div>
                        </div>
                        {preco>0&&<div style={{fontSize:'var(--fs-md)',fontWeight:700,color:'var(--c-primary)',whiteSpace:'nowrap'}}>{fmt.money(preco)}</div>}
                      </div>
                    )
                  }}
                  placeholder="Buscar equipamento..."
                />
              </div>
              <div style={{width:70}}>
                <div className="ds-label" style={{marginBottom:4}}>Qtd</div>
                <input type="number" min={1} value={qtdNova} onChange={e=>setQtdNova(Math.max(1,Number(e.target.value)))} className={inputCls}/>
              </div>
              <div style={{paddingBottom:1}}>
                <div className="ds-label" style={{marginBottom:4}}>&nbsp;</div>
                <Btn onClick={adicionarItem} disabled={!prodSel} size="sm">+ Incluir</Btn>
              </div>
            </div>
          </div>

          {/* Tabela de itens */}
          {itens.length===0
            ?<div style={{padding:'32px',textAlign:'center',color:'var(--t-muted)',border:'2px dashed var(--border)',borderRadius:'var(--r-md)',fontSize:'var(--fs-md)'}}>Nenhum equipamento adicionado. Use o campo acima para buscar e incluir.</div>
            :<div className="ds-card" style={{overflow:'hidden'}}>
              <div style={{padding:'10px 14px',background:'var(--bg-header)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,fontSize:'var(--fs-md)'}}>{itens.length} equipamento(s)</span>
                <span style={{fontWeight:800,color:'var(--c-primary)'}}>{fmt.money(subtotal)}</span>
              </div>
              <table className="ds-table">
                <thead><tr>
                  <th>Equipamento</th>
                  <th style={{textAlign:'center',width:70}}>Qtd</th>
                  <th style={{textAlign:'right',width:130}}>Preço Unit.</th>
                  <th style={{textAlign:'right',width:120}}>Total</th>
                  <th style={{width:36}}></th>
                </tr></thead>
                <tbody>
                  {itens.map((it,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:500}}>{it.produto_nome}</td>
                      <td style={{textAlign:'center'}}>
                        <input type="number" min={1} value={it.quantidade}
                          onChange={e=>editarQtd(i,Math.max(1,Number(e.target.value)))}
                          className={inputCls} style={{width:56,textAlign:'center',height:26}}/>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <input type="number" min={0} step={0.01} value={it.preco_unitario}
                          onChange={e=>editarPreco(i,Number(e.target.value))}
                          className={inputCls} style={{width:100,textAlign:'right',height:26}}/>
                      </td>
                      <td style={{textAlign:'right',fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmt.money(it.total_item)}</td>
                      <td><button onClick={()=>setItens(prev=>prev.filter((_,j)=>j!==i))} className="tbl-btn del" title="Remover">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}

      {/* ══ PASSO 3 — LOCAL E PAGAMENTO ══════════════════════════════════ */}
      {passo===3&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Local */}
          <div className="ds-card" style={{padding:'16px 20px'}}>
            <div className="ds-section-title">Local de Uso dos Equipamentos</div>
            {enderecos.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:'var(--fs-md)',fontWeight:600,color:'var(--t-secondary)',marginBottom:8}}>Endereços do cliente — clique para selecionar</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {enderecos.map(e=>{
                    const sel=localEnd.endereco===(e.logradouro??'')&&localEnd.cidade===(e.cidade??'')
                    return(
                      <button key={e.id} onClick={()=>setLocalEnd({cep:e.cep??'',endereco:e.logradouro??'',numero:e.numero??'',complemento:e.complemento??'',bairro:e.bairro??'',cidade:e.cidade??'',estado:e.estado??'',referencia:''})}
                        style={{border:`2px solid ${sel?'var(--c-primary)':'var(--border)'}`,borderRadius:'var(--r-sm)',padding:'8px 12px',textAlign:'left',background:sel?'var(--c-primary-light)':'var(--bg-card)',cursor:'pointer',transition:'all 150ms'}}>
                        <div style={{fontSize:'var(--fs-xs)',fontWeight:600,color:'var(--t-muted)',marginBottom:2}}>{(e.tipo??'').toUpperCase()}{e.principal?' · PRINCIPAL':''}</div>
                        <div style={{fontSize:'var(--fs-base)',color:'var(--t-primary)'}}>{[e.logradouro,e.numero,e.bairro,e.cidade,e.estado].filter(Boolean).join(', ')}</div>
                      </button>
                    )
                  })}
                </div>
                <div style={{borderTop:'1px solid var(--border)',margin:'14px 0'}}/>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10}}>
              <FormField label="CEP"><input className={inputCls} value={localEnd.cep} onChange={e=>setLocalEnd(l=>({...l,cep:e.target.value}))} placeholder="00000-000"/></FormField>
              <FormField label="Endereço"><input className={inputCls} value={localEnd.endereco} onChange={e=>setLocalEnd(l=>({...l,endereco:e.target.value}))}/></FormField>
              <FormField label="Número"><input className={inputCls} value={localEnd.numero} onChange={e=>setLocalEnd(l=>({...l,numero:e.target.value}))}/></FormField>
              <FormField label="Complemento"><input className={inputCls} value={localEnd.complemento} onChange={e=>setLocalEnd(l=>({...l,complemento:e.target.value}))}/></FormField>
              <FormField label="Bairro"><input className={inputCls} value={localEnd.bairro} onChange={e=>setLocalEnd(l=>({...l,bairro:e.target.value}))}/></FormField>
              <FormField label="Cidade"><input className={inputCls} value={localEnd.cidade} onChange={e=>setLocalEnd(l=>({...l,cidade:e.target.value}))}/></FormField>
              <FormField label="UF"><input className={inputCls} value={localEnd.estado} onChange={e=>setLocalEnd(l=>({...l,estado:e.target.value.toUpperCase().slice(0,2)}))} maxLength={2} placeholder="RS"/></FormField>
              <FormField label="Referência"><input className={inputCls} value={localEnd.referencia} onChange={e=>setLocalEnd(l=>({...l,referencia:e.target.value}))} placeholder="Próximo ao..."/></FormField>
            </div>
          </div>

          {/* Pagamento */}
          <div className="ds-card" style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
            <div className="ds-section-title">Condições de Pagamento</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <FormField label="Forma de Pagamento">
                <select className={selectCls} value={formaPgto} onChange={e=>setFormaPgto(e.target.value)}>
                  {['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia'].map(v=>(
                    <option key={v} value={v}>{v.replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase())}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Condição de Pagamento" hint="Ex: 0 · 3x · 0+2x · 14+3x · 30+60+90">
                <div style={{display:'flex',gap:6}}>
                  <input className={inputCls} style={{flex:1}} value={condicaoPgto} onChange={e=>{setCondicaoPgto(e.target.value);setShowParcelas(false)}} placeholder="Ex: 0 · 3x · 0+2x"/>
                  <button onClick={()=>setShowParcelas(s=>!s)} disabled={!condicaoPgto.trim()||totalFinal<=0}
                    style={{height:30,padding:'0 10px',display:'flex',alignItems:'center',
                      background:showParcelas?'var(--c-primary)':'var(--bg-header)',
                      color:showParcelas?'#fff':'var(--c-primary)',
                      border:`1px solid ${showParcelas?'var(--c-primary)':'var(--border-input)'}`,
                      borderRadius:'var(--r-sm)',cursor:'pointer',fontSize:'var(--fs-md)',fontWeight:600,fontFamily:'var(--font)',
                      opacity:(!condicaoPgto.trim()||totalFinal<=0)?0.45:1,transition:'all 150ms'}}>
                    Gerar
                  </button>
                </div>
                {showParcelas&&condicaoPgto&&totalFinal>0&&(()=>{
                  const parcelas=calcularParcelas(condicaoPgto,totalFinal,dataInicio)
                  if(!parcelas.length)return<div style={{marginTop:6,fontSize:'var(--fs-sm)',color:'var(--t-muted)',fontStyle:'italic'}}>Formato não reconhecido.</div>
                  return(
                    <div style={{marginTop:8,border:'1px solid var(--border)',borderRadius:'var(--r-sm)',overflow:'hidden'}}>
                      <div style={{background:'var(--bg-header)',borderBottom:'1px solid var(--border)',padding:'5px 10px',fontSize:'var(--fs-sm)',fontWeight:700,color:'var(--t-secondary)',display:'flex',justifyContent:'space-between'}}>
                        <span>{parcelas.length} parcela{parcelas.length>1?'s':''}</span>
                        <span style={{color:'var(--c-primary)'}}>{fmt.money(totalFinal)}</span>
                      </div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--fs-md)'}}>
                        <tbody>
                          {parcelas.map((p,i)=>(
                            <tr key={i} style={{borderBottom:i<parcelas.length-1?'1px solid var(--border)':'none'}}>
                              <td style={{padding:'5px 10px',color:'var(--t-muted)',width:20}}>{p.num}</td>
                              <td style={{padding:'5px 10px',fontWeight:500}}>{p.descricao}</td>
                              <td style={{padding:'5px 10px',fontFamily:'var(--font-mono)',color:'var(--t-secondary)'}}>{fmt.date(p.vencimento)}</td>
                              <td style={{padding:'5px 10px',textAlign:'right',fontWeight:700,color:'var(--c-primary)'}}>{fmt.money(p.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </FormField>
            </div>

            <div className="ds-section-title">Ajuste de Valor</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <FormField label="Desconto %">
                <input type="number" min="0" max="100" step="0.01" className={inputCls} value={descontoPct} onChange={e=>calcDescPct(Number(e.target.value))}/>
              </FormField>
              <FormField label="Desconto R$">
                <input type="number" min="0" step="0.01" className={inputCls} value={desconto} onChange={e=>calcDescVal(Number(e.target.value))}/>
              </FormField>
              <FormField label="Acréscimo R$">
                <input type="number" min="0" step="0.01" className={inputCls} value={acrescimo} onChange={e=>setAcrescimo(Number(e.target.value))}/>
              </FormField>
            </div>
          </div>
        </div>
      )}

      {/* ══ PASSO 4 — REVISÃO ════════════════════════════════════════════ */}
      {passo===4&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Resumo geral */}
          <div className="ds-card" style={{overflow:'hidden'}}>
            <div style={{padding:'12px 16px',background:'var(--bg-header)',borderBottom:'1px solid var(--border)',fontWeight:700}}>Resumo da Cotação</div>
            <div style={{padding:'16px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {[
                {l:'Cliente',     v:clienteNome},
                {l:'Período',     v:periodoNome||(dataInicio&&dataFim?`${fmt.date(dataInicio)} → ${fmt.date(dataFim)}`:'Não informado')},
                {l:'Validade',    v:fmt.date(dataValidade)},
                {l:'Equipamentos',v:`${itens.length} item(ns)`},
                {l:'Pagamento',   v:formaPgto.replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase())},
                {l:'Condição',    v:condicaoPgto||'À Vista'},
              ].map(k=>(
                <div key={k.l}>
                  <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:3}}>{k.l}</div>
                  <div style={{fontWeight:600}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financeiro */}
          <div className="ds-card" style={{padding:'16px 20px'}}>
            <div className="ds-section-title">Resumo Financeiro</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[
                {l:'Subtotal',   v:fmt.money(subtotal),   c:'var(--t-primary)'},
                Number(desconto)>0&&{l:`Desconto (${descontoPct}%)`,v:`− ${fmt.money(desconto)}`,c:'var(--c-success-text)'},
                Number(acrescimo)>0&&{l:'Acréscimo',v:`+ ${fmt.money(acrescimo)}`,c:'var(--c-danger)'},
              ].filter(Boolean).map((row:any)=>(
                <div key={row.l} style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-md)'}}>
                  <span style={{color:'var(--t-secondary)'}}>{row.l}</span>
                  <span style={{fontWeight:600,color:row.c}}>{row.v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,paddingTop:8,borderTop:'2px solid var(--border)'}}>
                <span style={{fontWeight:700,fontSize:'var(--fs-base)'}}>TOTAL</span>
                <span style={{fontWeight:800,fontSize:'var(--fs-lg)',color:'var(--c-primary)'}}>{fmt.money(totalFinal)}</span>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="ds-card" style={{overflow:'hidden'}}>
            <div style={{padding:'10px 16px',background:'var(--bg-header)',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:'var(--fs-md)'}}>
              Equipamentos ({itens.length})
            </div>
            <table className="ds-table">
              <thead><tr><th>Equipamento</th><th style={{textAlign:'center'}}>Qtd</th><th style={{textAlign:'right'}}>Preço</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
              <tbody>
                {itens.map((it,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:500}}>{it.produto_nome}</td>
                    <td style={{textAlign:'center'}}>{it.quantidade}</td>
                    <td style={{textAlign:'right'}}>{fmt.money(it.preco_unitario)}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:'var(--c-primary)'}}>{fmt.money(it.total_item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botões de ação finais */}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
            <Btn variant="secondary" loading={saving} onClick={()=>salvar('rascunho')} style={{minWidth:160}}>Salvar Rascunho</Btn>
            <Btn loading={saving||loadingUser} onClick={()=>salvar('aguardando')} style={{minWidth:200}}>Salvar e Enviar ao Cliente</Btn>
          </div>
        </div>
      )}

      {/* ── Navegação ────────────────────────────────────────────────────── */}
      {passo<4&&(
        <div style={{display:'flex',justifyContent:'space-between',marginTop:24,gap:12}}>
          <Btn variant="secondary" onClick={passo===1?()=>router.push('/cotacoes'):voltar} style={{minWidth:120}}>
            {passo===1?'Cancelar':'← Voltar'}
          </Btn>
          <Btn onClick={avancar} style={{minWidth:160}}>Próximo →</Btn>
        </div>
      )}
      {passo===4&&(
        <div style={{marginTop:16}}>
          <Btn variant="secondary" onClick={voltar} style={{minWidth:120}}>← Voltar</Btn>
        </div>
      )}
    </div>
  )
}
