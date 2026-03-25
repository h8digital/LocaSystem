'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { fmt } from '@/lib/supabase'

export default function CotacaoPublicaPage() {
  const params      = useParams() as { token: string }
  const [cot, setCot]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]   = useState('')
  const [acao, setAcao]   = useState<'aprovar'|'recusar'|null>(null)
  const [motivo, setMotivo] = useState('')
  const [nome, setNome]   = useState('')
  const [telefone, setTelefone] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string|null>(null)

  useEffect(() => {
    fetch(`/api/cotacoes/aprovar?token=${params.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else {
          setCot(d)
          // Pré-preencher nome e telefone do cliente
          setNome(d.clientes?.nome ?? '')
          setTelefone(d.clientes?.celular || d.clientes?.telefone || '')
        }
      })
      .finally(() => setLoading(false))
  }, [params.token])

  async function responder() {
    if (!acao) return
    if (acao === 'recusar' && !motivo.trim()) { alert('Informe o motivo da recusa.'); return }
    setEnviando(true)
    const r = await fetch('/api/cotacoes/aprovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, acao, motivo, nome, telefone, email: cot?.clientes?.email }),
    })
    const d = await r.json()
    if (d.error) setErro(d.error)
    else setResultado(acao === 'aprovar' ? 'aprovada' : 'recusada')
    setEnviando(false)
  }

  /* ── Estilos inline reutilizáveis ── */
  const font = "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif"
  const colorPrimary = '#17A2B8'

  /* ── Print CSS ── */
  const printCSS = `
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; }
      .print-card { box-shadow: none !important; border: 1px solid #ddd !important; }
      @page { margin: 15mm; size: A4; }
    }
  `

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', fontFamily: font }}>
      <style>{printCSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6C757D', fontSize: 13 }}>
        <div style={{ width: 18, height: 18, border: '2px solid #DEE2E6', borderTopColor: colorPrimary, borderRadius: '50%', animation: 'spin .65s linear infinite' }} />
        Carregando proposta...
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (erro || !cot) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', fontFamily: font }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: '32px 40px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#212529', marginBottom: 8 }}>Proposta não disponível</div>
        <div style={{ fontSize: 13, color: '#6C757D' }}>{erro || 'Proposta não encontrada ou expirada.'}</div>
      </div>
    </div>
  )

  if (resultado) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', fontFamily: font }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: '40px 48px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{resultado === 'aprovada' ? '✅' : '❌'}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#212529', marginBottom: 8 }}>
          Proposta {resultado === 'aprovada' ? 'Aprovada' : 'Recusada'}!
        </div>
        <div style={{ fontSize: 13, color: '#6C757D', lineHeight: 1.6 }}>
          {resultado === 'aprovada'
            ? 'Sua aprovação foi registrada com sucesso. Nossa equipe entrará em contato para confirmar os detalhes da locação.'
            : 'Sua resposta foi registrada. Se mudar de ideia, entre em contato conosco.'}
        </div>
      </div>
    </div>
  )

  const jaRespondida = ['aprovada', 'recusada', 'convertida', 'expirada'].includes(cot.status)

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', fontFamily: font }}>
      <style>{printCSS}</style>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{margin:0}`}</style>

      {/* Topbar */}
      <div className="no-print" style={{ background: 'linear-gradient(135deg,#1E2A38,#2C3E50)', height: 48, display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>⚙️ LocaSystem</span>
        {/* Botão imprimir */}
        <button onClick={() => window.print()}
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '5px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px' }}>

        {/* Cabeçalho da proposta */}
        <div className="print-card" style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: `linear-gradient(135deg,${colorPrimary},#138496)`, padding: '18px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Proposta de Locação</div>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{cot.numero}</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginTop: 4 }}>
                Emitida em {fmt.date(cot.data_emissao)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 3, textTransform: 'uppercase',
                background: cot.status === 'aprovada' ? '#D4EDDA' : cot.status === 'recusada' ? '#F8D7DA' : cot.status === 'convertida' ? '#CCE5FF' : 'rgba(255,255,255,.2)',
                color: cot.status === 'aprovada' ? '#155724' : cot.status === 'recusada' ? '#721C24' : cot.status === 'convertida' ? '#004085' : '#fff',
              }}>{cot.status}</div>
              <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 6 }}>
                Válida até {fmt.date(cot.data_validade)}
              </div>
            </div>
          </div>

          {/* Dados gerais */}
          <div style={{ padding: '14px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, borderBottom: '1px solid #DEE2E6' }}>
            {[
              { l: 'Cliente',    v: cot.clientes?.nome },
              { l: 'Período',    v: cot.periodos_locacao?.nome ?? '—' },
              { l: 'Início',     v: fmt.date(cot.data_inicio) || '—' },
              { l: 'Fim',        v: fmt.date(cot.data_fim)    || '—' },
              { l: 'Pagamento',  v: cot.forma_pagamento?.replace(/_/g,' ')  || '—' },
              { l: 'Condição',   v: cot.condicao_pagamento || '—' },
            ].map(i => (
              <div key={i.l}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{i.l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#212529' }}>{i.v}</div>
              </div>
            ))}
          </div>

          {/* Local de uso */}
          {(cot.local_uso_endereco || cot.local_uso_cidade) && (
            <div style={{ padding: '10px 24px', background: '#F8F9FA', borderBottom: '1px solid #DEE2E6' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>📍 Local de Uso</div>
              <div style={{ fontSize: 13, color: '#212529' }}>
                {[cot.local_uso_endereco, cot.local_uso_numero, cot.local_uso_complemento, cot.local_uso_bairro, cot.local_uso_cidade, cot.local_uso_estado].filter(Boolean).join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="print-card" style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: '#F8F9FA', borderBottom: '1px solid #DEE2E6', padding: '9px 20px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#212529' }}>📦 Equipamentos</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #DEE2E6' }}>
                {['Equipamento', 'Qtd', 'Preço Unit.', 'Total'].map(h => (
                  <th key={h} style={{ textAlign: h !== 'Equipamento' ? 'center' : 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cot.cotacao_itens ?? []).map((it: any, i: number) => (
                <tr key={it.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8F9FA', borderBottom: '1px solid #DEE2E6' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{it.produtos?.nome}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{it.quantidade}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'monospace' }}>{fmt.money(it.preco_unitario)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }}>{fmt.money(it.total_item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Totais */}
          <div style={{ padding: '12px 20px', borderTop: '2px solid #DEE2E6', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 240 }}>
              {Number(cot.desconto) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6C757D' }}>
                  <span>Desconto ({cot.desconto_pct}%)</span><span>- {fmt.money(cot.desconto)}</span>
                </div>
              )}
              {Number(cot.acrescimo) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6C757D' }}>
                  <span>Acréscimo</span><span>+ {fmt.money(cot.acrescimo)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: colorPrimary, borderTop: '1px solid #DEE2E6', paddingTop: 8, marginTop: 4 }}>
                <span>Total</span><span>{fmt.money(cot.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Observações */}
        {cot.observacoes && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FFEEBA', borderRadius: 6, padding: '12px 16px', marginBottom: 12, fontSize: 12, color: '#856404' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>📋 Observações</strong>
            {cot.observacoes}
          </div>
        )}

        {/* ── Ação do cliente (só se aguardando) ── */}
        {cot.status === 'aguardando' && !jaRespondida && (
          <div className="no-print" style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: '20px 24px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#212529', marginBottom: 4 }}>Sua resposta</div>
            <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 16 }}>Analise a proposta e confirme sua decisão.</div>

            {/* Identificação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#495057', marginBottom: 3 }}>Seu nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)}
                  style={{ width: '100%', border: '1px solid #CED4DA', borderRadius: 4, padding: '6px 9px', fontSize: 13, fontFamily: font, boxSizing: 'border-box' }}
                  placeholder="Nome completo" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#495057', marginBottom: 3 }}>Seu telefone</label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)}
                  style={{ width: '100%', border: '1px solid #CED4DA', borderRadius: 4, padding: '6px 9px', fontSize: 13, fontFamily: font, boxSizing: 'border-box' }}
                  placeholder="(00) 00000-0000" />
              </div>
            </div>

            {!acao && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setAcao('aprovar')}
                  style={{ flex: 1, background: '#28A745', color: '#fff', border: 'none', borderRadius: 4, padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  ✅ Aprovar Proposta
                </button>
                <button onClick={() => setAcao('recusar')}
                  style={{ flex: 1, background: 'transparent', color: '#DC3545', border: '1px solid #DC3545', borderRadius: 4, padding: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  ❌ Recusar
                </button>
              </div>
            )}

            {acao === 'aprovar' && (
              <div>
                <div style={{ background: '#D4EDDA', border: '1px solid #C3E6CB', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#155724' }}>
                  ✅ Você está aprovando esta proposta no valor de <strong>{fmt.money(cot.total)}</strong>. Confirma?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAcao(null)} style={{ flex: 1, background: 'transparent', color: '#6C757D', border: '1px solid #CED4DA', borderRadius: 4, padding: '8px', fontSize: 13, cursor: 'pointer', fontFamily: font }}>Voltar</button>
                  <button onClick={responder} disabled={enviando}
                    style={{ flex: 2, background: '#28A745', color: '#fff', border: 'none', borderRadius: 4, padding: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1, fontFamily: font }}>
                    {enviando ? 'Enviando...' : '✅ Confirmar Aprovação'}
                  </button>
                </div>
              </div>
            )}

            {acao === 'recusar' && (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#495057', marginBottom: 4 }}>Motivo da recusa *</label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                    style={{ width: '100%', border: '1px solid #CED4DA', borderRadius: 4, padding: '7px 9px', fontSize: 13, resize: 'vertical', fontFamily: font, boxSizing: 'border-box' }}
                    placeholder="Descreva o motivo..." />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAcao(null)} style={{ flex: 1, background: 'transparent', color: '#6C757D', border: '1px solid #CED4DA', borderRadius: 4, padding: 8, fontSize: 13, cursor: 'pointer', fontFamily: font }}>Voltar</button>
                  <button onClick={responder} disabled={enviando || !motivo.trim()}
                    style={{ flex: 2, background: '#DC3545', color: '#fff', border: 'none', borderRadius: 4, padding: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (enviando || !motivo.trim()) ? 0.6 : 1, fontFamily: font }}>
                    {enviando ? 'Enviando...' : '❌ Confirmar Recusa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {jaRespondida && (
          <div className="no-print" style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', padding: '14px 20px', textAlign: 'center', color: '#6C757D', fontSize: 13 }}>
            {cot.status === 'aprovada'   && '✅ Esta proposta foi aprovada.'}
            {cot.status === 'recusada'   && '❌ Esta proposta foi recusada.'}
            {cot.status === 'convertida' && '✅ Esta proposta foi aprovada e convertida em contrato.'}
            {cot.status === 'expirada'   && '⚠️ Esta proposta expirou.'}
          </div>
        )}

        <div className="no-print" style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#ADB5BD' }}>
          © {new Date().getFullYear()} LocaSystem · Kanoff Soluções
        </div>
      </div>
    </div>
  )
}
