// build: 2026-05-29 18:10:30
'use client'
import { useEffect, useState, Suspense } from 'react'
import { calcularPrecoItem, calcularDias, type PrecosProduto } from '@/lib/calcularCobranca'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Badge, Btn, Tabs, SlidePanel, FormField, inputCls, selectCls, textareaCls, LookupField, ActionButtons } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th style={{ padding:'10px 16px', fontSize:'var(--fs-md)', fontWeight:700, color:'var(--t-muted)',
    textTransform:'uppercase' as const, letterSpacing:'.04em', textAlign: right ? 'right' as const : 'left' as const,
    background:'var(--bg-header)', borderBottom:'1px solid var(--border)' }}>{children}</th>
)
const Td = ({ children, right, mono, muted, bold, primary }: any) => (
  <td style={{ padding:'11px 16px', fontSize:'var(--fs-base)', borderBottom:'1px solid var(--border)',
    textAlign: right ? 'right' as const : 'left' as const,
    fontFamily: mono ? 'monospace' : undefined,
    color: primary ? 'var(--c-primary)' : muted ? 'var(--t-muted)' : 'var(--t-primary)',
    fontWeight: bold ? 700 : 400 }}>{children}</td>
)
const Campo = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:3 }}>{label}</div>
    <div style={{ fontWeight:600, fontSize:'var(--fs-base)', color:'var(--t-primary)' }}>{value || '—'}</div>
  </div>
)

