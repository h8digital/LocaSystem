// build: 2026-05-29 18:10:30
'use client'
import { useEffect, useState } from 'react'
import { calcularPrecoItem, calcularDias, type PrecosProduto } from '@/lib/calcularCobranca'
import { supabase, fmt } from '@/lib/supabase'
import { carregarFeriados, carregarAjusteDiaUtilAtivo, postergarParaDiaUtil } from '@/lib/diasUteis'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormField, inputCls, selectCls, textareaCls, Btn, LookupField, useToast } from '@/components/ui'
import { QuickCreateCliente, QuickCreateProduto } from '@/components/quick-create'

// ─── Stepper ─────────────────────────────────────────────────────────────────
const PASSOS = [
  { n:1, label:'Cliente e Período', icon:'👤' },
  { n:2, label:'Local de Entrega',  icon:'📍' },
  { n:3, label:'Equipamentos',      icon:'🔧' },
  { n:4, label:'Revisão e Valores', icon:'✅' },
]

function Stepper({ passo }: { passo: number }) {
  return (
    <div style={{
      display:'flex', alignItems:'center',
      background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:'var(--r-lg)',
      padding:'16px 24px',
      marginBottom:28,
      gap:0,
    }}>
      {PASSOS.map((p, idx) => {
        const ativo     = passo === p.n
        const concluido = passo > p.n
        return (
          <div key={p.n} style={{ display:'flex', alignItems:'center', flex: idx < PASSOS.length - 1 ? 1 : 'none' }}>
            {/* Step */}
            <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              {/* Círculo */}
              <div style={{
                width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center',
                justifyContent:'center', fontWeight:800, fontSize:15, flexShrink:0,
                background: concluido
                  ? 'rgba(52,211,153,0.2)'
                  : ativo
                    ? 'linear-gradient(135deg,#6366f1,#818cf8)'
                    : 'rgba(255,255,255,0.06)',
                color:   concluido ? '#34d399' : ativo ? '#fff' : 'rgba(255,255,255,0.25)',
                border:  `2px solid ${concluido ? 'rgba(52,211,153,0.5)' : ativo ? '#6366f1' : 'rgba(255,255,255,0.10)'}`,
                boxShadow: ativo ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
                transition: 'all 300ms',
              }}>
                {concluido ? '✓' : p.icon}
              </div>
              {/* Label */}
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <div style={{
                  fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                  color: ativo ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                }}>
                  {`Passo ${p.n}`}
                </div>
                <div style={{
                  fontSize:13, fontWeight: ativo ? 700 : 500, whiteSpace:'nowrap',
                  color: concluido ? '#34d399' : ativo ? '#fff' : 'rgba(255,255,255,0.35)',
                  transition:'color 300ms',
                }}>
                  {p.label}
                </div>
              </div>
            </div>
            {/* Linha conectora */}
            {idx < PASSOS.length - 1 && (
              <div style={{
                flex:1, height:1, margin:'0 16px',
                background: concluido
                  ? 'rgba(52,211,153,0.4)'
                  : 'rgba(255,255,255,0.08)',
                transition:'background 400ms',
              }} />
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
  const toast        = useToast()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const novoPeriodoDe = searchParams.get('novo_periodo_de') // ID do contrato anterior

  const [passo,     setPasso]     = useState(1)
  const [periodos,  setPeriodos]  = useState<any[]>([])
  const [feriados,  setFeriados]  = useState<Set<string>>(new Set())
  const [ajusteDiaUtilAtivo, setAjusteDiaUtilAtivo] = useState(true)
  const [itens,     setItens]     = useState<any[]>([])
  const [saving,    setSaving]    = useState(false)
  const [modalAtivar, setModalAtivar] = useState<{id:number; numero:string}|null>(null)
  const [ativando,    setAtivando]    = useState(false)
  const [avisoRenovacao, setAvisoRenovacao] = useState('')
  const [carregandoAnterior, setCarregandoAnterior] = useState(false)

  // Passo 1 — cliente e período
  const [clienteId,   setClienteId]   = useState<number|null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteData, setClienteData] = useState<any>(null)
  const [form, setForm] = useState<any>({
    periodo_id:'', data_inicio: new Date().toISOString().split('T')[0],
    data_fim:'', forma_pagamento:'pix', caucao:0,
    desconto:0, acrescimo:0, frete:0, comissao_percentual:0, observacoes:'',
    tipo_contrato:'unico', data_venc_fatura:'',
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
  const totalLimpeza   = itens.reduce((s,i)=>s+Number(i.valor_limpeza||0),0)
  const total          = subtotal - Number(form.desconto) + Number(form.acrescimo) + Number(form.frete) + totalLimpeza
  const comissaoVal    = total * Number(form.comissao_percentual) / 100
  const totalReposicao = itens.reduce((s,i)=>s+Number(i.custo_reposicao||0)*Number(i.quantidade||1),0)
  const multaDiaria    = itens.reduce((s,i)=>s+Number(i.preco_diario||0),0)

  useEffect(()=>{ supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias').then(({data})=>setPeriodos(data??[])) },[])
  useEffect(()=>{ carregarFeriados().then(setFeriados) },[])
  useEffect(()=>{ carregarAjusteDiaUtilAtivo().then(setAjusteDiaUtilAtivo) },[])

  // Carregar dados do contrato anterior (Novo Período)
  useEffect(() => {
    if (!novoPeriodoDe || periodos.length === 0) return
    async function carregarAnterior() {
      setCarregandoAnterior(true)
      const { data: ct } = await supabase
        .from('contratos')
        .select('*, clientes(id,nome,cpf_cnpj,celular,tipo), contrato_itens(*, produtos(*))')
        .eq('id', novoPeriodoDe)
        .maybeSingle()

      if (!ct) { setCarregandoAnterior(false); return }

      // Pré-preencher cliente
      setClienteId(ct.clientes?.id ?? null)
      setClienteNome(ct.clientes?.nome ?? '')
      setClienteData(ct.clientes)

      // Pré-preencher forma de pagamento
      setForm((f:any) => ({
        ...f,
        forma_pagamento: ct.forma_pagamento || 'pix',
        frete: ct.frete || 0,
        data_inicio: new Date().toISOString().split('T')[0],
      }))

      // Pré-preencher itens — preços serão recalculados ao selecionar período
      const novosItens = (ct.contrato_itens ?? []).map((ci:any) => {
        const prod = ci.produtos
        return {
          produto_id:     ci.produto_id,
          produto_nome:   prod?.nome ?? ci.descricao_livre ?? '—',
          patrimonio_id:  ci.patrimonio_id,
          patrimonio_num: ci.patrimonio_num ?? null,
          quantidade:     ci.quantidade,
          preco_unitario: 0, // será recalculado quando o período for selecionado
          tipo_item:      'locacao',
          descricao_livre:null,
          preco_diario:   Number(prod?.preco_locacao_diario ?? 0),
          custo_reposicao:Number(prod?.custo_reposicao ?? 0),
          prazo_entrega_dias: Number(prod?.prazo_entrega_dias ?? 0),
          limpeza_contratada: false,
          taxa_limpeza_contratada: Number(prod?.taxa_limpeza_contratada ?? 0),
          taxa_limpeza_avulsa: Number(prod?.taxa_limpeza_avulsa ?? 0),
          valor_limpeza:  0,
          total: 0,
          _produto: prod,
          _descricaoCobranca: 'Selecione o período para calcular',
        }
      })
      setItens(novosItens)

      // Banner informativo
      setAvisoRenovacao(`Contrato ${ct.numero} encerrado. Selecione o novo período e os preços serão calculados automaticamente.`)
      setCarregandoAnterior(false)
    }
    carregarAnterior()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoPeriodoDe, periodos.length])

  // Recalcular preços dos itens quando período ou datas mudam
  useEffect(() => {
    if (itens.length === 0 || periodos.length === 0) return
    setItens(prev => prev.map(it => {
      if (!it._produto) return it
      const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
      const res = calcularPrecoItem(it._produto as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias)
      const qtd = it._produto.controla_patrimonio ? 1 : it.quantidade
      return { ...it, preco_unitario: res.totalItem, total: res.totalItem * qtd, _descricaoCobranca: res.descricao }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[form.periodo_id,dias])

  // Mapear nome do período para tipo_contrato
  function tipoContratoDoPeriodo(nomePeriodo: string): string {
    const n = (nomePeriodo || '').toLowerCase()
    if (n.includes('mensal') || n.includes('mês')) return 'mensal'
    if (n.includes('final') || n.includes('fds') || n.includes('fim de semana')) return 'fds'
    if (n.includes('quinzenal') || n.includes('quinzena')) return 'quinzenal'
    if (n.includes('semanal') || n.includes('semana')) return 'semanal'
    return 'diario'
  }

  function aplicarPeriodo(pid:string) {
    const p = periodos.find((x:any)=>x.id==pid)
    const tipo = tipoContratoDoPeriodo(p?.nome ?? '')
    if (p && form.data_inicio) {
      // Mesma regra para todos os períodos, incluindo mensal: devolução prevista = início + dias do período
      // Se cair em fim de semana ou feriado, adia para o próximo dia útil (quando o ajuste estiver ativado)
      let fim = new Date(form.data_inicio+'T00:00:00'); fim.setDate(fim.getDate() + p.dias)
      if (ajusteDiaUtilAtivo) fim = postergarParaDiaUtil(fim, feriados)
      setForm((f:any)=>({...f, periodo_id:pid, tipo_contrato:tipo, data_fim:fim.toISOString().split('T')[0]}))
    } else {
      setForm((f:any)=>({...f, periodo_id:pid, tipo_contrato:tipo}))
    }
  }

  // ── Novo endereço inline ────────────────────────────────────
  const [showNovoEnd,   setShowNovoEnd]   = useState(false)
  const [salvandoEnd,   setSalvandoEnd]   = useState(false)
  const [buscandoCep,   setBuscandoCep]   = useState(false)
  const [novoEnd,       setNovoEnd]       = useState<any>({
    tipo:'obra', cep:'', logradouro:'', numero:'', complemento:'',
    bairro:'', cidade:'', estado:'', referencia:'', principal:false, flag_obra_entrega:true,
  })

  async function buscarCep(cep: string) {
    const c = cep.replace(/\D/g,'')
    if (c.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d   = await res.json()
      if (!d.erro) {
        setNovoEnd((p:any) => ({
          ...p,
          logradouro: d.logradouro || p.logradouro,
          bairro:     d.bairro     || p.bairro,
          cidade:     d.localidade || p.cidade,
          estado:     d.uf         || p.estado,
          ibge:       d.ibge       || '',
        }))
      }
    } catch(_) {}
    setBuscandoCep(false)
  }

  async function salvarNovoEndereco() {
    if (!novoEnd.logradouro || !novoEnd.numero || !novoEnd.cidade) {
      toast.error('Preencha pelo menos logradouro, número e cidade.')
      return
    }
    if (!clienteId) return
    setSalvandoEnd(true)
    const { data, error } = await supabase.from('cliente_enderecos').insert({
      cliente_id:        clienteId,
      tipo:              novoEnd.tipo || 'obra',
      cep:               novoEnd.cep?.replace(/\D/g,'') || null,
      logradouro:        novoEnd.logradouro,
      numero:            novoEnd.numero,
      complemento:       novoEnd.complemento || null,
      bairro:            novoEnd.bairro || null,
      cidade:            novoEnd.cidade,
      estado:            novoEnd.estado || null,
      referencia:        novoEnd.referencia || null,
      principal:         novoEnd.principal || false,
      flag_obra_entrega: novoEnd.flag_obra_entrega || false,
      ativo:             1,
    }).select().single()
    if (error) { toast.error(error.message, { title: 'Erro ao salvar endereço' }); setSalvandoEnd(false); return }

    // Atualizar lista e selecionar automaticamente o novo
    setEnderecosCliente((prev:any) => [data, ...prev])
    selecionarEnderecoUso(data.id, data)
    setShowNovoEnd(false)
    setNovoEnd({ tipo:'obra', cep:'', logradouro:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', referencia:'', principal:false, flag_obra_entrega:true })
    setSalvandoEnd(false)
  }

  function NE(field: string) {
    return {
      value: novoEnd[field] ?? '',
      onChange: (e: any) => setNovoEnd((p:any) => ({ ...p, [field]: e.target.value })),
    }
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
    const res = calcularPrecoItem(prod as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias)
    return res.totalItem
  }

  function getDescricaoCobranca(prod:any): string {
    if (!prod) return ''
    const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
    const res = calcularPrecoItem(prod as PrecosProduto, dias, p?.nome ?? '', p?.dias ?? dias)
    return res.descricao
  }

  
  async function loadPatrimonios(produtoId:number) {
    setLoadingPats(true)

    // Buscar patrimônios disponíveis para locação
    const { data: disponiveis } = await supabase.from('patrimonios')
      .select('id,numero_patrimonio,numero_serie,status,finalidade')
      .eq('produto_id', produtoId)
      .eq('finalidade', 'locacao')
      .is('deleted_at', null)
      .in('status', ['disponivel','locado']) // incluir locado para verificar abaixo
      .order('numero_patrimonio')

    // Para os locados, verificar via RPC se há contrato ativo real
    // Filtrar: só mostrar disponivel, ou locado sem contrato ativo
    const resultado: any[] = []
    for (const pat of (disponiveis ?? [])) {
      if (pat.status === 'disponivel') {
        resultado.push(pat)
      } else {
        // Verificar se tem contrato ativo (não rascunho/encerrado)
        const { data: contratoAtivo } = await supabase
          .from('contratos')
          .select('id')
          .eq('status', 'ativo')
          .in('id',
            (await supabase.from('contrato_itens').select('contrato_id').eq('patrimonio_id', pat.id)).data?.map((r:any)=>r.contrato_id) ?? [0]
          )
          .limit(1)
          .maybeSingle()
        if (!contratoAtivo) resultado.push({ ...pat, status: 'disponivel' })
      }
    }

    setPatrimonios(resultado)
    setLoadingPats(false)
  }

  function selecionarProduto(id:number|null, row:any|null) {
    setItemProdutoId(id); setItemProduto(row); setItemProdutoNome(row?.nome??'')
    const p = periodos.find((x:any) => String(x.id) === String(form.periodo_id))
    if (row && p) {
      const res = calcularPrecoItem(row as PrecosProduto, dias, p.nome, p.dias ?? dias)
      setItemPreco(res.totalItem)
    } else {
      setItemPreco(getPrecoParaPeriodo(row))
    }
    setItemPatrimonioId(null); setItemPatrimonioNome(''); setPatrimonios([])
    if(id && row?.controla_patrimonio) loadPatrimonios(id)
  }

  function adicionarItem() {
    if(!itemProdutoId||!itemProduto){toast.error('Selecione um produto.');return}
    if(itemProduto.controla_patrimonio && !itemPatrimonioId){toast.error('Selecione o patrimônio do produto.');return}
    setItens(prev=>[...prev,{
      produto_id:itemProdutoId, produto_nome:itemProduto.nome,
      patrimonio_id:itemPatrimonioId, patrimonio_num:itemPatrimonioNome||null,
      quantidade:itemQtd, preco_unitario:itemPreco,
      tipo_item:'locacao', descricao_livre:null,
      _descricaoCobranca: getDescricaoCobranca(itemProduto),
      preco_diario: Number(itemProduto.preco_locacao_diario??0),
      custo_reposicao: Number(itemProduto.custo_reposicao??0),
      prazo_entrega_dias: Number(itemProduto.prazo_entrega_dias??0),
      limpeza_contratada: false,
      taxa_limpeza_contratada: Number(itemProduto.taxa_limpeza_contratada??0),
      taxa_limpeza_avulsa: Number(itemProduto.taxa_limpeza_avulsa??0),
      valor_limpeza: 0,
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
      if(!form.data_fim) return 'Informe a data de fim.'
      if(!form.periodo_id)  return 'Selecione um período.'
    }
    if(passo===3){
      if(itens.length===0) return 'Adicione pelo menos 1 equipamento.'
    }
    return ''
  }

  function avancar() {
    const msg=validar()
    if(msg){toast.error(msg);return}
    setPasso(p=>p+1); window.scrollTo(0,0)
  }
  function voltar() { setPasso(p=>p-1); window.scrollTo(0,0) }

  async function salvar() {
    if(itens.length===0){toast.error('Adicione pelo menos 1 item.');return}
    setSaving(true)
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
      body:JSON.stringify({...form,...localUso,cliente_id:clienteId,itens,subtotal,total,totalLimpeza,comissao_valor:comissaoVal})})
    const result=await res.json()
    if(result.ok) {
      // Mostrar modal perguntando se quer ativar o contrato
      setModalAtivar({ id: result.id, numero: result.numero })
    } else {
      toast.error(result.error)
    }
    setSaving(false)
  }

  async function ativarEImprimir(contratoId: number, numero: string) {
    setAtivando(true)
    try {
      // 1. Ativar o contrato
      const res = await fetch('/api/contratos/ativar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contratoId }),
      })
      const d = await res.json()
      if (!d.ok) { toast.error(d.error, { title: 'Erro ao ativar' }); setAtivando(false); return }

      // 2. Gerar e imprimir a Ordem de Locação (template_id=1)
      try {
        const docRes = await fetch('/api/documentos/gerar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contrato_id: contratoId, template_id: 1 }),
        })
        const docData = await docRes.json()
        if (docData.ok && docData.token) {
          window.open(`/doc/${docData.token}`, '_blank')
        }
      } catch(_) {}

      router.push(`/contratos/${contratoId}`)
    } catch(e: any) {
      toast.error(e.message)
    }
    setAtivando(false)
  }

  return (
    <div className="ds-page-content" style={{ paddingBottom:60 }}>

      {/* Cabeçalho */}
      {/* Cabeçalho */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:28, gap:16,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={()=>router.back()} style={{
            width:40, height:40, borderRadius:'var(--r-md)', flexShrink:0,
            background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
            cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:20,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .15s',
          }}>←</button>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'rgba(255,255,255,0.95)', letterSpacing:'-0.3px', lineHeight:1.2 }}>
              Novo Contrato de Locação
            </h1>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:4 }}>
              Preencha as {PASSOS.length} etapas para criar o contrato
            </div>
          </div>
        </div>
        <div style={{
          padding:'6px 16px', borderRadius:99, flexShrink:0,
          background:'rgba(129,140,248,0.15)', border:'1px solid rgba(129,140,248,0.3)',
          fontSize:12, fontWeight:700, color:'#a5b4fc',
        }}>
          Etapa {passo} de {PASSOS.length}
        </div>
      </div>

      <Stepper passo={passo} />

      {/* Banner Novo Período */}
      {novoPeriodoDe && (
        <div style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'var(--r-md)',padding:'12px 16px',marginBottom:16,fontSize:13,color:'#a5b4fc',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>🔁</span>
          <div>
            <strong>Novo Período</strong> — cliente e equipamentos pré-carregados do contrato anterior.
            Selecione o novo período para recalcular os preços automaticamente.
          </div>
          {carregandoAnterior && <span style={{marginLeft:'auto',color:'var(--t-muted)',fontSize:12}}>Carregando...</span>}
        </div>
      )}

      {avisoRenovacao && <div className="ds-alert-success" style={{ marginBottom:16 }}>{avisoRenovacao}</div>}

      {/* ══════════════════════════════════════════════════════════
          PASSO 1 — CLIENTE E PERÍODO
      ══════════════════════════════════════════════════════════ */}
      {passo===1 && (
        <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.9)', marginBottom:2 }}>Dados do Cliente</div>
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
          <div className="form-grid-auto">
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

          {form.tipo_contrato==='fds' && form.data_inicio && new Date(form.data_inicio+'T00:00:00').getDay()!==5 && (
            <div style={{ background:'var(--c-warning-light)', border:'1px solid var(--c-warning)', borderRadius:'var(--r-sm)',
              padding:'8px 14px', fontSize:'var(--fs-md)', color:'var(--c-warning-text)', fontWeight:500 }}>
              ⚠️ O período "Final de Semana" normalmente começa numa sexta-feira. A data de início selecionada não é sexta-feira.
            </div>
          )}

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
        <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.9)', marginBottom:6 }}>Local de Entrega dos Equipamentos</div>
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
              <div style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",verticalAlign:"middle",flexShrink:0}}/> Carregando endereços...
            </div>
          ) : enderecosCliente.length===0 && !showNovoEnd ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'var(--r-md)', padding:'12px 16px', fontSize:'var(--fs-md)', color:'#fbbf24' }}>
                ⚠️ Este cliente não possui endereços cadastrados.
              </div>
              <Btn onClick={()=>setShowNovoEnd(true)} size="sm" style={{ alignSelf:'flex-start' }}>
                + Cadastrar Novo Endereço
              </Btn>
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

          {/* Botão novo endereço (quando já existem endereços) */}
          {clienteId && !showNovoEnd && enderecosCliente.length > 0 && (
            <Btn onClick={()=>setShowNovoEnd(true)} size="sm" variant="secondary" style={{ alignSelf:'flex-start' }}>
              + Novo Endereço de Entrega
            </Btn>
          )}

          {/* Formulário inline de novo endereço */}
          {showNovoEnd && (
            <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:'var(--r-lg)', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, color:'#a5b4fc', fontSize:14 }}>📍 Novo Endereço de Entrega</div>
                <button onClick={()=>setShowNovoEnd(false)} style={{ background:'none', border:'none', color:'var(--t-muted)', cursor:'pointer', fontSize:18 }}>×</button>
              </div>

              {/* Tipo */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FormField label="Tipo de endereço">
                  <select className={inputCls} {...NE('tipo')}>
                    {['obra','residencial','comercial','industrial','rural','outro'].map(t=>(
                      <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="CEP">
                  <div style={{ position:'relative' }}>
                    <input className={inputCls} placeholder="00000-000"
                      value={novoEnd.cep}
                      onChange={e=>setNovoEnd((p:any)=>({...p, cep:e.target.value}))}
                      onBlur={e=>buscarCep(e.target.value)}
                      maxLength={9}/>
                    {buscandoCep && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t-muted)' }}>Buscando...</span>}
                  </div>
                </FormField>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
                <FormField label="Logradouro *">
                  <input className={inputCls} placeholder="Rua, Av, Rodovia..." {...NE('logradouro')}/>
                </FormField>
                <FormField label="Número *">
                  <input className={inputCls} placeholder="S/N" {...NE('numero')}/>
                </FormField>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FormField label="Complemento">
                  <input className={inputCls} placeholder="Apto, Sala, Galpão..." {...NE('complemento')}/>
                </FormField>
                <FormField label="Bairro">
                  <input className={inputCls} {...NE('bairro')}/>
                </FormField>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
                <FormField label="Cidade *">
                  <input className={inputCls} {...NE('cidade')}/>
                </FormField>
                <FormField label="Estado">
                  <input className={inputCls} maxLength={2} placeholder="RS" {...NE('estado')}
                    onChange={e=>setNovoEnd((p:any)=>({...p, estado:e.target.value.toUpperCase()}))}/>
                </FormField>
              </div>

              <FormField label="Referência / Ponto de referência">
                <input className={inputCls} placeholder="Ex: Próximo ao Sicredi, portão verde..." {...NE('referencia')}/>
              </FormField>

              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={novoEnd.flag_obra_entrega}
                    onChange={e=>setNovoEnd((p:any)=>({...p, flag_obra_entrega:e.target.checked}))}
                    style={{ accentColor:'var(--c-primary)' }}/>
                  <span style={{ color:'var(--t-secondary)' }}>Endereço de obra/entrega</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={novoEnd.principal}
                    onChange={e=>setNovoEnd((p:any)=>({...p, principal:e.target.checked}))}
                    style={{ accentColor:'var(--c-primary)' }}/>
                  <span style={{ color:'var(--t-secondary)' }}>Definir como endereço principal</span>
                </label>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <Btn variant="secondary" style={{ flex:1 }} onClick={()=>setShowNovoEnd(false)}>Cancelar</Btn>
                <Btn style={{ flex:2 }} loading={salvandoEnd} onClick={salvarNovoEndereco}>
                  💾 Salvar e Selecionar Este Endereço
                </Btn>
              </div>
            </div>
          )}

          {(enderecoUsoId || enderecosCliente.length===0) && !showNovoEnd && (
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
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* ── FORMULÁRIO: EQUIPAMENTO ─────────────────────────────── */}
          {true && (
            <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'24px 28px' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,0.9)', marginBottom:12 }}>Adicionar Equipamento de Locação</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'flex-end' }}>
                <LookupField
                  label="Produto / Equipamento" required placeholder="Pesquisar equipamento..."
                  value={itemProdutoId} displayValue={itemProdutoNome}
                  onChange={(id,row)=>selecionarProduto(id as number,row)}
                  table="produtos" searchColumn="nome"
                  extraColumns="controla_patrimonio,preco_locacao_diario,preco_fds,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_trimestral,preco_semestral,marca,custo_reposicao,prazo_entrega_dias,taxa_limpeza_contratada,taxa_limpeza_avulsa"
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

              {itemProduto?.controla_patrimonio===1 && (
                <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <FormField label="Patrimônio disponível" required>
                    {loadingPats
                      ? <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-md)', color:'var(--t-muted)', height:30 }}><div style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",verticalAlign:"middle",flexShrink:0}}/>Carregando...</div>
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
                  <FormField
                    label={getDescricaoCobranca(itemProduto) ? `Preço do período (R$)` : `Preço/Dia (R$)`}
                    hint={getDescricaoCobranca(itemProduto) || undefined}
                  >
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
                  <FormField label={getDescricaoCobranca(itemProduto) ? `Preço do período (R$)` : `Preço/Dia (R$)`} hint={getDescricaoCobranca(itemProduto) || undefined} style={{ maxWidth:200 }}>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                      <input type="number" step="0.01" min="0" value={itemPreco}
                        onChange={e=>setItemPreco(Number(e.target.value))}
                        className={inputCls} style={{ paddingLeft:30 }}/>
                    </div>
                  </FormField>
                </div>
              )}
              {itemPreco>0 && itemProduto && (
                <div style={{ marginTop:12, background:'var(--c-primary-light)', border:'1px solid var(--c-primary)', borderRadius:'var(--r-sm)',
                  padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'var(--fs-md)' }}>
                  <span style={{ color:'var(--c-primary-text)' }}>
                    {getDescricaoCobranca(itemProduto) || `${dias}d`}
                    {' × '}{itemProduto.controla_patrimonio ? '1 un' : `${itemQtd} un`}
                  </span>
                  <span style={{ fontWeight:800, color:'var(--c-primary)' }}>
                    {fmt.money(itemPreco*(itemProduto.controla_patrimonio?1:itemQtd))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── LISTA DE ITENS ────────────────────────────────────────────── */}
          {itens.length>0 && (
            <div className="ds-card" style={{ overflow:'hidden' }}>
              {/* Locação */}
              {itens.length > 0 && (
                <>
                  <div style={{ padding:'10px 14px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)',
                    fontWeight:700, fontSize:'var(--fs-md)', display:'flex', justifyContent:'space-between' }}>
                    <span>📦 Equipamentos de Locação ({itens.length})</span>
                    <span style={{ color:'var(--c-primary)', fontWeight:800 }}>
                      {fmt.money(itens.reduce((s,i)=>s+i.total,0))}
                    </span>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>
                      <Th>Equipamento</Th><Th>Patrimônio</Th>
                      <Th right>Qtd</Th><Th right>Preço</Th><Th right>Total</Th><Th></Th>
                    </tr></thead>
                    <tbody>
                      {itens.map((item,i) => (
                        <tr key={i}>
                          <td style={{ padding:'9px 12px', fontWeight:500, borderBottom:'1px solid var(--border)' }}>
                            <div>{item.produto_nome}</div>
                            <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)' }}>
                              {item._descricaoCobranca}
                            </div>
                            {/* Checkbox de limpeza — só aparece se o produto tem taxa configurada */}
                            {Number(item.taxa_limpeza_contratada) > 0 && (
                              <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:5,
                                fontSize:'var(--fs-xs)', color:'var(--t-secondary)', cursor:'pointer',
                                padding:'3px 6px', borderRadius:'var(--r-sm)',
                                background: item.limpeza_contratada ? 'var(--c-success-light)' : 'var(--bg-header)',
                                border: `1px solid ${item.limpeza_contratada ? 'var(--c-success)' : 'var(--border)'}`,
                                width:'fit-content', transition:'all .15s' }}>
                                <input type="checkbox"
                                  checked={!!item.limpeza_contratada}
                                  onChange={e => setItens(prev => prev.map((it,j) => j!==i ? it : {
                                    ...it,
                                    limpeza_contratada: e.target.checked,
                                    valor_limpeza: e.target.checked ? Number(it.taxa_limpeza_contratada) * Number(it.quantidade) : 0,
                                  }))}
                                  style={{ accentColor:'var(--c-success)', cursor:'pointer' }} />
                                🧹 Limpeza {item.limpeza_contratada ? `incluída — ${fmt.money(Number(item.taxa_limpeza_contratada) * Number(item.quantidade))}` : `(+ ${fmt.money(Number(item.taxa_limpeza_contratada))}/un.)`}
                              </label>
                            )}
                          </td>
                          <td style={{ padding:'9px 12px', color:'var(--t-muted)', fontFamily:'monospace', fontSize:'var(--fs-md)', borderBottom:'1px solid var(--border)' }}>{item.patrimonio_num??'—'}</td>
                          <td style={{ padding:'9px 12px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>{item.quantidade}</td>
                          <td style={{ padding:'9px 12px', textAlign:'right', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)' }}>{fmt.money(item.preco_unitario)}</td>
                          <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color:'var(--c-primary)', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)' }}>{fmt.money(item.total)}</td>
                          <td style={{ padding:'9px 12px', borderBottom:'1px solid var(--border)' }}>
                            <button onClick={()=>setItens(prev=>prev.filter((_,j)=>j!==i))} className="tbl-btn del" title="Remover">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}


              {/* Total geral */}
              <div style={{ padding:'10px 16px', display:'flex', justifyContent:'flex-end',
                gap:8, alignItems:'center', background:'var(--bg-header)', borderTop:'2px solid var(--border)' }}>
                <span style={{ fontWeight:600, color:'var(--t-muted)' }}>Total:</span>
                <span style={{ fontWeight:800, fontSize:'var(--fs-lg)', color:'var(--c-primary)' }}>{fmt.money(subtotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

        {passo===4 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Resumo geral */}
          <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderBottom:'1px solid var(--border)', fontWeight:700 }}>
              Resumo do Contrato
            </div>
            <div className="form-grid-auto" style={{ padding:'16px' }}>
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
          <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:'var(--r-lg)', padding:'24px 28px' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.9)', marginBottom:16 }}>Ajustes Financeiros</div>
            <div className="form-grid-auto">
              {[
                { l:'Desconto (R$)',    f:'desconto' },
                { l:'Acréscimo (R$)',   f:'acrescimo' },
                { l:'Frete (R$)',       f:'frete' },
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
                { l:'Subtotal',        v:fmt.money(subtotal),      c:'var(--t-primary)' },
                Number(form.desconto)>0&&{ l:'Desconto',    v:`− ${fmt.money(form.desconto)}`, c:'var(--c-success-text)' },
                Number(form.acrescimo)>0&&{ l:'Acréscimo',  v:`+ ${fmt.money(form.acrescimo)}`, c:'var(--c-danger)' },
                Number(form.frete)>0&&{ l:'Frete',          v:`+ ${fmt.money(form.frete)}`, c:'var(--c-warning-text)' },
                totalLimpeza>0&&{ l:'🧹 Taxa de Limpeza',   v:`+ ${fmt.money(totalLimpeza)}`, c:'var(--c-info-text,#0369a1)' },
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
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginTop:28, gap:12,
        padding:'20px 24px',
        background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:'var(--r-lg)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button
            onClick={passo===1 ? ()=>router.back() : voltar}
            style={{
              padding:'10px 20px', borderRadius:'var(--r-md)', cursor:'pointer',
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
              color:'rgba(255,255,255,0.7)', fontSize:14, fontWeight:500,
              fontFamily:'var(--font-sans)', transition:'all .15s',
              display:'flex', alignItems:'center', gap:6,
            }}>
            {passo===1 ? '✕ Cancelar' : '← Voltar'}
          </button>
          {passo > 1 && (
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>
              Etapa {passo-1} concluída
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Bolinhas de progresso */}
          <div style={{ display:'flex', gap:6 }}>
            {PASSOS.map(p => (
              <div key={p.n} style={{
                width: passo===p.n ? 20 : 6, height:6, borderRadius:99,
                background: passo>p.n ? '#34d399' : passo===p.n ? '#818cf8' : 'rgba(255,255,255,0.12)',
                transition:'all 300ms',
              }}/>
            ))}
          </div>
          {passo<4
            ? <button onClick={avancar} style={{
                padding:'11px 28px', borderRadius:'var(--r-md)', cursor:'pointer',
                background:'linear-gradient(135deg,#6366f1,#818cf8)',
                border:'none', color:'#fff', fontSize:14, fontWeight:700,
                fontFamily:'var(--font-sans)', transition:'all .15s',
                boxShadow:'0 0 20px rgba(99,102,241,0.35)',
                display:'flex', alignItems:'center', gap:8,
              }}>
                Próximo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            : <button onClick={salvar} disabled={saving} style={{
                padding:'11px 28px', borderRadius:'var(--r-md)', cursor:'pointer',
                background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#34d399,#10b981)',
                border:'none', color:'#fff', fontSize:14, fontWeight:700,
                fontFamily:'var(--font-sans)', transition:'all .15s',
                boxShadow:'0 0 20px rgba(52,211,153,0.3)',
                display:'flex', alignItems:'center', gap:8,
                opacity: saving ? .7 : 1,
              }}>
                {saving ? 'Salvando...' : '✓ Salvar Contrato'}
              </button>
          }
        </div>
      </div>

      {/* ── Modal: Ativar Contrato ──────────────────────────────────────────── */}
      {modalAtivar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#1e293b',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:480,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',overflow:'hidden'}}>

            {/* Header */}
            <div style={{background:'rgba(52,211,153,0.08)',borderBottom:'1px solid var(--border)',padding:'18px 22px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:8}}>✅</div>
              <div style={{fontWeight:800,fontSize:16,color:'#34d399'}}>Contrato salvo com sucesso!</div>
              <div style={{fontSize:12,color:'var(--t-muted)',marginTop:4,fontFamily:'monospace'}}>{modalAtivar.numero}</div>
            </div>

            {/* Body */}
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              <div style={{fontSize:14,color:'var(--t-secondary)',textAlign:'center',lineHeight:1.6}}>
                Deseja <strong style={{color:'var(--t-primary)'}}>ativar o contrato agora</strong> e imprimir a{' '}
                <strong style={{color:'#818cf8'}}>Ordem de Locação</strong>?
              </div>

              <div style={{background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px',fontSize:13,color:'var(--t-muted)',lineHeight:1.6}}>
                🖨️ Ao ativar, a <strong style={{color:'var(--t-secondary)'}}>Ordem de Locação de Bens Móveis</strong> será gerada e aberta automaticamente para impressão.
              </div>

              <div style={{display:'flex',gap:10,marginTop:4}}>
                {/* Só salvar — ir para o contrato sem ativar */}
                <button
                  onClick={()=>router.push(`/contratos/${modalAtivar.id}`)}
                  style={{flex:1,padding:'12px',borderRadius:'var(--r-md)',border:'1px solid var(--border)',background:'transparent',color:'var(--t-secondary)',cursor:'pointer',fontSize:13,fontWeight:600}}>
                  Salvar como rascunho
                </button>

                {/* Ativar + imprimir */}
                <button
                  onClick={()=>ativarEImprimir(modalAtivar.id, modalAtivar.numero)}
                  disabled={ativando}
                  style={{flex:2,padding:'12px',borderRadius:'var(--r-md)',border:'none',
                    background: ativando ? '#334155' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color:'#fff',cursor:ativando?'not-allowed':'pointer',fontSize:14,fontWeight:700,
                    display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  {ativando ? (
                    <><div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> Ativando...</>
                  ) : (
                    <>🚀 Ativar e Imprimir Ordem</>
                  )}
                </button>
              </div>
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

    </div>
  )
}
