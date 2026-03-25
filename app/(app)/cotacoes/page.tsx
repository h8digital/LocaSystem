'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PageHeader, DataTable, Filters, Badge, ActionButtons, Btn } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

export default function CotacoesPage() {
  const router = useRouter()
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string,string>>({ busca:'', status:'' })

  async function load() {
    setLoading(true)
    let q = supabase.from('cotacoes')
      .select('*, clientes(nome), usuarios(nome), periodos_locacao(nome)')
      .order('created_at', { ascending: false })
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.busca)  q = q.ilike('numero', `%${filters.busca}%`)
    const { data } = await q.limit(100)
    setLista(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filters])

  async function excluir(id: number) {
    if (!confirm('Excluir esta cotação?')) return
    await supabase.from('cotacao_itens').delete().eq('cotacao_id', id)
    await supabase.from('cotacoes').delete().eq('id', id)
    load()
  }

  async function enviarCliente(row: any) {
    // Gerar token de aprovação
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2,'0')).join('')
    await supabase.from('cotacoes').update({
      status: 'aguardando',
      token_aprovacao: token,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    const link = `${window.location.origin}/cotacao/${token}`
    await navigator.clipboard.writeText(link)
    alert(`✅ Link copiado para a área de transferência!\n\n${link}`)
    load()
  }

  async function converter(row: any) {
    if (!confirm(`Converter cotação ${row.numero} em contrato?`)) return
    const r = await fetch('/api/cotacoes/converter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotacao_id: row.id }),
    })
    const d = await r.json()
    if (d.error) return alert('Erro: ' + d.error)
    if (confirm(`✅ Contrato ${d.numero} criado! Deseja abri-lo?`))
      router.push(`/contratos/${d.contrato_id}`)
    else load()
  }

  const statusOpts = [
    {value:'rascunho',label:'Rascunho'},
    {value:'aguardando',label:'Aguardando'},
    {value:'aprovada',label:'Aprovada'},
    {value:'recusada',label:'Recusada'},
    {value:'expirada',label:'Expirada'},
    {value:'convertida',label:'Convertida'},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <PageHeader
        title="📋 Cotações"
        subtitle={`${lista.length} cotação(ões)`}
        actions={<Btn onClick={()=>router.push('/cotacoes/criar')}>+ Nova Cotação</Btn>}
      />

      <Filters
        fields={[
          {type:'text',   key:'busca',  placeholder:'Buscar por número...', width:'240px'},
          {type:'select', key:'status', placeholder:'Todos os status', options:statusOpts},
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f=>({...f,[k]:v}))}
        onClear={() => setFilters({busca:'',status:''})}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhuma cotação encontrada."
        columns={[
          {key:'numero',  label:'Nº', render:r=><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:'var(--fs-md)',color:'var(--c-primary)'}}>{r.numero}</span>},
          {key:'cliente', label:'Cliente', render:r=><span style={{fontWeight:500}}>{r.clientes?.nome??'—'}</span>},
          {key:'periodo', label:'Período', render:r=><span style={{fontSize:'var(--fs-md)',color:'var(--t-secondary)'}}>{r.periodos_locacao?.nome??'—'}</span>},
          {key:'data_inicio',   label:'Início',   render:r=>fmt.date(r.data_inicio)||'—'},
          {key:'data_fim',      label:'Fim',      render:r=>fmt.date(r.data_fim)||'—'},
          {key:'data_validade', label:'Validade', render:r=>{
            const vencida = r.status==='rascunho'||r.status==='aguardando' ? new Date(r.data_validade) < new Date() : false
            return <span style={{color:vencida?'var(--c-danger)':undefined,fontWeight:vencida?600:400}}>{fmt.date(r.data_validade)}</span>
          }},
          {key:'total', label:'Total', align:'right', render:r=><span style={{fontWeight:700}}>{fmt.money(r.total)}</span>},
          {key:'status', label:'Status', render:r=><StatusBadge s={r.status}/>},
        ]}
        data={lista}
        onRowClick={row => router.push(`/cotacoes/${row.id}`)}
        actions={row => {
          const sec: AcaoSecundaria[] = []
          if (['rascunho','aguardando'].includes(row.status))
            sec.push({ label:'Enviar ao Cliente', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, onClick:()=>enviarCliente(row), grupo:1 })
          if (['aprovada','aguardando','rascunho'].includes(row.status) && !row.contrato_id)
            sec.push({ label:'Converter em Contrato', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>, onClick:()=>converter(row), grupo:1 })
          if (row.contrato_id)
            sec.push({ label:'Ver Contrato', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, onClick:()=>router.push(`/contratos/${row.contrato_id}`), grupo:1 })
          if (['rascunho'].includes(row.status))
            sec.push({ label:'Excluir Cotação', onClick:()=>excluir(row.id), grupo:2, destrutivo:true })
          return (
            <ActionButtons
              onView={()=>router.push(`/cotacoes/${row.id}`)}
              onEdit={['rascunho'].includes(row.status)?()=>router.push(`/cotacoes/${row.id}`):undefined}
              acoesSec={sec}
            />
          )
        }}
      />
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string,[string,string]> = {
    rascunho:   ['ds-badge ds-badge-gray',   'Rascunho'],
    aguardando: ['ds-badge ds-badge-yellow', 'Aguardando'],
    aprovada:   ['ds-badge ds-badge-green',  'Aprovada'],
    recusada:   ['ds-badge ds-badge-red',    'Recusada'],
    expirada:   ['ds-badge ds-badge-gray',   'Expirada'],
    convertida: ['ds-badge ds-badge-blue',   'Convertida'],
  }
  const [cls, label] = map[s] ?? ['ds-badge ds-badge-gray', s]
  return <span className={cls}><span className="ds-badge-dot"/>{label}</span>
}
