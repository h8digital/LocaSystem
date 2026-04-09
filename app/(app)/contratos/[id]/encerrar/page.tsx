'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { Badge, Btn, FormField, inputCls, selectCls, textareaCls } from '@/components/ui'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Fatura = {
  id: number; numero: string; tipo: string; status: string
  valor: number; valor_pago: number; data_vencimento: string
  data_pagamento?: string; forma_pagamento?: string; descricao?: string
}
type ItemWizard = {
  id: number; produto_id: number; patrimonio_id?: number
  quantidade: number; qtd_devolvida?: number; qtd_pendente: number
  preco_unitario: number; total_item: number
  produtos: { nome: string }; patrimonios?: { numero_patrimonio: string }
  condicao: 'bom' | 'avariado' | 'extraviado'
  quantidade_devolvida: number
  custo_avaria: number
}
type PagFatura = {
  fatura_id: number; pagar: boolean
  valor_pago: number; forma_pagamento: string; data_pagamento: string
}

const FORMAS = [
  { v: 'pix',           l: 'PIX' },
  { v: 'dinheiro',      l: 'Dinheiro' },
  { v: 'cartao_debito', l: 'Cartão Débito' },
  { v: 'cartao_credito',l: 'Cartão Crédito' },
  { v: 'transferencia', l: 'Transferência' },
  { v: 'boleto',        l: 'Boleto' },
]

const PASSOS = [
  { n: 1, label: 'Financeiro'   },
  { n: 2, label: 'Itens'        },
  { n: 3, label: 'Ajustes'      },
  { n: 4, label: 'Confirmação'  },
]

// ─── Helpers de estilo inline ─────────────────────────────────────────────────
const card  = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-md)' } as const
const header = { padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight:700 as const, background:'var(--bg-header)' }

