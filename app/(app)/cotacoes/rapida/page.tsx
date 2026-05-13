'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { Btn, inputCls } from '@/components/ui'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Produto = {
  id: number; nome: string; marca?: string; descricao?: string
  preco_locacao_diario: number; preco_locacao_semanal: number
  preco_quinzenal: number; preco_locacao_mensal: number; preco_fds: number
  categorias?: { nome: string }
  foto?: string
}
type ItemCarrinho = { produto: Produto; quantidade: number }

const PERIODOS = [
  { label: 'Diário',          campo: 'preco_locacao_diario'  as keyof Produto },
  { label: 'Fim de Semana',   campo: 'preco_fds'             as keyof Produto },
  { label: 'Semanal (7d)',    campo: 'preco_locacao_semanal' as keyof Produto },
  { label: 'Quinzenal (15d)', campo: 'preco_quinzenal'       as keyof Produto },
  { label: 'Mensal (30d)',    campo: 'preco_locacao_mensal'  as keyof Produto },
]

// ── Subcomponentes ────────────────────────────────────────────────────────────
function PrecoPill({ label, valor }: { label: string; valor: number }) {
  if (!valor || valor === 0) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)',
      borderRadius: 6, padding: '3px 7px', minWidth: 72,
    }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>{fmt.money(valor)}</span>
    </div>
  )
}

