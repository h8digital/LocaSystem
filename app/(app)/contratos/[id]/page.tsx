'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
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
  const [painelEmail,   setPainelEmail]   = useState(false)
  const [emailLog,      setEmailLog]      = useState<any[]>([])
  const [timeline,      setTimeline]      = useState<any[]>([])
  const [envEmail,      setEnvEmail]      = useState({ para:'', cc:'', assunto:'', corpo:'' })
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [erroEmail,     setErroEmail]     = useState('')
  const [okEmail,       setOkEmail]       = useState('')
  const [aba,        setAba]        = useState('dados')
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
        supabase.from('contratos').select('*, clientes(*), usuarios(nome)').eq('id', id).single(),
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

      itensAtualizados = itens.map((it:any) => {
        const p = prodMap[it.produto_id]
        if (!p) return it
        let preco = 0
        const d = periodoDias
        if      (isFDS && p.preco_fds > 0)                    preco = Number(p.preco_fds)
        else if (d >= 180 && p.preco_semestral > 0)           preco = Number(p.preco_semestral)
        else if (d >= 90  && p.preco_trimestral > 0)          preco = Number(p.preco_trimestral)
        else if (d >= 30  && p.preco_locacao_mensal > 0)      preco = Number(p.preco_locacao_mensal)
        else if (d >= 15  && p.preco_quinzenal > 0)           preco = Number(p.preco_quinzenal)
        else if (d >= 7   && p.preco_locacao_semanal > 0)     preco = Number(p.preco_locacao_semanal)
        else                                                   preco = Number(p.preco_locacao_diario ?? 0)
        const novoTotal = preco * Number(it.quantidade ?? 1)
        return { ...it, preco_unitario: preco, total: novoTotal }
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
  function abrirEmail() {
    const emailCliente = (contrato as any)?.clientes?.email ?? ''
    const nomeCliente  = (contrato as any)?.clientes?.nome  ?? ''
    setEnvEmail({
      para:    emailCliente,
      cc:      '',
      assunto: `Contrato de Locação Nº ${contrato?.numero}`,
      corpo:   `Olá ${nomeCliente},

Segue o contrato de locação Nº ${contrato?.numero}.

${docLink ? `Link para visualização: ${docLink}` : ''}

Em caso de dúvidas, estamos à disposição.

Atenciosamente,`,
    })
    setErroEmail(''); setOkEmail('')
    setPainelEmail(true)
  }

  async function enviarEmail() {
    if (!envEmail.para) { setErroEmail('Informe o e-mail do destinatário'); return }
    setEnviandoEmail(true); setErroEmail(''); setOkEmail('')
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        para:        envEmail.para,
        cc:          envEmail.cc || undefined,
        assunto:     envEmail.assunto,
        corpo:       envEmail.corpo,
        contrato_id: Number(id),
        html: envEmail.corpo.split('\n').join('<br/>') + (docLink ? '<br/><br/><a href="' + docLink + '" style="background:#17A2B8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Abrir Documento</a>' : ''),
      }),
    })
    const data = await res.json()
    setEnviandoEmail(false)
    if (data.ok) { setOkEmail(data.msg); }
    else setErroEmail(data.error)
  }

  // ── Ativar contrato (DRAFT → ACTIVE) ─────────────────────
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
    await supabase.from('faturas').update({
      status:          'pago',
      valor_pago:      Number(formPgto.valor_pago),
      data_pagamento:  formPgto.data_pagamento,
      forma_pagamento: formPgto.forma_pagamento,
      observacoes:     formPgto.observacoes || null,
    }).eq('id', faturaAlvo.id)
    const { data: f } = await supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento')
    setFaturas(f ?? [])
    setSalvandoPgto(false)
    setPainelPgto(false)
  }

  async function estornarPagamento(fatura: any) {
    if (!confirm(`Estornar pagamento da fatura ${fatura.numero}?`)) return
    await supabase.from('faturas').update({ status:'pendente', valor_pago:null, data_pagamento:null }).eq('id', fatura.id)
    const { data: f } = await supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento')
    setFaturas(f ?? [])
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
      supabase.from('contratos').select('*, clientes(*), usuarios(nome)').eq('id', id).single(),
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

  const totalPago    =faturas.filter(f=>f.status==='pago').reduce((s,f)=>s+Number(f.valor_pago??f.valor),0)
  const totalPendente=faturas.filter(f=>f.status!=='pago').reduce((s,f)=>s+Number(f.valor),0)

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
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[
                  {l:'Total',  v:fmt.money(contrato.total),       c:'var(--c-primary)'},
                  {l:'Caução', v:fmt.money(contrato.caucao),      c:'var(--t-primary)'},
                  {l:'Início', v:fmt.date(contrato.data_inicio),  c:'var(--t-primary)'},
                  {l:'Fim',    v:fmt.date(contrato.data_fim),     c:'var(--t-primary)'},
                ].map(k=>(
                  <div key={k.l} style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:4}}>{k.l}</div>
                    <div style={{fontWeight:700,color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="ds-section-title">Informações Gerais</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  <Campo label="Cliente"           value={contrato.clientes?.nome}/>
                  <Campo label="Vendedor"          value={(contrato.usuarios as any)?.nome}/>
                  <Campo label="Forma de Pagamento" value={(contrato.forma_pagamento??'').replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}/>
                  <Campo label="Início"            value={fmt.date(contrato.data_inicio)}/>
                  <Campo label="Fim Previsto"      value={fmt.date(contrato.data_fim)}/>
                  <Campo label="Caução"            value={fmt.money(contrato.caucao)}/>
                  {contrato.data_devolucao_real&&<Campo label="Devolução Real" value={fmt.date(contrato.data_devolucao_real)}/>}
                  {Number(contrato.comissao_percentual)>0&&<Campo label={`Comissão (${contrato.comissao_percentual}%)`} value={fmt.money(contrato.comissao_valor)}/>}
                </div>
                {contrato.observacoes&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:4}}>Observações</div>
                    <div style={{fontSize:'var(--fs-base)',color:'var(--t-secondary)',lineHeight:1.6}}>{contrato.observacoes}</div>
                  </div>
                )}
              </div>

              {(enderecoUso||contrato.local_uso_referencia)&&(
                <div>
                  <div className="ds-section-title">Local de Uso dos Equipamentos</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
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
                      style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:10,
                        fontSize:'var(--fs-md)',color:'var(--c-primary)',textDecoration:'none',fontWeight:500}}>
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
                  <div style={{fontSize:'var(--fs-md)',color:'var(--c-success-text)',marginBottom:4}}>Recebido</div>
                  <div style={{fontWeight:700,fontSize:'var(--fs-lg)',color:'var(--c-success-text)'}}>{fmt.money(totalPago)}</div>
                </div>
                <div style={{background:totalPendente>0?'var(--c-danger-light)':'var(--c-success-light)',borderRadius:'var(--r-md)',padding:'12px 16px',border:`1px solid ${totalPendente>0?'var(--c-danger)':'var(--c-success)'}`}}>
                  <div style={{fontSize:'var(--fs-md)',color:totalPendente>0?'var(--c-danger-text)':'var(--c-success-text)',marginBottom:4}}>Em Aberto</div>
                  <div style={{fontWeight:700,fontSize:'var(--fs-lg)',color:totalPendente>0?'var(--c-danger)':'var(--c-success-text)'}}>{fmt.money(totalPendente)}</div>
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
                          <Td right>{f.status==='pago'?fmt.money(f.valor_pago??f.valor):'—'}</Td>
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
                      <a href={docLink} target="_blank" rel="noopener" style={{flex:1}}><Btn variant="secondary" style={{width:'100%'}}>Visualizar</Btn></a>
                      <Btn style={{flex:1}} onClick={abrirEmail}>📧 Enviar por E-mail</Btn>
                      <Btn variant="secondary" style={{flex:1}} onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link do seu contrato:\n\n${docLink}`)}`, '_blank')}>WhatsApp</Btn>
                    </div>
                    <Btn variant="secondary" onClick={()=>setDocLink('')} style={{alignSelf:'flex-start'}}>Gerar Novamente</Btn>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>Link válido por 30 dias.</div>
                  </div>
                }
              </div>
            </div>

            <div className="panel-section">
              <div style={{padding:'10px 14px',background:'var(--bg-header)',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:'var(--fs-md)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>E-mails Enviados</span>
                <span style={{fontWeight:400,fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>{emailLog.length} registro(s)</span>
              </div>
              {emailLog.length === 0
                ? <div style={{padding:'20px',textAlign:'center',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>Nenhum e-mail enviado ainda.</div>
                : <table className="ds-table">
                    <thead><tr style={{background:'var(--bg-header)'}}>
                      {['Data','Para','Assunto','Usuario','Status'].map(h=>(
                        <th key={h} style={{padding:'6px 12px',textAlign:'left',fontWeight:600,color:'var(--t-muted)',fontSize:'var(--fs-sm)',borderBottom:'1px solid var(--border)'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {emailLog.map((log:any,ix:number)=>(
                        <tr key={log.id} style={{borderBottom:'1px solid var(--border)',background:ix%2===0?'transparent':'var(--bg-header)'}}>
                          <td style={{padding:'7px 12px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{new Date(log.created_at).toLocaleDateString('pt-BR')}</td>
                          <td style={{padding:'7px 12px',fontWeight:500}}>{log.para}</td>
                          <td style={{padding:'7px 12px',color:'var(--t-secondary)'}}>{log.assunto}</td>
                          <td style={{padding:'7px 12px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{log.usuarios?.nome??'---'}</td>
                          <td style={{padding:'7px 12px',fontWeight:600,fontSize:'var(--fs-sm)',color:log.status==='enviado'?'var(--c-success,#16a34a)':'var(--c-danger)'}}>
                            {log.status==='enviado'?'Enviado':'Erro'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            </div>

          )}

        </div>
      </div>

      {/* ── Painel: Enviar por E-mail ─────────────────────────────────────── */}
      <SlidePanel
        open={painelEmail}
        onClose={() => setPainelEmail(false)}
        title="Enviar por E-mail"
        subtitle={`Contrato ${contrato?.numero}`}
        width="md"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainelEmail(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={enviandoEmail} onClick={enviarEmail}>
              📧 Enviar
            </Btn>
          </div>
        }
      >
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {erroEmail && (
            <div style={{ background:'var(--c-danger-light)', border:'1px solid var(--c-danger)',
              borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--c-danger-text)',
              fontSize:'var(--fs-md)', fontWeight:600 }}>
              ❌ {erroEmail}
            </div>
          )}
          {okEmail && (
            <div style={{ background:'var(--c-success-light)', border:'1px solid var(--c-success)',
              borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--c-success-text)',
              fontSize:'var(--fs-md)', fontWeight:600 }}>
              ✅ {okEmail}
            </div>
          )}
          <FormField label="Para (destinatário) *">
            <input className={inputCls} type="email"
              value={envEmail.para}
              onChange={e => setEnvEmail(v=>({...v,para:e.target.value}))}
              placeholder="cliente@email.com.br" />
          </FormField>
          <FormField label="CC (cópia) — opcional">
            <input className={inputCls} type="email"
              value={envEmail.cc}
              onChange={e => setEnvEmail(v=>({...v,cc:e.target.value}))}
              placeholder="outro@email.com.br" />
          </FormField>
          <FormField label="Assunto">
            <input className={inputCls}
              value={envEmail.assunto}
              onChange={e => setEnvEmail(v=>({...v,assunto:e.target.value}))} />
          </FormField>
          <FormField label="Mensagem">
            <textarea className={textareaCls} rows={8}
              value={envEmail.corpo}
              onChange={e => setEnvEmail(v=>({...v,corpo:e.target.value}))} />
          </FormField>
          {docLink && (
            <div style={{ background:'var(--bg-header)', border:'1px solid var(--border)',
              borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)',
              color:'var(--t-secondary)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>📄</span>
              <div>
                <div className="tbl-cell-main">Link do documento será incluído</div>
                <div style={{ fontSize:'var(--fs-sm)', color:'var(--t-muted)', marginTop:2 }}>
                  Um botão de acesso ao documento será adicionado automaticamente ao e-mail.
                </div>
              </div>
            </div>
          )}
          {!docLink && (
            <div style={{ background:'var(--c-warning-light,#fef3c7)', border:'1px solid var(--c-warning,#f59e0b)',
              borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)',
              color:'var(--c-warning-text,#92400e)' }}>
              ⚠ Nenhum documento gerado ainda. Gere o documento na aba <strong>Documentos</strong> antes de enviar para incluir o link.
            </div>
          )}
        </div>
      </SlidePanel>


          {aba==='timeline'&&(
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div className="ds-section-title" style={{marginBottom:0}}>Histórico do Contrato</div>
                <button onClick={()=>registrarTimeline('sistema','Entrada manual na timeline',{})}
                  style={{display:'none'}} />
              </div>
              {timeline.length === 0
                ? <div style={{textAlign:'center',padding:'32px',color:'var(--t-muted)',fontSize:'var(--fs-md)'}}>
                    Nenhum evento registrado ainda.
                  </div>
                : <div style={{position:'relative',paddingLeft:28}}>
                    {/* Linha vertical */}
                    <div style={{position:'absolute',left:10,top:0,bottom:0,width:2,background:'var(--border)'}} />
                    {timeline.map((ev:any,i:number)=>{
                      const icone:Record<string,string>={
                        criacao:'📄',ativacao:'✅',alteracao:'✏️',pagamento:'💰',
                        devolucao:'↩️',manutencao:'🔧',documento:'📋',email:'📧',
                        encerramento:'🏁',sistema:'⚙️'
                      }
                      return (
                        <div key={ev.id} style={{position:'relative',paddingBottom:20}}>
                          {/* Ícone no círculo */}
                          <div style={{position:'absolute',left:-28,top:0,width:20,height:20,
                            borderRadius:'50%',background:'var(--bg-card)',border:'2px solid var(--border)',
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>
                            {icone[ev.tipo]??'•'}
                          </div>
                          {/* Conteúdo */}
                          <div style={{background:'var(--bg-header)',borderRadius:'var(--r-md)',
                            padding:'10px 14px',border:'1px solid var(--border)'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                              <div style={{fontWeight:600,fontSize:'var(--fs-md)',color:'var(--t-primary)'}}>
                                {ev.descricao}
                              </div>
                              <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',whiteSpace:'nowrap',flexShrink:0}}>
                                {new Date(ev.created_at).toLocaleDateString('pt-BR')}{' '}
                                {new Date(ev.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                              </span>
                            </div>
                            {ev.usuarios?.nome && (
                              <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:4}}>
                                por {ev.usuarios.nome}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          )}

      {/* Painel: Enviar por E-mail */}
      <SlidePanel
        open={painelEmail}
        onClose={() => setPainelEmail(false)}
        title="Enviar por E-mail"
        subtitle={'Contrato ' + (contrato?.numero ?? '')}
        width="md"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainelEmail(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={enviandoEmail} onClick={enviarEmail}>Enviar</Btn>
          </div>
        }
      >
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {erroEmail && (
            <div style={{ background:'var(--c-danger-light)', border:'1px solid var(--c-danger)',
              borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--c-danger-text)', fontWeight:600 }}>
              {erroEmail}
            </div>
          )}
          {okEmail && (
            <div style={{ background:'var(--c-success-light)', border:'1px solid var(--c-success)',
              borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--c-success-text)', fontWeight:600 }}>
              {okEmail}
            </div>
          )}
          <FormField label="Para (destinatario) *">
            <input className={inputCls} type="email"
              value={envEmail.para}
              onChange={e => setEnvEmail(v=>({...v,para:e.target.value}))}
              placeholder="cliente@email.com.br" />
          </FormField>
          <FormField label="CC (copia) - opcional">
            <input className={inputCls} type="email"
              value={envEmail.cc}
              onChange={e => setEnvEmail(v=>({...v,cc:e.target.value}))}
              placeholder="outro@email.com.br" />
          </FormField>
          <FormField label="Assunto">
            <input className={inputCls}
              value={envEmail.assunto}
              onChange={e => setEnvEmail(v=>({...v,assunto:e.target.value}))} />
          </FormField>
          <FormField label="Mensagem">
            <textarea className={textareaCls} rows={7}
              value={envEmail.corpo}
              onChange={e => setEnvEmail(v=>({...v,corpo:e.target.value}))} />
          </FormField>
          {docLink && (
            <div style={{ background:'var(--bg-header)', border:'1px solid var(--border)',
              borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)',
              color:'var(--t-secondary)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>Link do documento sera incluido automaticamente.</span>
            </div>
          )}
          {!docLink && (
            <div style={{ background:'#fef3c7', border:'1px solid #f59e0b',
              borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:'var(--fs-md)', color:'#92400e' }}>
              Gere o documento antes de enviar para incluir o link.
            </div>
          )}
        </div>
      </SlidePanel>

      {/* -- Painel: Registrar Pagamento ──────────────────────────────────── */}
      <SlidePanel
        open={painelPgto}
        onClose={()=>setPainelPgto(false)}
        title="Registrar Pagamento"
        subtitle={faturaAlvo?.numero}
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{flex:1}} onClick={()=>setPainelPgto(false)}>Cancelar</Btn>
            <Btn style={{flex:2}} loading={salvandoPgto} onClick={confirmarPagamento}>Confirmar Pagamento</Btn>
          </div>
        }
      >
        {erroPgto&&<div className="ds-alert-error" style={{marginBottom:14}}>{erroPgto}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Resumo da fatura */}
          <div style={{background:'var(--bg-header)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'12px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:3}}>Fatura</div>
              <div style={{fontWeight:700}}>{faturaAlvo?.numero}</div>
            </div>
            <div>
              <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:3}}>Valor</div>
              <div style={{fontWeight:700,color:'var(--c-primary)'}}>{fmt.money(faturaAlvo?.valor)}</div>
            </div>
            <div>
              <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:3}}>Vencimento</div>
              <div className="tbl-cell-main">{fmt.date(faturaAlvo?.data_vencimento)}</div>
            </div>
            <div>
              <div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)',marginBottom:3}}>Tipo</div>
              <div style={{fontWeight:600,textTransform:'capitalize'}}>{(faturaAlvo?.tipo??'').replace(/_/g,' ')}</div>
            </div>
          </div>

          <FormField label="Valor Pago (R$)" required>
            <input type="number" step="0.01" min="0"
              value={formPgto.valor_pago}
              onChange={e=>setFormPgto((f:any)=>({...f,valor_pago:e.target.value}))}
              className={inputCls}/>
          </FormField>

          <div className="form-grid-2">
            <FormField label="Data do Pagamento" required>
              <input type="date" value={formPgto.data_pagamento}
                onChange={e=>setFormPgto((f:any)=>({...f,data_pagamento:e.target.value}))}
                className={inputCls}/>
            </FormField>
            <FormField label="Forma de Pagamento">
              <select value={formPgto.forma_pagamento}
                onChange={e=>setFormPgto((f:any)=>({...f,forma_pagamento:e.target.value}))}
                className={selectCls}>
                {['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','cheque'].map(v=>(
                  <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\w/g,(x:string)=>x.toUpperCase())}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Observações">
            <textarea value={formPgto.observacoes}
              onChange={e=>setFormPgto((f:any)=>({...f,observacoes:e.target.value}))}
              className={textareaCls} rows={2} placeholder="Comprovante, observações..."/>
          </FormField>

          {/* Alerta para gerar recibo */}
          <div style={{background:'var(--c-info-light)',border:'1px solid var(--c-info)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:'var(--fs-md)',color:'var(--c-info-text)'}}>
            Após confirmar, gere o <strong>Recibo</strong> na aba Documentos usando um template do tipo recibo.
          </div>
        </div>
      </SlidePanel>

      {/* ── Painel: Nova Fatura / Antecipação ──────────────────────────────── */}
      <SlidePanel
        open={painelFatura}
        onClose={()=>setPainelFatura(false)}
        title="Nova Fatura / Antecipação"
        subtitle={contrato?.numero}
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{flex:1}} onClick={()=>setPainelFatura(false)}>Cancelar</Btn>
            <Btn style={{flex:2}} loading={salvandoFatura} onClick={criarFaturaAvulsa}>Criar Fatura</Btn>
          </div>
        }
      >
        {erroFatura&&<div className="ds-alert-error" style={{marginBottom:14}}>{erroFatura}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          <FormField label="Tipo de Fatura">
            <select value={formNovaFatura.tipo}
              onChange={e=>setFormNovaFatura((f:any)=>({...f,tipo:e.target.value}))}
              className={selectCls}>
              {[
                {v:'antecipacao',  l:'Antecipação de Pagamento'},
                {v:'locacao',      l:'Locação'},
                {v:'avaria',       l:'Avaria / Dano'},
                {v:'multa',        l:'Multa por Atraso'},
                {v:'frete',        l:'Frete'},
                {v:'outros',       l:'Outros'},
              ].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </FormField>

          <div className="form-grid-2">
            <FormField label="Valor (R$)" required>
              <input type="number" step="0.01" min="0"
                value={formNovaFatura.valor}
                onChange={e=>setFormNovaFatura((f:any)=>({...f,valor:e.target.value}))}
                className={inputCls}/>
            </FormField>
            <FormField label="Vencimento" required>
              <input type="date" value={formNovaFatura.data_vencimento}
                onChange={e=>setFormNovaFatura((f:any)=>({...f,data_vencimento:e.target.value}))}
                className={inputCls}/>
            </FormField>
          </div>

          <FormField label="Forma de Pagamento">
            <select value={formNovaFatura.forma_pagamento}
              onChange={e=>setFormNovaFatura((f:any)=>({...f,forma_pagamento:e.target.value}))}
              className={selectCls}>
              {['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','cheque'].map(v=>(
                <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\w/g,(x:string)=>x.toUpperCase())}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Descrição">
            <input value={formNovaFatura.descricao}
              onChange={e=>setFormNovaFatura((f:any)=>({...f,descricao:e.target.value}))}
              className={inputCls} placeholder="Ex: Pagamento antecipado ref. ao período 01/04 a 30/04"/>
          </FormField>

          <FormField label="Observações">
            <textarea value={formNovaFatura.observacoes}
              onChange={e=>setFormNovaFatura((f:any)=>({...f,observacoes:e.target.value}))}
              className={textareaCls} rows={2}/>
          </FormField>

          {formNovaFatura.tipo==='antecipacao'&&(
            <div style={{background:'var(--c-info-light)',border:'1px solid var(--c-info)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:'var(--fs-md)',color:'var(--c-info-text)'}}>
              Após criar, registre o pagamento na linha da fatura e gere o <strong>Recibo</strong> na aba Documentos.
            </div>
          )}
        </div>
      </SlidePanel>

      {/* ── Painel de Item ──────────────────────────────────────────────── */}
      <SlidePanel
        open={painelItem}
        onClose={() => setPainelItem(false)}
        title={editandoItem ? 'Editar Item' : 'Adicionar Item'}
        subtitle={contrato?.numero}
        width="sm"
        footer={
          <div className="panel-footer-2btn">
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPainelItem(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={salvandoItem} onClick={salvarItem}>
              {editandoItem ? 'Salvar Alterações' : 'Adicionar'}
            </Btn>
          </div>
        }
      >
        {erroItem && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erroItem}</div>}

        {contrato?.status === 'ativo' && !editandoItem && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--c-info-light)',
            border:'1px solid var(--c-info)', borderRadius:'var(--r-md)',
            fontSize:'var(--fs-md)', color:'var(--c-info-text)' }}>
            Contrato ativo — novos itens serão incluídos como aditivo.
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <LookupField
            label="Produto / Equipamento" required
            table="produtos" searchColumn="nome"
            extraColumns="controla_patrimonio,preco_locacao_diario,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_trimestral,preco_semestral,custo_reposicao,prazo_entrega_dias"
            filter={{ ativo:1 }}
            value={formItem.produto_id ?? null}
            displayValue={itemProdNome}
            disabled={!!editandoItem}
            onChange={(pid, row) => {
              setFormItem((f: any) => ({
                ...f,
                produto_id: pid,
                patrimonio_id: null,
                preco_unitario: Number(row?.preco_locacao_diario ?? 0),
              }))
              setItemProdNome(row?.nome ?? '')
              setPatrimonios([])
              if (pid && row?.controla_patrimonio) loadPatrimonios(pid as number)
            }}
            renderOption={row => (
              <div>
                <div style={{ fontWeight:500 }}>{row.nome}</div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  {fmt.money(row.preco_locacao_diario ?? 0)}/dia
                </div>
              </div>
            )}
          />

          {/* Patrimônio — apenas para produtos que controlam */}
          {!editandoItem && patrimonios.length > 0 && (
            <FormField label="Patrimônio disponível">
              {loadingPats
                ? <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>Carregando...</div>
                : <select
                    value={formItem.patrimonio_id ?? ''}
                    onChange={e => setFormItem((f: any) => ({ ...f, patrimonio_id: Number(e.target.value) || null }))}
                    className={selectCls}>
                    <option value="">Sem patrimônio específico</option>
                    {patrimonios.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero_patrimonio}{p.numero_serie ? ` — ${p.numero_serie}` : ''}
                      </option>
                    ))}
                  </select>
              }
            </FormField>
          )}

          <div className="form-grid-2">
            <FormField label="Quantidade">
              <input type="number" min="1" step="1"
                value={formItem.quantidade ?? 1}
                onChange={e => setFormItem((f: any) => ({ ...f, quantidade: Number(e.target.value) }))}
                className={inputCls} />
            </FormField>
            <FormField label="Preço por Dia (R$)">
              <input type="number" min="0" step="0.01"
                value={formItem.preco_unitario ?? 0}
                onChange={e => setFormItem((f: any) => ({ ...f, preco_unitario: Number(e.target.value) }))}
                className={inputCls} />
            </FormField>
          </div>

          {/* Preview do total calculado */}
          {formItem.preco_unitario > 0 && (
            <div style={{ background:'var(--c-primary-light)', border:'1px solid var(--c-primary)',
              borderRadius:'var(--r-md)', padding:'10px 14px',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>
                {(() => {
                  const dias = contrato?.data_inicio && contrato?.data_fim
                    ? Math.max(1, Math.ceil((new Date(contrato.data_fim).getTime() - new Date(contrato.data_inicio).getTime()) / 86400000))
                    : 1
                  return `${dias}d × ${fmt.money(formItem.preco_unitario)}/dia × ${formItem.quantidade ?? 1} un`
                })()}
              </span>
              <span style={{ fontWeight:800, color:'var(--c-primary)' }}>
                {(() => {
                  const dias = contrato?.data_inicio && contrato?.data_fim
                    ? Math.max(1, Math.ceil((new Date(contrato.data_fim).getTime() - new Date(contrato.data_inicio).getTime()) / 86400000))
                    : 1
                  return fmt.money(Number(formItem.preco_unitario) * Number(formItem.quantidade ?? 1) * dias)
                })()}
              </span>
            </div>
          )}
        </div>
      </SlidePanel>

      {/* ── Painel de Edição ────────────────────────────────────────────── */}
      <SlidePanel
        open={painelEditar}
        onClose={() => setPainelEditar(false)}
        title="Alterar Contrato"
        subtitle={`Contrato ${contrato?.numero}`}
        width="lg"
        footer={
          <div style={{display:'flex',gap:10,width:'100%'}}>
            <Btn variant="secondary" style={{flex:1}} onClick={() => setPainelEditar(false)}>Cancelar</Btn>
            <Btn style={{flex:2}} loading={salvandoEdicao} onClick={salvarEdicao}>Salvar Alterações</Btn>
          </div>
        }
      >
        {erroEdicao && <div className="ds-alert-error" style={{marginBottom:14}}>{erroEdicao}</div>}

        <div style={{display:'flex',flexDirection:'column',gap:20}}>

          {/* ── SEÇÃO 1: Período e Datas ── */}
          <div className="panel-section">
            <div className="panel-section-header">📅 Período de Locação</div>
            <div className="panel-section-body">

              {/* Seletor de período */}
              <FormField label="Modalidade do Contrato">
                <select
                  value={formEdicao.periodo_id ?? ''}
                  onChange={e => {
                    const pid = e.target.value
                    const per = periodos.find((p:any) => String(p.id) === pid)
                    if (per && formEdicao.data_inicio) {
                      const fim = new Date(formEdicao.data_inicio)
                      fim.setDate(fim.getDate() + per.dias)
                      setFormEdicao((f:any) => ({ ...f, periodo_id: pid, data_fim: fim.toISOString().split('T')[0] }))
                    } else {
                      setFormEdicao((f:any) => ({ ...f, periodo_id: pid }))
                    }
                  }}
                  className={selectCls}
                >
                  <option value="">-- Selecione a modalidade --</option>
                  {periodos.map((p:any) => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.dias} dias)</option>
                  ))}
                </select>
                <div style={{marginTop:5,fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>
                  {periodos.length === 0
                    ? '⚠️ Nenhum período cadastrado — verifique os parâmetros'
                    : 'Alterar a modalidade recalcula automaticamente os preços de todos os itens'}
                </div>
              </FormField>

              {/* Alerta de recálculo */}
              {formEdicao.periodo_id && String(formEdicao.periodo_id) !== String(contrato?.periodo_id) && (
                <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',
                  background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:'var(--r-md)'}}>
                  <span style={{fontSize:18,flexShrink:0}}>⚡</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:'var(--fs-base)',color:'#78350F'}}>Recálculo automático de preços</div>
                    <div style={{fontSize:'var(--fs-sm)',color:'#92400E',marginTop:2}}>
                      Ao salvar, os preços de todos os {itens.length} item(ns) serão recalculados com base na nova modalidade selecionada.
                    </div>
                  </div>
                </div>
              )}

              {/* Datas */}
              <div className="form-grid-2">
                <FormField label="Data de Início" required>
                  <input type="date" value={formEdicao.data_inicio ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, data_inicio: e.target.value }))}
                    className={inputCls} />
                </FormField>
                <FormField label="Data de Fim" required>
                  <input type="date" value={formEdicao.data_fim ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, data_fim: e.target.value }))}
                    className={inputCls} min={formEdicao.data_inicio} />
                </FormField>
              </div>

              {/* Duração calculada */}
              {formEdicao.data_inicio && formEdicao.data_fim && (() => {
                const dias = Math.max(0, Math.ceil(
                  (new Date(formEdicao.data_fim).getTime() - new Date(formEdicao.data_inicio).getTime()) / 86400000
                ))
                return (
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'var(--fs-sm)',color:'var(--t-muted)'}}>
                    <span style={{fontWeight:600,color:'var(--c-primary)',fontSize:'var(--fs-base)'}}>{dias}</span>
                    {dias === 1 ? 'dia de locação' : 'dias de locação'}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── SEÇÃO 2: Itens com preços atuais ── */}
          {itens.length > 0 && (
            <div className="panel-section">
              <div className="panel-section-header">
                📦 Equipamentos ({itens.length} {itens.length === 1 ? 'item' : 'itens'})
                {formEdicao.periodo_id && String(formEdicao.periodo_id) !== String(contrato?.periodo_id) && (
                  <span style={{marginLeft:'auto',fontSize:'var(--fs-xs)',fontWeight:700,
                    background:'#F59E0B',color:'#fff',padding:'2px 8px',borderRadius:99}}>
                    PREÇOS SERÃO ATUALIZADOS
                  </span>
                )}
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="ds-table" style={{fontSize:'var(--fs-sm)'}}>
                  <thead>
                    <tr>
                      <th>Equipamento</th>
                      <th style={{textAlign:'right'}}>Qtd</th>
                      <th style={{textAlign:'right'}}>Preço Unit.</th>
                      <th style={{textAlign:'right'}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it:any) => (
                      <tr key={it.id}>
                        <td>
                          <div style={{fontWeight:600,fontSize:'var(--fs-base)'}}>{it.produtos?.nome ?? it.nome}</div>
                          {it.patrimonios?.numero_patrimonio && (
                            <div className="tbl-cell-sub">Patrimônio: {it.patrimonios.numero_patrimonio}</div>
                          )}
                        </td>
                        <td style={{textAlign:'right',fontFamily:'var(--font-mono)'}}>{it.quantidade}</td>
                        <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:600}}>
                          {fmt.money(it.preco_unitario)}
                        </td>
                        <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--c-primary)'}}>
                          {fmt.money(Number(it.preco_unitario) * Number(it.quantidade))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SEÇÃO 3: Pagamento ── */}
          <div className="panel-section">
            <div className="panel-section-header">💳 Pagamento</div>
            <div className="panel-section-body">
              <div className="form-grid-2">
                <FormField label="Forma de Pagamento">
                  <select value={formEdicao.forma_pagamento ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, forma_pagamento: e.target.value }))}
                    className={selectCls}>
                    {[
                      ['pix','PIX'],['dinheiro','Dinheiro'],['cartao_credito','Cartão de Crédito'],
                      ['cartao_debito','Cartão de Débito'],['boleto','Boleto'],['transferencia','Transferência'],
                    ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </FormField>
                <FormField label="Condição de Pagamento">
                  <input value={formEdicao.condicao_pagamento ?? ''}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, condicao_pagamento: e.target.value }))}
                    className={inputCls} placeholder="Ex: 0+2x, 30+60+90" />
                </FormField>
              </div>
            </div>
          </div>

          {/* ── SEÇÃO 4: Ajustes de Valor ── */}
          <div className="panel-section">
            <div className="panel-section-header">💰 Ajustes de Valor</div>
            <div className="panel-section-body">
              <div className="form-grid-3">
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
              </div>
              <div className="form-grid-2">
                <FormField label="Caução (R$)">
                  <input type="number" step="0.01" min="0"
                    value={formEdicao.caucao ?? 0}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, caucao: e.target.value }))}
                    className={inputCls} />
                </FormField>
                <FormField label="Comissão (%)">
                  <input type="number" step="0.01" min="0" max="100"
                    value={formEdicao.comissao_percentual ?? 0}
                    onChange={e => setFormEdicao((f:any) => ({ ...f, comissao_percentual: e.target.value }))}
                    className={inputCls} />
                </FormField>
              </div>

              {/* Preview do total */}
              {(() => {
                const sub = itens.reduce((s:number, i:any) => s + Number(i.preco_unitario ?? 0) * Number(i.quantidade ?? 1), 0)
                const tot = sub - Number(formEdicao.desconto ?? 0) + Number(formEdicao.acrescimo ?? 0) + Number(formEdicao.frete ?? 0)
                return (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'12px 14px',background:'var(--bg-header)',borderRadius:'var(--r-md)',
                    border:'1px solid var(--border)',marginTop:4}}>
                    <div style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>
                      Subtotal {fmt.money(sub)}
                      {Number(formEdicao.desconto) > 0 && <span style={{color:'var(--c-success)',marginLeft:8}}>− {fmt.money(Number(formEdicao.desconto))}</span>}
                      {Number(formEdicao.acrescimo) > 0 && <span style={{color:'var(--c-danger)',marginLeft:8}}>+ {fmt.money(Number(formEdicao.acrescimo))}</span>}
                      {Number(formEdicao.frete) > 0 && <span style={{marginLeft:8}}>+ frete {fmt.money(Number(formEdicao.frete))}</span>}
                    </div>
                    <div style={{fontWeight:700,fontSize:'var(--fs-lg)',color:'var(--c-primary)',fontFamily:'var(--font-mono)'}}>
                      {fmt.money(tot)}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── SEÇÃO 5: Observações ── */}
          <div className="panel-section">
            <div className="panel-section-header">📝 Observações</div>
            <div className="panel-section-body">
              <FormField label="Observações (visível no documento)">
                <textarea value={formEdicao.observacoes ?? ''}
                  onChange={e => setFormEdicao((f:any) => ({ ...f, observacoes: e.target.value }))}
                  className={textareaCls} rows={2} />
              </FormField>
              <FormField label="Observações Internas (apenas para a equipe)">
                <textarea value={formEdicao.observacoes_internas ?? ''}
                  onChange={e => setFormEdicao((f:any) => ({ ...f, observacoes_internas: e.target.value }))}
                  className={textareaCls} rows={2} />
              </FormField>
            </div>
          </div>

        </div>
      </SlidePanel>

    </div>
  )
}