export default function EncerrarContratoPage() {
  const { id }  = useParams()
  const router  = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [erro,    setErro]    = useState('')
  const [passo,   setPasso]   = useState(1)

  const [contrato,   setContrato]   = useState<any>(null)
  const [faturas,    setFaturas]    = useState<Fatura[]>([])
  const [itens,      setItens]      = useState<ItemWizard[]>([])
  const [pagamentos, setPagamentos] = useState<PagFatura[]>([])

  const [diasAtraso,      setDiasAtraso]      = useState(0)
  const [caucaoDevolvido, setCaucaoDevolvido] = useState(0)
  const [observacoes,     setObservacoes]     = useState('')
  const [multaParam,      setMultaParam]      = useState(2)

  // ── Carregamento inicial ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: f }, { data: i }, { data: mp }] = await Promise.all([
        supabase.from('contratos').select('*, clientes(nome)').eq('id', id).single(),
        supabase.from('faturas').select('*').eq('contrato_id', id).order('data_vencimento'),
        supabase.from('contrato_itens')
          .select('*, produtos(nome), patrimonios(numero_patrimonio)')
          .eq('contrato_id', id)
          .order('id'),
        supabase.from('parametros').select('valor').eq('chave', 'multa_atraso_percentual').single(),
      ])

      if (!c || ['encerrado','cancelado','pendente_manutencao'].includes(c.status)) {
        router.push(`/contratos/${id}`); return
      }

      setContrato(c)
      setFaturas(f ?? [])
      setMultaParam(Number((mp as any)?.data?.valor ?? 2))
      setCaucaoDevolvido(Number(c.caucao ?? 0))

      // Atraso automático
      if (c.data_fim) {
        const diff = Math.floor((Date.now() - new Date(c.data_fim).getTime()) / 86400000)
        if (diff > 0) setDiasAtraso(diff)
      }

      // Muda status para EM_DEVOLUCAO apenas quando devolução total inicia
      // Para devolução parcial, o status ativo é mantido
      // (atualizado ao confirmar)

      setItens((i ?? []).map((item: any) => ({
        ...item,
        condicao:             'bom',
        quantidade_devolvida: Number(item.quantidade) - Number(item.qtd_devolvida ?? 0),
        qtd_pendente:         Number(item.quantidade) - Number(item.qtd_devolvida ?? 0),
        custo_avaria:         0,
      })).filter((item: any) => item.qtd_pendente > 0))

      const pendentes = (f ?? []).filter((fat: Fatura) => fat.status !== 'pago')
      setPagamentos(pendentes.map((fat: Fatura) => ({
        fatura_id:       fat.id,
        pagar:           true,
        valor_pago:      fat.valor,
        forma_pagamento: 'pix',
        data_pagamento:  new Date().toISOString().split('T')[0],
      })))

      setLoading(false)
    }
    load()
  }, [id])

  // ── Valores calculados ────────────────────────────────────────────────────
  const totalPagas     = faturas.filter(f => f.status === 'pago').reduce((s, f) => s + Number(f.valor_pago ?? f.valor), 0)
  const totalPendentes = faturas.filter(f => f.status !== 'pago').reduce((s, f) => s + Number(f.valor), 0)
  const totalPagarAgora = pagamentos.filter(p => p.pagar).reduce((s, p) => s + Number(p.valor_pago), 0)
  const valorAvarias   = itens.filter(i => i.condicao === 'avariado').reduce((s, i)   => s + Number(i.custo_avaria), 0)
  const valorExtravios = itens.filter(i => i.condicao === 'extraviado').reduce((s, i) => s + Number(i.custo_avaria), 0)
  const multaAtraso    = diasAtraso > 0 ? Number(contrato?.total ?? 0) * (multaParam / 100) * diasAtraso : 0
  const totalExtras    = multaAtraso + valorAvarias + valorExtravios

  // ── Validação ─────────────────────────────────────────────────────────────
  function validar(): string {
    if (passo === 2) {
      const semCusto = itens.find(i => i.condicao === 'extraviado' && i.custo_avaria <= 0)
      if (semCusto) return `Informe o custo de reposição para "${(semCusto.produtos as any)?.nome}".`
    }
    return ''
  }

  function avancar() {
    const msg = validar()
    if (msg) { setErro(msg); return }
    setErro(''); setPasso(p => p + 1); window.scrollTo(0, 0)
  }
  function voltar() { setErro(''); setPasso(p => p - 1); window.scrollTo(0, 0) }

  // ── Confirmar ─────────────────────────────────────────────────────────────
  async function confirmar() {
    setSaving(true); setErro('')
    try {
      for (const pag of pagamentos.filter(p => p.pagar)) {
        await supabase.from('faturas').update({
          status: 'pago', valor_pago: pag.valor_pago,
          forma_pagamento: pag.forma_pagamento, data_pagamento: pag.data_pagamento,
        }).eq('id', pag.fatura_id)
      }

      const res = await fetch('/api/devolucoes/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrato_id:      Number(id),
          dias_atraso:      diasAtraso,
          valor_avarias:    valorAvarias + valorExtravios,
          caucao_devolvido: caucaoDevolvido,
          observacoes,
          itens: itens
            .filter(item => item.quantidade_devolvida > 0)
            .map(item => ({
              contrato_item_id:     item.id,
              patrimonio_id:        item.patrimonio_id ?? null,
              produto_id:           item.produto_id,
              quantidade_devolvida: item.quantidade_devolvida,
              quantidade_total:     item.quantidade,
              condicao:             item.condicao,
              custo_avaria:         item.custo_avaria,
            })),
        }),
      })
      const result = await res.json()
      if (!result.ok) { setErro('Erro: ' + result.error); setSaving(false); return }
      router.push(`/contratos/${id}?aba=devolucoes`)
    } catch (e: any) { setErro('Erro: ' + e.message); setSaving(false) }
  }

  // ── Helpers de update ─────────────────────────────────────────────────────
  const updItem = (idx: number, k: string, v: any) =>
    setItens(prev => prev.map((x, i) => i === idx ? { ...x, [k]: v } : x))
  const updPag = (fid: number, k: string, v: any) =>
    setPagamentos(prev => prev.map(p => p.fatura_id === fid ? { ...p, [k]: v } : p))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:10, color:'var(--t-muted)' }}>
      <div style={{width:6,height:6,borderRadius:"50%",background:"var(--c-primary)",animation:"dot-pulse 1.2s ease-in-out infinite",display:"inline-block",verticalAlign:"middle",flexShrink:0}}/> Carregando...
    </div>
  )
  if (!contrato) return null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin:'0 auto', padding:'0 0 60px' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <button
          onClick={() => router.push(`/contratos/${id}`)}
          style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:'var(--r-md)',
            cursor:'pointer', color:'var(--t-secondary)', fontSize:16, flexShrink:0 }}>←
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:'var(--fs-lg)', color:'var(--t-primary)' }}>
            Encerramento de Contrato
          </div>
          <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
            {contrato.numero} · {(contrato.clientes as any)?.nome}
          </div>
        </div>
        <Badge value={contrato.status} dot />
      </div>

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', marginBottom:36 }}>
        {PASSOS.map((p, idx) => {
          const ativo     = passo === p.n
          const concluido = passo > p.n
          return (
            <div key={p.n} style={{ display:'flex', alignItems:'center', flex: idx < PASSOS.length - 1 ? 1 : 'none' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:70 }}>
                <div style={{
                  width:38, height:38, borderRadius:'50%', display:'flex', alignItems:'center',
                  justifyContent:'center', fontWeight:700, fontSize:'var(--fs-md)', flexShrink:0,
                  background: concluido ? 'var(--c-success)' : ativo ? 'var(--c-primary)' : 'var(--bg-header)',
                  color:      concluido ? '#fff'             : ativo ? '#fff'              : 'var(--t-muted)',
                  border:     `2px solid ${concluido ? 'var(--c-success)' : ativo ? 'var(--c-primary)' : 'var(--border)'}`,
                  transition: 'all 250ms ease',
                }}>
                  {concluido ? '✓' : p.n}
                </div>
                <div style={{
                  fontSize:'var(--fs-sm)', fontWeight: ativo ? 700 : 400, whiteSpace:'nowrap', textAlign:'center',
                  color: ativo ? 'var(--c-primary)' : concluido ? 'var(--c-success)' : 'var(--t-muted)',
                }}>{p.label}</div>
              </div>
              {idx < PASSOS.length - 1 && (
                <div style={{ flex:1, height:2, margin:'0 6px', marginBottom:24,
                  background: concluido ? 'var(--c-success)' : 'var(--border)', transition:'background 300ms' }} />
              )}
            </div>
          )
        })}
      </div>

      {erro && <div className="ds-alert-error" style={{ marginBottom:20 }}>{erro}</div>}

      {/* ══════════════════════════════════════════════════════════════════
          PASSO 1 — FINANCEIRO
      ══════════════════════════════════════════════════════════════════ */}
      {/* ── Seletor de tipo de devolução (sempre visível no passo 1) ── */}
      {passo === 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* KPIs do contrato */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
            {[
              { l:'Total do Contrato', v: fmt.money(contrato.total),       c: 'var(--c-primary)' },
              { l:'Caução',            v: fmt.money(contrato.caucao),       c: 'var(--t-primary)' },
              { l:'Frete',             v: fmt.money(contrato.frete ?? 0),   c: Number(contrato.frete) > 0 ? 'var(--c-warning-text)' : 'var(--t-muted)' },
              { l:'Já Recebido',       v: fmt.money(totalPagas),            c: 'var(--c-success-text)' },
              { l:'Em Aberto',         v: fmt.money(totalPendentes), c: totalPendentes > 0 ? 'var(--c-danger)' : 'var(--c-success-text)' },
            ].map(k => (
              <div key={k.l} style={{ ...card, padding:'12px 14px' }}>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:4 }}>{k.l}</div>
                <div style={{ fontWeight:700, fontSize:'var(--fs-base)', color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Faturas pendentes */}
          {faturas.filter(f => f.status !== 'pago').length === 0 ? (
            <div style={{ ...card, padding:'16px', display:'flex', gap:12, alignItems:'center',
              background:'var(--c-success-light)', borderColor:'var(--c-success)' }}>
              <span style={{ fontSize:22 }}>✓</span>
              <div>
                <div style={{ fontWeight:700, color:'var(--c-success-text)' }}>Todas as faturas estão pagas</div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--c-success-text)' }}>Nenhum valor pendente neste contrato.</div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, overflow:'hidden' }}>
              <div style={{ ...header, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>Faturas em Aberto</span>
                <span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', fontWeight:400 }}>
                  Marque as que serão pagas agora
                </span>
              </div>

              {faturas.filter(f => f.status !== 'pago').map(fat => {
                const pag = pagamentos.find(p => p.fatura_id === fat.id)!
                const vencida = new Date(fat.data_vencimento) < new Date()
                return (
                  <div key={fat.id} style={{
                    padding:'14px 16px', borderBottom:'1px solid var(--border)',
                    background: pag?.pagar ? 'var(--c-primary-light)' : 'var(--bg-card)',
                    transition:'background 200ms',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: pag?.pagar ? 14 : 0 }}>
                      <input type="checkbox" checked={pag?.pagar ?? false}
                        onChange={e => updPag(fat.id, 'pagar', e.target.checked)}
                        style={{ width:18, height:18, cursor:'pointer', accentColor:'var(--c-primary)', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:'var(--fs-base)' }}>{fat.numero}</span>
                          <Badge value={fat.tipo} label={fat.tipo === 'locacao' ? 'Locação' : fat.tipo === 'multa' ? 'Multa' : fat.tipo} />
                          {vencida && <Badge value="vencido" dot />}
                        </div>
                        <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:2 }}>
                          Vencimento: {fmt.date(fat.data_vencimento)}
                          {fat.descricao ? ` · ${fat.descricao}` : ''}
                        </div>
                      </div>
                      <div style={{ fontWeight:700, fontSize:'var(--fs-lg)', color: vencida ? 'var(--c-danger)' : 'var(--t-primary)', flexShrink:0 }}>
                        {fmt.money(fat.valor)}
                      </div>
                    </div>

                    {pag?.pagar && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, paddingLeft:30 }}>
                        <FormField label="Valor Recebido (R$)">
                          <input type="number" step="0.01" min="0" value={pag.valor_pago}
                            onChange={e => updPag(fat.id, 'valor_pago', Number(e.target.value))}
                            className={inputCls} />
                        </FormField>
                        <FormField label="Forma de Pagamento">
                          <select value={pag.forma_pagamento}
                            onChange={e => updPag(fat.id, 'forma_pagamento', e.target.value)}
                            className={selectCls}>
                            {FORMAS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                          </select>
                        </FormField>
                        <FormField label="Data">
                          <input type="date" value={pag.data_pagamento}
                            onChange={e => updPag(fat.id, 'data_pagamento', e.target.value)}
                            className={inputCls} />
                        </FormField>
                      </div>
                    )}
                  </div>
                )
              })}

              {totalPagarAgora > 0 && (
                <div style={{ padding:'12px 16px', background:'var(--bg-header)', borderTop:'1px solid var(--border)',
                  display:'flex', justifyContent:'space-between', fontWeight:600 }}>
                  <span style={{ color:'var(--t-secondary)' }}>Total a receber agora:</span>
                  <span style={{ color:'var(--c-primary)', fontSize:'var(--fs-base)' }}>{fmt.money(totalPagarAgora)}</span>
                </div>
              )}
            </div>
          )}

          {/* Faturas já pagas */}
          {faturas.filter(f => f.status === 'pago').length > 0 && (
            <div style={{ ...card, overflow:'hidden' }}>
              <div style={{ ...header, fontWeight:600, fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                Faturas Já Pagas
              </div>
              {faturas.filter(f => f.status === 'pago').map(fat => (
                <div key={fat.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                  display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:'var(--font-mono)', color:'var(--t-muted)', fontSize:'var(--fs-md)', flex:1 }}>{fat.numero}</span>
                  <span style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                    {fmt.date(fat.data_pagamento ?? '')} · {fat.forma_pagamento?.replace(/_/g,' ')}
                  </span>
                  <Badge value="pago" dot />
                  <span style={{ fontWeight:600, color:'var(--c-success-text)' }}>{fmt.money(fat.valor_pago ?? fat.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PASSO 2 — ITENS E CONDIÇÕES
      ══════════════════════════════════════════════════════════════════ */}
      {passo === 2 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ ...card, padding:'12px 16px', background:'var(--c-info-light)', borderColor:'var(--c-info)', fontSize:'var(--fs-md)', color:'var(--c-info-text)' }}>
            '📦 Registre a condição e a quantidade de cada item devolvido. Informe o custo para itens avariados ou extraviados. Se devolver todos os itens, o contrato será encerrado automaticamente.'
          </div>

          {itens.map((item, idx) => {
            const corBorda = item.condicao === 'bom' ? 'var(--c-success)' : item.condicao === 'avariado' ? 'var(--c-warning)' : 'var(--c-danger)'
            return (
              <div key={item.id} style={{ ...card, padding:'14px 16px', borderColor: corBorda + '66', borderWidth:2, transition:'border-color 200ms' }}>
                {/* Cabeçalho do item */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'var(--fs-base)' }}>{(item.produtos as any)?.nome}</div>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginTop:3, display:'flex', gap:14 }}>
                      {item.patrimonios && (
                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--t-secondary)' }}>
                          {(item.patrimonios as any)?.numero_patrimonio}
                        </span>
                      )}
                      <span>Qtd: {item.quantidade}</span>
                      <span>Preço/un: {fmt.money(item.preco_unitario)}</span>
                      <span>Total: {fmt.money(item.total_item)}</span>
                    </div>
                  </div>

                  {/* Botões de condição */}
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    {([
                      { v:'bom',        l:'Bom',        cor:'var(--c-success)' },
                      { v:'avariado',   l:'Avariado',   cor:'var(--c-warning)' },
                      { v:'extraviado', l:'Extraviado', cor:'var(--c-danger)'  },
                    ] as const).map(opt => (
                      <button key={opt.v}
                        onClick={() => updItem(idx, 'condicao', opt.v)}
                        style={{
                          padding:'5px 12px', borderRadius:'var(--r-sm)',
                          border:`2px solid ${item.condicao === opt.v ? opt.cor : 'var(--border)'}`,
                          background: item.condicao === opt.v ? opt.cor + '22' : 'transparent',
                          color:      item.condicao === opt.v ? opt.cor : 'var(--t-muted)',
                          fontWeight: item.condicao === opt.v ? 700 : 400,
                          fontSize:'var(--fs-sm)', cursor:'pointer', transition:'all 150ms',
                        }}>{opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantidade devolvida */}
                {!item.patrimonio_id && (
                  <div style={{ marginBottom: (item.condicao !== 'bom') ? 12 : 0 }}>
                    <FormField label={`Quantidade Devolvida Agora (máx: ${item.qtd_pendente})`} style={{ maxWidth:200 }}>
                      <input type="number" min="0" max={item.qtd_pendente ?? item.quantidade}
                        value={item.quantidade_devolvida}
                        onChange={e => updItem(idx, 'quantidade_devolvida', Math.min(Number(e.target.value), item.qtd_pendente ?? item.quantidade))}
                        className={inputCls} />
                    </FormField>
                    {(item.qtd_pendente ?? item.quantidade) > item.quantidade_devolvida && item.quantidade_devolvida > 0 && (
                      <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',marginTop:3}}>
                        {(item.qtd_pendente ?? item.quantidade) - item.quantidade_devolvida} unidade(s) permanecerão no contrato
                      </div>
                    )}
                  </div>
                )}

                {/* Custo */}
                {(item.condicao === 'avariado' || item.condicao === 'extraviado') && (
                  <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:12, alignItems:'flex-end' }}>
                    <FormField
                      label={item.condicao === 'extraviado' ? 'Custo de Reposição (R$)' : 'Custo do Reparo (R$)'}
                      required={item.condicao === 'extraviado'}
                    >
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                          color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                        <input type="number" step="0.01" min="0" value={item.custo_avaria}
                          onChange={e => updItem(idx, 'custo_avaria', Number(e.target.value))}
                          className={inputCls} style={{ paddingLeft:30 }} placeholder="0,00" />
                      </div>
                    </FormField>
                    <div style={{ fontSize:'var(--fs-md)', paddingBottom:2, lineHeight:1.4,
                      color: item.condicao === 'extraviado' ? 'var(--c-danger-text)' : 'var(--c-warning-text)',
                      fontStyle:'italic' }}>
                      {item.condicao === 'extraviado'
                        ? 'Item não devolvido — será cobrado custo de reposição.'
                        : 'Será gerada fatura adicional de reparo.'}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PASSO 3 — AJUSTES E CAUÇÃO
      ══════════════════════════════════════════════════════════════════ */}
      {passo === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Atraso */}
          <div style={{ ...card, padding:'18px 20px' }}>
            <div style={{ fontWeight:700, marginBottom:14 }}>Verificação de Prazo</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div style={{ background:'var(--bg-header)', borderRadius:'var(--r-sm)', padding:'10px 12px', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:2 }}>Devolução Prevista</div>
                <div style={{ fontWeight:700 }}>{fmt.date(contrato.data_fim)}</div>
              </div>
              <div style={{ background:'var(--bg-header)', borderRadius:'var(--r-sm)', padding:'10px 12px', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:2 }}>Data Atual</div>
                <div style={{ fontWeight:700 }}>{fmt.date(new Date().toISOString().split('T')[0])}</div>
              </div>
            </div>
            <FormField label={`Dias de Atraso (multa de ${multaParam}% ao dia sobre ${fmt.money(contrato.total)})`}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <input type="number" min="0" value={diasAtraso}
                  onChange={e => setDiasAtraso(Number(e.target.value))}
                  className={inputCls} style={{ width:100 }} />
                {diasAtraso > 0 ? (
                  <div style={{ background:'var(--c-danger-light)', color:'var(--c-danger-text)',
                    padding:'6px 14px', borderRadius:'var(--r-sm)', fontWeight:700, fontSize:'var(--fs-md)' }}>
                    Multa: {fmt.money(multaAtraso)}
                  </div>
                ) : (
                  <div style={{ background:'var(--c-success-light)', color:'var(--c-success-text)',
                    padding:'6px 14px', borderRadius:'var(--r-sm)', fontWeight:600, fontSize:'var(--fs-md)' }}>
                    Sem atraso
                  </div>
                )}
              </div>
            </FormField>
          </div>

          {/* Caução */}
          <div style={{ ...card, padding:'18px 20px' }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Devolução de Caução</div>
            <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', marginBottom:14 }}>
              Caução cobrado: <strong>{fmt.money(contrato.caucao)}</strong>
              {totalExtras > 0 && ` · Descontos previstos: ${fmt.money(totalExtras)}`}
            </div>
            <FormField label="Valor a Devolver ao Cliente (R$)">
              <div style={{ position:'relative', maxWidth:200 }}>
                <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)',
                  color:'var(--t-muted)', fontSize:'var(--fs-md)', pointerEvents:'none' }}>R$</span>
                <input type="number" step="0.01" min="0" max={contrato.caucao}
                  value={caucaoDevolvido}
                  onChange={e => setCaucaoDevolvido(Number(e.target.value))}
                  className={inputCls} style={{ paddingLeft:30 }} />
              </div>
            </FormField>
            {Number(contrato.caucao) > 0 && caucaoDevolvido < Number(contrato.caucao) && (
              <div style={{ marginTop:10, fontSize:'var(--fs-md)', color:'var(--c-warning-text)',
                background:'var(--c-warning-light)', padding:'8px 12px', borderRadius:'var(--r-sm)' }}>
                Retendo {fmt.money(Number(contrato.caucao) - caucaoDevolvido)} da caução
                {totalExtras > 0 ? ` para cobertura de multas/avarias.` : '.'}
              </div>
            )}
          </div>

          {/* Observações */}
          <div style={{ ...card, padding:'18px 20px' }}>
            <FormField label="Observações do Encerramento">
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                rows={3} className={textareaCls}
                placeholder="Ex: Equipamentos devolvidos em bom estado. Encerramento antecipado por solicitação do cliente..." />
            </FormField>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PASSO 4 — CONFIRMAÇÃO
      ══════════════════════════════════════════════════════════════════ */}
      {passo === 4 && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Resumo financeiro */}
          <div style={{ ...card, overflow:'hidden' }}>
            <div style={{ ...header }}>Resumo Financeiro</div>
            <div style={{ padding:'0 16px' }}>
              {([
                { l:'Total do Contrato',      v: contrato.total,    cor: 'var(--t-primary)',       sinal: '' },
                { l:'Já Recebido',            v: totalPagas,        cor: 'var(--c-success-text)',  sinal: '' },
                totalPagarAgora > 0 && { l:'A Receber Agora', v: totalPagarAgora, cor:'var(--c-primary)', sinal:'' },
                caucaoDevolvido > 0 && { l:'Caução a Devolver', v: caucaoDevolvido, cor:'var(--c-warning-text)', sinal:'−' },
                multaAtraso > 0     && { l:`Multa (${diasAtraso}d)`, v: multaAtraso, cor:'var(--c-danger-text)', sinal:'+' },
                valorAvarias > 0    && { l:'Avarias',           v: valorAvarias,    cor:'var(--c-warning-text)', sinal:'+' },
                valorExtravios > 0  && { l:'Extravios',         v: valorExtravios,  cor:'var(--c-danger-text)',  sinal:'+' },
              ] as any[]).filter(Boolean).map((row: any) => (
                <div key={row.l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--t-secondary)' }}>{row.l}</span>
                  <span style={{ fontWeight:600, color: row.cor }}>
                    {row.sinal}{fmt.money(row.v)}
                  </span>
                </div>
              ))}
              {totalExtras > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0' }}>
                  <span style={{ fontWeight:700 }}>Nova fatura a gerar</span>
                  <span style={{ fontWeight:700, color:'var(--c-danger)' }}>{fmt.money(Math.max(0, totalExtras - (Number(contrato.caucao) - caucaoDevolvido)))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Itens */}
          <div style={{ ...card, overflow:'hidden' }}>
            <div style={{ ...header, fontSize:'var(--fs-md)' }}>Itens Devolvidos ({itens.length})</div>
            {itens.map(item => (
              <div key={item.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600 }}>{(item.produtos as any)?.nome}</div>
                  {item.patrimonios && (
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)', fontFamily:'var(--font-mono)' }}>
                      {(item.patrimonios as any)?.numero_patrimonio}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                  Qtd: {item.quantidade_devolvida}
                </div>
                <div style={{
                  padding:'3px 10px', borderRadius:'var(--r-sm)', fontSize:'var(--fs-sm)', fontWeight:700,
                  background: item.condicao === 'bom' ? 'var(--c-success-light)' : item.condicao === 'avariado' ? 'var(--c-warning-light)' : 'var(--c-danger-light)',
                  color:      item.condicao === 'bom' ? 'var(--c-success-text)' : item.condicao === 'avariado' ? 'var(--c-warning-text)' : 'var(--c-danger-text)',
                }}>
                  {item.condicao === 'bom' ? 'Bom Estado' : item.condicao === 'avariado' ? 'Avariado' : 'Extraviado'}
                  {item.custo_avaria > 0 && ` · ${fmt.money(item.custo_avaria)}`}
                </div>
              </div>
            ))}
          </div>

          {/* Pagamentos */}
          {pagamentos.filter(p => p.pagar).length > 0 && (
            <div style={{ ...card, overflow:'hidden' }}>
              <div style={{ ...header, fontSize:'var(--fs-md)' }}>Pagamentos a Registrar</div>
              {pagamentos.filter(p => p.pagar).map(pag => {
                const fat = faturas.find(f => f.id === pag.fatura_id)!
                return (
                  <div key={pag.fatura_id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                    display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:'var(--fs-md)', color:'var(--t-secondary)' }}>{fat?.numero}</div>
                    <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>
                      {FORMAS.find(f => f.v === pag.forma_pagamento)?.l} · {fmt.date(pag.data_pagamento)}
                    </div>
                    <div style={{ fontWeight:700, color:'var(--c-success-text)' }}>{fmt.money(pag.valor_pago)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Aviso irreversível */}
          <div style={{ ...card, padding:'16px', display:'flex', gap:12, alignItems:'flex-start',
            background:'var(--c-warning-light)', borderColor:'var(--c-warning)', borderWidth:2 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>⚠</span>
            <div>
              <div style={{ fontWeight:700, color:'var(--c-warning-text)', marginBottom:4 }}>Ação irreversível</div>
              <div style={{ fontSize:'var(--fs-md)', color:'var(--c-warning-text)', lineHeight:1.5 }}>
                Ao confirmar: o contrato será <strong>encerrado</strong>, os patrimônios serão <strong>liberados no estoque</strong>,
                os pagamentos serão <strong>registrados</strong> e eventuais faturas de multa/avaria serão <strong>geradas automaticamente</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Navegação ────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:28, gap:12 }}>
        <Btn variant="secondary"
          onClick={passo === 1 ? () => router.push(`/contratos/${id}`) : voltar}
          style={{ minWidth:130 }}>
          {passo === 1 ? 'Cancelar' : '← Voltar'}
        </Btn>

        {passo < 4 ? (
          <Btn onClick={avancar} style={{ minWidth:180 }}>Próximo →</Btn>
        ) : (
          <Btn loading={saving} onClick={confirmar}
            style={{ minWidth:220, background:'var(--c-success)', borderColor:'var(--c-success)' }}>
            Confirmar Encerramento
          </Btn>
        )}
      </div>
    </div>
  )
}