function CardProduto({ prod, qtd, onAdd, onRemove }: {
  prod: Produto; qtd: number; onAdd: () => void; onRemove: () => void
}) {
  const selecionado = qtd > 0
  return (
    <div style={{
      background: selecionado ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
      border: `1.5px solid ${selecionado ? '#6366f1' : 'rgba(255,255,255,0.10)'}`,
      borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'all .2s',
      display: 'flex', flexDirection: 'column',
      boxShadow: selecionado ? '0 0 20px rgba(99,102,241,0.2)' : 'none',
    }}>
      {/* Foto */}
      <div style={{ height: 120, background: 'rgba(0,0,0,0.3)', position: 'relative', flexShrink: 0 }}>
        {prod.foto
          ? <img src={prod.foto} alt={prod.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, opacity: .3 }}>🔧</div>
        }
        {selecionado && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: '#6366f1', color: '#fff',
            borderRadius: 99, width: 22, height: 22, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {qtd}
          </div>
        )}
        {prod.categorias?.nome && (
          <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.6)',
            color: 'rgba(255,255,255,0.7)', fontSize: 9, padding: '2px 6px', borderRadius: 4 }}>
            {prod.categorias.nome}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{prod.nome}</div>
          {prod.marca && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{prod.marca}</div>}
        </div>

        {/* Preços por período */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PERIODOS.map(per => (
            <PrecoPill key={per.campo} label={per.label} valor={Number(prod[per.campo] ?? 0)} />
          ))}
        </div>

        {/* Controle de quantidade */}
        <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          {selecionado ? (
            <>
              <button onClick={onRemove} style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>−</button>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#a5b4fc', minWidth: 20, textAlign: 'center' }}>{qtd}</span>
              <button onClick={onAdd} style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)',
                background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>+</button>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>un.</span>
            </>
          ) : (
            <button onClick={onAdd} style={{
              flex: 1, padding: '6px 0', borderRadius: 6,
              background: 'linear-gradient(135deg,#6366f1,#818cf8)',
              border: 'none', color: '#fff', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              boxShadow: '0 0 12px rgba(99,102,241,0.3)',
            }}>+ Adicionar</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CotacaoRapidaPage() {
  const [step, setStep]         = useState<1 | 2 | 3>(1)
  const [produtos, setProdutos]  = useState<Produto[]>([])
  const [cats, setCats]          = useState<string[]>([])
  const [catFiltro, setCatFiltro]= useState('')
  const [busca, setBusca]        = useState('')
  const [loading, setLoading]    = useState(true)
  const [carrinho, setCarrinho]  = useState<ItemCarrinho[]>([])
  const [salvando, setSalvando]  = useState(false)
  const [resultado, setResultado]= useState<{ token: string; numero: string; cotacao_id: number } | null>(null)
  const [erro, setErro]          = useState('')

  const [cliente, setCliente] = useState({ nome: '', email: '', telefone: '', cidade: '' })
  const C = (k: keyof typeof cliente) => ({
    value: cliente[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCliente(c => ({ ...c, [k]: e.target.value })),
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('produtos')
      .select('id,nome,marca,descricao,preco_locacao_diario,preco_locacao_semanal,preco_quinzenal,preco_locacao_mensal,preco_fds,categorias(nome),produto_fotos(url,principal)')
      .eq('ativo', 1).order('nome')

    const prods = (data ?? []).map((p: any) => {
      const fotos = p.produto_fotos ?? []
      const foto = fotos.find((f: any) => f.principal)?.url ?? fotos[0]?.url ?? null
      const catNome = Array.isArray(p.categorias) ? p.categorias[0]?.nome : p.categorias?.nome
      return { ...p, foto, categorias: { nome: catNome ?? '' }, produto_fotos: undefined }
    })
    setProdutos(prods)

    const catSet = new Set<string>()
    prods.forEach((p: Produto) => { if (p.categorias?.nome) catSet.add(p.categorias.nome) })
    setCats(Array.from(catSet).sort())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Carrinho ───────────────────────────────────────────────────────────────
  function qtdProduto(id: number) {
    return carrinho.find(i => i.produto.id === id)?.quantidade ?? 0
  }
  function addProduto(prod: Produto) {
    setCarrinho(c => {
      const idx = c.findIndex(i => i.produto.id === prod.id)
      if (idx >= 0) return c.map((i, n) => n === idx ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...c, { produto: prod, quantidade: 1 }]
    })
  }
  function remProduto(prod: Produto) {
    setCarrinho(c => {
      const idx = c.findIndex(i => i.produto.id === prod.id)
      if (idx < 0) return c
      const nova = [...c]
      if (nova[idx].quantidade <= 1) nova.splice(idx, 1)
      else nova[idx] = { ...nova[idx], quantidade: nova[idx].quantidade - 1 }
      return nova
    })
  }

  // ── Gerar PDF ──────────────────────────────────────────────────────────────
  async function gerarCotacao() {
    if (!cliente.nome.trim()) { setErro('Informe o nome.'); return }
    setSalvando(true); setErro('')
    const res = await fetch('/api/cotacoes/rapida', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente,
        itens: carrinho.map(i => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
      }),
    })
    const data = await res.json()
    if (!data.ok) { setErro(data.error ?? 'Erro ao gerar cotação.'); setSalvando(false); return }
    setResultado(data)
    setStep(3)
    setSalvando(false)
  }

  // ── Filtros do catálogo ────────────────────────────────────────────────────
  const filtrados = produtos.filter(p => {
    const okCat   = !catFiltro || p.categorias?.nome === catFiltro
    const okBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) ||
                    (p.marca ?? '').toLowerCase().includes(busca.toLowerCase())
    return okCat && okBusca
  })

  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0)

  // ── Renderização ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>

      {/* Header fixo com steps + filtros (sticky) */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
        paddingBottom: 10, position: 'sticky', top: 0, zIndex: 50,
        background: 'linear-gradient(180deg,#0f172a 80%,transparent 100%)' }}>

      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '14px 20px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>📋 Nova Cotação Rápida</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            Selecione os equipamentos, informe os dados do cliente e gere o PDF.
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { n: 1, label: 'Equipamentos' },
            { n: 2, label: 'Dados do Cliente' },
            { n: 3, label: 'PDF Gerado' },
          ].map((s, idx) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: idx < 2 ? 1 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                  background: step === s.n ? 'linear-gradient(135deg,#6366f1,#818cf8)'
                    : step > s.n ? '#34d399' : 'rgba(255,255,255,0.10)',
                  color: step >= s.n ? '#fff' : 'rgba(255,255,255,0.35)',
                  boxShadow: step === s.n ? '0 0 14px rgba(99,102,241,0.5)' : 'none',
                  transition: 'all .3s',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 12, fontWeight: step === s.n ? 600 : 400,
                  color: step === s.n ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div style={{ flex: 1, height: 1, background: step > s.n ? '#34d399' : 'rgba(255,255,255,0.12)',
                  margin: '0 10px', transition: 'background .3s' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Barra de busca + categoria — dentro do header fixo, só no step 1 */}
      {step === 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)',
          padding: '10px 14px' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              className={inputCls} placeholder="Buscar equipamento..."
              style={{ flex: '1 1 200px', minWidth: 180 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setCatFiltro('')}
                style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  border: '1px solid', fontFamily: 'var(--font-sans)',
                  background: !catFiltro ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)',
                  borderColor: !catFiltro ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.12)',
                  color: !catFiltro ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
                Todos
              </button>
              {cats.map(cat => (
                <button key={cat} onClick={() => setCatFiltro(cat === catFiltro ? '' : cat)}
                  style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: '1px solid', fontFamily: 'var(--font-sans)',
                    background: catFiltro === cat ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)',
                    borderColor: catFiltro === cat ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.12)',
                    color: catFiltro === cat ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
                  {cat}
                </button>
              ))}
            </div>
        </div>
      )}

      </div>{/* fim do header fixo */}

      {/* ── Área scrollável ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12 }}>

      {/* ── ETAPA 1: CATÁLOGO ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>

          {loading ? (
            <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>
          ) : filtrados.length === 0 ? (
            <div className="ds-empty">
              <div className="ds-empty-icon">🔧</div>
              <div className="ds-empty-title">Nenhum equipamento encontrado.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {filtrados.map(prod => (
                <CardProduto key={prod.id} prod={prod}
                  qtd={qtdProduto(prod.id)}
                  onAdd={() => addProduto(prod)}
                  onRemove={() => remProduto(prod)} />
              ))}
            </div>
          )}

          {/* Rodapé com carrinho */}
          {totalItens > 0 && (
            <div style={{ position: 'sticky', bottom: 12, marginTop: 4 }}>
              <div style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(129,140,248,0.4)', borderRadius: 'var(--r-lg)',
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    {carrinho.length} equipamento(s) selecionado(s) — {totalItens} unidade(s)
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {carrinho.map(i => `${i.produto.nome} (${i.quantidade})`).join(' · ')}
                  </div>
                </div>
                <Btn onClick={() => setStep(2)}>
                  Continuar →
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ETAPA 2: DADOS DO CLIENTE ─────────────────────────────────────── */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>

          {/* Formulário */}
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
              👤 Dados do Solicitante
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              Informe os dados para quem a cotação será emitida. Não é necessário cadastro completo.
            </div>

            {erro && <div className="ds-alert-error" style={{ marginBottom: 14 }}>{erro}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
                  Nome completo *
                </div>
                <input {...C('nome')} className={inputCls} placeholder="Ex: João da Silva" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>E-mail</div>
                  <input {...C('email')} type="email" className={inputCls} placeholder="email@exemplo.com" style={{ width: '100%' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Telefone / WhatsApp</div>
                  <input
                    value={cliente.telefone}
                    onChange={e => {
                      // Máscara: (99) 9 9999-9999 ou (99) 9999-9999
                      let v = e.target.value.replace(/\D/g, '').slice(0, 11)
                      if (v.length > 10) {
                        v = v.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4')
                      } else if (v.length > 6) {
                        v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
                      } else if (v.length > 2) {
                        v = v.replace(/(\d{2})(\d+)/, '($1) $2')
                      } else if (v.length > 0) {
                        v = v.replace(/(\d+)/, '($1')
                      }
                      setCliente(c => ({ ...c, telefone: v }))
                    }}
                    className={inputCls}
                    placeholder="(51) 9 9999-9999"
                    inputMode="numeric"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Cidade</div>
                <input {...C('cidade')} className={inputCls} placeholder="Ex: São Leopoldo" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => setStep(1)}
                  style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  ← Voltar
                </button>
                <Btn loading={salvando} onClick={gerarCotacao} style={{ flex: 1 }}>
                  🖨️ Gerar Cotação em PDF
                </Btn>
              </div>
            </div>
          </div>

          {/* Resumo do carrinho */}
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12,
              textTransform: 'uppercase', letterSpacing: '.05em' }}>
              🛒 Equipamentos selecionados
            </div>
            {carrinho.map(item => (
              <div key={item.produto.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.produto.nome}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    Qtd: {item.quantidade}
                  </div>
                </div>
                <button onClick={() => setCarrinho(c => c.filter(i => i.produto.id !== item.produto.id))}
                  style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.7)',
                    cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>×</button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8, fontStyle: 'italic' }}>
              O PDF incluirá todos os preços por período de locação.
            </div>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: PDF GERADO ───────────────────────────────────────────── */}
      {step === 3 && resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg,#34d399,#10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 0 32px rgba(52,211,153,0.4)',
          }}>✓</div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: 6 }}>
              Cotação gerada com sucesso!
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {resultado.numero} · {cliente.nome}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={`/doc/${resultado.token}`} target="_blank" rel="noreferrer">
              <Btn>🖨️ Imprimir / Salvar PDF</Btn>
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Segue sua cotação de equipamentos:\n${window.location.origin}/doc/${resultado.token}`
              )}`}
              target="_blank" rel="noreferrer">
              <button style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid rgba(52,211,153,0.4)',
                background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📱 Enviar por WhatsApp
              </button>
            </a>
          </div>

          {/* Links para consulta futura */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={`/cotacoes/${resultado.cotacao_id}`}
              style={{ padding: '7px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.1)',
                color: '#a5b4fc', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5 }}>
              📋 Ver cotação salva
            </a>
            <a href="/cotacoes"
              style={{ padding: '7px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5 }}>
              📄 Ver todas as cotações
            </a>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--r-md)', padding: '10px 16px', fontSize: 12, color: 'rgba(255,255,255,0.4)',
            textAlign: 'center', maxWidth: 420 }}>
            O link do PDF fica disponível por 30 dias e pode ser compartilhado diretamente com o cliente.
          </div>

          <button onClick={() => {
            setStep(1); setCarrinho([]); setCliente({ nome:'', email:'', telefone:'', cidade:'' })
            setResultado(null); setErro('')
          }}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--r-md)', padding: '8px 16px', color: 'rgba(255,255,255,0.55)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            + Nova Cotação
          </button>
        </div>
      )}
      </div>{/* fim da área scrollável */}
    </div>
  )
}
