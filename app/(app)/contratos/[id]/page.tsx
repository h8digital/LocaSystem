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
  // E-mail
  const [emailLog,      setEmailLog]      = useState<any[]>([])
  const [timeline,      setTimeline]      = useState<any[]>([])
  const [novaAnotacao,  setNovaAnotacao]  = useState('')
  const [salvandoAnot,  setSalvandoAnot]  = useState(false)
  const [erroAnot,      setErroAnot]      = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [erroEmail,     setErroEmail]     = useState('')
  const [okEmail,       setOkEmail]       = useState('')
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

  useEffect(() => {
    async function load() {
      const [{ data:c },{ data:i },{ data:f }, s,{ data:t },{ data:per },{ data:d },{ data:el }] = await Promise.all([
        supabase.from('contratos').select('*, clientes(*), usuarios(nome), periodos_locacao(nome, dias)').eq('id', id).single(),
        supabase.from('contrato_itens').select('*, produtos(nome), patrimonios(numero_patrimonio)').eq('contrato_id', id),
        supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento'),
        supabase.from('contrato_saldo').select('*').eq('contrato_id', id).maybeSingle(),
        supabase.from('doc_templates').select('id,nome,tipo').eq('ativo',1).order('tipo').order('nome'),
        supabase.from('periodos_locacao').select('*').eq('ativo',1).order('dias'),
        supabase.from('devolucoes').select('*, usuarios(nome)').eq('contrato_id', id).order('created_at',{ascending:false}),
        supabase.from('email_log').select('*, usuarios(nome)').eq('contrato_id', id).order('created_at',{ascending:false}).limit(20),
      ])
      setContrato(c); setItens(i??[]); setFaturas(f??[]); setSaldoInfo(s?.data ?? s ?? null); setEmailLog(el??[]); setPeriodos(per??[])
      // Carregar timeline
      const tlRes = await fetch('/api/contrato-timeline?contrato_id=' + id)
      const tlData = await tlRes.json()
      setTimeline(tlData.ok ? tlData.data : [])
      setTemplates(t??[]); setDevolucoes(d??[]); setLoading(false)
      const pad = t?.find((x:any)=>x.padrao===1&&x.tipo==='contrato')
      if(pad) setTemplateSel(String(pad.id))
    }
    load()
  }, [id])

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

  async function iniciarCheckin() { router.push(`/contratos/${id}/encerrar`) }

  async function encerrarPendente() {
    const res = await fetch('/api/contratos/encerrar', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contrato_id: Number(id) }) })
    const data = await res.json()
    if (data.fatura_gerada) { alert(data.error); window.location.reload(); return }
    if (!data.ok) { alert(`Erro: ${data.error}`); return }
    alert(data.msg); window.location.reload()
  }

  // ── Funções de pagamento ─────────────────────────────────
  function abrirPagamento(fatura: any) {
    setFaturaAlvo(fatura)
    setFormPgto({
      valor_pago:      fatura.valor_pago ?? fatura.valor,
      data_pagamento:  new Date().toISOString().split('T')[0],
      forma_pagamento: fatura.forma_pagamento ?? contrato.forma_pagamento ?? 'pix',
      observacoes:     '',
    })
    setErroPgto('')
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
    if (!confirm(`Excluir a fatura ${fatura.numero}?`)) return
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
      <div className="ds-spinner" style={{width:20,height:20}}/>Carregando...
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
          {contrato.status==='ativo'&&(
            <Btn onClick={iniciarCheckin}>
              Iniciar Devolução
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
            sec.push({ label:'Gerar Documento', onClick:()=>{setAba('documentos');setDocLink('')}, grupo:1 })
            if(contrato.status==='rascunho'||contrato.status==='ativo'){
              sec.push({ label:'Alterar Contrato', onClick:abrirEditar, grupo:1 })
            }
            if(contrato.status==='ativo'){
              sec.push({ label:'Cancelar Contrato', onClick:cancelar, grupo:2, destrutivo:true })
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
                  <div key={k.l} className="ds-card" style={{padding:'12px 14px'}}>
                    <div style={{fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{k.l==='Caucao'?'Caução':k.l}</div>
                    <div style={{fontWeight:k.bold?800:700,fontSize:k.bold?'var(--fs-lg)':'var(--fs-base)',color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Informações Gerais */}
              <div className="ds-card" style={{padding:'16px 20px'}}>
                <div className="ds-section-title">Informações Gerais</div>
                <div className="form-grid-3" style={{gap:18}}>
                  <Campo label="Cliente"            value={contrato.clientes?.nome}/>
                  <Campo label="Vendedor"           value={(contrato.usuarios as any)?.nome}/>
                  <Campo label="Forma de Pagamento" value={(contrato.forma_pagamento??'').replace(/_/g,' ').replace(/\w/g,(ch:string)=>ch.toUpperCase())}/>
                  <Campo label="Início"             value={fmt.date(contrato.data_inicio)}/>
                  <Campo label="Fim Previsto"       value={fmt.date(contrato.data_fim)}/>
                  <Campo label="Período de Locação" value={(contrato as any).periodos_locacao?.nome?`${(contrato as any).periodos_locacao.nome} (${(contrato as any).periodos_locacao.dias}d)`:'—'}/>
                  {contrato.data_devolucao_real&&<Campo label="Devolução Real" value={fmt.date(contrato.data_devolucao_real)}/>}
                  {Number(contrato.comissao_percentual)>0&&<Campo label={`Comissão (${contrato.comissao_percentual}%)`} value={fmt.money(contrato.comissao_valor)}/>}
                  {Number(contrato.frete)>0&&<Campo label="Frete" value={fmt.money(contrato.frete)}/>}
                </div>
                {contrato.observacoes&&(
                  <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Observações</div>
                    <div style={{fontSize:'var(--fs-base)',color:'var(--t-secondary)',lineHeight:1.6}}>{contrato.observacoes}</div>
                  </div>
                )}
              </div>

              {/* Local de Uso */}
              {(enderecoUso||contrato.local_uso_referencia)&&(
                <div className="ds-card" style={{padding:'16px 20px'}}>
                  <div className="ds-section-title">Local de Uso dos Equipamentos</div>
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
                    <Th right>Preço/dia</Th>
                    <Th right>Total</Th>
                    {(contrato.status==='rascunho'||contrato.status==='ativo')&&<Th></Th>}
                  </tr></thead>
                  <tbody>
                    {itens.map(i=>(
                      <tr key={i.id}>
                        <Td bold>{(i.produtos as any)?.nome}</Td>
                        <Td mono muted>{(i.patrimonios as any)?.numero_patrimonio??'—'}</Td>
                        <Td right>{i.quantidade}</Td>
                        <Td right>{fmt.money(i.preco_unitario)}</Td>
                        <Td right bold primary>{fmt.money(i.total_item)}</Td>
                        {(contrato.status==='rascunho'||contrato.status==='ativo')&&(
                          <td style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',gap:4}}>
                              <button onClick={()=>abrirEditarItem(i)}
                                className="tbl-btn edit" title="Editar item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                              {contrato.status==='rascunho'&&(
                                <button onClick={()=>removerItem(i)}
                                  className="tbl-btn del" title="Remover item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'var(--bg-header)'}}>
                      <td colSpan={(contrato.status==='rascunho'||contrato.status==='ativo')?5:4}
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
                      {l:'Multa/Atraso',     v:saldoInfo.fat_multa,       c:Number(saldoInfo.fat_multa)>0?'var(--c-danger)':'var(--t-muted)'},
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
                  <div key={dev.id} style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:dev.observacoes?10:0}}>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontFamily:'monospace',fontWeight:700}}>#{dev.id}</span>
                          <Badge value={dev.status} dot/>
                        </div>
                        <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>{fmt.datetime(dev.data_devolucao)} · {(dev.usuarios as any)?.nome}</div>
                      </div>
                      <div style={{display:'flex',gap:16,flexShrink:0}}>
                        {dev.dias_atraso>0&&<div style={{textAlign:'right'}}><div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Atraso</div><div style={{fontWeight:700,color:'var(--c-danger)'}}>{dev.dias_atraso}d</div></div>}
                        {dev.multa_atraso>0&&<div style={{textAlign:'right'}}><div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Multa</div><div style={{fontWeight:700,color:'var(--c-danger)'}}>{fmt.money(dev.multa_atraso)}</div></div>}
                        {dev.valor_avarias>0&&<div style={{textAlign:'right'}}><div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Avarias</div><div style={{fontWeight:700,color:'var(--c-warning-text)'}}>{fmt.money(dev.valor_avarias)}</div></div>}
                        <div style={{textAlign:'right'}}><div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Caução Dev.</div><div style={{fontWeight:700}}>{fmt.money(dev.caucao_devolvido)}</div></div>
                      </div>
                    </div>
                    {dev.observacoes&&<div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)',borderTop:'1px solid var(--border)',paddingTop:8}}>{dev.observacoes}</div>}
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

    </div>
  )
}
