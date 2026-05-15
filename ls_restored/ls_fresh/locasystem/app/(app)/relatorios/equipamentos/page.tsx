'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Btn, inputCls, selectCls } from '@/components/ui'
export const dynamic = 'force-dynamic'

type Equip = {
  id:number; nome:string; descricao?:string; marca?:string; modelo?:string
  controla_patrimonio:number; ativo:number
  categorias?:{id:number;nome:string} | {id:number;nome:string}[] | null
  produto_fotos?:{url:string;principal:boolean}[]
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
    // Buscar equipamentos com fotos
    const { data } = await supabase
      .from('produtos')
      .select('id,nome,descricao,marca,modelo,controla_patrimonio,ativo,categorias(id,nome),produto_fotos(url,principal)')
      .eq('ativo', 1)
      .order('nome')
    setEquips((data ?? []) as any as Equip[])

    // Parâmetros da empresa
    const { data: params } = await supabase.from('parametros').select('chave,valor')
      .in('chave',['empresa_nome','empresa_telefone','empresa_email','empresa_cnpj'])
    const emp:Record<string,string> = {}
    ;(params ?? []).forEach((p:any) => { emp[p.chave] = p.valor })
    setEmpresa(emp)

    // Categorias para filtro
    const { data: c } = await supabase.from('categorias').select('id,nome').eq('ativo',1).order('nome')
    setCats(c ?? [])
    setLoading(false)
  }

  const filtrados = equips.filter(e => {
    const okCat   = !catFiltro || catId(e) === catFiltro
    const okBusca = !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
                    (e.marca??'').toLowerCase().includes(busca.toLowerCase())
    return okCat && okBusca
  })

  function catNome(e: Equip): string {
    if (!e.categorias) return '—'
    if (Array.isArray(e.categorias)) return (e.categorias[0] as any)?.nome ?? '—'
    return (e.categorias as any).nome ?? '—'
  }

  function catId(e: Equip): string {
    if (!e.categorias) return ''
    if (Array.isArray(e.categorias)) return String((e.categorias[0] as any)?.id ?? '')
    return String((e.categorias as any).id ?? '')
  }

  function fotoUrl(e: Equip) {
    const fotos = e.produto_fotos ?? []
    return fotos.find(f=>f.principal)?.url ?? fotos[0]?.url ?? null
  }

  async function gerarPDF() {
    setGerandoPDF(true)
    // Buscar com filtro de categoria se aplicado
    let q = supabase
      .from('produtos')
      .select('id,nome,descricao,marca,modelo,categorias(id,nome),produto_fotos(url,principal)')
      .eq('ativo', 1).order('nome')
    if (catFiltro) q = (q as any).eq('categoria_id', catFiltro)
    const { data: equipsData } = await q

    const rows = (equipsData ?? []).map((e:any) => {
      const fotos = e.produto_fotos ?? []
      const foto  = fotos.find((f:any)=>f.principal)?.url ?? fotos[0]?.url ?? null
      const imgTag = foto
        ? `<img src="${foto}" style="width:48px;height:36px;object-fit:cover;border-radius:3px;border:1px solid #ddd" />`
        : `<div style="width:48px;height:36px;background:#f0f0f0;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle">${imgTag}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;vertical-align:middle">${e.nome}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;vertical-align:middle">${catNome(e)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;vertical-align:middle">${e.marca??'—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#444;font-size:8pt;vertical-align:middle;max-width:180px">${e.descricao??''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Catálogo — ${empresa.empresa_nome??'Locadora'}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:9pt;color:#222;padding:12mm}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;padding-bottom:5mm;border-bottom:2px solid #1a56db}
      h1{font-size:16pt;color:#1a56db;font-weight:700}
      .sub{font-size:8pt;color:#888;margin-top:2px}
      .info{text-align:right;font-size:8pt;color:#555;line-height:1.7}
      h2{font-size:11pt;text-align:center;margin-bottom:5mm;color:#333}
      table{width:100%;border-collapse:collapse}
      th{padding:6px 8px;background:#1a56db;color:#fff;font-size:8pt;font-weight:700;text-align:left}
      td{font-size:8.5pt}
      tr:nth-child(even) td{background:#f5f7fb}
      .ftr{margin-top:6mm;border-top:1px solid #ddd;padding-top:3mm;display:flex;justify-content:space-between;font-size:7pt;color:#aaa}
    </style></head><body>
    <div class="hdr">
      <div><h1>${empresa.empresa_nome??'Catálogo de Equipamentos'}</h1>
      <div class="sub">Equipamentos disponíveis para locação</div></div>
      <div class="info">
        ${empresa.empresa_cnpj?`CNPJ: ${empresa.empresa_cnpj}<br>`:''}
        ${empresa.empresa_telefone?`Tel: ${empresa.empresa_telefone}<br>`:''}
        ${empresa.empresa_email??''}
      </div>
    </div>
    <h2>Catálogo de Equipamentos</h2>
    <table>
      <thead><tr>
        <th style="width:60px">Foto</th>
        <th>Equipamento</th><th>Categoria</th><th>Marca</th><th>Descrição</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ftr">
      <span>${empresa.empresa_nome??''}</span>
      <span>${(equipsData??[]).length} equipamento(s)</span>
      <span>Emitido em ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>win.print(),600) }
    setGerandoPDF(false)
  }

  if (loading) return <div className="ds-loading"><div className="ds-dots"><span/><span/><span/></div></div>

  return (
    <div>
      <PageHeader title="📦 Catálogo de Equipamentos"
        subtitle={`${filtrados.length} equipamento(s) · para envio a clientes`}
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
                {['','Equipamento','Categoria','Marca','Descrição'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',
                    fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--t-muted)',
                    textTransform:'uppercase',letterSpacing:'0.05em',
                    borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtrados.map(e=>{
                  const foto = fotoUrl(e)
                  return <tr key={e.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 14px',width:52}}>
                      {foto
                        ? <img src={foto} alt="" style={{width:44,height:36,objectFit:'cover',
                            borderRadius:'var(--r-sm)',border:'1px solid var(--border)'}} />
                        : <div style={{width:44,height:36,background:'var(--bg-header)',
                            borderRadius:'var(--r-sm)',border:'1px solid var(--border)',
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📦</div>
                      }
                    </td>
                    <td style={{padding:'10px 14px',fontWeight:600,fontSize:'var(--fs-md)'}}>{e.nome}</td>
                    <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{catNome(e)}</td>
                    <td style={{padding:'10px 14px',color:'var(--t-muted)',fontSize:'var(--fs-sm)'}}>{e.marca??'—'}</td>
                    <td style={{padding:'10px 14px',color:'var(--t-secondary)',fontSize:'var(--fs-sm)',maxWidth:200}}>
                      {e.descricao ? <span style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{e.descricao}</span> : '—'}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
      }
      <div style={{marginTop:16,padding:'10px 14px',background:'var(--bg-header)',borderRadius:'var(--r-md)',fontSize:'var(--fs-xs)',color:'var(--t-muted)'}}>
        💡 Clique em <strong>Gerar PDF / Imprimir</strong> para abrir o catálogo com fotos — salve como PDF e envie por e-mail ou WhatsApp. Sem preços ou estoque.
      </div>
    </div>
  )
}
