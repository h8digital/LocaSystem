'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function fmt_money(v: number) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmt_date(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function AprovarForm() {
  const params    = useSearchParams()
  const token     = params.get('token') ?? ''
  const [apr, setApr]       = useState<any>(null)
  const [erro, setErro]     = useState('')
  const [acao, setAcao]     = useState<'aprovar'|'reprovar'|null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnv]  = useState(false)
  const [resultado, setRes] = useState<'aprovado'|'reprovado'|null>(null)
  const canvasRef           = useRef<HTMLCanvasElement>(null)
  const [desenhando, setDes]= useState(false)
  const [temAssinatura, setTemAss] = useState(false)

  useEffect(() => {
    if (!token) { setErro('Token não informado.'); return }
    fetch(`/api/contrato-aprovacao/responder?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) setErro(d.error)
        else {
          setApr(d.data)
          if (d.data.status !== 'pendente' || d.data.expirado) {
            setRes(d.data.status === 'aprovado' ? 'aprovado' : 'reprovado')
          }
        }
      })
  }, [token])

  // Canvas de assinatura
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setDes(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!desenhando) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    setTemAss(true)
  }
  function stopDraw() { setDes(false) }
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }
  function limparAssinatura() {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, 600, 160)
    setTemAss(false)
  }

  async function enviar() {
    if (!acao) return
    if (acao === 'aprovar' && !temAssinatura) {
      alert('Por favor, assine no campo de assinatura antes de aprovar.')
      return
    }
    if (acao === 'reprovar' && !motivo.trim()) {
      alert('Informe o motivo da reprovação.')
      return
    }
    setEnv(true)
    const assinaturaData = canvasRef.current?.toDataURL('image/svg+xml') ?? canvasRef.current?.toDataURL()
    const r = await fetch('/api/contrato-aprovacao/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        acao,
        assinatura_svg: acao === 'aprovar' ? assinaturaData : null,
        motivo_reprovacao: acao === 'reprovar' ? motivo : null,
      }),
    })
    const d = await r.json()
    if (d.ok) setRes(acao === 'aprovar' ? 'aprovado' : 'reprovado')
    else { alert('Erro: ' + d.error); setEnv(false) }
  }

  const contrato = apr?.contratos
  const cliente  = contrato?.clientes

  // ── Estados de resultado ────────────────────────────────────────
  if (resultado === 'aprovado') return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: 64, textAlign: 'center' }}>✅</div>
        <h1 style={styles.h1green}>Contrato Aprovado!</h1>
        <p style={styles.sub}>Sua assinatura eletrônica foi registrada com sucesso.</p>
        <p style={styles.sub}>O contrato <strong>{contrato?.numero}</strong> está confirmado.</p>
        <div style={styles.logBox}>
          <div style={styles.logTitle}>📋 Log de Aprovação</div>
          <div style={styles.logRow}><span>Data/Hora:</span><span>{new Date().toLocaleString('pt-BR')}</span></div>
          <div style={styles.logRow}><span>Contrato:</span><span>{contrato?.numero}</span></div>
          <div style={styles.logRow}><span>Cliente:</span><span>{cliente?.nome}</span></div>
          <div style={styles.logRow}><span>Status:</span><span style={{ color: '#16a34a', fontWeight: 700 }}>APROVADO ELETRONICAMENTE</span></div>
          <div style={styles.logRow}><span>Documento legal:</span><span>Assinatura digital com valor probatório</span></div>
        </div>
      </div>
    </div>
  )

  if (resultado === 'reprovado') return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: 64, textAlign: 'center' }}>❌</div>
        <h1 style={styles.h1red}>Contrato Reprovado</h1>
        <p style={styles.sub}>Sua resposta foi registrada. Entraremos em contato em breve.</p>
      </div>
    </div>
  )

  if (apr && apr.status !== 'pendente') return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: 48, textAlign: 'center' }}>ℹ️</div>
        <h1 style={styles.h1}>Este link já foi utilizado</h1>
        <p style={styles.sub}>
          Status: <strong>{apr.status === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}</strong>
          {apr.aprovado_em && <> em {new Date(apr.aprovado_em).toLocaleString('pt-BR')}</>}
        </p>
      </div>
    </div>
  )

  if (erro) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: 48, textAlign: 'center' }}>⚠️</div>
        <h1 style={styles.h1}>Link inválido ou expirado</h1>
        <p style={styles.sub}>{erro}</p>
      </div>
    </div>
  )

  if (!apr) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.sub}>Carregando...</p>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: 32 }}>📄</div>
          <div>
            <h1 style={styles.h1}>Aprovação de Contrato</h1>
            <p style={styles.sub}>Leia os dados abaixo e assine para confirmar</p>
          </div>
        </div>

        {/* Dados do contrato */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Dados do Contrato</div>
          <div style={styles.grid2}>
            <div style={styles.dataField}><span style={styles.dataLabel}>Contrato Nº</span><span style={styles.dataVal}>{contrato?.numero}</span></div>
            <div style={styles.dataField}><span style={styles.dataLabel}>Cliente</span><span style={styles.dataVal}>{cliente?.nome}</span></div>
            <div style={styles.dataField}><span style={styles.dataLabel}>CPF/CNPJ</span><span style={styles.dataVal}>{cliente?.cpf_cnpj}</span></div>
            <div style={styles.dataField}><span style={styles.dataLabel}>Valor Total</span><span style={{...styles.dataVal, color:'#0EA5E9', fontWeight:700}}>{fmt_money(contrato?.total ?? 0)}</span></div>
            <div style={styles.dataField}><span style={styles.dataLabel}>Início</span><span style={styles.dataVal}>{fmt_date(contrato?.data_inicio)}</span></div>
            <div style={styles.dataField}><span style={styles.dataLabel}>Término Previsto</span><span style={styles.dataVal}>{fmt_date(contrato?.data_fim)}</span></div>
          </div>
        </div>

        {/* Botões de ação */}
        {!acao && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Sua Decisão</div>
            <div style={styles.botoesAcao}>
              <button style={styles.btnAprovar} onClick={() => setAcao('aprovar')}>
                ✅ Aprovar Contrato
              </button>
              <button style={styles.btnReprovar} onClick={() => setAcao('reprovar')}>
                ❌ Reprovar Contrato
              </button>
            </div>
          </div>
        )}

        {/* Fluxo de aprovação */}
        {acao === 'aprovar' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>✍️ Assinatura Eletrônica</div>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
              Desenhe sua assinatura no campo abaixo. Esta assinatura terá valor legal como aprovação eletrônica do contrato.
            </p>
            <div style={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                width={560} height={160}
                style={styles.canvas}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
              />
              <div style={styles.canvasHint}>Assine aqui</div>
            </div>
            <button onClick={limparAssinatura} style={styles.btnLimpar}>Limpar assinatura</button>

            <div style={styles.declaracao}>
              <strong>Declaro</strong> que li e concordo com todos os termos do Contrato Nº {contrato?.numero},
              que as informações acima são corretas, e que esta assinatura eletrônica tem pleno valor legal
              conforme a Lei nº 14.063/2020.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setAcao(null)} style={styles.btnVoltar}>← Voltar</button>
              <button onClick={enviar} disabled={enviando || !temAssinatura} style={styles.btnEnviar}>
                {enviando ? 'Enviando...' : '✅ Confirmar Aprovação'}
              </button>
            </div>
          </div>
        )}

        {/* Fluxo de reprovação */}
        {acao === 'reprovar' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>❌ Motivo da Reprovação</div>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da reprovação..."
              rows={4}
              style={styles.textarea}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => setAcao(null)} style={styles.btnVoltar}>← Voltar</button>
              <button onClick={enviar} disabled={enviando || !motivo.trim()} style={styles.btnReprovarEnv}>
                {enviando ? 'Enviando...' : '❌ Confirmar Reprovação'}
              </button>
            </div>
          </div>
        )}

        {/* Aviso legal */}
        <div style={styles.footer}>
          🔒 Este link é pessoal e intransferível. Ao aprovar, você confirma que leu e concordou com os termos
          do contrato. A aprovação eletrônica tem validade legal conforme a Lei nº 14.063/2020.
          <br/>Este link expira em {apr.expires_at ? new Date(apr.expires_at).toLocaleDateString('pt-BR') : '30 dias'}.
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container:    { minHeight:'100vh', background:'#F1F5F9', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 16px', fontFamily:'Arial,sans-serif' },
  card:         { background:'#fff', borderRadius:12, boxShadow:'0 4px 24px rgba(0,0,0,.10)', padding:'32px', maxWidth:660, width:'100%' },
  header:       { display:'flex', alignItems:'center', gap:16, marginBottom:24, paddingBottom:20, borderBottom:'1px solid #E2E8F0' },
  h1:           { fontSize:22, fontWeight:700, color:'#0F172A', margin:0 },
  h1green:      { fontSize:24, fontWeight:700, color:'#16a34a', textAlign:'center', margin:'12px 0 8px' },
  h1red:        { fontSize:24, fontWeight:700, color:'#DC2626', textAlign:'center', margin:'12px 0 8px' },
  sub:          { fontSize:14, color:'#64748B', margin:'4px 0', textAlign:'center' } as React.CSSProperties,
  section:      { marginBottom:24, paddingBottom:24, borderBottom:'1px solid #F1F5F9' },
  sectionTitle: { fontSize:13, fontWeight:700, color:'#64748B', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:14 },
  grid2:        { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  dataField:    { display:'flex', flexDirection:'column' as const, gap:2 },
  dataLabel:    { fontSize:11, fontWeight:600, color:'#94A3B8', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  dataVal:      { fontSize:14, fontWeight:500, color:'#0F172A' },
  botoesAcao:   { display:'flex', gap:12 },
  btnAprovar:   { flex:1, padding:'14px 20px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' },
  btnReprovar:  { flex:1, padding:'14px 20px', background:'#fff', color:'#DC2626', border:'2px solid #DC2626', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' },
  canvasWrap:   { position:'relative' as const, border:'2px dashed #CBD5E1', borderRadius:8, overflow:'hidden', marginBottom:8, background:'#FAFAFA' },
  canvas:       { display:'block', width:'100%', cursor:'crosshair', touchAction:'none' },
  canvasHint:   { position:'absolute' as const, top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#CBD5E1', fontSize:16, pointerEvents:'none' as const, userSelect:'none' as const },
  btnLimpar:    { background:'none', border:'1px solid #E2E8F0', borderRadius:6, padding:'4px 12px', fontSize:12, color:'#64748B', cursor:'pointer', marginBottom:14 },
  declaracao:   { background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#334155', lineHeight:1.6 },
  btnVoltar:    { padding:'12px 20px', background:'#F1F5F9', color:'#475569', border:'1px solid #E2E8F0', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnEnviar:    { flex:1, padding:'12px 20px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' },
  btnReprovarEnv:{ flex:1, padding:'12px 20px', background:'#DC2626', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' },
  textarea:     { width:'100%', border:'1px solid #CBD5E1', borderRadius:8, padding:'10px 12px', fontSize:14, fontFamily:'Arial,sans-serif', resize:'vertical' as const, minHeight:100, boxSizing:'border-box' as const },
  logBox:       { background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:8, padding:'14px 16px', marginTop:16 },
  logTitle:     { fontWeight:700, fontSize:13, color:'#15803d', marginBottom:10 },
  logRow:       { display:'flex', justifyContent:'space-between', fontSize:12, color:'#166534', padding:'3px 0', borderBottom:'1px solid rgba(134,239,172,0.4)' },
  footer:       { background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'12px 14px', fontSize:11, color:'#94A3B8', lineHeight:1.6, marginTop:8 },
}

export default function AprovarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>}>
      <AprovarForm />
    </Suspense>
  )
}