export default function VerContratoPage() {
  const { id } = useParams()
  const router = useRouter()

  const [contrato,   setContrato]   = useState<any>(null)
  const [itens,      setItens]      = useState<any[]>([])
  const [faturas,    setFaturas]    = useState<any[]>([])
  const [saldoInfo,  setSaldoInfo]  = useState<any>(null)
  const [devolucoes, setDevolucoes] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [templates,  setTemplates]  = useState<any[]>([])
  const [templateSel,setTemplateSel]= useState('')
  const [gerando,    setGerando]    = useState(false)
  const [docLink,    setDocLink]    = useState('')
  const [timeline,      setTimeline]      = useState<any[]>([])
  const [novaAnotacao,  setNovaAnotacao]  = useState('')
  const [salvandoAnot,  setSalvandoAnot]  = useState(false)
  const [erroAnot,      setErroAnot]      = useState('')
  const [aba,        setAba]        = useState('dados')
  const searchParams = useSearchParams()
  useEffect(() => {
    const abaParam = searchParams.get('aba')
    if (abaParam) setAba(abaParam)
  }, [searchParams])
  // ── Pagamento / Fatura ──────────────────────────────────
  const [painelPgto,    setPainelPgto]    = useState(false)
  const [faturaAlvo,    setFaturaAlvo]    = useState<any>(null)
  const [salvandoPgto,  setSalvandoPgto]  = useState(false)
  const [erroPgto,      setErroPgto]      = useState('')
  const [multaJurosInfo, setMultaJurosInfo] = useState<{multa:number,juros:number,dias:number}|null>(null)
  const [formPgto, setFormPgto] = useState<any>({
    valor_pago: 0, data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix', observacoes: ''
  })
  const [painelFatura,  setPainelFatura]  = useState(false)
  const [formNovaFatura, setFormNovaFatura] = useState<any>({
    tipo: 'antecipacao', valor: 0, data_vencimento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix', descricao: '', observacoes: ''
  })
  const [salvandoFatura, setSalvandoFatura] = useState(false)
  const [erroFatura,     setErroFatura]     = useState('')

  // ── Edição de itens ─────────────────────────────────────
  const [painelItem,    setPainelItem]    = useState(false)
  const [editandoItem,  setEditandoItem]  = useState<any>(null)   // null = novo
  const [salvandoItem,  setSalvandoItem]  = useState(false)
  const [erroItem,      setErroItem]      = useState('')
  const [formItem,      setFormItem]      = useState<any>({})
  const [itemProdNome,  setItemProdNome]  = useState('')
  const [patrimonios,   setPatrimonios]   = useState<any[]>([])
  const [loadingPats,   setLoadingPats]   = useState(false)
  const [periodos,     setPeriodos]     = useState<any[]>([])
  const [painelEditar, setPainelEditar] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erroEdicao, setErroEdicao] = useState('')
  const [formEdicao, setFormEdicao] = useState<any>({})
  // ── Renovação ──────────────────────────────────────────────
  const [modalRenovar,    setModalRenovar]    = useState(false)
  const [formRenovar,     setFormRenovar]     = useState<any>({})
  const [renovando,       setRenovando]       = useState(false)
  const [erroRenovar,     setErroRenovar]     = useState('')
  const [calcRenovar,     setCalcRenovar]     = useState<any>(null) // cálculo exibido no modal

  // ── Novo Período ────────────────────────────────────────────
  const [modalNovoPeriodo,  setModalNovoPeriodo]  = useState(false)
  const [calcNovoPeriodo,   setCalcNovoPeriodo]   = useState<any>(null)
  const [formNovoPeriodo,   setFormNovoPeriodo]   = useState<any>({})
  const [encerrando,        setEncerrando]        = useState(false)
  const [erroNovoPeriodo,   setErroNovoPeriodo]   = useState('')

  async function abrirNovoPeriodo() {
    const hoje         = new Date().toISOString().split('T')[0]
    const dataFimAtual = contrato.data_fim || hoje

    const diasOriginais = contrato.data_inicio && contrato.data_fim
      ? Math.max(1, Math.ceil((new Date(contrato.data_fim+'T12:00:00').getTime()-new Date(contrato.data_inicio+'T12:00:00').getTime())/86400000))
      : 1

    const diasAtraso = dataFimAtual < hoje
      ? Math.ceil((Date.now() - new Date(dataFimAtual+'T12:00:00').getTime()) / 86400000)
      : 0

    // Valor diário: soma de preco_diario × qtd de cada item (sem frete)
    const valorDiarioItens = itens.reduce((s:number, item:any) =>
      s + Number(item.preco_diario ?? 0) * Number(item.quantidade ?? 1), 0)

    const valorDiariasExtras = valorDiarioItens * diasAtraso

    // Faturas pendentes
    const pendentes = faturas.filter((f:any) => !['pago','cancelada'].includes(f.status))
    const valorPendente = pendentes.reduce((s:number,f:any) => s + Number(f.saldo_restante ?? f.valor), 0)

    setCalcNovoPeriodo({
      diasOriginais, diasAtraso,
      valorDiario: valorDiarioItens,
      valorDiariasExtras,
      valorPendente, pendentes,
      totalEncerramento: valorPendente + valorDiariasExtras,
    })
    setFormNovoPeriodo({
      forma_pagamento:  contrato.forma_pagamento || 'pix',
      cobrar_diarias:   diasAtraso > 0,
      quitar_pendentes: pendentes.length > 0,
    })
    setErroNovoPeriodo('')
    setModalNovoPeriodo(true)
  }

  async function confirmarNovoPeriodo() {
    setEncerrando(true); setErroNovoPeriodo('')
    try {
      const hoje = new Date().toISOString().split('T')[0]

      // 1. Fatura de diárias extras (se houver atraso)
      if (formNovoPeriodo.cobrar_diarias && calcNovoPeriodo.valorDiariasExtras > 0) {
        const { data: ult } = await supabase.from('faturas').select('numero').order('id',{ascending:false}).limit(1).maybeSingle()
        const seq = ult?.numero ? String(Number(ult.numero.replace(/\D/g,''))+1).padStart(9,'0') : '000000001'
        await supabase.from('faturas').insert({
          contrato_id:     contrato.id,
          numero:          'FAT'+new Date().getFullYear()+seq.slice(-6),
          tipo:            'atraso',
          status:          'pendente',
          valor:            Number(calcNovoPeriodo.valorDiariasExtras.toFixed(2)),
          valor_pago:       0,
          saldo_restante:   Number(calcNovoPeriodo.valorDiariasExtras.toFixed(2)),
          data_emissao:     hoje,
          data_vencimento:  hoje,
          descricao:        `Diárias extras — ${calcNovoPeriodo.diasAtraso} dia(s) × ${fmt.money(calcNovoPeriodo.valorDiario)}/dia`,
          forma_pagamento:  formNovoPeriodo.forma_pagamento,
        })
      }

      // 2. Quitar pendentes (se marcado)
      if (formNovoPeriodo.quitar_pendentes) {
        for (const f of calcNovoPeriodo.pendentes) {
          await supabase.from('faturas').update({
            status:'pago', valor_pago:Number(f.saldo_restante??f.valor),
            valor_recebido:Number(f.saldo_restante??f.valor), saldo_restante:0,
            data_pagamento:hoje, forma_pagamento:formNovoPeriodo.forma_pagamento,
            observacoes:'Quitado no encerramento para novo período',
          }).eq('id',f.id)
        }
      }

      // 3. Encerrar contrato atual via API (gera fatura e abre PDF)
      const res = await fetch('/api/contratos/encerrar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contrato_id: contrato.id }),
      })
      const enc = await res.json()

      // Abrir fatura para impressão
      if (enc.fatura_id) {
        try {
          const fr = await fetch('/api/documentos/fatura',{
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ fatura_id: enc.fatura_id, tipo:'fatura' }),
          })
          const fd = await fr.json()
          if (fd.ok && fd.token) window.open(`/doc/${fd.token}`, '_blank')
        } catch(_) {}
      }

      // 4. Redirecionar para novo contrato pré-preenchido
      setModalNovoPeriodo(false)
      router.push(`/contratos/criar?novo_periodo_de=${contrato.id}`)

    } catch(e:any) { setErroNovoPeriodo('Erro: '+e.message) }
    setEncerrando(false)
  }

  async function abrirRenovar() {
    const hoje         = new Date().toISOString().split('T')[0]
    const dataFimAtual = contrato.data_fim || hoje

    // Dias do período original
    const diasOriginais = contrato.data_inicio && contrato.data_fim
      ? Math.max(1, Math.ceil((new Date(contrato.data_fim+'T12:00:00').getTime()-new Date(contrato.data_inicio+'T12:00:00').getTime())/86400000))
      : 30

    // Dias de atraso (se vencido)
    const diasAtraso = dataFimAtual < hoje
      ? Math.ceil((Date.now() - new Date(dataFimAtual+'T12:00:00').getTime()) / 86400000)
      : 0

    // ── Valor diário: soma dos preco_diario de cada item × quantidade ──────
    // Regra (parametros.multa_atraso_base = 'diaria_item'):
    // Sempre usar contrato_itens.preco_diario — frete e encargos não entram.
    const valorDiarioItens = itens.reduce((s: number, item: any) => {
      const diaria = Number(item.preco_diario ?? 0)
      const qtd    = Number(item.quantidade ?? 1)
      return s + (diaria * qtd)
    }, 0)

    // Diárias extras pelo atraso
    const valorDiariasExtras = valorDiarioItens * diasAtraso

    // Buscar parâmetros de multa
    const { data: params } = await supabase.from('parametros')
      .select('chave,valor')
      .in('chave', ['multa_entrega_ativo','multa_atraso_base'])
    const pMap: Record<string,string> = {}
    ;(params??[]).forEach((p:any) => { pMap[p.chave] = p.valor })

    // Faturas pendentes
    const pendentes = faturas.filter(f => !['pago','cancelada'].includes(f.status))
    const valorPendente = pendentes.reduce((s,f) => s + Number(f.saldo_restante ?? f.valor), 0)

    // Nova data sugerida = hoje + período original
    const novaData = new Date()
    novaData.setDate(novaData.getDate() + diasOriginais)

    setCalcRenovar({
      diasOriginais,
      diasAtraso,
      valorDiario:         valorDiarioItens,
      valorDiariasExtras,
      multaAtivo:          pMap['multa_entrega_ativo'] === 'sim',
      baseCalculo:         pMap['multa_atraso_base'] || 'diaria_item',
      valorPendente,
      pendentes,
    })

    setFormRenovar({
      nova_data_fim:    novaData.toISOString().split('T')[0],
      forma_pagamento:  contrato.forma_pagamento || 'pix',
      cobrar_diarias:   diasAtraso > 0 && pMap['multa_entrega_ativo'] === 'sim',
      quitar_pendentes: pendentes.length > 0,
    })
    setErroRenovar('')
    setModalRenovar(true)
  }

  async function confirmarRenovacao() {
    if (!formRenovar.nova_data_fim) { setErroRenovar('Informe a nova data de fim.'); return }
    if (formRenovar.nova_data_fim <= contrato.data_fim) { setErroRenovar('A nova data de fim deve ser após a data atual do contrato.'); return }
    setRenovando(true); setErroRenovar('')
    try {
      const hoje = new Date().toISOString().split('T')[0]

      // 1. Criar fatura de diárias extras por atraso (se aplicável)
      if (formRenovar.cobrar_diarias && calcRenovar.valorDiariasExtras > 0) {
        const { data: ultimaFat } = await supabase.from('faturas')
          .select('numero').order('id', { ascending: false }).limit(1).maybeSingle()
        const seq = ultimaFat?.numero
          ? String(Number(ultimaFat.numero.replace(/\D/g,'')) + 1).padStart(9,'0')
          : '000000001'
        await supabase.from('faturas').insert({
          contrato_id:      contrato.id,
          numero:           'FAT' + new Date().getFullYear() + seq.slice(-6),
          tipo:             'atraso',
          status:           'pendente',
          valor:            Number(calcRenovar.valorDiariasExtras.toFixed(2)),
          valor_pago:       0,
          saldo_restante:   Number(calcRenovar.valorDiariasExtras.toFixed(2)),
          data_emissao:     hoje,
          data_vencimento:  hoje,
          descricao:        `Diárias extras por atraso — ${calcRenovar.diasAtraso} dia(s) × ${fmt.money(calcRenovar.valorDiario)}/dia`,
          forma_pagamento:  formRenovar.forma_pagamento,
        })
      }

      // 2. Quitar faturas pendentes existentes (se marcado)
      if (formRenovar.quitar_pendentes && calcRenovar.pendentes?.length > 0) {
        for (const f of calcRenovar.pendentes) {
          await supabase.from('faturas').update({
            status:          'pago',
            valor_pago:       Number(f.saldo_restante ?? f.valor),
            valor_recebido:   Number(f.saldo_restante ?? f.valor),
            saldo_restante:   0,
            data_pagamento:   hoje,
            forma_pagamento:  formRenovar.forma_pagamento,
            observacoes:      'Quitado na renovação do contrato',
          }).eq('id', f.id)
        }
      }

      // 3. Atualizar data_fim do contrato
      await supabase.from('contratos').update({
        data_fim:                formRenovar.nova_data_fim,
        data_devolucao_prevista: formRenovar.nova_data_fim,
        updated_at:              new Date().toISOString(),
      }).eq('id', id)

      // 4. Registrar na timeline
      const resumo = [
        formRenovar.cobrar_diarias && calcRenovar.diasAtraso > 0
          ? `${calcRenovar.diasAtraso} diária(s) extra(s): ${fmt.money(calcRenovar.valorDiariasExtras)}`
          : '',
        formRenovar.quitar_pendentes && calcRenovar.pendentes?.length > 0
          ? `${calcRenovar.pendentes.length} fatura(s) quitada(s): ${fmt.money(calcRenovar.valorPendente)}`
          : '',
        `Nova data de devolução: ${fmt.date(formRenovar.nova_data_fim)}`,
      ].filter(Boolean).join(' · ')

      await registrarTimeline('renovacao', `Contrato renovado — ${resumo}`, {
        nova_data_fim:    formRenovar.nova_data_fim,
        dias_atraso:      calcRenovar.diasAtraso,
        diarias_extras:   calcRenovar.valorDiariasExtras,
        pendentes_quitados: formRenovar.quitar_pendentes,
      })

      setModalRenovar(false)
      await load()
    } catch (e: any) {
      setErroRenovar('Erro: ' + e.message)
    }
    setRenovando(false)
  }

  // ── Cobrança Asaas ─────────────────────────────────────────
  const [modalAsaas,    setModalAsaas]    = useState(false)
  const [fatAsaas,      setFatAsaas]      = useState<any>(null)
  const [tipoAsaas,     setTipoAsaas]     = useState<'PIX'|'BOLETO'|'PIX_BOLETO'>('PIX')
  const [asaasResult,   setAsaasResult]   = useState<any>(null)
  const [gerandoAsaas,  setGerandoAsaas]  = useState(false)
  const [erroAsaas,     setErroAsaas]     = useState('')

  function abrirCobrancaAsaas(f: any) {
    setFatAsaas(f); setAsaasResult(null); setErroAsaas(''); setTipoAsaas('PIX'); setModalAsaas(true)
  }

  async function gerarCobrancaAsaas() {
    setGerandoAsaas(true); setErroAsaas('')
    try {
      const res = await fetch('/api/asaas/cobranca', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: fatAsaas.id, tipo: tipoAsaas }),
      })
      const d = await res.json()
      if (!d.ok) { setErroAsaas(d.error); setGerandoAsaas(false); return }
      if (d.ja_paga) {
        setModalAsaas(false)
        await load()
        return
      }
      setAsaasResult(d)
      await load()
    } catch(e: any) { setErroAsaas(e.message) }
    setGerandoAsaas(false)
  }

  async function sincronizarAsaas(faturaId: number) {
    setGerandoAsaas(true)
    try {
      const res = await fetch('/api/asaas/sincronizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: faturaId }),
      })
      const d = await res.json()
      if (d.atualizadas > 0) {
        setModalAsaas(false)
        await load()
      } else {
        setErroAsaas('Pagamento ainda não confirmado no Asaas. Tente novamente em instantes.')
      }
    } catch(e: any) { setErroAsaas((e as any).message) }
    setGerandoAsaas(false)
  }

  // ── Devolução rápida por item ─────────────────────────────────────────────
  const [modalDevItem, setModalDevItem] = useState(false)
  const [itemDevoluver, setItemDevoluver] = useState<any>(null)
  const [formDevItem, setFormDevItem]   = useState<any>({ qtd:1, condicao:'bom', custo_avaria:0, obs:'' })
  const [salvandoDevItem, setSalvandoDevItem] = useState(false)
  const [erroDevItem, setErroDevItem]   = useState('')

  async function load() {
    const [{ data:c },{ data:i },{ data:f }, s,{ data:t },{ data:per },{ data:d }] = await Promise.all([
      supabase.from('contratos').select('*, clientes(*), usuarios(nome), periodos_locacao(nome, dias)').eq('id', id).single(),
      supabase.from('contrato_itens').select('*, produtos(nome), patrimonios(numero_patrimonio)').eq('contrato_id', id),
      supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento'),
      supabase.from('contrato_saldo').select('*').eq('contrato_id', id).maybeSingle(),
      supabase.from('doc_templates').select('id,nome,tipo').eq('ativo',1).order('tipo').order('nome'),
      supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias'),
      supabase.from('devolucoes').select('*, usuarios(nome)').eq('contrato_id', id).order('created_at',{ascending:false}),
    ])
    setContrato(c); setItens(i??[]); setFaturas(f??[]); setSaldoInfo(s?.data ?? s ?? null); setPeriodos(per??[])
    const tlRes = await fetch('/api/contrato-timeline?contrato_id=' + id)
    const tlData = await tlRes.json()
    setTimeline(tlData.ok ? tlData.data : [])
    setTemplates(t??[]); setDevolucoes(d??[]); setLoading(false)
    const pad = t?.find((x:any)=>x.padrao===1&&x.tipo==='contrato')
    if(pad) setTemplateSel(String(pad.id))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  async function cancelar() {
    if(!confirm('Cancelar este contrato? Esta ação não pode ser desfeita.'))return
    await supabase.from('contratos').update({status:'cancelado'}).eq('id',id)
    router.push('/contratos')
  }


  async function registrarTimeline(tipo:string, descricao:string, detalhes?:any) {
    await fetch('/api/contrato-timeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contrato_id: id, tipo, descricao, detalhes })
    })
    const res = await fetch('/api/contrato-timeline?contrato_id=' + id)
    const data = await res.json()
    if (data.ok) setTimeline(data.data)
  }

  function abrirEditar() {
    setFormEdicao({
      periodo_id:         contrato.periodo_id        ?? '',
      data_inicio:        contrato.data_inicio      ?? '',
      data_fim:           contrato.data_fim          ?? '',
      forma_pagamento:    contrato.forma_pagamento   ?? 'pix',
      condicao_pagamento: contrato.condicao_pagamento ?? '',
      desconto:           contrato.desconto          ?? 0,
      acrescimo:          contrato.acrescimo         ?? 0,
      frete:              contrato.frete             ?? 0,
      caucao:             contrato.caucao            ?? 0,
      comissao_percentual:contrato.comissao_percentual ?? 0,
      observacoes:        contrato.observacoes       ?? '',
      observacoes_internas: contrato.observacoes_internas ?? '',
    })
    setErroEdicao('')
    setPainelEditar(true)
  }

  async function salvarEdicao() {
    if (!formEdicao.data_inicio || !formEdicao.data_fim) { setErroEdicao('Datas de início e fim são obrigatórias.'); return }
    setSalvandoEdicao(true); setErroEdicao('')

    // Recalcular preços dos itens se período mudou
    const periodoMudou = formEdicao.periodo_id && formEdicao.periodo_id !== contrato?.periodo_id
    const periodoDias  = periodos.find((p:any) => String(p.id) === String(formEdicao.periodo_id))?.dias ?? 1
    const nomePeríodo  = (periodos.find((p:any) => String(p.id) === String(formEdicao.periodo_id))?.nome ?? '').toLowerCase()
    const isFDS        = nomePeríodo.includes('final') || nomePeríodo.includes('fds')
    const diasTotal    = Math.max(1, Math.ceil(
      (new Date(formEdicao.data_fim).getTime() - new Date(formEdicao.data_inicio).getTime()) / 86400000
    ))

    let itensAtualizados = itens
    if (periodoMudou && itens.length > 0) {
      // Buscar preços atualizados dos produtos
      const prodIds = [...new Set(itens.map((i:any) => i.produto_id))]
      const { data: prods } = await supabase
        .from('produtos')
        .select('id,preco_locacao_diario,preco_fds,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_trimestral,preco_semestral')
        .in('id', prodIds)
      const prodMap: Record<number,any> = {}
      prods?.forEach((p:any) => { prodMap[p.id] = p })

      const periodoObj = periodos.find((p:any) => String(p.id) === String(formEdicao.periodo_id))
      const diasCalc   = calcularDias(formEdicao.data_inicio, formEdicao.data_fim)

      itensAtualizados = itens.map((it:any) => {
        const p = prodMap[it.produto_id]
        if (!p) return it
        const res = calcularPrecoItem(
          p as PrecosProduto,
          diasCalc,
          periodoObj?.nome ?? '',
          periodoObj?.dias ?? diasCalc
        )
        const qtd = Number(it.quantidade ?? 1)
        return { ...it, preco_unitario: res.totalItem, total: res.totalItem * qtd }
      })

      // Salvar novos preços nos itens
      for (const it of itensAtualizados) {
        if (it.id) {
          await supabase.from('contrato_itens').update({
            preco_unitario: it.preco_unitario,
            total:          it.total,
          }).eq('id', it.id)
        }
      }
      setItens(itensAtualizados)
    }

    const subtotal = itensAtualizados.reduce((s: number, i: any) => s + Number(i.total ?? (Number(i.preco_unitario ?? 0) * Number(i.quantidade ?? 1))), 0)
    const total = subtotal - Number(formEdicao.desconto) + Number(formEdicao.acrescimo) + Number(formEdicao.frete)
    const { error } = await supabase.from('contratos').update({
      periodo_id:           formEdicao.periodo_id || null,
      data_inicio:          formEdicao.data_inicio,
      data_fim:             formEdicao.data_fim,
      forma_pagamento:      formEdicao.forma_pagamento,
      condicao_pagamento:   formEdicao.condicao_pagamento || null,
      desconto:             Number(formEdicao.desconto)  || 0,
      acrescimo:            Number(formEdicao.acrescimo) || 0,
      frete:                Number(formEdicao.frete)     || 0,
      caucao:               Number(formEdicao.caucao)    || 0,
      comissao_percentual:  Number(formEdicao.comissao_percentual) || 0,
      comissao_valor:       total * Number(formEdicao.comissao_percentual) / 100,
      total,
      observacoes:          formEdicao.observacoes       || null,
      observacoes_internas: formEdicao.observacoes_internas || null,
    }).eq('id', id)
    if (error) { setErroEdicao('Erro ao salvar: ' + error.message); setSalvandoEdicao(false); return }
    setSalvandoEdicao(false); setPainelEditar(false)
    // Registrar na timeline
    const descTimeline = periodoMudou
      ? 'Contrato alterado — período atualizado e preços recalculados'
      : 'Dados do contrato alterados'
    await registrarTimeline('alteracao', descTimeline)
    // Recarregar contrato
    const { data: c } = await supabase.from('contratos').select('*, clientes(*), usuarios(nome)').eq('id', id).single()
    if (c) setContrato(c)
  }

  async function excluirContrato() {
    if (!confirm(`Excluir o contrato ${contrato.numero}?\n\nEsta ação é irreversível e removerá todos os itens, faturas e movimentações vinculadas.`)) return
    // Deletar em cascata
    await supabase.from('contrato_itens').delete().eq('contrato_id', id)
    await supabase.from('faturas').delete().eq('contrato_id', id)
    await supabase.from('devolucoes').delete().eq('contrato_id', id)
    const { error } = await supabase.from('contratos').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    router.push('/contratos')
  }

  // ── Abrir modal de envio de e-mail ──────────────────────────
  

  async function ativarContrato() {
    if (!confirm(`Ativar o contrato ${contrato.numero}?\n\nIsso registrará a remessa dos equipamentos e mudará o status para ATIVO.`)) return
    const res = await fetch('/api/contratos/ativar', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contrato_id: Number(id) }) })
    const data = await res.json()
    if (!data.ok) { alert(`Erro: ${data.error}`); return }
    alert(data.msg)
    window.location.reload()
  }

  function iniciarCheckin() {
    // Navega para aba de Itens onde o usuário faz devoluções individuais
    setAba('itens')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function encerrarContrato() {
    if (!confirm('Encerrar este contrato?\n\nO sistema verificará se todos os equipamentos foram devolvidos e gerará a fatura de locação se necessário.')) return
    const res = await fetch('/api/contratos/encerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrato_id: Number(id) }),
    })
    const data = await res.json()
    if (data.precisa_devolucao) {
      alert('⚠️ ' + data.error + '\n\nAcesse a aba Itens e registre a devolução primeiro.')
      setAba('itens')
      return
    }
    if (data.fatura_gerada || data.precisa_pagamento) {
      alert('📄 ' + data.error + '\n\nAcesse a aba Financeiro para registrar o pagamento.')
      setAba('financeiro')
      window.location.reload()
      return
    }
    if (!data.ok) {
      alert('Erro: ' + data.error)
      return
    }
    // ── Encerramento bem-sucedido — imprimir fatura obrigatoriamente ──────────
    alert('✅ ' + data.msg + '\n\n🖨️ A fatura será aberta para impressão agora.')
    if (data.fatura_id) {
      // Gerar e abrir o PDF da fatura — obrigatório ao encerrar
      try {
        const fatRes = await fetch('/api/documentos/fatura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fatura_id: data.fatura_id, tipo: 'fatura' }),
        })
        const fatData = await fatRes.json()
        if (fatData.ok && fatData.token) {
          window.open(`/doc/${fatData.token}`, '_blank')
        }
      } catch (_) {}
    }
    window.location.reload()
  }
  // manter alias para compatibilidade
  const encerrarPendente = encerrarContrato

  // ── Funções de pagamento ─────────────────────────────────
  async function abrirPagamento(fatura: any) {
    setFaturaAlvo(fatura)
    setErroPgto('')
    setMultaJurosInfo(null)

    // Calcular juros e multa se fatura estiver vencida
    const hoje      = new Date().toISOString().split('T')[0]
    const venc      = fatura.data_vencimento
    const jaQuitada = ['pago'].includes(fatura.status)

    if (!jaQuitada && venc && hoje > venc) {
      const diasAtraso = Math.floor(
        (new Date(hoje).getTime() - new Date(venc).getTime()) / 86400000
      )
      // Buscar parâmetros de multa/juros
      const { data: params } = await supabase
        .from('parametros')
        .select('chave,valor')
        .in('chave', ['multa_pagamento_percentual','juros_pagamento_mensal'])
      const p: Record<string,number> = {}
      ;(params ?? []).forEach((x: any) => { p[x.chave] = Number(x.valor) })

      const valorBase  = Number(fatura.saldo_restante ?? fatura.valor)
      const multa      = valorBase * (p['multa_pagamento_percentual'] ?? 2) / 100
      const juros      = valorBase * ((p['juros_pagamento_mensal'] ?? 1) / 100 / 30) * diasAtraso
      setMultaJurosInfo({ multa, juros, dias: diasAtraso })

      setFormPgto({
        valor_pago:      (valorBase + multa + juros).toFixed(2),
        data_pagamento:  hoje,
        forma_pagamento: fatura.forma_pagamento ?? contrato.forma_pagamento ?? 'pix',
        observacoes:     `Multa: R$ ${multa.toFixed(2)} + Juros: R$ ${juros.toFixed(2)} (${diasAtraso}d de atraso)`,
      })
    } else {
      setFormPgto({
        valor_pago:      fatura.saldo_restante ?? fatura.valor,
        data_pagamento:  hoje,
        forma_pagamento: fatura.forma_pagamento ?? contrato.forma_pagamento ?? 'pix',
        observacoes:     '',
      })
    }
    setPainelPgto(true)
  }

  async function confirmarPagamento() {
    if (!formPgto.valor_pago || Number(formPgto.valor_pago) <= 0) { setErroPgto('Informe o valor pago.'); return }
    if (!formPgto.data_pagamento) { setErroPgto('Informe a data do pagamento.'); return }
    setSalvandoPgto(true); setErroPgto('')
    const valorPago    = Number(formPgto.valor_pago)
    const jaRecebido   = Number(faturaAlvo?.valor_recebido ?? 0)
    const novoRecebido = jaRecebido + valorPago
    const novoSaldo    = Number(faturaAlvo?.valor ?? 0) - novoRecebido
    const novoStatus   = novoSaldo <= 0.005 ? 'pago' : 'parcial'
    await supabase.from('fatura_recebimentos').insert({
      fatura_id:        faturaAlvo?.id,
      valor:            valorPago,
      data_recebimento: formPgto.data_pagamento,
      forma_pagamento:  formPgto.forma_pagamento,
      observacoes:      formPgto.observacoes || null,
    })
    await supabase.from('faturas').update({
      status:          novoStatus,
      valor_recebido:  novoRecebido,
      saldo_restante:  Math.max(0, novoSaldo),
      data_pagamento:  novoStatus === 'pago' ? formPgto.data_pagamento : null,
      forma_pagamento: formPgto.forma_pagamento,
    }).eq('id', faturaAlvo.id)
    const [{ data: f }, sRes] = await Promise.all([
      supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento'),
      supabase.from('contrato_saldo').select('*').eq('contrato_id', id).maybeSingle(),
    ])
    setFaturas(f ?? [])
    setSaldoInfo(sRes?.data ?? sRes ?? null)
    setSalvandoPgto(false)
    setPainelPgto(false)
  }

  async function salvarAnotacao() {
    if (!novaAnotacao.trim()) { setErroAnot('Digite o texto da anotação.'); return }
    setSalvandoAnot(true); setErroAnot('')
    const cookieUser = document.cookie.split(';').map(s=>s.trim())
      .find(s=>s.startsWith('locasystem_user='))
    const usuario = cookieUser ? JSON.parse(decodeURIComponent(cookieUser.split('=')[1])) : null
    const { error } = await supabase.from('contrato_timeline').insert({
      contrato_id: Number(id),
      usuario_id:  usuario?.id ?? null,
      tipo:        'anotacao',
      descricao:   novaAnotacao.trim(),
      detalhes:    {},
    })
    if (error) { setErroAnot(error.message); setSalvandoAnot(false); return }
    setNovaAnotacao('')
    // Recarregar timeline
    const { data: tl } = await supabase
      .from('contrato_timeline')
      .select('*, usuarios(nome)')
      .eq('contrato_id', id)
      .order('created_at', { ascending: false })
    setTimeline(tl ?? [])
    setSalvandoAnot(false)
  }

  async function excluirAnotacao(evId: number) {
    if (!confirm('Excluir esta anotação?')) return
    await supabase.from('contrato_timeline').delete().eq('id', evId)
    setTimeline(prev => prev.filter((e:any) => e.id !== evId))
  }

  async function estornarPagamento(fatura: any) {
    if (!confirm(`Estornar pagamento da fatura ${fatura.numero}?`)) return
    await supabase.from('fatura_recebimentos').delete().eq('fatura_id', fatura.id)
    await supabase.from('faturas').update({
      status:'pendente', valor_recebido:0, saldo_restante:fatura.valor,
      data_pagamento:null, forma_pagamento:null
    }).eq('id', fatura.id)
    const [{ data: f }, sRes] = await Promise.all([
      supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento'),
      supabase.from('contrato_saldo').select('*').eq('contrato_id', id).maybeSingle(),
    ])
    setFaturas(f ?? [])
    setSaldoInfo(sRes?.data ?? sRes ?? null)
  }

  async function criarFaturaAvulsa() {
    if (!formNovaFatura.valor || Number(formNovaFatura.valor) <= 0) { setErroFatura('Informe o valor da fatura.'); return }
    if (!formNovaFatura.data_vencimento) { setErroFatura('Informe a data de vencimento.'); return }
    setSalvandoFatura(true); setErroFatura('')
    // Gerar número sequencial
    const { data: ultima } = await supabase.from('faturas').select('numero').order('id', {ascending:false}).limit(1).single()
    const seq = ultima?.numero ? (parseInt(ultima.numero.replace(/\D/g,'').slice(-6)) + 1) : 1
    const ano = new Date().getFullYear()
    const numero = `FAT${ano}${String(seq).padStart(6,'0')}`
    await supabase.from('faturas').insert({
      contrato_id:     Number(id),
      numero,
      tipo:            formNovaFatura.tipo,
      status:          'pendente',
      valor:           Number(formNovaFatura.valor),
      data_emissao:    new Date().toISOString().split('T')[0],
      data_vencimento: formNovaFatura.data_vencimento,
      forma_pagamento: formNovaFatura.forma_pagamento,
      descricao:       formNovaFatura.descricao || null,
      observacoes:     formNovaFatura.observacoes || null,
    })
    const { data: f } = await supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento')
    setFaturas(f ?? [])
    setSalvandoFatura(false)
    setPainelFatura(false)
    setFormNovaFatura({ tipo:'antecipacao', valor:0, data_vencimento:new Date().toISOString().split('T')[0], forma_pagamento:'pix', descricao:'', observacoes:'' })
  }

  async function excluirFatura(fatura: any) {
    if (!confirm(`Excluir a fatura ${fatura.numero}?\n\n${fatura.asaas_payment_id ? '⚠️ Esta fatura possui cobrança no Asaas que também será cancelada.' : ''}`)) return

    // Se tem cobrança no Asaas, cancelar primeiro
    if (fatura.asaas_payment_id) {
      try {
        await fetch('/api/asaas/cancelar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: fatura.asaas_payment_id }),
        })
      } catch(_) {
        // Não bloquear exclusão local se Asaas falhar
      }
    }

    await supabase.from('faturas').delete().eq('id', fatura.id)
    setFaturas(prev => prev.filter(f => f.id !== fatura.id))
  }

  // ── Funções de edição de itens ──────────────────────────
  async function loadPatrimonios(produtoId: number) {
    setLoadingPats(true)
    const { data } = await supabase
      .from('patrimonios').select('id,numero_patrimonio,numero_serie,status')
      .eq('produto_id', produtoId).eq('status', 'disponivel').order('numero_patrimonio')
    setPatrimonios(data ?? [])
    setLoadingPats(false)
  }

  function abrirNovoItem() {
    setEditandoItem(null)
    setFormItem({ produto_id: null, patrimonio_id: null, quantidade: 1, preco_unitario: 0 })
    setItemProdNome('')
    setPatrimonios([])
    setErroItem('')
    setPainelItem(true)
  }

  function abrirEditarItem(item: any) {
    setEditandoItem(item)
    setFormItem({
      produto_id:    item.produto_id,
      patrimonio_id: item.patrimonio_id ?? null,
      quantidade:    item.quantidade,
      preco_unitario:item.preco_unitario,
    })
    setItemProdNome((item.produtos as any)?.nome ?? '')
    setPatrimonios([])
    setErroItem('')
    setPainelItem(true)
  }

  async function salvarItem() {
    if (!formItem.produto_id) { setErroItem('Selecione um produto.'); return }
    if (!formItem.preco_unitario || Number(formItem.preco_unitario) <= 0) { setErroItem('Informe o preço unitário.'); return }
    setSalvandoItem(true); setErroItem('')

    const dias = contrato.data_inicio && contrato.data_fim
      ? Math.max(1, Math.ceil((new Date(contrato.data_fim).getTime() - new Date(contrato.data_inicio).getTime()) / 86400000))
      : 1
    const total_item = Number(formItem.preco_unitario) * Number(formItem.quantidade) * dias

    if (editandoItem) {
      // Atualizar item existente
      await supabase.from('contrato_itens').update({
        quantidade:     Number(formItem.quantidade),
        preco_unitario: Number(formItem.preco_unitario),
        total_item,
      }).eq('id', editandoItem.id)
    } else {
      // Inserir novo item
      await supabase.from('contrato_itens').insert({
        contrato_id:    Number(id),
        produto_id:     formItem.produto_id,
        patrimonio_id:  formItem.patrimonio_id || null,
        quantidade:     Number(formItem.quantidade),
        preco_unitario: Number(formItem.preco_unitario),
        total_item,
      })
    }

    // Recalcular total do contrato
    const { data: novosItens } = await supabase.from('contrato_itens')
      .select('total_item').eq('contrato_id', id)
    const novoSubtotal = (novosItens ?? []).reduce((s: number, i: any) => s + Number(i.total_item), 0)
    const novoTotal = novoSubtotal - Number(contrato.desconto ?? 0) + Number(contrato.acrescimo ?? 0) + Number(contrato.frete ?? 0)
    await supabase.from('contratos').update({ subtotal: novoSubtotal, total: novoTotal }).eq('id', id)

    // Recarregar
    const [{ data: itensAtualizados }, { data: c2 }] = await Promise.all([
      supabase.from('contrato_itens').select('*, produtos(nome), patrimonios(numero_patrimonio)').eq('contrato_id', id),
      supabase.from('contratos').select('*, clientes(*), usuarios(nome), periodos_locacao(nome, dias)').eq('id', id).single(),
    ])
    setItens(itensAtualizados ?? [])
    if (c2) setContrato(c2)
    setSalvandoItem(false)
    setPainelItem(false)
  }

  async function removerItem(item: any) {
    if (!confirm(`Remover "${(item.produtos as any)?.nome}" deste contrato?`)) return
    await supabase.from('contrato_itens').delete().eq('id', item.id)
    const itensRestantes = itens.filter(i => i.id !== item.id)
    const novoSubtotal = itensRestantes.reduce((s: number, i: any) => s + Number(i.total_item), 0)
    const novoTotal = novoSubtotal - Number(contrato.desconto ?? 0) + Number(contrato.acrescimo ?? 0) + Number(contrato.frete ?? 0)
    await supabase.from('contratos').update({ subtotal: novoSubtotal, total: novoTotal }).eq('id', id)
    setItens(itensRestantes)
    const { data: c2 } = await supabase.from('contratos').select('*, clientes(*), usuarios(nome)').eq('id', id).single()
    if (c2) setContrato(c2)
  }

  async function gerarDocumento() {
    if(!templateSel){alert('Selecione um template.');return}
    setGerando(true)
    const res=await fetch('/api/documentos/gerar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template_id:Number(templateSel),contrato_id:Number(id)})})
    const result=await res.json()
    if(result.ok) setDocLink(`${window.location.origin}/doc/${result.token}`)
    else alert('Erro: '+result.error)
    setGerando(false)
  }

  if(loading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:10,color:'var(--t-muted)'}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",display:"inline-block",verticalAlign:"middle",flexShrink:0}}/>Carregando...
    </div>
  )
  if(!contrato) return <div style={{textAlign:'center',padding:48,color:'var(--t-muted)'}}>Contrato não encontrado.</div>

  const enderecoUso=[
    contrato.local_uso_endereco,contrato.local_uso_numero,
    contrato.local_uso_complemento,contrato.local_uso_bairro,
    contrato.local_uso_cidade,contrato.local_uso_estado,
  ].filter(Boolean).join(', ')

  const totalPago    =faturas.filter(f=>f.status==='pago').reduce((s,f)=>s+Number(f.valor_recebido??f.valor),0)
  const totalPendente=faturas.filter(f=>f.status!=='pago').reduce((s,f)=>s+Number(f.saldo_restante??f.valor),0)

  const TABS=[
    {key:'dados',      label:'Dados do Contrato'},
    {key:'itens',      label:'Itens',      count:itens.length},
    {key:'financeiro', label:'Financeiro', count:faturas.length},
    {key:'devolucoes', label:'Devoluções', count:devolucoes.length},
    {key:'documentos',   label:'Documentos'},
    {key:'timeline',     label:'Histórico'},
  ]

  // ── Devolução rápida de item individual ──────────────────────────────────
  function abrirDevItem(item: any) {
    const pendente = Number(item.quantidade) - Number(item.qtd_devolvida ?? 0)
    setItemDevoluver(item)
    setFormDevItem({ qtd: pendente, condicao: 'bom', custo_avaria: 0, obs: '' })
    setErroDevItem('')
    setModalDevItem(true)
  }

  async function salvarDevItem() {
    if (!itemDevoluver) return
    const qtd = Number(formDevItem.qtd)
    const pendente = Number(itemDevoluver.quantidade) - Number(itemDevoluver.qtd_devolvida ?? 0)
    if (qtd <= 0 || qtd > pendente) {
      setErroDevItem(`Quantidade inválida. Máximo pendente: ${pendente}`)
      return
    }
    setSalvandoDevItem(true)
    setErroDevItem('')
    try {
      const res = await fetch('/api/devolucoes/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrato_id: contrato.id,
          itens: [{
            contrato_item_id: itemDevoluver.id,
            patrimonio_id:    itemDevoluver.patrimonio_id ?? null,
            quantidade_devolvida: qtd,
            condicao:         formDevItem.condicao,
            custo_avaria:     formDevItem.condicao !== 'bom' ? Number(formDevItem.custo_avaria) : 0,
          }],
          observacoes: formDevItem.obs || null,
          caucao_devolvido: 0,
        }),
      })
      const data = await res.json()
      if (!data.ok) { setErroDevItem(data.error ?? 'Erro ao registrar devolução'); return }
      setModalDevItem(false)
      await load()  // recarrega contrato, itens e devoluções
    } catch (e: any) {
      setErroDevItem(e.message)
    } finally {
      setSalvandoDevItem(false)
    }
  }


  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* ── Cabeçalho ────────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>router.back()}
          style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',
            background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',
            cursor:'pointer',color:'var(--t-secondary)',fontSize:16,flexShrink:0}}>←
        </button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <h1 style={{margin:0,fontSize:'var(--fs-lg)',fontWeight:700,color:'var(--t-primary)'}}>
              Contrato {contrato.numero}
            </h1>
            <Badge value={contrato.status} dot/>
          </div>
          <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginTop:2}}>{contrato.clientes?.nome}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          {/* Ação primária — muda conforme status */}
          {/* ── Ação primária por estado ── */}
          {contrato.status==='rascunho'&&(
            <Btn onClick={ativarContrato}>
              Ativar Contrato
            </Btn>
          )}

          {contrato.status==='pendente_manutencao'&&(
            <Btn onClick={encerrarPendente} variant="secondary">
              Encerrar (Verificar OS)
            </Btn>
          )}

          {/* ── Badge de alerta para vencidos ── */}
          {contrato.status==='ativo'&&contrato.data_fim&&new Date(contrato.data_fim)<new Date()&&(
            <div style={{background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',borderRadius:'var(--r-md)',padding:'4px 10px',fontSize:'var(--fs-md)',color:'var(--c-danger)',fontWeight:700}}>
              ⚠ VENCIDO
            </div>
          )}

          {/* ── Menu de ações secundárias ── */}
          {(()=>{
            const sec: AcaoSecundaria[] = []
            if(contrato.status==='ativo'||contrato.status==='em_devolucao'){
              sec.push({ label:'↩ Registrar Devolução', onClick:iniciarCheckin, grupo:1 })
            }
            if(contrato.status==='ativo'||contrato.status==='em_devolucao'||contrato.status==='pendente_manutencao'){
              // Novo Período: apenas para contratos não-mensais
              if(contrato.tipo_contrato !== 'mensal') {
                sec.push({ label:'🔁 Novo Período', onClick:abrirNovoPeriodo, grupo:1 })
              }
              // Renovar: apenas para mensais
              if(contrato.tipo_contrato === 'mensal') {
                sec.push({ label:'🔄 Renovar Contrato', onClick:abrirRenovar, grupo:1 })
              }
              sec.push({ label:'🔒 Encerrar Contrato', onClick:encerrarContrato, grupo:1 })
            }
            sec.push({ label:'📄 Gerar Documento', onClick:()=>{setAba('documentos');setDocLink('')}, grupo:1 })
            if(contrato.status==='rascunho'||contrato.status==='ativo'){
              sec.push({ label:'✏️ Alterar Contrato', onClick:abrirEditar, grupo:1 })
            }
            if(contrato.status==='ativo'){
              sec.push({ label:'✕ Cancelar Contrato', onClick:cancelar, grupo:2, destrutivo:true })
            }
            if(contrato.status==='rascunho'||contrato.status==='cancelado'){
              sec.push({ label:'Excluir Contrato', onClick:excluirContrato, grupo:2, destrutivo:true })
            }
            return <ActionButtons acoesSec={sec}/>
          })()}
        </div>
      </div>

      {/* ── Card com Tabs ────────────────────────────────────────────── */}
      <div className="ds-card" style={{overflow:'hidden'}}>
        <Tabs tabs={TABS} active={aba} onChange={setAba}/>

        <div style={{padding:'20px 20px'}}>

          {/* ════ DADOS ════════════════════════════════════════════════ */}
          {aba==='dados'&&(
            <div style={{display:'flex',flexDirection:'column',gap:20}}>

              {/* KPIs financeiros */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
                {[
                  {l:'Total',    v:fmt.money(contrato.total),    c:'var(--c-primary)',   bold:true},
                  {l:'Subtotal', v:fmt.money(contrato.subtotal), c:'var(--t-secondary)', bold:false},
                  {l:'Desconto', v:fmt.money(contrato.desconto), c:Number(contrato.desconto)>0?'var(--c-success-text)':'var(--t-muted)', bold:false},
                  {l:'Frete',    v:fmt.money(contrato.frete??0), c:Number(contrato.frete)>0?'var(--c-warning-text)':'var(--t-muted)', bold:false},
                  {l:'Caucao',   v:fmt.money(contrato.caucao),   c:'var(--t-secondary)', bold:false},
                ].map(k=>(
                  <div key={k.l} className="ds-card" style={{padding:'12px 14px',borderTop: k.l==='Total'?'3px solid var(--c-primary)':undefined}}>
                    <div style={{fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{k.l==='Caucao'?'Caução':k.l}</div>
                    <div style={{fontWeight:700,fontSize:k.bold?'20px':'var(--fs-base)',color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Informações Gerais */}
              <div className="ds-card" style={{padding:'16px 20px'}}>
                <div className="ds-section-title">Informações Gerais</div>
                <div className="form-grid-2" style={{gap:14}}>
                  <Campo label="Cliente"            value={contrato.clientes?.nome}/>
                  <Campo label="Vendedor"           value={(contrato.usuarios as any)?.nome}/>
                  <Campo label="Forma de Pagamento" value={(contrato.forma_pagamento??'').replace(/_/g,' ').replace(/\w/g,(ch:string)=>ch.toUpperCase())}/>
                  <Campo label="Início"             value={fmt.date(contrato.data_inicio)}/>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <span style={{fontSize:'var(--fs-xs)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',
                      color: contrato.status==='ativo'&&contrato.data_fim<new Date().toISOString().split('T')[0] ? 'var(--c-danger)' : 'var(--t-muted)'
                    }}>Fim Previsto {contrato.status==='ativo'&&contrato.data_fim<new Date().toISOString().split('T')[0]?'⚠':''}</span>
                    <span style={{fontSize:'var(--fs-base)',fontWeight:600,
                      color: contrato.status==='ativo'&&contrato.data_fim<new Date().toISOString().split('T')[0] ? 'var(--c-danger)' : 'var(--t-primary)'
                    }}>{fmt.date(contrato.data_fim)}</span>
                  </div>
                  <Campo label="Período de Locação" value={(contrato as any).periodos_locacao?.nome?`${(contrato as any).periodos_locacao.nome} (${(contrato as any).periodos_locacao.dias}d)`:'—'}/>
                  {contrato.data_devolucao_real&&<Campo label="Devolução Real" value={fmt.date(contrato.data_devolucao_real)}/>}
                  {Number(contrato.comissao_percentual)>0&&<Campo label={`Comissão (${contrato.comissao_percentual}%)`} value={fmt.money(contrato.comissao_valor)}/>}
                  {Number(contrato.frete)>0&&<Campo label="Frete" value={fmt.money(contrato.frete)}/>}
                </div>
                {contrato.observacoes&&(
                  <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Observações</div>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)',lineHeight:1.6,background:'var(--bg-header)',padding:'8px 12px',borderRadius:'var(--r-sm)',borderLeft:'3px solid var(--c-primary)'}}>{contrato.observacoes}</div>
                  </div>
                )}
              </div>

              {/* Local de Uso */}
              {(enderecoUso||contrato.local_uso_referencia)&&(
                <div className="ds-card" style={{padding:'16px 20px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><span style={{fontSize:16}}>📍</span><span className="ds-section-title" style={{marginBottom:0}}>Local de Uso dos Equipamentos</span></div>
                  <div className="form-grid-2" style={{gap:14}}>
                    {enderecoUso&&(
                      <div style={{gridColumn:'span 2'}}>
                        <Campo label="Endereço" value={<>{enderecoUso}{contrato.local_uso_cep&&` — CEP ${contrato.local_uso_cep}`}</>}/>
                      </div>
                    )}
                    {contrato.local_uso_referencia&&(
                      <div style={{gridColumn:'span 2'}}>
                        <Campo label="Referência" value={contrato.local_uso_referencia}/>
                      </div>
                    )}
                  </div>
                  {enderecoUso&&(
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoUso)}`}
                      target="_blank" rel="noopener"
                      style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:14,
                        fontSize:'var(--fs-md)',color:'var(--c-primary)',textDecoration:'none',fontWeight:600}}>
                      Abrir no Google Maps →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ ITENS ════════════════════════════════════════════════ */}
          {aba==='itens'&&(
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {/* Cabeçalho da aba com botão adicionar */}
              {(contrato.status==='rascunho'||contrato.status==='ativo')&&(
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                  <Btn size="sm" onClick={abrirNovoItem}>+ Adicionar Item</Btn>
                </div>
              )}
              {(contrato.status==='encerrado'||contrato.status==='cancelado')&&(
                <div style={{marginBottom:12,padding:'8px 14px',background:'var(--bg-header)',borderRadius:'var(--r-md)',border:'1px solid var(--border)',fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>
                  Contrato {contrato.status} — itens somente leitura.
                </div>
              )}
              {itens.length===0
                ?<div className="ds-empty"><div className="ds-empty-title">Nenhum item neste contrato.</div></div>
                :<table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>
                    <Th>Produto</Th>
                    <Th>Patrimônio</Th>
                    <Th right>Qtd</Th>
                    <Th right>Devolvido</Th>
                    <Th right>Preço/dia</Th>
                    <Th right>Total</Th>
                    {(contrato.status==='rascunho'||contrato.status==='ativo')&&<Th></Th>}
                  </tr></thead>
                  <tbody>
                    {itens.map(i=>{
                      const pendente = Number(i.quantidade) - Number(i.qtd_devolvida ?? 0)
                      return (
                      <tr key={i.id}>
                        <Td bold>{(i.produtos as any)?.nome}</Td>
                        <Td mono muted>{(i.patrimonios as any)?.numero_patrimonio??'—'}</Td>
                        <Td right>{i.quantidade}</Td>
                        <Td right>
                          {Number(i.qtd_devolvida??0)>0
                            ? <span style={{color:pendente===0?'var(--c-success)':'var(--c-warning)',fontWeight:600,fontSize:'var(--fs-sm)'}}>
                                {i.qtd_devolvida}/{i.quantidade}
                              </span>
                            : <span style={{color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>—</span>
                          }
                        </Td>
                        <Td right>{fmt.money(i.preco_unitario)}</Td>
                        <Td right bold primary>{fmt.money(i.total_item)}</Td>
                        {(contrato.status==='rascunho'||contrato.status==='ativo')&&(
                          <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <button onClick={()=>abrirEditarItem(i)}
                                className="tbl-btn edit" title="Editar item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                              {contrato.status==='ativo'&&pendente>0&&(
                                <button
                                  onClick={()=>abrirDevItem(i)}
                                  className="tbl-btn"
                                  title="Registrar devolução deste item"
                                  style={{color:'var(--c-warning)',borderColor:'rgba(251,191,36,0.3)'}}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
                                  </svg>
                                </button>
                              )}
                              {contrato.status==='rascunho'&&(
                                <button onClick={()=>removerItem(i)}
                                  className="tbl-btn del" title="Remover item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--bg-header)'}}>
                      <td colSpan={(contrato.status==='rascunho'||contrato.status==='ativo')?6:5}
                        style={{padding:'10px 16px',fontWeight:700,fontSize:'var(--fs-md)',color:'var(--t-muted)',borderTop:'2px solid var(--border)'}}>Total</td>
                      <td style={{padding:'10px 16px',fontWeight:800,textAlign:'right',color:'var(--c-primary)',borderTop:'2px solid var(--border)'}}>{fmt.money(contrato.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              }
            </div>
          )}

          {/* ════ FINANCEIRO ═══════════════════════════════════════════ */}
          {aba==='financeiro'&&(
            <div style={{display:'flex',flexDirection:'column',gap:20}}>

              {/* KPIs financeiros */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
                {[
                  {l:'Subtotal',  v:fmt.money(contrato.subtotal),  c:'var(--t-primary)'},
                  {l:'Desconto',  v:fmt.money(contrato.desconto),  c:Number(contrato.desconto)>0?'var(--c-success-text)':'var(--t-muted)'},
                  {l:'Acréscimo', v:fmt.money(contrato.acrescimo), c:Number(contrato.acrescimo)>0?'var(--c-danger)':'var(--t-muted)'},
                  {l:'Frete',     v:fmt.money(contrato.frete??0),  c:Number(contrato.frete)>0?'var(--c-warning-text)':'var(--t-muted)'},
                  {l:'Total',     v:fmt.money(contrato.total),     c:'var(--c-primary)'},
                ].map(k=>(
                  <div key={k.l} style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:4}}>{k.l}</div>
                    <div style={{fontWeight:700,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Recebido / Em aberto */}
              <div className="form-grid-2">
                {/* Saldo discriminado (PRD 5.4) */}
              {saldoInfo && (
                <div style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'12px 16px'}}>
                  <div style={{fontSize:'var(--fs-md)',fontWeight:700,color:'var(--t-secondary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.04em'}}>Consolidação Financeira</div>
                  <div className="form-grid-3">
                    {[
                      {l:'Locação',          v:saldoInfo.fat_locacao,     c:'var(--t-primary)'},
                      {l:'Multa Faturada',   v:saldoInfo.fat_multa,       c:Number(saldoInfo.fat_multa)>0?'var(--c-danger)':'var(--t-muted)'},
                      {l:'Manutenção/OS',    v:saldoInfo.fat_manutencao,  c:Number(saldoInfo.fat_manutencao)>0?'var(--c-warning)':'var(--t-muted)'},
                      {l:'Total Faturado',   v:saldoInfo.total_faturado,  c:'var(--c-primary)'},
                      {l:'Recebido',         v:saldoInfo.total_recebido,  c:'var(--c-success)'},
                      {l:'Saldo Devedor',    v:saldoInfo.saldo_devedor,   c:Number(saldoInfo.saldo_devedor)>0?'var(--c-danger)':'var(--c-success)'},
                    ].map(k=>(
                      <div key={k.l}>
                        <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)',marginBottom:2}}>{k.l}</div>
                        <div style={{fontWeight:700,color:k.c}}>{fmt.money(k.v)}</div>
                      </div>
                    ))}
                  </div>
                  {Number(saldoInfo.os_abertas)>0&&(
                    <div style={{marginTop:10,padding:'6px 10px',background:'var(--c-warning-light)',border:'1px solid var(--c-warning)',borderRadius:'var(--r-sm)',fontSize:'var(--fs-md)',color:'var(--c-warning-text)',fontWeight:600}}>
                      ⚠ {saldoInfo.os_abertas} OS em aberto — contrato bloqueado para encerramento
                    </div>
                  )}
                  {Number(saldoInfo.custo_os_pendente)>0&&(
                    <div style={{marginTop:6,padding:'6px 10px',background:'var(--c-danger-light)',border:'1px solid var(--c-danger)',borderRadius:'var(--r-sm)',fontSize:'var(--fs-md)',color:'var(--c-danger-text)'}}>
                      {fmt.money(saldoInfo.custo_os_pendente)} em custos de OS pendentes de faturamento
                    </div>
                  )}
                </div>
              )}

              <div className="form-grid-2">
                <div style={{background:'var(--c-success-light)',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid var(--c-success)'}}>
                  <div style={{fontSize:'var(--fs-md)',color:'var(--c-success-text)',marginBottom:4,fontWeight:600}}>Recebido</div>
                  <div style={{fontWeight:800,fontSize:'var(--fs-lg)',color:'var(--c-success-text)'}}>
                    {fmt.money(saldoInfo?.total_recebido ?? totalPago)}
                  </div>
                  {Number(saldoInfo?.total_recebido ?? totalPago) > 0 && (
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--c-success-text)',marginTop:4,opacity:.75}}>
                      {faturas.filter(f=>f.status==='pago').length} fatura(s) quitada(s)
                    </div>
                  )}
                </div>
                <div style={{background:totalPendente>0?'var(--c-danger-light)':'var(--c-success-light)',borderRadius:'var(--r-md)',padding:'12px 16px',border:`1px solid ${totalPendente>0?'var(--c-danger)':'var(--c-success)'}`}}>
                  <div style={{fontSize:'var(--fs-md)',color:totalPendente>0?'var(--c-danger-text)':'var(--c-success-text)',marginBottom:4,fontWeight:600}}>Em Aberto</div>
                  <div style={{fontWeight:800,fontSize:'var(--fs-lg)',color:totalPendente>0?'var(--c-danger)':'var(--c-success-text)'}}>
                    {fmt.money(saldoInfo?.saldo_devedor ?? totalPendente)}
                  </div>
                  {totalPendente === 0 && (
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--c-success-text)',marginTop:4,opacity:.75}}>✓ Contrato quitado</div>
                  )}
                </div>
              </div>
              </div>

              {/* Alerta de multa prevista por atraso */}
              {saldoInfo && Number(saldoInfo.multa_prevista) > 0 && (
                <div style={{
                  background:'rgba(248,113,113,0.12)',
                  border:'1px solid rgba(248,113,113,0.4)',
                  borderLeft:'4px solid var(--c-danger)',
                  borderRadius:'var(--r-md)',
                  padding:'12px 16px',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  gap:12,
                }}>
                  <div>
                    <div style={{fontWeight:700,color:'var(--c-danger)',fontSize:'var(--fs-base)',marginBottom:3}}>
                      ⚠ Multa por Atraso na Devolução
                    </div>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--c-danger-text)'}}>
                      Contrato vencido há <strong>{saldoInfo.dias_atraso_hoje} dia(s)</strong>.
                      Multa calculada sobre todos os itens ainda não devolvidos.
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'var(--fs-sm)',color:'var(--c-danger-text)',marginBottom:2}}>Multa Prevista</div>
                    <div style={{fontWeight:800,fontSize:22,color:'var(--c-danger)',fontFamily:'var(--font-mono)'}}>
                      {fmt.money(Number(saldoInfo.multa_prevista))}
                    </div>
                    <div style={{fontSize:'var(--fs-xs)',color:'rgba(248,113,113,0.6)',marginTop:2}}>
                      Será cobrada no encerramento
                    </div>
                  </div>
                </div>
              )}

              {/* Faturas */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div className="ds-section-title" style={{marginBottom:0}}>Faturas e Pagamentos</div>
                  <Btn size="sm" variant="secondary" onClick={()=>{
                    setFormNovaFatura({tipo:'antecipacao',valor:0,data_vencimento:new Date().toISOString().split('T')[0],forma_pagamento:contrato.forma_pagamento??'pix',descricao:'',observacoes:''})
                    setErroFatura('')
                    setPainelFatura(true)
                  }}>+ Nova Fatura / Antecipação</Btn>
                </div>

                {faturas.length===0
                  ?<div className="ds-empty"><div className="ds-empty-title">Nenhuma fatura gerada.</div></div>
                  :<table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr>
                      <Th>Nº</Th><Th>Tipo</Th><Th>Vencimento</Th>
                      <Th right>Valor</Th><Th right>Pago</Th>
                      <Th>Pagamento</Th><Th>Status</Th><Th></Th>
                    </tr></thead>
                    <tbody>
                      {faturas.map(f=>(
                        <tr key={f.id} style={{background:f.status==='pago'?'var(--c-success-light)':f.status==='cancelado'?'var(--bg-header)':'var(--bg-card)'}}>
                          <Td mono>{f.numero}</Td>
                          <Td muted>{f.tipo?.replace(/_/g,' ').replace(/\w/g,(x:string)=>x.toUpperCase())}</Td>
                          <Td muted>{fmt.date(f.data_vencimento)}</Td>
                          <Td right bold>{fmt.money(f.valor)}</Td>
                          <Td right>{f.valor_recebido>0?fmt.money(f.valor_recebido):'—'}</Td>
                          <td style={{padding:'8px 16px',borderBottom:'1px solid var(--border)',fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>
                            {f.status==='pago'
                              ?<>{fmt.date(f.data_pagamento)} · {(f.forma_pagamento??'').replace(/_/g,' ')}</>
                              :'—'
                            }
                          </td>
                          <td style={{padding:'8px 16px',borderBottom:'1px solid var(--border)'}}><Badge value={f.status} dot/></td>
                          <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',gap:4}}>
                              {f.status==='pendente'&&(
                                <button onClick={()=>abrirPagamento(f)}
                                  className="tbl-btn"
                                  title="Registrar pagamento"
                                  style={{color:'var(--c-success)',fontSize:16,lineHeight:1,padding:'3px 7px'}}>
                                  ✓
                                </button>
                              )}
                              {['pendente','vencida'].includes(f.status)&&(
                                <button onClick={()=>abrirCobrancaAsaas(f)}
                                  className="tbl-btn"
                                  title="Cobrar via PIX ou Boleto (Asaas)"
                                  style={{color:'#818cf8',fontSize:12,lineHeight:1,padding:'3px 7px',fontWeight:700}}>
                                  💳
                                </button>
                              )}
                              {f.status==='pago'&&(
                                <button onClick={()=>estornarPagamento(f)}
                                  className="tbl-btn"
                                  title="Estornar pagamento"
                                  style={{color:'var(--c-warning)',fontSize:13,lineHeight:1,padding:'3px 7px'}}>
                                  ↩
                                </button>
                              )}
                              {f.status==='pendente'&&(
                                <button onClick={()=>excluirFatura(f)}
                                  className="tbl-btn del" title="Excluir fatura"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </div>

              {Number(contrato.comissao_percentual)>0&&(
                <div style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>Comissão ({contrato.comissao_percentual}%)</span>
                  <span style={{fontWeight:700,color:'var(--c-primary)'}}>{fmt.money(contrato.comissao_valor)}</span>
                </div>
              )}
            </div>
          )}

          {/* ════ DEVOLUÇÕES ═══════════════════════════════════════════ */}
          {aba==='devolucoes'&&(
            devolucoes.length===0
              ?<div className="ds-empty"><div className="ds-empty-title">Nenhuma devolução registrada.</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {devolucoes.map(dev=>(
                  <div key={dev.id} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'14px 16px'}}>
                    {/* Layout: dados à esquerda | valores no centro | ações à direita */}
                    <div style={{display:'flex',alignItems:'flex-start',gap:12}}>

                      {/* Esquerda: identificação */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5,flexWrap:'wrap'}}>
                          <span style={{fontFamily:'monospace',fontWeight:700,fontSize:'var(--fs-md)'}}>#{dev.id}</span>
                          <Badge value={dev.status} dot/>
                          <span style={{fontSize:'var(--fs-xs)',padding:'2px 8px',borderRadius:99,fontWeight:600,
                            background:dev.tipo==='total'?'var(--c-primary-light,#dbeafe)':'var(--bg-header)',
                            color:dev.tipo==='total'?'var(--c-primary)':'var(--t-muted)'}}>
                            {dev.tipo==='total'?'Total':'Parcial'}
                          </span>
                        </div>
                        <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:2}}>
                          {fmt.datetime(dev.data_devolucao)}
                        </div>
                        <div style={{fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>
                          Operador: {(dev.usuarios as any)?.nome ?? '—'}
                        </div>
                        {dev.observacoes&&(
                          <div style={{fontSize:'var(--fs-sm)',color:'var(--t-secondary)',marginTop:6,
                            padding:'5px 8px',background:'var(--bg-header)',borderRadius:'var(--r-sm)',
                            borderLeft:'2px solid var(--border)'}}>
                            {dev.observacoes}
                          </div>
                        )}
                      </div>

                      {/* Centro: valores (só mostra se há algo) */}
                      {(dev.dias_atraso>0||dev.multa_atraso>0||dev.valor_avarias>0||dev.caucao_devolvido>0)&&(
                        <div style={{display:'flex',gap:14,flexShrink:0,borderLeft:'1px solid var(--border)',
                          paddingLeft:14,alignItems:'flex-start'}}>
                          {dev.dias_atraso>0&&(
                            <div style={{textAlign:'center'}}>
                              <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginBottom:2}}>Atraso</div>
                              <div style={{fontWeight:700,color:'var(--c-danger)',fontSize:'var(--fs-md)'}}>{dev.dias_atraso}d</div>
                            </div>
                          )}
                          {dev.multa_atraso>0&&(
                            <div style={{textAlign:'center'}}>
                              <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginBottom:2}}>Multa</div>
                              <div style={{fontWeight:700,color:'var(--c-danger)',fontSize:'var(--fs-md)'}}>{fmt.money(dev.multa_atraso)}</div>
                            </div>
                          )}
                          {dev.valor_avarias>0&&(
                            <div style={{textAlign:'center'}}>
                              <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginBottom:2}}>Avarias</div>
                              <div style={{fontWeight:700,color:'var(--c-warning-text)',fontSize:'var(--fs-md)'}}>{fmt.money(dev.valor_avarias)}</div>
                            </div>
                          )}
                          {dev.caucao_devolvido>0&&(
                            <div style={{textAlign:'center'}}>
                              <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginBottom:2}}>Caução Dev.</div>
                              <div style={{fontWeight:700,fontSize:'var(--fs-md)'}}>{fmt.money(dev.caucao_devolvido)}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Direita: botões de ação com apenas ícones + title */}
                      <div style={{display:'flex',gap:4,flexShrink:0,borderLeft:'1px solid var(--border)',paddingLeft:10}}>
                        {/* Recibo */}
                        <button
                          title="Emitir Recibo de Devolução"
                          onClick={async(e)=>{
                            const btn = e.currentTarget
                            btn.textContent = '...'
                            btn.style.opacity = '0.6'
                            try {
                              const res = await fetch(`/api/documentos/recibo-devolucao?devolucao_id=${dev.id}`)
                              const data = await res.json()
                              if (data.ok && data.token) window.open(`${window.location.origin}/doc/${data.token}`,'_blank')
                              else alert('Erro ao gerar recibo: '+(data.error??'Tente novamente'))
                            } finally {
                              btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>'
                              btn.style.opacity = '1'
                            }
                          }}
                          style={{width:30,height:30,padding:0,borderRadius:'var(--r-sm)',
                            border:'1px solid var(--border)',background:'var(--bg-card)',
                            color:'var(--c-primary)',cursor:'pointer',display:'flex',
                            alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background='var(--c-primary-light,#dbeafe)'}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='var(--bg-card)'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                          </svg>
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
          )}

          {/* ════ DOCUMENTOS ═══════════════════════════════════════════ */}
          {aba==='documentos'&&(
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div style={{maxWidth:460}}>
              <div className="ds-section-title">Gerar Documento</div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:6}}>Template</div>
                  <select value={templateSel} onChange={e=>{setTemplateSel(e.target.value);setDocLink('')}} className="ds-input" style={{width:'100%'}}>
                    <option value="">Selecione um template...</option>
                    {templates.map(t=><option key={t.id} value={t.id}>{t.nome} ({t.tipo})</option>)}
                  </select>
                </div>
                {!docLink
                  ?<Btn loading={gerando} onClick={gerarDocumento} style={{alignSelf:'flex-start'}}>Gerar Documento</Btn>
                  :<div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <div style={{background:'var(--c-success-light)',border:'1px solid var(--c-success)',borderRadius:'var(--r-md)',padding:'14px 16px'}}>
                      <div style={{fontWeight:600,color:'var(--c-success-text)',marginBottom:8}}>Documento gerado com sucesso!</div>
                      <div style={{display:'flex',gap:8}}>
                        <input value={docLink} readOnly style={{flex:1,border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:'6px 10px',fontSize:'var(--fs-md)',fontFamily:'monospace',background:'var(--bg-card)',color:'var(--t-secondary)'}}/>
                        <button onClick={()=>navigator.clipboard.writeText(docLink)} style={{padding:'6px 12px',background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',cursor:'pointer',fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>Copiar</button>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <a href={docLink} target="_blank" rel="noopener" style={{flex:1}}><Btn variant="secondary" style={{width:'100%'}}>Visualizar PDF</Btn></a>
                      <Btn style={{flex:1}} onClick={()=>window.open(docLink,'_blank')}>🖨️ Imprimir / Baixar PDF</Btn>
                    </div>
                    <Btn variant="secondary" onClick={()=>setDocLink('')} style={{alignSelf:'flex-start'}}>Gerar Novamente</Btn>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Link válido por 30 dias.</div>
                  </div>
                }
              </div>
            </div>

            </div>

          )}

        </div>
      </div>

      {/* ── Painel: Enviar por E-mail ─────────────────────────────────────── */}
      


          {aba==='timeline'&&(
            <div style={{display:'flex',flexDirection:'column',gap:20}}>

              {/* ── Formulário nova anotação ── */}
              <div className="ds-card" style={{padding:'16px 20px'}}>
                <div className="ds-section-title">Nova Anotação de Acompanhamento</div>
                {erroAnot && <div className="ds-alert-error" style={{marginBottom:10}}>{erroAnot}</div>}
                <textarea
                  value={novaAnotacao}
                  onChange={e=>{setNovaAnotacao(e.target.value);setErroAnot('')}}
                  rows={3}
                  placeholder="Digite o acompanhamento, observação ou ocorrência..."
                  className={textareaCls}
                  style={{marginBottom:10}}
                />
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <Btn loading={salvandoAnot} onClick={salvarAnotacao}
                    disabled={!novaAnotacao.trim()}>
                    💬 Registrar Anotação
                  </Btn>
                </div>
              </div>

              {/* ── Timeline de eventos ── */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div className="ds-section-title" style={{marginBottom:0}}>
                    Histórico ({timeline.length} evento{timeline.length!==1?'s':''})
                  </div>
                </div>

                {timeline.length === 0 ? (
                  <div className="ds-card" style={{padding:'40px 24px',textAlign:'center',color:'var(--t-muted)'}}>
                    <div style={{fontSize:32,marginBottom:8}}>📋</div>
                    <div style={{fontWeight:600}}>Nenhum evento registrado ainda.</div>
                  </div>
                ) : (
                  <div style={{position:'relative',paddingLeft:32}}>
                    <div style={{position:'absolute',left:11,top:0,bottom:0,width:2,background:'var(--border)'}}/>
                    {timeline.map((ev:any)=>{
                      const icones:Record<string,string>={
                        criacao:'📄',ativacao:'✅',alteracao:'✏️',pagamento:'💰',
                        devolucao:'↩️',manutencao:'🔧',documento:'📋',email:'📧',
                        encerramento:'🏁',sistema:'⚙️',anotacao:'💬'
                      }
                      const isAnot = ev.tipo === 'anotacao'
                      return (
                        <div key={ev.id} style={{position:'relative',paddingBottom:16}}>
                          {/* Ícone */}
                          <div style={{
                            position:'absolute',left:-32,top:2,width:22,height:22,
                            borderRadius:'50%',
                            background: isAnot ? 'var(--c-primary)' : 'var(--bg-card)',
                            border:`2px solid ${isAnot?'var(--c-primary)':'var(--border)'}`,
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,
                          }}>
                            {icones[ev.tipo]??'•'}
                          </div>
                          {/* Card */}
                          <div style={{
                            background: isAnot ? 'var(--c-primary-light,#e0f2fe)' : 'var(--bg-header)',
                            borderRadius:'var(--r-md)',
                            border:`1px solid ${isAnot?'var(--c-primary)':'var(--border)'}`,
                            padding:'10px 14px',
                          }}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                              <div style={{flex:1}}>
                                {isAnot && (
                                  <div style={{fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--c-primary)',
                                    textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>
                                    Anotação
                                  </div>
                                )}
                                <div style={{fontSize:'var(--fs-md)',color:'var(--t-primary)',lineHeight:1.5}}>
                                  {ev.descricao}
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:10,marginTop:5,flexWrap:'wrap'}}>
                                  <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>
                                    {new Date(ev.created_at).toLocaleDateString('pt-BR')}{' '}
                                    {new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                                  </span>
                                  {ev.usuarios?.nome && (
                                    <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>
                                      · {ev.usuarios.nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isAnot && (
                                <button onClick={()=>excluirAnotacao(ev.id)}
                                  title="Excluir anotação"
                                  style={{background:'none',border:'none',cursor:'pointer',
                                    color:'var(--t-muted)',fontSize:14,lineHeight:1,padding:'2px 4px',
                                    borderRadius:'var(--r-sm)',flexShrink:0}}
                                  onMouseEnter={e=>(e.currentTarget.style.color='var(--c-danger)')}
                                  onMouseLeave={e=>(e.currentTarget.style.color='var(--t-muted)')}>
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}


      {/* ── Modal: Cobrança Asaas ────────────────────────────────────────── */}
      {modalAsaas && fatAsaas && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{if(e.target===e.currentTarget)setModalAsaas(false)}}>
          <div style={{background:'#1e293b',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:520,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',overflow:'hidden',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>

            <div style={{background:'rgba(99,102,241,0.1)',borderBottom:'1px solid var(--border)',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:'var(--t-primary)'}}>💳 Cobrar via Asaas</div>
                <div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>{fatAsaas.numero} · {fmt.money(fatAsaas.saldo_restante??fatAsaas.valor)}</div>
              </div>
              <button onClick={()=>setModalAsaas(false)} style={{background:'none',border:'none',color:'var(--t-muted)',cursor:'pointer',fontSize:20}}>×</button>
            </div>

            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:16,overflowY:'auto'}}>

              {!asaasResult ? (<>
                {/* Se já tem cobrança Asaas — oferecer sincronização */}
                {fatAsaas.asaas_payment_id ? (
                  <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'var(--r-md)',padding:'14px 16px'}}>
                    <div style={{fontWeight:600,color:'#fbbf24',fontSize:13,marginBottom:6}}>
                      ⚡ Cobrança já gerada nesta fatura
                    </div>
                    <div style={{fontSize:12,color:'var(--t-muted)',marginBottom:10}}>
                      ID Asaas: <code style={{color:'var(--t-secondary)'}}>{fatAsaas.asaas_payment_id}</code>
                      {fatAsaas.asaas_status && <> · Status: <strong>{fatAsaas.asaas_status}</strong></>}
                    </div>
                    <Btn onClick={()=>sincronizarAsaas(fatAsaas.id)} loading={gerandoAsaas} style={{width:'100%'}}>
                      🔄 Sincronizar Status com Asaas
                    </Btn>
                  </div>
                ) : (
                  /* Seletor de tipo — nova cobrança */
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    {([['PIX','⚡ PIX','Pagamento instantâneo'],['BOLETO','🏦 Boleto','Vencimento configurável'],['PIX_BOLETO','⚡🏦 Ambos','PIX + Boleto juntos']] as const).map(([val,label,desc])=>(
                      <button key={val} onClick={()=>setTipoAsaas(val as any)}
                        style={{padding:'12px 8px',borderRadius:'var(--r-md)',border:`2px solid ${tipoAsaas===val?'var(--c-primary)':'var(--border)'}`,background:tipoAsaas===val?'rgba(99,102,241,0.1)':'transparent',cursor:'pointer',textAlign:'center'}}>
                        <div style={{fontSize:16,marginBottom:4}}>{label}</div>
                        <div style={{fontSize:11,color:'var(--t-muted)'}}>{desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {erroAsaas && (
                  <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'var(--r-md)',padding:'10px 14px',color:'#f87171',fontSize:13}}>
                    {erroAsaas}
                  </div>
                )}
              </>) : (<>
                {/* Resultado — QR Code e linha digitável */}
                {asaasResult.pix_qrcode && (
                  <div style={{textAlign:'center'}}>
                    <div style={{fontWeight:700,color:'#34d399',marginBottom:12,fontSize:14}}>✅ PIX gerado com sucesso</div>
                    <img src={`data:image/png;base64,${asaasResult.pix_qrcode}`}
                      alt="QR Code PIX" style={{width:200,height:200,borderRadius:8,background:'#fff',padding:8}}/>
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:11,color:'var(--t-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Pix Copia e Cola</div>
                      <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',fontSize:11,fontFamily:'monospace',wordBreak:'break-all',color:'var(--t-secondary)',cursor:'pointer'}}
                        onClick={()=>{navigator.clipboard.writeText(asaasResult.pix_copia_cola??'');alert('Copiado!')}}>
                        {asaasResult.pix_copia_cola?.slice(0,60)}...
                        <div style={{color:'var(--c-primary)',marginTop:4,fontSize:11}}>📋 Clique para copiar</div>
                      </div>
                    </div>
                  </div>
                )}
                {asaasResult.boleto_linha_digitavel && (
                  <div>
                    <div style={{fontWeight:700,color:'#34d399',marginBottom:8,fontSize:14}}>✅ Boleto gerado</div>
                    <div style={{fontSize:11,color:'var(--t-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Linha Digitável</div>
                    <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',fontSize:12,fontFamily:'monospace',wordBreak:'break-all',cursor:'pointer'}}
                      onClick={()=>{navigator.clipboard.writeText(asaasResult.boleto_linha_digitavel??'');alert('Copiado!')}}>
                      {asaasResult.boleto_linha_digitavel}
                      <div style={{color:'var(--c-primary)',marginTop:4,fontSize:11}}>📋 Clique para copiar</div>
                    </div>
                    {asaasResult.boleto_url && (
                      <a href={asaasResult.boleto_url} target="_blank" rel="noreferrer"
                        style={{display:'block',marginTop:10,textAlign:'center',padding:'8px',borderRadius:'var(--r-sm)',background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',color:'#818cf8',fontSize:13,fontWeight:600,textDecoration:'none'}}>
                        🔗 Abrir boleto em PDF
                      </a>
                    )}
                  </div>
                )}
              </>)}
            </div>

            <div style={{padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0}}>
              {!asaasResult ? (<>
                <Btn variant="secondary" style={{flex:1}} onClick={()=>setModalAsaas(false)}>Cancelar</Btn>
                {!fatAsaas.asaas_payment_id && (
                  <Btn style={{flex:2}} loading={gerandoAsaas} onClick={gerarCobrancaAsaas}>
                    💳 Gerar Cobrança {tipoAsaas==='PIX'?'PIX':tipoAsaas==='BOLETO'?'Boleto':'PIX + Boleto'}
                  </Btn>
                )}
              </>) : (
                <Btn style={{flex:1}} onClick={()=>setModalAsaas(false)}>Fechar</Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Novo Período ───────────────────────────────────────────── */}
      {modalNovoPeriodo && contrato && calcNovoPeriodo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{if(e.target===e.currentTarget)setModalNovoPeriodo(false)}}>
          <div style={{background:'#1e293b',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:560,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',overflow:'hidden',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>

            {/* Header */}
            <div style={{background:'rgba(251,191,36,0.08)',borderBottom:'1px solid var(--border)',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:'var(--t-primary)'}}>🔁 Novo Período</div>
                <div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>{contrato.numero} · {contrato.clientes?.nome}</div>
              </div>
              <button onClick={()=>setModalNovoPeriodo(false)} style={{background:'none',border:'none',color:'var(--t-muted)',cursor:'pointer',fontSize:20}}>×</button>
            </div>

            {/* Body */}
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto'}}>

              {/* Explicação */}
              <div style={{background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px',fontSize:13,color:'var(--t-secondary)',lineHeight:1.6}}>
                <strong style={{color:'#a5b4fc'}}>Como funciona:</strong> este contrato será <strong>encerrado</strong> e a fatura impressa automaticamente. Em seguida, você será redirecionado para um <strong>novo contrato</strong> com o mesmo cliente e equipamentos — podendo escolher o novo período e ajustar os preços.
              </div>

              {/* Situação */}
              <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'var(--r-md)',padding:'12px 16px'}}>
                <div style={{fontWeight:700,color:'var(--t-secondary)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Situação do contrato</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:13}}>
                  {[
                    {l:'Período', v:`${calcNovoPeriodo.diasOriginais} dias`},
                    {l:'Valor diário (itens)', v:fmt.money(calcNovoPeriodo.valorDiario)},
                    {l:'Data fim', v:fmt.date(contrato.data_fim)},
                    {l:'Dias em atraso', v:calcNovoPeriodo.diasAtraso>0?`${calcNovoPeriodo.diasAtraso} dias`:'—', cor:calcNovoPeriodo.diasAtraso>0?'#f87171':undefined},
                  ].map(item=>(
                    <div key={item.l}>
                      <div style={{fontSize:10,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{item.l}</div>
                      <div style={{fontWeight:600,color:item.cor??'var(--t-primary)'}}>{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diárias extras */}
              {calcNovoPeriodo.diasAtraso > 0 && (
                <div style={{background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px'}}>
                  <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
                    <input type="checkbox" checked={formNovoPeriodo.cobrar_diarias??true}
                      onChange={e=>setFormNovoPeriodo((p:any)=>({...p,cobrar_diarias:e.target.checked}))}
                      style={{marginTop:2,accentColor:'var(--c-primary)',flexShrink:0}}/>
                    <div>
                      <div style={{fontWeight:600,color:'#f87171',fontSize:13}}>Cobrar diárias extras por atraso</div>
                      <div style={{fontSize:12,color:'var(--t-secondary)',marginTop:2}}>
                        {calcNovoPeriodo.diasAtraso} dia(s) × {fmt.money(calcNovoPeriodo.valorDiario)} = <strong style={{color:'#fbbf24'}}>{fmt.money(calcNovoPeriodo.valorDiariasExtras)}</strong>
                      </div>
                      <div style={{fontSize:11,color:'var(--t-muted)',marginTop:2}}>Base: diária do equipamento. Frete excluído.</div>
                    </div>
                  </label>
                </div>
              )}

              {/* Pendentes */}
              {calcNovoPeriodo.pendentes?.length > 0 && (
                <div style={{background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px'}}>
                  <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}>
                    <input type="checkbox" checked={formNovoPeriodo.quitar_pendentes??true}
                      onChange={e=>setFormNovoPeriodo((p:any)=>({...p,quitar_pendentes:e.target.checked}))}
                      style={{marginTop:2,accentColor:'var(--c-primary)',flexShrink:0}}/>
                    <div>
                      <div style={{fontWeight:600,color:'#fbbf24',fontSize:13}}>Quitar {calcNovoPeriodo.pendentes.length} fatura(s) pendente(s)</div>
                      <div style={{fontSize:12,color:'var(--t-secondary)',marginTop:2}}>
                        Total: <strong style={{color:'#fbbf24'}}>{fmt.money(calcNovoPeriodo.valorPendente)}</strong>
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Forma de pagamento */}
              <FormField label="Forma de pagamento do encerramento">
                <select className={selectCls} value={formNovoPeriodo.forma_pagamento??'pix'}
                  onChange={e=>setFormNovoPeriodo((p:any)=>({...p,forma_pagamento:e.target.value}))}>
                  {['pix','dinheiro','transferencia','boleto','cartao_credito','cartao_debito','cheque'].map(f=>(
                    <option key={f} value={f}>{f.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </FormField>

              {/* Resumo */}
              <div style={{background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px'}}>
                <div style={{fontWeight:700,color:'var(--t-secondary)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Resumo do encerramento</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:13}}>
                  {calcNovoPeriodo.diasAtraso > 0 && (
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--t-muted)'}}>Diárias extras ({calcNovoPeriodo.diasAtraso}d)</span>
                      <span style={{color:formNovoPeriodo.cobrar_diarias?'var(--t-primary)':'var(--t-muted)',textDecoration:!formNovoPeriodo.cobrar_diarias?'line-through':undefined}}>
                        {fmt.money(calcNovoPeriodo.valorDiariasExtras)}
                      </span>
                    </div>
                  )}
                  {calcNovoPeriodo.pendentes?.length > 0 && (
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:'var(--t-muted)'}}>Faturas pendentes</span>
                      <span style={{color:formNovoPeriodo.quitar_pendentes?'var(--t-primary)':'var(--t-muted)',textDecoration:!formNovoPeriodo.quitar_pendentes?'line-through':undefined}}>
                        {fmt.money(calcNovoPeriodo.valorPendente)}
                      </span>
                    </div>
                  )}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:8,marginTop:2}}>
                    <span style={{fontWeight:700,color:'var(--t-primary)'}}>Total a receber agora</span>
                    <span style={{fontWeight:800,color:'#34d399',fontSize:15}}>
                      {fmt.money(
                        (formNovoPeriodo.cobrar_diarias?calcNovoPeriodo.valorDiariasExtras:0)+
                        (formNovoPeriodo.quitar_pendentes?calcNovoPeriodo.valorPendente:0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {erroNovoPeriodo && (
                <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'var(--r-md)',padding:'10px 14px',color:'#f87171',fontSize:13}}>
                  {erroNovoPeriodo}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0}}>
              <Btn variant="secondary" style={{flex:1}} onClick={()=>setModalNovoPeriodo(false)}>Cancelar</Btn>
              <Btn style={{flex:2}} loading={encerrando} onClick={confirmarNovoPeriodo}>
                🔁 Encerrar e Abrir Novo Período
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Renovação de Contrato ─────────────────────────────────── */}
      {modalRenovar && contrato && calcRenovar && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
          onClick={e=>{ if(e.target===e.currentTarget) setModalRenovar(false) }}>
          <div style={{ background:'#1e293b',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:560,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',overflow:'hidden',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
            {/* Header */}
            <div style={{ background:'rgba(99,102,241,0.1)',borderBottom:'1px solid var(--border)',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:700,fontSize:15,color:'var(--t-primary)' }}>🔄 Renovar Contrato</div>
                <div style={{ fontSize:12,color:'var(--t-muted)',marginTop:2 }}>{contrato.numero} · {contrato.clientes?.nome}</div>
              </div>
              <button onClick={()=>setModalRenovar(false)} style={{ background:'none',border:'none',color:'var(--t-muted)',cursor:'pointer',fontSize:20 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto' }}>

              {/* Situação atual */}
              <div style={{ background:'rgba(255,255,255,0.04)',borderRadius:'var(--r-md)',padding:'12px 16px' }}>
                <div style={{ fontWeight:700,color:'var(--t-secondary)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>Situação do contrato</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:13 }}>
                  {[
                    { l:'Período original',    v:`${calcRenovar.diasOriginais} dias` },
                    { l:'Valor diário',         v:fmt.money(calcRenovar.valorDiario) },
                    { l:'Data fim original',    v:fmt.date(contrato.data_fim) },
                    { l:'Dias em atraso',       v:calcRenovar.diasAtraso > 0 ? `${calcRenovar.diasAtraso} dias` : '—', cor: calcRenovar.diasAtraso>0?'#f87171':undefined },
                  ].map(item=>(
                    <div key={item.l}>
                      <div style={{ fontSize:10,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2 }}>{item.l}</div>
                      <div style={{ fontWeight:600,color:item.cor??'var(--t-primary)' }}>{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diárias extras */}
              {calcRenovar.diasAtraso > 0 && (
                <div style={{ background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px' }}>
                  <label style={{ display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer' }}>
                    <input type="checkbox" checked={formRenovar.cobrar_diarias ?? true}
                      onChange={e=>setFormRenovar((p:any)=>({...p,cobrar_diarias:e.target.checked}))}
                      style={{ marginTop:2,accentColor:'var(--c-primary)',flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600,color:'#f87171',fontSize:13 }}>
                        Cobrar diárias extras por atraso
                      </div>
                      <div style={{ fontSize:12,color:'var(--t-secondary)',marginTop:2 }}>
                        {calcRenovar.diasAtraso} dia(s) × {fmt.money(calcRenovar.valorDiario)}/dia =&nbsp;
                        <strong style={{ color:'#fbbf24' }}>{fmt.money(calcRenovar.valorDiariasExtras)}</strong>
                      </div>
                      <div style={{ fontSize:11,color:'var(--t-muted)',marginTop:3 }}>
                        Base: diária do equipamento (frete e encargos não incluídos). Será criada uma fatura do tipo "atraso".
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Faturas pendentes */}
              {calcRenovar.pendentes?.length > 0 && (
                <div style={{ background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px' }}>
                  <label style={{ display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer' }}>
                    <input type="checkbox" checked={formRenovar.quitar_pendentes ?? true}
                      onChange={e=>setFormRenovar((p:any)=>({...p,quitar_pendentes:e.target.checked}))}
                      style={{ marginTop:2,accentColor:'var(--c-primary)',flexShrink:0 }}/>
                    <div>
                      <div style={{ fontWeight:600,color:'#fbbf24',fontSize:13 }}>
                        Quitar {calcRenovar.pendentes.length} fatura(s) pendente(s)
                      </div>
                      <div style={{ fontSize:12,color:'var(--t-secondary)',marginTop:2 }}>
                        Total: <strong style={{ color:'#fbbf24' }}>{fmt.money(calcRenovar.valorPendente)}</strong> — serão marcadas como pagas na renovação.
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Forma de pagamento */}
              <FormField label="Forma de pagamento">
                <select className={selectCls} value={formRenovar.forma_pagamento ?? 'pix'}
                  onChange={e=>setFormRenovar((p:any)=>({...p,forma_pagamento:e.target.value}))}>
                  {['pix','dinheiro','transferencia','boleto','cartao_credito','cartao_debito','cheque'].map(f=>(
                    <option key={f} value={f}>{f.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </FormField>

              {/* Nova data */}
              <FormField label="Nova data de devolução *">
                <input type="date" className={inputCls}
                  value={formRenovar.nova_data_fim ?? ''}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e=>setFormRenovar((p:any)=>({...p,nova_data_fim:e.target.value}))}/>
              </FormField>

              {/* Resumo financeiro */}
              <div style={{ background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--r-md)',padding:'12px 16px' }}>
                <div style={{ fontWeight:700,color:'var(--t-secondary)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>Resumo da renovação</div>
                <div style={{ display:'flex',flexDirection:'column',gap:6,fontSize:13 }}>
                  {calcRenovar.diasAtraso > 0 && (
                    <div style={{ display:'flex',justifyContent:'space-between' }}>
                      <span style={{ color:'var(--t-muted)' }}>Diárias extras ({calcRenovar.diasAtraso}d)</span>
                      <span style={{ color:formRenovar.cobrar_diarias?'var(--t-primary)':'var(--t-muted)', textDecoration:!formRenovar.cobrar_diarias?'line-through':undefined }}>
                        {fmt.money(calcRenovar.valorDiariasExtras)}
                      </span>
                    </div>
                  )}
                  {calcRenovar.pendentes?.length > 0 && (
                    <div style={{ display:'flex',justifyContent:'space-between' }}>
                      <span style={{ color:'var(--t-muted)' }}>Pendências anteriores</span>
                      <span style={{ color:formRenovar.quitar_pendentes?'var(--t-primary)':'var(--t-muted)', textDecoration:!formRenovar.quitar_pendentes?'line-through':undefined }}>
                        {fmt.money(calcRenovar.valorPendente)}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex',justifyContent:'space-between',borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:8,marginTop:2 }}>
                    <span style={{ fontWeight:700,color:'var(--t-primary)' }}>Total a receber agora</span>
                    <span style={{ fontWeight:800,color:'#34d399',fontSize:15 }}>
                      {fmt.money(
                        (formRenovar.cobrar_diarias ? calcRenovar.valorDiariasExtras : 0) +
                        (formRenovar.quitar_pendentes ? calcRenovar.valorPendente : 0)
                      )}
                    </span>
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between' }}>
                    <span style={{ color:'var(--t-muted)' }}>Novo período</span>
                    <span style={{ color:'#818cf8',fontWeight:600 }}>
                      {formRenovar.nova_data_fim ? `até ${fmt.date(formRenovar.nova_data_fim)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {erroRenovar && (
                <div style={{ background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'var(--r-md)',padding:'10px 14px',color:'#f87171',fontSize:13 }}>
                  {erroRenovar}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0 }}>
              <Btn variant="secondary" style={{ flex:1 }} onClick={()=>setModalRenovar(false)}>Cancelar</Btn>
              <Btn style={{ flex:2 }} loading={renovando} onClick={confirmarRenovacao}>
                🔄 Confirmar Renovação
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Devolução Rápida de Item ─────────────────────────────── */}
      {modalDevItem && itemDevoluver && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={e => { if (e.target === e.currentTarget) setModalDevItem(false) }}>
          <div style={{
            background:'#1e293b', borderRadius:'var(--r-lg)', width:'100%', maxWidth:440,
            border:'1px solid rgba(255,255,255,0.12)',
            boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
          }}>
            {/* Header */}
            <div style={{
              padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'rgba(255,255,255,0.03)', borderRadius:'var(--r-lg) var(--r-lg) 0 0',
            }}>
              <div>
                <div style={{fontWeight:700,fontSize:'var(--fs-base)',color:'rgba(255,255,255,0.9)'}}>
                  ↩ Devolver Item
                </div>
                <div style={{fontSize:'var(--fs-sm)',color:'rgba(255,255,255,0.4)',marginTop:2}}>
                  {(itemDevoluver.produtos as any)?.nome}
                </div>
              </div>
              <button onClick={() => setModalDevItem(false)} style={{
                background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:'var(--r-md)', width:28, height:28, cursor:'pointer',
                color:'rgba(255,255,255,0.5)', fontSize:18, display:'flex',
                alignItems:'center', justifyContent:'center',
              }}>×</button>
            </div>

            <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:14}}>
              {erroDevItem && <div className="ds-alert-error">{erroDevItem}</div>}

              {/* Info do item */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10,
                background:'rgba(255,255,255,0.04)', borderRadius:'var(--r-md)',
                padding:'10px 14px', border:'1px solid rgba(255,255,255,0.07)',
              }}>
                <div>
                  <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Patrimônio</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'var(--fs-md)',color:'rgba(255,255,255,0.85)',fontWeight:600}}>
                    {(itemDevoluver.patrimonios as any)?.numero_patrimonio ?? '—'}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Qtd Total</div>
                  <div style={{fontSize:'var(--fs-md)',color:'rgba(255,255,255,0.85)',fontWeight:600}}>{itemDevoluver.quantidade}</div>
                </div>
                <div>
                  <div style={{fontSize:'var(--fs-xs)',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Pendente</div>
                  <div style={{fontSize:'var(--fs-md)',color:'var(--c-warning)',fontWeight:700}}>
                    {Number(itemDevoluver.quantidade) - Number(itemDevoluver.qtd_devolvida ?? 0)}
                  </div>
                </div>
              </div>

              {/* Quantidade a devolver */}
              <FormField label="Quantidade a devolver">
                <input
                  type="number" min="1"
                  max={Number(itemDevoluver.quantidade) - Number(itemDevoluver.qtd_devolvida ?? 0)}
                  value={formDevItem.qtd}
                  onChange={e => setFormDevItem((f:any) => ({ ...f, qtd: e.target.value }))}
                  className={inputCls}
                />
              </FormField>

              {/* Condição */}
              <FormField label="Condição do equipamento">
                <select value={formDevItem.condicao}
                  onChange={e => setFormDevItem((f:any) => ({ ...f, condicao: e.target.value }))}
                  className={selectCls}>
                  <option value="bom">Bom Estado</option>
                  <option value="avariado">Avariado</option>
                  <option value="perdido">Extraviado / Perdido</option>
                </select>
              </FormField>

              {/* Custo de avaria (condicional) */}
              {formDevItem.condicao !== 'bom' && (
                <FormField label="Custo da avaria / extravio (R$)">
                  <input type="number" step="0.01" min="0"
                    value={formDevItem.custo_avaria}
                    onChange={e => setFormDevItem((f:any) => ({ ...f, custo_avaria: e.target.value }))}
                    className={inputCls} placeholder="0,00" />
                </FormField>
              )}

              {/* Observações */}
              <FormField label="Observações">
                <textarea value={formDevItem.obs}
                  onChange={e => setFormDevItem((f:any) => ({ ...f, obs: e.target.value }))}
                  className={textareaCls} rows={2}
                  placeholder="Opcional — aparece no recibo de devolução" />
              </FormField>

              {/* Ações */}
              <div style={{display:'flex', gap:8, marginTop:4}}>
                <Btn loading={salvandoDevItem} onClick={salvarDevItem} style={{flex:1}}>
                  ↩ Confirmar Devolução
                </Btn>
                <Btn variant="secondary" onClick={() => setModalDevItem(false)}>
                  Cancelar
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal de Edição do Contrato (Aditivo) ───────────────────────── */}
      {painelEditar && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={e => { if (e.target === e.currentTarget) setPainelEditar(false) }}>
          <div style={{
            background:'var(--bg-card)', borderRadius:'var(--r-lg)', width:'100%', maxWidth:580,
            boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden', maxHeight:'90vh', overflowY:'auto',
          }}>
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--bg-header)', position:'sticky', top:0, zIndex:1 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>✏️ Alterar Contrato</div>
                <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
                  As alterações serão registradas como aditivo na timeline.
                </div>
              </div>
              <button onClick={() => setPainelEditar(false)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20,
                  color:'var(--t-muted)', lineHeight:1 }}>×</button>
            </div>

            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>
              {erroEdicao && <div className="ds-alert-error">{erroEdicao}</div>}

              {/* Período e datas */}
              <div className="ds-card" style={{ padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-sm)', color:'var(--t-muted)',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                  📅 Período e Datas
                </div>

                <FormField label="Período de Locação"
                  hint={formEdicao.periodo_id !== contrato?.periodo_id ? '⚠️ Mudança de período recalcula os preços de todos os itens.' : ''}>
                  <select value={formEdicao.periodo_id ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, periodo_id: e.target.value }))}
                    className={selectCls}>
                    <option value="">Sem período definido</option>
                    {periodos.map((p:any) => (
                      <option key={p.id} value={p.id}>{p.nome} ({p.dias}d)</option>
                    ))}
                  </select>
                </FormField>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                  <FormField label="Data de Início">
                    <input type="date" value={formEdicao.data_inicio ?? ''}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, data_inicio: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Previsão de Devolução">
                    <input type="date" value={formEdicao.data_fim ?? ''}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, data_fim: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                </div>

                {/* Preview do novo total quando período muda */}
                {formEdicao.periodo_id && String(formEdicao.periodo_id) !== String(contrato?.periodo_id) && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'var(--c-warning-light)',
                    border:'1px solid var(--c-warning)', borderRadius:'var(--r-sm)',
                    fontSize:'var(--fs-sm)', color:'var(--c-warning-text)' }}>
                    ⚠️ O período foi alterado de <strong>{periodos.find((p:any)=>String(p.id)===String(contrato?.periodo_id))?.nome ?? 'sem período'}</strong> para <strong>{periodos.find((p:any)=>String(p.id)===String(formEdicao.periodo_id))?.nome}</strong>.
                    Os preços de todos os itens serão recalculados ao salvar.
                  </div>
                )}
              </div>

              {/* Financeiro */}
              <div className="ds-card" style={{ padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-sm)', color:'var(--t-muted)',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                  💰 Ajustes Financeiros
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <FormField label="Desconto (R$)">
                    <input type="number" step="0.01" min="0"
                      value={formEdicao.desconto ?? 0}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, desconto: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Acréscimo (R$)">
                    <input type="number" step="0.01" min="0"
                      value={formEdicao.acrescimo ?? 0}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, acrescimo: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Frete (R$)">
                    <input type="number" step="0.01" min="0"
                      value={formEdicao.frete ?? 0}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, frete: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Caução (R$)">
                    <input type="number" step="0.01" min="0"
                      value={formEdicao.caucao ?? 0}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, caucao: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                </div>
              </div>

              {/* Pagamento */}
              <div className="ds-card" style={{ padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-sm)', color:'var(--t-muted)',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                  🏦 Pagamento
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <FormField label="Forma de Pagamento">
                    <select value={formEdicao.forma_pagamento ?? 'pix'}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, forma_pagamento: e.target.value }))}
                      className={selectCls}>
                      {['pix','dinheiro','cartao_debito','cartao_credito','transferencia','boleto','cheque'].map(fp => (
                        <option key={fp} value={fp}>{fp.replace(/_/g,' ').replace(/\b\w/g,(ch:string)=>ch.toUpperCase())}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Condição de Pagamento">
                    <input value={formEdicao.condicao_pagamento ?? ''}
                      onChange={e => setFormEdicao((f:any) => ({ ...f, condicao_pagamento: e.target.value }))}
                      className={inputCls} placeholder="Ex: 30/60 dias" />
                  </FormField>
                </div>
              </div>

              {/* Observações */}
              <div className="ds-card" style={{ padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:'var(--fs-sm)', color:'var(--t-muted)',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                  📝 Observações
                </div>
                <FormField label="Observações (visível no contrato)">
                  <textarea value={formEdicao.observacoes ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, observacoes: e.target.value }))}
                    rows={3} className={textareaCls} />
                </FormField>
                <FormField label="Observações Internas" style={{ marginTop:10 }}>
                  <textarea value={formEdicao.observacoes_internas ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, observacoes_internas: e.target.value }))}
                    rows={2} className={textareaCls} placeholder="Visível apenas internamente" />
                </FormField>
              </div>

              {/* Ações */}
              <div style={{ display:'flex', gap:8 }}>
                <Btn loading={salvandoEdicao} onClick={salvarEdicao} style={{ flex:1 }}>
                  💾 Salvar Alterações
                </Btn>
                <Btn variant="secondary" onClick={() => setPainelEditar(false)}>
                  Cancelar
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nova Fatura / Antecipação ──────────────────────────────── */}
      {painelFatura && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={e => { if (e.target === e.currentTarget) setPainelFatura(false) }}>
          <div style={{
            background:'var(--bg-card)', borderRadius:'var(--r-lg)', width:'100%', maxWidth:480,
            boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden',
          }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--bg-header)' }}>
              <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>+ Nova Fatura / Antecipação</div>
              <button onClick={() => setPainelFatura(false)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--t-muted)' }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:14 }}>
              {erroFatura && <div className="ds-alert-error">{erroFatura}</div>}

              <FormField label="Tipo">
                <select value={formNovaFatura.tipo}
                  onChange={e => setFormNovaFatura((f:any) => ({ ...f, tipo: e.target.value }))}
                  className={selectCls}>
                  <option value="antecipacao">Antecipação</option>
                  <option value="cobranca">Cobrança</option>
                  <option value="avaria">Avaria / Dano</option>
                  <option value="multa">Multa</option>
                  <option value="limpeza">Limpeza</option>
                  <option value="outros">Outros</option>
                </select>
              </FormField>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FormField label="Valor (R$) *">
                  <input type="number" step="0.01" min="0.01"
                    value={formNovaFatura.valor || ''}
                    onChange={e => setFormNovaFatura((f:any) => ({ ...f, valor: e.target.value }))}
                    className={inputCls} placeholder="0,00" />
                </FormField>
                <FormField label="Vencimento *">
                  <input type="date"
                    value={formNovaFatura.data_vencimento}
                    onChange={e => setFormNovaFatura((f:any) => ({ ...f, data_vencimento: e.target.value }))}
                    className={inputCls} />
                </FormField>
              </div>

              <FormField label="Forma de Pagamento">
                <select value={formNovaFatura.forma_pagamento}
                  onChange={e => setFormNovaFatura((f:any) => ({ ...f, forma_pagamento: e.target.value }))}
                  className={selectCls}>
                  {['pix','dinheiro','cartao_debito','cartao_credito','transferencia','boleto','cheque'].map(fp => (
                    <option key={fp} value={fp}>{fp.replace(/_/g,' ').replace(/\w/g,(x:string)=>x.toUpperCase())}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Descrição">
                <input value={formNovaFatura.descricao}
                  onChange={e => setFormNovaFatura((f:any) => ({ ...f, descricao: e.target.value }))}
                  className={inputCls} placeholder="Ex: Antecipação referente a..." />
              </FormField>

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <Btn loading={salvandoFatura} onClick={criarFaturaAvulsa} style={{ flex:1 }}>
                  ✓ Criar Fatura
                </Btn>
                <Btn variant="secondary" onClick={() => setPainelFatura(false)}>
                  Cancelar
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal de Pagamento ──────────────────────────────────────────── */}
      {painelPgto && faturaAlvo && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={e => { if (e.target === e.currentTarget) { setPainelPgto(false); setMultaJurosInfo(null) } }}>
          <div style={{
            background:'var(--bg-card)', borderRadius:'var(--r-lg)', width:'100%', maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden',
          }}>
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--bg-header)' }}>
              <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>💰 Registrar Pagamento</div>
              <button onClick={() => { setPainelPgto(false); setMultaJurosInfo(null) }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:18,
                  color:'var(--t-muted)', lineHeight:1 }}>×</button>
            </div>

            <div style={{ padding:'20px' }}>
              {/* Dados da fatura */}
              <div style={{ background:'var(--bg-header)', borderRadius:'var(--r-md)',
                padding:'10px 14px', marginBottom:16, fontSize:'var(--fs-md)' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--t-muted)' }}>Fatura</span>
                  <span style={{ fontWeight:600, fontFamily:'monospace' }}>{faturaAlvo.numero}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                  <span style={{ color:'var(--t-muted)' }}>Valor original</span>
                  <span style={{ fontWeight:600 }}>{fmt.money(faturaAlvo.valor)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                  <span style={{ color:'var(--t-muted)' }}>Vencimento</span>
                  <span style={{ fontWeight:600 }}>{fmt.date(faturaAlvo.data_vencimento)}</span>
                </div>
              </div>

              {/* Aviso de multa/juros quando vencida */}
              {multaJurosInfo && (
                <div style={{ background:'var(--c-warning-light)', border:'1px solid var(--c-warning)',
                  borderRadius:'var(--r-md)', padding:'12px 14px', marginBottom:16 }}>
                  <div style={{ fontWeight:700, color:'var(--c-warning-text)', marginBottom:8, fontSize:'var(--fs-md)' }}>
                    ⚠️ Fatura vencida há {multaJurosInfo.dias} dia(s)
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'var(--fs-md)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'var(--t-secondary)' }}>Valor base (saldo)</span>
                      <span>{fmt.money(Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor))}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'var(--c-danger)' }}>+ Multa ({multaJurosInfo.dias > 0 ? '2%' : ''})</span>
                      <span style={{ color:'var(--c-danger)', fontWeight:600 }}>{fmt.money(multaJurosInfo.multa)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'var(--c-danger)' }}>+ Juros ({multaJurosInfo.dias}d × 1%/mês)</span>
                      <span style={{ color:'var(--c-danger)', fontWeight:600 }}>{fmt.money(multaJurosInfo.juros)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--c-warning)',
                      paddingTop:6, marginTop:4, fontWeight:700 }}>
                      <span>Total sugerido</span>
                      <span style={{ color:'var(--c-warning-text)' }}>
                        {fmt.money(Number(faturaAlvo.saldo_restante ?? faturaAlvo.valor) + multaJurosInfo.multa + multaJurosInfo.juros)}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', marginTop:8 }}>
                    Você pode ajustar o valor abaixo se negociar diferente com o cliente.
                  </div>
                </div>
              )}

              {erroPgto && <div className="ds-alert-error" style={{ marginBottom:12 }}>{erroPgto}</div>}

              {/* Formulário */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <FormField label="Valor Recebido (R$) *">
                  <input type="number" step="0.01" min="0"
                    value={formPgto.valor_pago}
                    onChange={e => setFormPgto((p: any) => ({ ...p, valor_pago: e.target.value }))}
                    className={inputCls} />
                </FormField>
                <FormField label="Data do Pagamento *">
                  <input type="date"
                    value={formPgto.data_pagamento}
                    onChange={e => setFormPgto((p: any) => ({ ...p, data_pagamento: e.target.value }))}
                    className={inputCls} />
                </FormField>
                <FormField label="Forma de Pagamento">
                  <select value={formPgto.forma_pagamento}
                    onChange={e => setFormPgto((p: any) => ({ ...p, forma_pagamento: e.target.value }))}
                    className={selectCls}>
                    {['pix','dinheiro','cartao_debito','cartao_credito','transferencia','boleto','cheque'].map(f => (
                      <option key={f} value={f}>{f.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Observações">
                  <input value={formPgto.observacoes}
                    onChange={e => setFormPgto((p: any) => ({ ...p, observacoes: e.target.value }))}
                    className={inputCls} placeholder="Multa, juros, desconto negociado..." />
                </FormField>
              </div>

              {/* Ações */}
              <div style={{ display:'flex', gap:8, marginTop:20 }}>
                <Btn loading={salvandoPgto} onClick={confirmarPagamento} style={{ flex:1 }}>
                  ✓ Confirmar Pagamento
                </Btn>
                <Btn variant="secondary" onClick={() => { setPainelPgto(false); setMultaJurosInfo(null) }}>
                  Cancelar
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
