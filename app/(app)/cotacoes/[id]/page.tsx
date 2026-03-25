'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { Btn } from '@/components/ui'

/* ── Formata user-agent de forma legível ── */
function formatUA(ua: string | null) {
  if (!ua) return '—'
  if (ua.length > 80) return ua.slice(0, 77) + '...'
  return ua
}

export default function CotacaoDetalhePage() {
  const router  = useRouter()
  const params  = useParams() as { id: string }
  const [cot,     setCot]       = useState<any>(null)
  const [logs,    setLogs]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tabDetalhe, setTabDetalhe] = useState<'dados'|'log'>('dados')
  const [copiado, setCopiado]   = useState(false)

  async function load() {
    const [{ data: cotData }, { data: logsData }] = await Promise.all([
      supabase.from('cotacoes')
        .select('*, clientes(nome,cpf_cnpj,email,celular,telefone), usuarios(nome), periodos_locacao(nome,dias), cotacao_itens(*, produtos(nome,unidade,codigo))')
        .eq('id', params.id).single(),
      supabase.from('cotacao_logs')
        .select('*')
        .eq('cotacao_id', params.id)
        .order('created_at', { ascending: false }),
    ])
    setCot(cotData)
    setLogs(logsData ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [params.id])

  async function enviarCliente() {
    let token = cot.token_aprovacao
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      await supabase.from('cotacoes').update({
        status: 'aguardando', token_aprovacao: token,
        updated_at: new Date().toISOString(),
      }).eq('id', cot.id)
    } else if (cot.status === 'rascunho') {
      await supabase.from('cotacoes').update({ status: 'aguardando', updated_at: new Date().toISOString() }).eq('id', cot.id)
    }
    return `${window.location.origin}/cotacao/${token}`
  }

  async function copiarLink() {
    const link = await enviarCliente()
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
    load()
  }

  async function abrirWhatsApp() {
    const link = await enviarCliente()
    const celular = cot.clientes?.celular || cot.clientes?.telefone || ''
    const numero  = celular.replace(/\D/g, '')
    const fone    = numero.startsWith('55') ? numero : `55${numero}`
    const texto   = encodeURIComponent(
      `Olá ${cot.clientes?.nome ?? ''}! Segue a proposta de locação *${cot.numero}* no valor de *${fmt.money(cot.total)}*.\n\nAcesse o link para visualizar e aprovar:\n${link}`
    )
    const url = numero
      ? `https://wa.me/${fone}?text=${texto}`
      : `https://wa.me/?text=${texto}`
    window.open(url, '_blank')
    load()
  }

  function imprimirProposta() {
    if (!cot?.token_aprovacao) {
      alert('Gere o link da proposta primeiro para imprimir.')
      return
    }
    window.open(`/cotacao/${cot.token_aprovacao}`, '_blank')
  }

  async function aprovarManual() {
    await supabase.from('cotacoes').update({
      status: 'aprovada', data_resposta: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', cot.id)
    load()
  }

  async function recusarManual() {
    const motivo = prompt('Motivo da recusa (opcional):') ?? ''
    await supabase.from('cotacoes').update({
      status: 'recusada', motivo_recusa: motivo || null,
      data_resposta: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', cot.id)
    load()
  }

  async function converter() {
    if (!confirm(`Converter ${cot.numero} em contrato?`)) return
    const r = await fetch('/api/cotacoes/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotacao_id: cot.id }),
    })
    const d = await r.json()
    if (d.error) return alert('Erro: ' + d.error)
    if (confirm(`✅ Contrato ${d.numero} criado!\nDeseja abri-lo?`))
      router.push(`/contratos/${d.contrato_id}`)
    else load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: 'var(--t-muted)', fontSize: 'var(--fs-base)' }}>
      <div className="ds-spinner" style={{ width: 18, height: 18 }} /> Carregando...
    </div>
  )
  if (!cot) return <div style={{ padding: 40, color: 'var(--t-muted)' }}>Cotação não encontrada.</div>

  const canEnviar   = ['rascunho','aguardando'].includes(cot.status)
  const canAprovar  = ['aguardando','rascunho'].includes(cot.status)
  const canConverter= ['aprovada','aguardando','rascunho'].includes(cot.status) && !cot.contrato_id

  const logAprovacao = logs.find(l => l.acao === 'aprovada')
  const logRecusa    = logs.find(l => l.acao === 'recusada')
  const logAtivo     = logAprovacao || logRecusa

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/cotacoes')}
            style={{ background: 'var(--bg-header)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'var(--t-secondary)' }}>←</button>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--t-primary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {cot.numero}
              <StatusBadge s={cot.status} />
              {cot.visualizacoes > 0 && (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t-muted)', fontWeight: 400 }}>
                  👁 {cot.visualizacoes} visualização{cot.visualizacoes > 1 ? 'ões' : ''}
                </span>
              )}
              {cot.contrato_id && (
                <span className="ds-badge ds-badge-blue" style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/contratos/${cot.contrato_id}`)}>
                  📄 Ver Contrato
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t-muted)', marginTop: 2 }}>
              {cot.clientes?.nome} · Emitida em {fmt.date(cot.data_emissao)} · Válida até {fmt.date(cot.data_validade)}
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Imprimir */}
          <Btn size="sm" variant="secondary" onClick={imprimirProposta} title="Abrir proposta para impressão">
            🖨️ Imprimir
          </Btn>

          {/* Copiar link */}
          {canEnviar && (
            <Btn size="sm" variant="secondary" onClick={copiarLink}>
              {copiado ? '✅ Copiado!' : '🔗 Copiar Link'}
            </Btn>
          )}

          {/* WhatsApp */}
          {canEnviar && (
            <button onClick={abrirWhatsApp}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1ebe5d')}
              onMouseLeave={e => (e.currentTarget.style.background = '#25D366')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          )}

          {/* Aprovação / Recusa manual */}
          {canAprovar && <Btn size="sm" variant="primary" onClick={aprovarManual}>Aprovar</Btn>}
          {canAprovar && <Btn size="sm" variant="danger"  onClick={recusarManual}>❌ Recusar</Btn>}

          {/* Converter */}
          {canConverter && (
            <button className="ds-btn btn-save ds-btn-sm" onClick={converter}>➡️ Converter em Contrato</button>
          )}
        </div>
      </div>

      {/* ── Tabs internas ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', gap: 0 }}>
        {([['dados','📋 Dados'], ['log','🔒 Log de Aprovação']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTabDetalhe(k as any)}
            style={{ padding: '9px 18px', fontSize: 'var(--fs-base)', fontWeight: tabDetalhe === k ? 600 : 400, color: tabDetalhe === k ? 'var(--c-primary)' : 'var(--t-secondary)', background: 'none', border: 'none', borderBottom: `2px solid ${tabDetalhe === k ? 'var(--c-primary)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'var(--font)', marginBottom: -2, whiteSpace: 'nowrap', transition: 'all 150ms' }}>
            {l}
            {k === 'log' && logs.length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--bg-header)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10, padding: '1px 5px', color: 'var(--t-muted)', fontWeight: 600 }}>{logs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Dados ── */}
      {tabDetalhe === 'dados' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
          {/* Coluna principal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Dados gerais */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border)', padding: '9px 14px' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--t-primary)' }}>📋 Dados da Cotação</span>
              </div>
              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { l: 'Cliente',    v: cot.clientes?.nome },
                  { l: 'CPF/CNPJ',  v: cot.clientes?.cpf_cnpj, mono: true },
                  { l: 'Vendedor',  v: cot.usuarios?.nome },
                  { l: 'Período',   v: cot.periodos_locacao?.nome ?? '—' },
                  { l: 'Início',    v: fmt.date(cot.data_inicio) || '—' },
                  { l: 'Fim',       v: fmt.date(cot.data_fim)    || '—' },
                  { l: 'Pagamento', v: cot.forma_pagamento?.replace(/_/g,' ') || '—' },
                  { l: 'Condição',  v: cot.condicao_pagamento || '—' },
                  { l: 'Resposta',  v: cot.data_resposta ? fmt.date(cot.data_resposta) : '—' },
                ].map(i => (
                  <div key={i.l}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--t-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{i.l}</div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--t-primary)', fontFamily: (i as any).mono ? 'var(--font-mono)' : undefined }}>{i.v || '—'}</div>
                  </div>
                ))}
              </div>
              {(cot.local_uso_endereco || cot.local_uso_cidade) && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--bg-header)' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--t-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>📍 Local de Uso</div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--t-primary)' }}>
                    {[cot.local_uso_endereco, cot.local_uso_numero, cot.local_uso_complemento, cot.local_uso_bairro, cot.local_uso_cidade, cot.local_uso_estado].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Itens */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border)', padding: '9px 14px' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--t-primary)' }}>📦 Equipamentos ({cot.cotacao_itens?.length ?? 0})</span>
              </div>
              <table className="ds-table">
                <thead><tr>
                  <th>Equipamento</th>
                  <th style={{ textAlign: 'center', width: 70 }}>Qtd</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Preço Unit.</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Total</th>
                </tr></thead>
                <tbody>
                  {(cot.cotacao_itens ?? []).map((it: any) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 500 }}>{it.produtos?.nome}</td>
                      <td style={{ textAlign: 'center' }}>{it.quantidade}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt.money(it.preco_unitario)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt.money(it.total_item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Alertas de observação / recusa */}
            {[
              cot.observacoes        && { cls: 'ds-alert-info',    icon: '📋', title: 'Observações ao Cliente', text: cot.observacoes },
              cot.observacoes_internas && { cls: 'ds-alert-warning', icon: '🔒', title: 'Observações Internas',   text: cot.observacoes_internas },
              cot.motivo_recusa      && { cls: 'ds-alert-error',   icon: '❌', title: 'Motivo da Recusa',       text: cot.motivo_recusa },
            ].filter(Boolean).map((a: any, i) => (
              <div key={i} className={a.cls} style={{ padding: '10px 14px' }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 'var(--fs-sm)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{a.icon} {a.title}</strong>
                {a.text}
              </div>
            ))}
          </div>

          {/* Sidebar financeira */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ background: 'var(--c-primary)', padding: '9px 14px' }}>
                <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 'var(--fs-sm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resumo Financeiro</div>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Row label="Subtotal"   value={fmt.money(cot.subtotal)} />
                {Number(cot.desconto) > 0  && <Row label={`Desconto (${cot.desconto_pct}%)`} value={`- ${fmt.money(cot.desconto)}`} color="var(--c-danger)" />}
                {Number(cot.acrescimo) > 0 && <Row label="Acréscimo" value={`+ ${fmt.money(cot.acrescimo)}`} />}
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--t-primary)', fontSize: 'var(--fs-base)' }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-kpi)', color: 'var(--c-primary)' }}>{fmt.money(cot.total)}</span>
                </div>
              </div>
            </div>

            {/* Link copiável */}
            {cot.token_aprovacao && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔗 Link da Proposta</div>
                <button onClick={copiarLink}
                  style={{ background: 'var(--c-primary-light)', border: '1px solid #BEE5EB', borderRadius: 'var(--r-sm)', padding: '7px 10px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--c-primary-text)', fontWeight: 500, textAlign: 'left', wordBreak: 'break-all', fontFamily: 'var(--font)', transition: 'all 150ms' }}>
                  {copiado ? '✅ Link copiado!' : '📋 Clique para copiar o link'}
                </button>
                <button onClick={abrirWhatsApp}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', padding: '7px', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'var(--font)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Log de Aprovação ── */}
      {tabDetalhe === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Card de aprovação/recusa destacado */}
          {logAtivo && (
            <div style={{
              background: logAtivo.acao === 'aprovada' ? 'var(--c-success-light)' : 'var(--c-danger-light)',
              border: `1px solid ${logAtivo.acao === 'aprovada' ? '#C3E6CB' : '#F5C6CB'}`,
              borderRadius: 'var(--r-md)', padding: '16px 20px',
            }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: logAtivo.acao === 'aprovada' ? 'var(--c-success-text)' : 'var(--c-danger-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {logAtivo.acao === 'aprovada' ? '✅ Proposta Aprovada' : '❌ Proposta Recusada'}
                <span style={{ fontWeight: 400, fontSize: 'var(--fs-sm)' }}>
                  em {new Date(logAtivo.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                {[
                  { l: 'Nome', v: logAtivo.nome_respondente },
                  { l: 'Telefone', v: logAtivo.telefone_respondente },
                  { l: 'E-mail', v: logAtivo.email_respondente },
                  { l: 'IP', v: logAtivo.ip, mono: true },
                  { l: 'Dispositivo', v: logAtivo.dispositivo },
                  { l: 'Sistema', v: logAtivo.sistema },
                  { l: 'Navegador', v: logAtivo.navegador },
                ].filter(i => i.v).map(i => (
                  <div key={i.l}>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: logAtivo.acao === 'aprovada' ? 'var(--c-success-text)' : 'var(--c-danger-text)', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7, marginBottom: 2 }}>{i.l}</div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 500, fontFamily: (i as any).mono ? 'var(--font-mono)' : undefined }}>{i.v}</div>
                  </div>
                ))}
              </div>
              {logAtivo.motivo_recusa && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.08)', fontSize: 'var(--fs-base)' }}>
                  <strong>Motivo:</strong> {logAtivo.motivo_recusa}
                </div>
              )}
            </div>
          )}

          {/* Tabela completa de logs */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border)', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--t-primary)' }}>📋 Histórico de Eventos</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t-muted)' }}>{logs.length} evento(s)</span>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t-muted)', fontSize: 'var(--fs-base)' }}>
                Nenhum acesso registrado ainda.
              </div>
            ) : (
              <table className="ds-table">
                <thead><tr>
                  <th>Data / Hora</th>
                  <th>Ação</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>IP</th>
                  <th>Dispositivo</th>
                  <th>Sistema</th>
                  <th>Navegador</th>
                </tr></thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-md)', whiteSpace: 'nowrap' }}>
                        {new Date(l.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td><AcaoBadge a={l.acao} /></td>
                      <td style={{ fontWeight: l.acao !== 'visualizou' ? 600 : 400 }}>{l.nome_respondente || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-md)' }}>{l.telefone_respondente || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-md)' }}>{l.ip || '—'}</td>
                      <td style={{ fontSize: 'var(--fs-md)' }}>{l.dispositivo || '—'}</td>
                      <td style={{ fontSize: 'var(--fs-md)' }}>{l.sistema     || '—'}</td>
                      <td style={{ fontSize: 'var(--fs-md)' }}>{l.navegador   || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    rascunho:   ['ds-badge ds-badge-gray',   'Rascunho'],
    aguardando: ['ds-badge ds-badge-yellow', 'Aguardando'],
    aprovada:   ['ds-badge ds-badge-green',  'Aprovada'],
    recusada:   ['ds-badge ds-badge-red',    'Recusada'],
    expirada:   ['ds-badge ds-badge-gray',   'Expirada'],
    convertida: ['ds-badge ds-badge-blue',   'Convertida'],
  }
  const [cls, label] = map[s] ?? ['ds-badge ds-badge-gray', s]
  return <span className={cls}><span className="ds-badge-dot" />{label}</span>
}

function AcaoBadge({ a }: { a: string }) {
  const map: Record<string, [string, string]> = {
    visualizou: ['ds-badge ds-badge-gray',   '👁 Visualizou'],
    aprovada:   ['ds-badge ds-badge-green',  '✅ Aprovou'],
    recusada:   ['ds-badge ds-badge-red',    '❌ Recusou'],
    expirada:   ['ds-badge ds-badge-gray',   '⚠️ Expirada'],
  }
  const [cls, label] = map[a] ?? ['ds-badge ds-badge-gray', a]
  return <span className={cls}>{label}</span>
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-md)' }}>
      <span style={{ color: 'var(--t-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--t-primary)' }}>{value}</span>
    </div>
  )
}
