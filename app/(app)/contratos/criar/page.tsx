'use client'
import { useEffect, useState } from 'react'
import { calcularPrecoItem, calcularDias, type PrecosProduto } from '@/lib/calcularCobranca'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { FormField, inputCls, selectCls, textareaCls, Btn, LookupField } from '@/components/ui'
import { QuickCreateCliente, QuickCreateProduto } from '@/components/quick-create'

// ─── Stepper ─────────────────────────────────────────────────────────────────
const PASSOS = [
  { n:1, label:'Cliente e Período' },
  { n:2, label:'Local de Uso'      },
  { n:3, label:'Equipamentos'      },
  { n:4, label:'Revisão e Valores' },
]

function Stepper({ passo }: { passo: number }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', marginBottom:28 }}>
      {PASSOS.map((p, idx) => {
        const ativo     = passo === p.n
        const concluido = passo > p.n
        return (
          <div key={p.n} style={{ display:'flex', alignItems:'center', flex: idx < PASSOS.length - 1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:80 }}>
              <div style={{
                width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center',
                justifyContent:'center', fontWeight:700, fontSize:'var(--fs-md)', flexShrink:0,
                background: concluido ? 'var(--c-success)' : ativo ? 'var(--c-primary)' : 'var(--bg-header)',
                color:      concluido ? '#fff'             : ativo ? '#fff'              : 'var(--t-muted)',
                border:     `2px solid ${concluido ? 'var(--c-success)' : ativo ? 'var(--c-primary)' : 'var(--border)'}`,
                transition: 'all 250ms',
              }}>{concluido ? '✓' : p.n}</div>
              <div style={{
                fontSize:'var(--fs-sm)', fontWeight: ativo ? 700 : 400, whiteSpace:'nowrap', textAlign:'center',
                color: ativo ? 'var(--c-primary)' : concluido ? 'var(--c-success)' : 'var(--t-muted)',
              }}>{p.label}</div>
            </div>
            {idx < PASSOS.length - 1 && (
              <div style={{ flex:1, height:2, margin:'0 8px', marginBottom:22,
                background: concluido ? 'var(--c-success)' : 'var(--border)', transition:'background 300ms' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Th = ({ children, right }: { children?:React.ReactNode; right?:boolean }) => (
  <th style={{ padding:'8px 12px', fontSize:'var(--fs-md)', fontWeight:700, color:'var(--t-muted)',
    textTransform:'uppercase' as const, letterSpacing:'.04em', textAlign: right ? 'right' as const : 'left' as const,
    background:'var(--bg-header)', borderBottom:'1px solid var(--border)' }}>{children}</th>
)

export default function CriarContratoPage() {
  const router = useRouter()
  const [passo,     setPasso]     = useState(1)
  const [periodos,  setPeriodos]  = useState<any[]>([])
  const [itens,     setItens]     = useState<any[]>([])
  const [saving,    setSaving]    = useState(false)
  const [erro,      setErro]      = useState('')

  // Passo 1 — cliente e período
  const [clienteId,   setClienteId]   = useState<number|null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteData, setClienteData] = useState<any>(null)
  const [form, setForm] = useState<any>({
    periodo_id:'', data_inicio: new Date().toISOString().split('T')[0],
    data_fim:'', forma_pagamento:'pix', caucao:0,
    desconto:0, acrescimo:0, frete:0, comissao_percentual:0, observacoes:'',
    tipo_contrato:'unico', dia_vencimento:'', data_venc_fatura:'',
  })

  // Passo 2 — local de uso
  const [enderecoUsoId,    setEnderecoUsoId]    = useState<number|null>(null)
  const [enderecoUsoData,  setEnderecoUsoData]  = useState<any>(null)
  const [enderecoUsoLabel, setEnderecoUsoLabel] = useState('')
  const [enderecosCliente, setEnderecosCliente] = useState<any[]>([])
  const [loadingEnderecos, setLoadingEnderecos] = useState(false)
  const [localReferencia,  setLocalReferencia]  = useState('')

  // Passo 3 — equipamentos
  const [itemProdutoId,    setItemProdutoId]    = useState<number|null>(null)
  const [itemProdutoNome,  setItemProdutoNome]  = useState('')
  const [itemProduto,      setItemProduto]      = useState<any>(null)
  const [itemPatrimonioId, setItemPatrimonioId] = useState<number|null>(null)
  const [itemPatrimonioNome,setItemPatrimonioNome]=useState('')
  const [itemQtd,          setItemQtd]          = useState(1)
  const [itemPreco,        setItemPreco]        = useState(0)
  const [patrimonios,      setPatrimonios]      = useState<any[]>([])
  const [loadingPats,      setLoadingPats]      = useState(false)

  const F = (k:string) => ({ value:form[k]??'', onChange:(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value})) })
  const dias = form.data_inicio && form.data_fim
    ? Math.max(1, Math.ceil((new Date(form.data_fim).getTime()-new Date(form.data_inicio).getTime())/86400000))
    : 1
  const subtotal       = itens.reduce((s,i)=>s+Number(i.total),0)
  const total          = subtotal - Number(form.desconto) + Number(form.acrescimo) + Number(form.frete)
  const comissaoVal    = total * Number(form.comissao_percentual) / 100
  const totalReposicao = itens.reduce((s,i)=>s+Number(i.custo_reposicao||0)*Number(i.quantidade||1),0)
  const multaDiaria    = itens.reduce((s,i)=>s+Number(i.preco_diario||0),0)

  useEffect(()=>{ supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias').then(({data})=>setPeriodos(data??[])) },[])

  // Recalcular preços dos itens quando período ou datas mudam
  useEffect(() => {
    if (itens.length === 0 || periodos.length === 0) return
    setItens(prev => prev.map(it => {
      if (!it._produto) return it
      const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
      const res = calcularPrecoItem(it._produto as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias ?? 1)
      const qtd = it._produto.controla_patrimonio ? 1 : it.quantidade
      return { ...it, preco_unitario: res.totalItem, total: res.totalItem * qtd, _descricaoCobranca: res.descricao }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[form.periodo_id,dias])

  function aplicarPeriodo(pid:string) {
    const p = periodos.find(x=>x.id==pid)
    if(p && form.data_inicio) {
      const fim=new Date(form.data_inicio); fim.setDate(fim.getDate()+p.dias)
      setForm((f:any)=>({...f,periodo_id:pid,data_fim:fim.toISOString().split('T')[0]}))
    } else setForm((f:any)=>({...f,periodo_id:pid}))
  }

  async function selecionarCliente(id:number|null, row:any|null) {
    setClienteId(id); setClienteNome(row?.nome??''); setClienteData(row)
    setEnderecoUsoId(null); setEnderecoUsoLabel(''); setEnderecoUsoData(null); setEnderecosCliente([])
    if(!id) return
    setLoadingEnderecos(true)
    const { data } = await supabase.from('cliente_enderecos').select('*').eq('cliente_id',id).eq('ativo',1)
      .order('principal',{ascending:false}).order('tipo')
    setEnderecosCliente(data??[])
    setLoadingEnderecos(false)
  }

  function selecionarEnderecoUso(id:number|null, row:any|null) {
    setEnderecoUsoId(id); setEnderecoUsoData(row)
    if(!row){setEnderecoUsoLabel('');return}
    const partes=[row.tipo?.toUpperCase(),row.logradouro,row.numero,row.bairro,row.cidade,row.estado].filter(Boolean)
    setEnderecoUsoLabel(partes.join(', '))
  }

  function getPrecoParaPeriodo(prod:any): number {
    if (!prod) return 0
    const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
    const res = calcularPrecoItem(prod as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias ?? 1)
    return res.totalItem
  }

  function getDescricaoCobranca(prod:any): string {
    if (!prod) return ''
    const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
    const res = calcularPrecoItem(prod as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias ?? 1)
    return res.descricao
  }

  
  async function loadPatrimonios(produtoId:number) {
    setLoadingPats(true)
    const {data}=await supabase.from('patrimonios').select('id,numero_patrimonio,numero_serie,status').eq('produto_id',produtoId).eq('status','disponivel').order('numero_patrimonio')
    setPatrimonios(data??[]); setLoadingPats(false)
  }

  function selecionarProduto(id:number|null, row:any|null) {
    setItemProdutoId(id); setItemProduto(row); setItemProdutoNome(row?.nome??'')
    setItemPreco(getPrecoParaPeriodo(row))
    setItemPatrimonioId(null); setItemPatrimonioNome(''); setPatrimonios([])
    if(id && row?.controla_patrimonio) loadPatrimonios(id)
  }

  function adicionarItem() {
    if(!itemProdutoId||!itemProduto){setErro('Selecione um produto.');return}
    if(itemProduto.controla_patrimonio && !itemPatrimonioId){setErro('Selecione o patrimônio do produto.');return}
    setErro('')
    setItens(prev=>[...prev,{
      produto_id:itemProdutoId, produto_nome:itemProduto.nome,
      patrimonio_id:itemPatrimonioId, patrimonio_num:itemPatrimonioNome||null,
      quantidade:itemQtd, preco_unitario:itemPreco,
      _descricaoCobranca: getDescricaoCobranca(itemProduto),
      preco_diario: Number(itemProduto.preco_locacao_diario??0),
      custo_reposicao: Number(itemProduto.custo_reposicao??0),
      prazo_entrega_dias: Number(itemProduto.prazo_entrega_dias??0),
      total:itemPreco*(itemProduto.controla_patrimonio?1:itemQtd),
      _produto: itemProduto,
    }])
    setItemProdutoId(null); setItemProdutoNome(''); setItemProduto(null)
    setItemPatrimonioId(null); setItemPatrimonioNome('')
    setItemQtd(1); setItemPreco(0); setPatrimonios([])
  }

  // ── Validação por passo ───────────────────────────────────────────────────
  function validar():string {
    if(passo===1){
      if(!clienteId)        return 'Selecione o cliente.'
      if(!form.data_inicio) return 'Informe a data de início.'
      if(!form.data_fim)    return 'Informe a data de fim.'
    }
    if(passo===3){
      if(itens.length===0) return 'Adicione pelo menos 1 equipamento.'
    }
    return ''
  }

  function avancar() {
    const msg=validar()
    if(msg){setErro(msg);return}
    setErro(''); setPasso(p=>p+1); window.scrollTo(0,0)
  }
  function voltar() { setErro(''); setPasso(p=>p-1); window.scrollTo(0,0) }

  async function salvar() {
    if(itens.length===0){setErro('Adicione pelo menos 1 item.');return}
    setSaving(true); setErro('')
    const localUso = enderecoUsoData ? {
      local_uso_cep:         enderecoUsoData.cep??null,
      local_uso_endereco:    enderecoUsoData.logradouro??null,
      local_uso_numero:      enderecoUsoData.numero??null,
      local_uso_complemento: enderecoUsoData.complemento??null,
      local_uso_bairro:      enderecoUsoData.bairro??null,
      local_uso_cidade:      enderecoUsoData.cidade??null,
      local_uso_estado:      enderecoUsoData.estado??null,
      local_uso_referencia:  localReferencia||null,
    } : { local_uso_referencia:localReferencia||null }

    const res=await fetch('/api/contratos/criar',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...form,...localUso,cliente_id:clienteId,itens,subtotal,total,comissao_valor:comissaoVal})})
    const result=await res.json()
    if(result.ok) router.push(`/contratos/${result.id}`)
    else { setErro('Erro: '+result.error); setSaving(false) }
  }

  return (
    <div style={{ maxWidth:800, margin:'0 auto', paddingBottom:60 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={()=>router.back()}
          style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
            cursor:'pointer', color:'var(--t-secondary)', fontSize:16, flexShrink:0 }}>←</button>
        <div>
          <h1 style={{ margin:0, fontSize:'var(--fs-lg)', fontWeight:700, color:'var(--t-primary)' }}>Novo Contrato</h1>
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:2 }}>Contrato de locação de equipamentos</div>
        </div>
      </div>

      <Stepper passo={passo} />

      {erro && <div className="ds-alert-error" style={{ marginBottom:16 }}>{erro}</div>}

      {/* ══════════════════════════════════════════════════════════
          PASSO 1 — CLIENTE E PERÍODO
      ══════════════════════════════════════════════════════════ */}
      {passo===1 && (
        <div className="ds-card" style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div className="ds-section-title">Dados do Cliente</div>
          <LookupField
            label="Cliente" required placeholder="Pesquisar cliente..."
            value={clienteId} displayValue={clienteNome}
            onChange={(id,row)=>selecionarCliente(id as number,row)}
            table="clientes" searchColumn="nome" extraColumns="tipo,cpf_cnpj,celular"
            filter={{ativo:1}} orderBy="nome"
            renderOption={row=>(
              <div>
                <div style={{ fontWeight:500 }}>{row.nome}</div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  {row.tipo}{row.cpf_cnpj?` · ${row.cpf_cnpj}`:''}{row.celular?` · ${row.celular}`:''}
                </div>
              </div>
            )}
            createPanelTitle="Novo Cliente" createPanelWidth="lg"
            createPanel={({onClose,onCreated}:any)=><QuickCreateCliente onClose={onClose} onCreated={r=>{selecionarCliente(r.id,r);onCreated(r)}}/>}
          />

          <div className="ds-section-title" style={{ marginTop:8 }}>Período de Locação</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <FormField label="Período Predefinido">
              <select value={form.periodo_id} onChange={e=>aplicarPeriodo(e.target.value)} className={selectCls}>
                <option value="">Personalizado</option>
                {periodos.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.dias}d)</option>)}
              </select>
            </FormField>
            <FormField label="Forma de Pagamento">
              <select {...F('forma_pagamento')} className={selectCls}>
                {['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia'].map(v=>(
                  <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Data de Início" required>
              <input type="date" {...F('data_inicio')} className={inputCls}/>
            </FormField>
            <FormField label="Data de Fim" required>
              <input type="date" {...F('data_fim')} min={form.data_inicio} className={inputCls}/>
            </FormField>
          </div>

          {form.data_inicio && form.data_fim && (
            <div style={{ background:'var(--c-info-light)', border:'1px solid var(--c-info)', borderRadius:'var(--r-sm)',
              padding:'8px 14px', fontSize:'var(--fs-md)', color:'var(--c-info-text)', fontWeight:500 }}>
              Duração: <strong>{dias} dia(s)</strong>
            </div>
          )}

          <FormField label="Observações">
            <textarea {...F('observacoes')} rows={2} className={textareaCls} placeholder="Observações gerais do contrato..."/>
          </FormField>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PASSO 2 — LOCAL DE USO
      ══════════════════════════════════════════════════════════ */}
      {passo===2 && (
        <div className="ds-card" style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div className="ds-section-title">Local de Uso dos Equipamentos</div>
            <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:4 }}>
              Selecione o endereço de entrega ou deixe em branco para definir depois.
            </div>
          </div>

          {!clienteId ? (
            <div style={{ padding:'20px', textAlign:'center', color:'var(--t-muted)', border:'2px dashed var(--border)', borderRadius:'var(--r-md)' }}>
              Nenhum cliente selecionado no passo anterior.
            </div>
          ) : loadingEnderecos ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--t-muted)' }}>
              <div className="ds-spinner" style={{ width:14, height:14 }}/> Carregando endereços...
            </div>
          ) : enderecosCliente.length===0 ? (
            <div style={{ background:'var(--c-warning-light)', border:'1px solid var(--c-warning)', borderRadius:'var(--r-md)', padding:'12px 16px', fontSize:'var(--fs-md)', color:'var(--c-warning-text)' }}>
              Este cliente não possui endereços cadastrados. Cadastre na ficha do cliente ou continue sem endereço.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {enderecosCliente.map(end=>{
                const sel=enderecoUsoId===end.id
                const linha1=[end.logradouro,end.numero,end.complemento].filter(Boolean).join(', ')
                const linha2=[end.bairro,end.cidade,end.estado].filter(Boolean).join(' / ')
                return (
                  <button key={end.id} type="button"
                    onClick={()=>selecionarEnderecoUso(sel?null:end.id, sel?null:end)}
                    style={{
                      border:`2px solid ${sel?'var(--c-primary)':'var(--border)'}`,
                      background:sel?'var(--c-primary-light)':'var(--bg-card)',
                      borderRadius:'var(--r-md)', padding:'12px 14px', cursor:'pointer',
                      textAlign:'left', transition:'all 150ms',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, padding:'2px 7px', borderRadius:'var(--r-xs)',
                          background: sel?'var(--c-primary)':'var(--bg-header)',
                          color: sel?'#fff':'var(--t-muted)' }}>
                          {end.tipo?.toUpperCase()||'ENDEREÇO'}
                        </span>
                        {end.principal && <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--c-primary)' }}>PRINCIPAL</span>}
                      </div>
                      {sel && <span style={{ fontWeight:700, color:'var(--c-primary)' }}>✓ Selecionado</span>}
                    </div>
                    {linha1 && <div style={{ fontWeight:500, fontSize:'var(--fs-base)', color:'var(--t-primary)' }}>{linha1}</div>}
                    {linha2 && <div style={{ fontSize:'var(--fs-md)', color:'var(--t-secondary)', marginTop:2 }}>{linha2}</div>}
                    {end.cep && <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:2 }}>CEP: {end.cep}</div>}
                  </button>
                )
              })}
            </div>
          )}

          {(enderecoUsoId || enderecosCliente.length===0) && (
            <FormField label="Referência / Observações do local">
              <input value={localReferencia} onChange={e=>setLocalReferencia(e.target.value)}
                className={inputCls} placeholder="Ex: Obra no 3º andar, portão azul, solicitar João"/>
            </FormField>
          )}

          {enderecoUsoData && (
            <div style={{ background:'var(--c-success-light)', border:'1px solid var(--c-success)', borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)', color:'var(--c-success-text)' }}>
              Endereço selecionado: <strong>{enderecoUsoLabel}</strong>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PASSO 3 — EQUIPAMENTOS
      ══════════════════════════════════════════════════════════ */}
      {passo===3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Adicionar item */}
          <div className="ds-card" style={{ padding:'14px 16px' }}>
            <div className="ds-section-title">Adicionar Equipamento</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'flex-end' }}>
              <LookupField
                label="Produto / Equipamento" required placeholder="Pesquisar equipamento..."
                value={itemProdutoId} displayValue={itemProdutoNome}
                onChange={(id,row)=>selecionarProduto(id as number,row)}
                table="produtos" searchColumn="nome"
                extraColumns="controla_patrimonio,preco_locacao_diario,preco_fds,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_trimestral,preco_semestral,marca,custo_reposicao,prazo_entrega_dias"
                filter={{ativo:1}}
                renderOption={row=>(
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <div>
                      <div style={{ fontWeight:500 }}>{row.nome}</div>
                      {row.marca && <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>{row.marca}</div>}
                    </div>
                    <div style={{ fontWeight:700, color:'var(--c-primary)', whiteSpace:'nowrap', fontSize:'var(--fs-md)' }}>
                      {fmt.money(getPrecoParaPeriodo(row))}
                    </div>
                  </div>
                )}
                createPanelTitle="Novo Produto"
                createPanel={({onClose,onCreated}:any)=><QuickCreateProduto onClose={onClose} onCreated={r=>{selecionarProduto(r.id,r);onCreated(r)}}/>}
              />
              <div style={{ minWidth:80 }}>
                <div className="ds-label" style={{ marginBottom:4 }}>Qtd</div>
                <input type="number" min="1" value={itemQtd}
                  onChange={e=>setItemQtd(Number(e.target.value))}
                  className={inputCls} style={{ width:80 }}
                  disabled={!!itemProduto?.controla_patrimonio}/>
              </div>
              <div style={{ paddingBottom:1 }}>
                <div className="ds-label" style={{ marginBottom:4 }}>&nbsp;</div>
                <Btn onClick={adicionarItem} disabled={!itemProdutoId} size="sm">+ Adicionar</Btn>
              </div>
            </div>

            {/* Patrimônio e preço */}
            {itemProduto?.controla_patrimonio===1 && (
              <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <FormField label="Patrimônio disponível" required>
                  {loadingPats
                    ? <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-md)', color:'var(--t-muted)', height:30 }}><div className="ds-spinner" style={{ width:13, height:13 }}/>Carregando...</div>
                    : patrimonios.length===0
                      ? <div style={{ fontSize:'var(--fs-md)', color:'var(--c-warning-text)', background:'var(--c-warning-light)', padding:'6px 10px', borderRadius:'var(--r-sm)', border:'1px solid var(--c-warning)' }}>Nenhum patrimônio disponível.</div>
                      : <select value={itemPatrimonioId??''} onChange={e=>{
                          const pid=Number(e.target.value)
                          const pat=patrimonios.find(p=>p.id===pid)
                          setItemPatrimonioId(pid||null); setItemPatrimonioNome(pat?.numero_patrimonio??'')
                        }} className={selectCls}>
                          <option value="">Selecione o patrimônio...</option>
                          {patrimonios.map(p=><option key={p.id} value={p.id}>{p.numero_patrimonio}{p.numero_serie?` — ${p.numero_serie}`:''}</option>)}
                        </select>
                  }
                </FormField>
                <FormField label={`Preço/Dia (R$) — ${dias}d`}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                    <input type="number" step="0.01" min="0" value={itemPreco}
                      onChange={e=>setItemPreco(Number(e.target.value))}
                      className={inputCls} style={{ paddingLeft:30 }}/>
                  </div>
                </FormField>
              </div>
            )}
            {itemProduto && !itemProduto.controla_patrimonio && (
              <div style={{ marginTop:12 }}>
                <FormField label={`Preço/Dia (R$) — ${dias}d`} style={{ maxWidth:200 }}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                    <input type="number" step="0.01" min="0" value={itemPreco}
                      onChange={e=>setItemPreco(Number(e.target.value))}
                      className={inputCls} style={{ paddingLeft:30 }}/>
                  </div>
                </FormField>
              </div>
            )}

            {/* Preview do item */}
            {itemPreco>0 && itemProduto && (
              <div style={{ marginTop:12, background:'var(--c-primary-light)', border:'1px solid var(--c-primary)', borderRadius:'var(--r-sm)',
                padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'var(--fs-md)' }}>
                <span style={{ color:'var(--c-primary-text)' }}>
                  {dias}d × {fmt.money(itemPreco)}/dia × {itemProduto.controla_patrimonio?'1 un':`${itemQtd} un`}
                </span>
                <span style={{ fontWeight:800, color:'var(--c-primary)' }}>
                  {fmt.money(itemPreco*dias*(itemProduto.controla_patrimonio?1:itemQtd))}
                </span>
              </div>
            )}
          </div>

          {/* Tabela de itens adicionados */}
          {itens.length>0 && (
            <div className="ds-card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
                fontWeight:700, fontSize:'var(--fs-md)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>{itens.length} equipamento(s) adicionado(s)</span>
                <span style={{ color:'var(--c-primary)', fontWeight:800 }}>{fmt.money(subtotal)}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <Th>Equipamento</Th>
                  <Th>Patrimônio</Th>
                  <Th right>Qtd</Th>
                  <Th right>Preço/período</Th>
                  <Th right>Prazo</Th>
                  <Th right>Total</Th>
                  <Th></Th>
                </tr></thead>
                <tbody>
                  {itens.map((item,i)=>(
                    <tr key={i}>
                      <td style={{ padding:'10px 12px', fontWeight:500, borderBottom:'1px solid var(--border)' }}>
                        <div>{item.produto_nome}</div>
                        {item.custo_reposicao>0&&<div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>Reposição: {fmt.money(item.custo_reposicao)}</div>}
                      </td>
                      <td style={{ padding:'10px 12px', color:'var(--t-muted)', fontFamily:'monospace', fontSize:'var(--fs-md)', borderBottom:'1px solid var(--border)' }}>{item.patrimonio_num??'—'}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>{item.quantidade}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>
                        <div style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{fmt.money(item.total)}</div>
                        <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:1}}>
                          {item._descricaoCobranca ?? getDescricaoCobranca(item._produto)}
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'right', borderBottom:'1px solid var(--border)', fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                        {item.prazo_entrega_dias>0?`${item.prazo_entrega_dias}d`:'—'}
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'var(--c-primary)', borderBottom:'1px solid var(--border)' }}>{fmt.money(item.total)}</td>
                      <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                        <button onClick={()=>setItens(prev=>prev.filter((_,j)=>j!==i))} className="tbl-btn del" title="Remover">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PASSO 4 — REVISÃO E VALORES
      ══════════════════════════════════════════════════════════ */}
      {passo===4 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Resumo geral */}
          <div className="ds-card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)', fontWeight:700 }}>
              Resumo do Contrato
            </div>
            <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {[
                { l:'Cliente',    v: clienteNome },
                { l:'Período',    v: `${fmt.date(form.data_inicio)} → ${fmt.date(form.data_fim)} (${dias}d)` },
                { l:'Pagamento',  v: form.forma_pagamento.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()) },
                { l:'Local de uso', v: enderecoUsoLabel || 'Não informado' },
                { l:'Itens',      v: `${itens.length} equipamento(s)` },
                { l:'Subtotal',   v: fmt.money(subtotal) },
              ].map(k=>(
                <div key={k.l}>
                  <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:3 }}>{k.l}</div>
                  <div style={{ fontWeight:600 }}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ajustes financeiros */}
          <div className="ds-card" style={{ padding:'16px 20px' }}>
            <div className="ds-section-title">Ajustes Financeiros</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                { l:'Desconto (R$)',    f:'desconto' },
                { l:'Acréscimo (R$)',   f:'acrescimo' },
                { l:'Caução (R$)',      f:'caucao' },
                { l:'Comissão (%)',     f:'comissao_percentual' },
              ].map(x=>(
                <FormField key={x.f} label={x.l}>
                  <input type="number" step="0.01" min="0"
                    value={form[x.f]} onChange={e=>setForm((f:any)=>({...f,[x.f]:e.target.value}))}
                    className={inputCls}/>
                </FormField>
              ))}
            </div>

            {/* Totalizador */}
            <div style={{ marginTop:16, borderTop:'2px solid var(--border)', paddingTop:14, display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { l:'Subtotal',   v:fmt.money(subtotal),    c:'var(--t-primary)' },
                Number(form.desconto)>0&&{ l:'Desconto',    v:`− ${fmt.money(form.desconto)}`, c:'var(--c-success-text)' },
                Number(form.acrescimo)>0&&{ l:'Acréscimo',  v:`+ ${fmt.money(form.acrescimo)}`, c:'var(--c-danger)' },
                Number(form.frete)>0&&{ l:'Frete',        v:`+ ${fmt.money(form.frete)}`, c:'var(--c-warning-text)' },
              ].filter(Boolean).map((row:any)=>(
                <div key={row.l} style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-md)' }}>
                  <span style={{ color:'var(--t-secondary)' }}>{row.l}</span>
                  <span style={{ fontWeight:600, color:row.c }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6, paddingTop:6, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>TOTAL</span>
                <span style={{ fontWeight:800, fontSize:'var(--fs-lg)', color:'var(--c-primary)' }}>{fmt.money(total)}</span>
              </div>
              {Number(form.comissao_percentual)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  <span>Comissão ({form.comissao_percentual}%)</span>
                  <span>{fmt.money(comissaoVal)}</span>
                </div>
              )}
              {Number(form.caucao)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  <span>Caução</span>
                  <span>{fmt.money(form.caucao)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Itens */}
          <div className="ds-card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:'var(--fs-md)' }}>
              Equipamentos ({itens.length})
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <Th>Produto</Th><Th>Patrimônio</Th><Th right>Qtd</Th><Th right>Preço/período</Th><Th right>Prazo</Th><Th right>Total</Th>
              </tr></thead>
              <tbody>
                {itens.map((item,i)=>(
                  <tr key={i}>
                    <td style={{ padding:'10px 12px', fontWeight:500, borderBottom:'1px solid var(--border)' }}>{item.produto_nome}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:'var(--fs-md)', color:'var(--t-muted)', borderBottom:'1px solid var(--border)' }}>{item.patrimonio_num??'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>{item.quantidade}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>{fmt.money(item.preco_unitario)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontSize:'var(--fs-md)', color:'var(--t-muted)', borderBottom:'1px solid var(--border)' }}>{item.prazo_entrega_dias>0?`${item.prazo_entrega_dias}d`:'—'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'var(--c-primary)', borderBottom:'1px solid var(--border)' }}>{fmt.money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nota Promissória */}
          {totalReposicao > 0 && (
            <div className="ds-card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:'var(--c-warning-light)', borderBottom:'1px solid var(--c-warning)',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontWeight:700, color:'var(--c-warning-text)' }}>Nota Promissória</div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--c-warning-text)' }}>
                  Garantia de reposição em caso de extravio
                </div>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:12 }}>
                  O cliente deverá assinar uma nota promissória no valor de <strong style={{color:'var(--c-danger)'}}>{fmt.money(totalReposicao)}</strong> cobrindo o custo de reposição dos equipamentos locados.
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{padding:'7px 12px',fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-muted)',textAlign:'left',background:'var(--bg-header)',borderBottom:'1px solid var(--border)'}}>Equipamento</th>
                      <th style={{padding:'7px 12px',fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-muted)',textAlign:'left',background:'var(--bg-header)',borderBottom:'1px solid var(--border)'}}>Patrimônio</th>
                      <th style={{padding:'7px 12px',fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-muted)',textAlign:'right',background:'var(--bg-header)',borderBottom:'1px solid var(--border)'}}>Qtd</th>
                      <th style={{padding:'7px 12px',fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-muted)',textAlign:'right',background:'var(--bg-header)',borderBottom:'1px solid var(--border)'}}>Custo Unit.</th>
                      <th style={{padding:'7px 12px',fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-muted)',textAlign:'right',background:'var(--bg-header)',borderBottom:'1px solid var(--border)'}}>Total Reposição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.filter(i=>i.custo_reposicao>0).map((item,i)=>(
                      <tr key={i}>
                        <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',fontWeight:500}}>{item.produto_nome}</td>
                        <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',fontFamily:'monospace',fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>{item.patrimonio_num??'—'}</td>
                        <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',textAlign:'right'}}>{item.quantidade}</td>
                        <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',textAlign:'right'}}>{fmt.money(item.custo_reposicao)}</td>
                        <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',textAlign:'right',fontWeight:700,color:'var(--c-danger)'}}>{fmt.money(item.custo_reposicao*item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--bg-header)'}}>
                      <td colSpan={4} style={{padding:'9px 12px',fontWeight:700,borderTop:'2px solid var(--border)',textAlign:'right'}}>
                        TOTAL DA NOTA PROMISSÓRIA:
                      </td>
                      <td style={{padding:'9px 12px',fontWeight:800,textAlign:'right',color:'var(--c-danger)',borderTop:'2px solid var(--border)',fontSize:'var(--fs-base)'}}>
                        {fmt.money(totalReposicao)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {multaDiaria > 0 && (
                  <div style={{ marginTop:12, padding:'10px 14px', background:'var(--bg-header)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>
                    Multa por atraso na devolução: <strong>{fmt.money(multaDiaria)}/dia</strong> (soma das diárias dos equipamentos)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Navegação ─────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, gap:12 }}>
        <Btn variant="secondary"
          onClick={passo===1 ? ()=>router.back() : voltar}
          style={{ minWidth:120 }}>
          {passo===1 ? 'Cancelar' : '← Voltar'}
        </Btn>
        {passo<4
          ? <Btn onClick={avancar} style={{ minWidth:160 }}>Próximo →</Btn>
          : <Btn loading={saving} onClick={salvar} style={{ minWidth:200 }}>Salvar Contrato</Btn>
        }
      </div>
    </div>
  )
}
