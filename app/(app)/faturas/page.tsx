'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { PageHeader, DataTable, Filters, Badge, Btn, SlidePanel, FormField, inputCls, selectCls } from '@/components/ui'

export default function FaturasPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string,string>>({status:'', busca:''})
  const [panel, setPanel]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [faturaSel, setFaturaSel] = useState<any>(null)
  const [pagamento, setPagamento] = useState({data_pagamento:'', forma_pagamento:'pix', valor_pago:0})

  async function load() {
    setLoading(true)
    let q = supabase.from('faturas').select('*, contratos(numero, clientes(nome))').order('data_vencimento')
    if(filters.status) q = q.eq('status', filters.status)
    const {data} = await q; setLista(data??[]); setLoading(false)
  }
  useEffect(()=>{ load() },[filters])

  async function registrarPagamento() {
    if(!faturaSel)return; setSaving(true)
    await supabase.from('faturas').update({
      status:'pago', data_pagamento:pagamento.data_pagamento||new Date().toISOString().split('T')[0],
      forma_pagamento:pagamento.forma_pagamento, valor_pago:Number(pagamento.valor_pago)||faturaSel.valor,
    }).eq('id',faturaSel.id)
    setSaving(false); setPanel(false); load()
  }

  const total   = lista.reduce((s,f)=>s+Number(f.valor),0)
  const recebido= lista.filter(f=>f.status==='pago').reduce((s,f)=>s+Number(f.valor_pago||f.valor),0)
  const pendente= lista.filter(f=>f.status==='pendente'||f.status==='vencido').reduce((s,f)=>s+Number(f.valor),0)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <PageHeader title="Faturas" subtitle={`${lista.length} fatura(s)`} />

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {[
          {label:'Total Emitido', value:fmt.money(total), color:'var(--t-primary)'},
          {label:'Recebido',      value:fmt.money(recebido), color:'var(--c-success)'},
          {label:'A Receber',     value:fmt.money(pendente), color:'var(--c-danger)'},
        ].map(k=>(
          <div key={k.label} style={{background:'var(--bg-card)',borderRadius:'var(--r-md)',boxShadow:'var(--shadow-sm)',padding:'18px 20px',border:'1px solid var(--border)'}}>
            <div style={{fontSize:'var(--fs-md)',fontWeight:600,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:'var(--fs-kpi)',fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
          </div>
        ))}
      </div>

      <Filters
        fields={[{type:'select',key:'status',placeholder:'Todos os status',options:[
          {value:'pendente',label:'Pendente'},{value:'pago',label:'Pago'},
          {value:'vencido',label:'Vencido'},{value:'cancelado',label:'Cancelado'},
        ]}]}
        values={filters} onChange={(k,v)=>setFilters(f=>({...f,[k]:v}))} onClear={()=>setFilters({status:'',busca:''})}
      />

      <DataTable
        loading={loading} emptyMessage="Nenhuma fatura encontrada."
        columns={[
          {key:'numero', label:'Nº',    render:r=><span style={{fontWeight:600,fontFamily:'var(--font-mono)',fontSize:'var(--fs-base)'}}>{r.numero}</span>},
          {key:'contrato',label:'Contrato/Cliente',render:r=><div><div style={{fontWeight:500}}>{(r.contratos as any)?.numero}</div><div style={{fontSize:'var(--fs-md)',color:'var(--t-muted)'}}>{(r.contratos as any)?.clientes?.nome}</div></div>},
          {key:'tipo',   label:'Tipo',  render:r=><span style={{fontSize:'var(--fs-base)',color:'var(--t-secondary)',textTransform:'capitalize'}}>{r.tipo}</span>},
          {key:'vencimento',label:'Vencimento',render:r=><span style={{color:r.status==='vencido'?'var(--c-danger)':undefined}}>{fmt.date(r.data_vencimento)}</span>},
          {key:'valor',  label:'Valor', align:'right', render:r=><span style={{fontWeight:700}}>{fmt.money(r.valor)}</span>},
          {key:'status', label:'Status',render:r=><Badge value={r.status} dot />},
        ]}
        data={lista}
        actions={row=>row.status==='pendente'||row.status==='vencido'?(
          <button onClick={()=>{setFaturaSel(row);setPagamento({data_pagamento:'',forma_pagamento:'pix',valor_pago:row.valor});setPanel(true)}}
            style={{background:'var(--c-success)',color:'#fff',border:'none',borderRadius:'var(--r-md)',padding:'5px 12px',fontSize:'var(--fs-md)',fontWeight:600,cursor:'pointer'}}>
            Receber
          </button>
        ):null}
      />

      <SlidePanel open={panel} onClose={()=>setPanel(false)} title="Registrar Recebimento" width="sm"
        footer={<div style={{display:'flex',gap:10}}><Btn variant="secondary" style={{flex:1}} onClick={()=>setPanel(false)}>Cancelar</Btn><Btn style={{flex:1}} loading={saving} onClick={registrarPagamento}>✓ Confirmar</Btn></div>}>
        {faturaSel&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="ds-inset"><div style={{fontSize:'var(--fs-base)',color:'var(--t-secondary)',marginBottom:4}}>Fatura</div><div style={{fontWeight:700}}>{faturaSel.numero} — {fmt.money(faturaSel.valor)}</div></div>
          <FormField label="Forma de Pagamento">
            <select value={pagamento.forma_pagamento} onChange={e=>setPagamento(p=>({...p,forma_pagamento:e.target.value}))} className={selectCls}>
              {['pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia'].map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </FormField>
          <FormField label="Data do Pagamento">
            <input type="date" value={pagamento.data_pagamento} onChange={e=>setPagamento(p=>({...p,data_pagamento:e.target.value}))} className={inputCls} />
          </FormField>
          <FormField label="Valor Recebido (R$)">
            <input type="number" step="0.01" value={pagamento.valor_pago} onChange={e=>setPagamento(p=>({...p,valor_pago:Number(e.target.value)}))} className={inputCls} />
          </FormField>
        </div>}
      </SlidePanel>
    </div>
  )
}
