'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { PageHeader, Btn, inputCls, selectCls } from '@/components/ui'
export const dynamic = 'force-dynamic'

type Equip = {
  id:number; nome:string; descricao?:string; marca?:string; modelo?:string
  preco_locacao_diario:number; preco_locacao_semanal:number
  preco_quinzenal:number; preco_locacao_mensal:number; preco_fds:number
  controla_patrimonio:number; ativo:number
  categorias?:{id:number;nome:string}
  estoque:{total:number;disponiveis:number;locados:number;manutencao:number}
}

export default function RelatorioEquipamentosPage() {
  const [equips, setEquips]       = useState<Equip[]>([])
  const [empresa, setEmpresa]     = useState<Record<string,string>>({})
  const [cats, setCats]           = useState<any[]>([])
  const [catFiltro, setCatFiltro] = useState('')
  const [busca, setBusca]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [gerandoPDF, setGerandoPDF] = useState(false)

  useEffect(()=>{ carregar() },[])

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/relatorios/equipamentos')
    const data = await res.json()
    if (data.ok) { setEquips(data.equipamentos); setEmpresa(data.empresa) }
    const { data: c } = await supabase.from('categorias').select('id,nome').eq('ativo',1).order('nome')
    setCats(c ?? [])
    setLoading(false)
  }

  const filtrados = equips.filter(e => {
    const okCat   = !catFiltro || String(e.categorias?.id) === catFiltro
    const okBusca = !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
                    (e.marca??'').toLowerCase().includes(busca.toLowerCase())
    return okCat && okBusca
  })

  async function gerarPDF() {
    setGerandoPDF(true)
    const params = new URLSearchParams()
    if (catFiltro) params.set('categoria_id', catFiltro)
    const res = await fetch(`/api/relatorios/equipamentos?${params}`)
    const data = await res.json()
    if (!data.ok) { setGerandoPDF(false); return }

    const rows = data.equipamentos.map((e:Equip) => {
      const p = (v:number) => v>0?'R$ '+Number(v).toFixed(2).replace('.',','):'—'
      return `<tr>
        <td>${e.nome}</td>
        <td style="color:#666">${e.categorias?.nome??'—'}</td>
        <td style="color:#666">${e.marca??'—'}</td>
        <td class="r">${p(e.preco_locacao_diario)}</td>
        <td class="r">${p(e.preco_locacao_semanal)}</td>
        <td class="r">${p(e.preco_quinzenal)}</td>
        <td class="r" style="font-weight:700;color:#1a56db">${p(e.preco_locacao_mensal)}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Catálogo — ${data.empresa.empresa_nome??'Locadora'}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:15mm}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;padding-bottom:5mm;border-bottom:2px solid #1a56db}
      h1{font-size:18pt;color:#1a56db;font-weight:700}
      .sub{font-size:8pt;color:#888;margin-top:2px}
      .info{text-align:right;font-size:8pt;color:#555;line-height:1.7}
      h2{font-size:12pt;text-align:center;margin-bottom:6mm;color:#333}
      table{width:100%;border-collapse:collapse}
      th{padding:6px 8px;background:#1a56db;color:#fff;font-size:8pt;font-weight:700;text-align:left}
      th.r,td.r{text-align:right}
      td{padding:5px 8px;border-bottom:1px solid #eee;font-size:8.5pt}
      tr:nth-child(even) td{background:#f5f7fb}
      .ftr{margin-top:8mm;border-top:1px solid #ddd;padding-top:3mm;display:flex;justify-content:space-between;font-size:7pt;color:#aaa}
    </style></head><body>
    <div class="hdr">
      <div><h1>${data.empresa.empresa_nome??'Catálogo de Equipamentos'}</h1>
      <div class="sub">Tabela de Preços para Locação</div></div>
      <div class="info">
        ${data.empresa.empresa_cnpj?`CNPJ: ${data.empresa.empresa_cnpj}<br>`:''}
        ${data.empresa.empresa_telefone?`Tel: ${data.empresa.empresa_telefone}<br>`:''}
        ${data.empresa.empresa_email??''}
      </div>
    </div>
    <h2>Equipamentos Disponíveis para Locação</h2>
    <table>
      <thead><tr>
        <th>Equipamento</th><th>Categoria</th><th>Marca</th>
        <th class="r">Diário</th><th class="r">Semanal</th>
        <th class="r">Quinzenal</th><th class="r">Mensal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ftr">
      <span>${data.empresa.empresa_nome??''}</span>
      <span>Preços sujeitos a alteração · ${data.equipamentos.length} equipamento(s)</span>
      <span>Emitido em ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>win.print(),500) }
    setGerandoPDF(false)
  }

  if (loading) return <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>

  return (
    <div>
      <PageHeader title="📦 Catálogo de Equipamentos"
        subtitle={`Relatório para envio a clientes · ${filtrados.length} equipamento(s)`}
        actions={<div style={{display:'flex',gap:8}}>
          <Btn variant="secondary" onClick={carregar}>↻ Atualizar</Btn>
          <Btn loading={gerandoPDF} onClick={gerarPDF}>🖨 Gerar PDF / Imprimir</Btn>
        </div>}/>

      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)}
          className={inputCls} placeholder="Buscar equipamento ou marca..."
          style={{flex:1,minWidth:200}} />
        <select value={catFiltro} onChange={e=>setCatFiltro(e.target.value)} className={selectCls} style={{minWidth:160}}>
          <option value="">Todas as categorias</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {filtrados.length === 0
        ? <div className="ds-empty"><div className="ds-empty-title">Nenhum equipamento encontrado.</div></div>
        : <div className="ds-card" style={{overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'var(--bg-header)'}}>
                {['Equipamento','Categoria','Marca','Diário','Semanal','Quinzenal','Mensal','Disponíveis',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',
                    textAlign:['Diário','Semanal','Quinzenal','Mensal','Disponíveis'].includes(h)?'right':'left',
                    fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',textTransform:'uppercase',
                    letterSpacing:'0.05em',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtrados.map(e=>{
                  const p = (v:number) => v>0?fmt.money(v):'—'
                  return <tr key={e.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 14px',fontWeight:600,fontSize:'var(--fs-md)'}}>{e.nome}</td>
                    <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{e.categorias?.nome??'—'}</td>
                    <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{e.marca??'—'}</td>
                    <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)'}}>{p(e.preco_locacao_diario)}</td>
                    <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)'}}>{p(e.preco_locacao_semanal)}</td>
                    <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)'}}>{p(e.preco_quinzenal)}</td>
                    <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:'var(--fs-sm)',fontWeight:700,color:'var(--c-primary)'}}>{p(e.preco_locacao_mensal)}</td>
                    <td style={{padding:'10px 14px',textAlign:'right'}}>
                      {e.controla_patrimonio
                        ? <span style={{fontWeight:700,fontSize:'var(--fs-sm)',color:e.estoque.disponiveis>0?'var(--c-success-text)':'var(--c-danger)'}}>{e.estoque.disponiveis}/{e.estoque.total}</span>
                        : <span style={{color:'var(--t-muted)',fontSize:'var(--fs-xs)'}}>por qtd</span>}
                    </td>
                    <td style={{padding:'8px 10px'}}>
                      {e.controla_patrimonio
                        ? e.estoque.disponiveis>0
                          ? <span style={{padding:'3px 8px',borderRadius:99,background:'var(--c-success-light)',color:'var(--c-success-text)',fontSize:'var(--fs-xs)',fontWeight:600}}>✓ Disponível</span>
                          : <span style={{padding:'3px 8px',borderRadius:99,background:'var(--c-danger-light)',color:'var(--c-danger)',fontSize:'var(--fs-xs)',fontWeight:600}}>Indisponível</span>
                        : null}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
      }
      <div style={{marginTop:16,padding:'10px 14px',background:'var(--bg-header)',borderRadius:'var(--r-md)',fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>
        💡 Clique em <strong>Gerar PDF / Imprimir</strong> para abrir o catálogo formatado — salve como PDF e envie por e-mail ou WhatsApp.
      </div>
    </div>
  )
}
