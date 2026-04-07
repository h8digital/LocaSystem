'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, DataTable, Filters, Badge, Btn, ActionButtons } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'

export default function ContratosPage() {
  const [contratos, setContratos] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filters,   setFilters]   = useState<Record<string,string>>({ busca:'', status:'' })
  const [totais,    setTotais]    = useState({ total:0, ativos:0, valor:0, vencidos:0, pendente_manutencao:0 })
  const router = useRouter()

  async function load() {
    setLoading(true)
    let q = supabase
      .from('contratos')
      .select('*, clientes(nome), usuarios(nome)')
      .order('created_at', { ascending:false })
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.busca)  q = q.ilike('numero', `%${filters.busca}%`)
    const { data } = await q.limit(100)
    setContratos(data ?? [])

    const { data:tots } = await supabase.from('contratos').select('status, total, data_fim')
    setTotais({
      total:  tots?.length ?? 0,
      ativos: tots?.filter(c => c.status === 'ativo').length ?? 0,
      valor:  tots?.filter(c => c.status === 'ativo').reduce((s,c) => s + Number(c.total), 0) ?? 0,
      vencidos: tots?.filter(c => c.status === 'ativo' && c.data_fim && Math.floor((new Date().getTime()-new Date(c.data_fim+'T23:59:59').getTime())/86400000) > 0).length ?? 0,
      pendente_manutencao: tots?.filter(c => c.status === 'pendente_manutencao').length ?? 0,
    })
    setLoading(false)
  }
  useEffect(() => { load() }, [filters])

  // ── Ações por status ────────────────────────────────────────────────────────
  function acoesPara(row: any) {
    const ir        = () => router.push(`/contratos/${row.id}`)
    const encerrar  = () => router.push(`/contratos/${row.id}/encerrar`)
    const alterar   = () => router.push(`/contratos/${row.id}`)
    const devolucao = () => router.push(`/contratos/${row.id}/encerrar`)

    async function ativar() {
      if (!confirm(`Ativar o contrato ${row.numero}?\n\nIsso registrará a remessa e mudará o status para ATIVO.`)) return
      const res = await fetch('/api/contratos/ativar', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contrato_id: row.id }) })
      const data = await res.json()
      if (!data.ok) { alert(`Erro: ${data.error}`); return }
      alert(data.msg); load()
    }

    async function cancelar() {
      if (!confirm(`Cancelar o contrato ${row.numero}?`)) return
      await supabase.from('contratos').update({ status:'cancelado' }).eq('id', row.id)
      load()
    }

    async function excluir() {
      if (!confirm(`Excluir o contrato ${row.numero}?\n\nTodos os itens, faturas e documentos vinculados serão removidos.\nEsta ação é irreversível.`)) return
      try {
        // 1. Liberar patrimônios que estavam reservados neste contrato
        const { data: itens } = await supabase
          .from('contrato_itens')
          .select('patrimonio_id')
          .eq('contrato_id', row.id)
          .not('patrimonio_id', 'is', null)
        if (itens && itens.length > 0) {
          const ids = itens.map((i: any) => i.patrimonio_id).filter(Boolean)
          if (ids.length > 0) {
            await supabase.from('patrimonios')
              .update({ status: 'disponivel' })
              .in('id', ids)
          }
        }
        // 2. Excluir o contrato — CASCADE remove automaticamente:
        //    contrato_itens, faturas, fatura_recebimentos, devolucoes,
        //    doc_gerados, email_log, manutencoes, contrato_timeline, contrato_aprovacoes
        const { error } = await supabase.from('contratos').delete().eq('id', row.id)
        if (error) { alert(`Erro ao excluir: ${error.message}`); return }
        load()
      } catch(e: any) {
        alert(`Erro inesperado: ${e.message}`)
      }
    }

    // Ações secundárias variam por status
    const sec: AcaoSecundaria[] = []

    if (row.status === 'ativo') {
      sec.push(
        { label:'Registrar Devolução', onClick: devolucao, grupo:1 },
        { label:'Alterar Contrato',    onClick: alterar,   grupo:1 },
        { label:'Encerrar Contrato',   onClick: encerrar,  grupo:2 },
        { label:'Cancelar Contrato',   onClick: cancelar,  grupo:2, destrutivo:true },
      )
    }

    if (row.status === 'rascunho') {
      sec.push(
        { label:'Ativar Contrato',   onClick: ativar,  grupo:1 },
        { label:'Alterar Contrato',  onClick: alterar,  grupo:1 },
        { label:'Excluir Contrato',  onClick: excluir,  grupo:2, destrutivo:true },
      )
    }
    if (row.status === 'em_devolucao') {
      sec.push(
        { label:'Continuar Check-in', onClick: devolucao, grupo:1 },
      )
    }
    if (row.status === 'pendente_manutencao') {
      sec.push(
        { label:'Verificar OS / Encerrar', onClick: encerrar, grupo:1 },
      )
    }

    if (row.status === 'encerrado') {
      sec.push(
        { label:'Ver Devoluções', onClick: devolucao, grupo:1 },
      )
    }

    if (row.status === 'cancelado') {
      sec.push(
        { label:'Excluir Contrato', onClick: excluir, grupo:1, destrutivo:true },
      )
    }

    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <button
          onClick={() => router.push(`/contratos/${row.id}?aba=timeline`)}
          title="Anotações e Histórico"
          style={{
            padding:'5px 8px', borderRadius:'var(--r-sm)',
            border:'1px solid var(--border)', background:'var(--bg-card)',
            cursor:'pointer', fontSize:14, color:'var(--t-muted)',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .15s',
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--c-primary)';e.currentTarget.style.color='var(--c-primary)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--t-muted)'}}
        >
          💬
        </button>
        <ActionButtons
          onView={ir}
          acoesSec={sec}
        />
      </div>
    )
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <PageHeader
        title="Contratos"
        subtitle={`${totais.total} contrato(s) — ${totais.ativos} ativo(s)`}
        actions={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" onClick={() => router.push('/devolucoes')}>Registrar Devolução</Btn>
            <Link href="/contratos/criar"><Btn>+ Novo Contrato</Btn></Link>
          </div>
        }
      />

      {/* KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className="kpi-card">
          <div className="kpi-label">Total de Contratos</div>
          <div className="kpi-value">{totais.total}</div>
        </div>
        <div className="kpi-card kpi-card-success">
          <div className="kpi-label">Contratos Ativos</div>
          <div className="kpi-value" style={{color:'var(--c-success)'}}>{totais.ativos}</div>
        </div>
        <div className="kpi-card kpi-card-accent">
          <div className="kpi-label">Valor em Aberto</div>
          <div className="kpi-value" style={{color:'var(--c-primary)'}}>{fmt.money(totais.valor)}</div>
        </div>
        <div className={(totais.vencidos??0)>0?'kpi-card kpi-card-danger':'kpi-card'}>
          <div className="kpi-label">Retorno Vencido</div>
          <div className="kpi-value" style={{color:(totais.vencidos??0)>0?'var(--c-danger)':'var(--t-muted)'}}>{totais.vencidos??0}</div>
        </div>
        <div className={(totais.pendente_manutencao??0)>0?'kpi-card kpi-card-warning':'kpi-card'}>
          <div className="kpi-label">Pend. Manutenção</div>
          <div className="kpi-value" style={{color:(totais.pendente_manutencao??0)>0?'var(--c-warning)':'var(--t-muted)'}}>{totais.pendente_manutencao??0}</div>
        </div>
      </div>

      <Filters
        fields={[
          { type:'text',   key:'busca',  placeholder:'Buscar por número ou cliente...', width:'280px' },
          { type:'select', key:'status', placeholder:'Todos os status',
            options:['rascunho','ativo','encerrado','cancelado','inadimplente']
              .map(s => ({ value:s, label:s.charAt(0).toUpperCase()+s.slice(1) })) },
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f,[k]:v }))}
        onClear={() => setFilters({ busca:'', status:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhum contrato encontrado."
        columns={[
          { key:'numero', label:'Nº', render: r => (
            <span style={{ fontWeight:700, fontSize:'var(--fs-base)', fontFamily:'var(--font-mono)' }}>
              {r.numero}
            </span>
          )},
          { key:'cliente', label:'Cliente', render: r => (
            <span style={{ fontWeight:500 }}>{(r.clientes as any)?.nome ?? '—'}</span>
          )},
          { key:'vendedor', label:'Vendedor', render: r => (
            <span style={{ color:'var(--t-secondary)', fontSize:'var(--fs-base)' }}>
              {(r.usuarios as any)?.nome ?? '—'}
            </span>
          )},
          { key:'data_inicio', label:'Início', render: r => fmt.date(r.data_inicio) },
          { key:'data_fim',    label:'Fim',    render: r => fmt.date(r.data_fim) },
          { key:'total',  label:'Total',  align:'right', render: r => (
            <span style={{ fontWeight:700 }}>{fmt.money(r.total)}</span>
          )},
          { key:'status', label:'Status', render: r => (
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              <Badge value={r.status} dot />
              {r.status==='ativo'&&r.data_fim&&Math.floor((new Date().getTime()-new Date(r.data_fim+'T23:59:59').getTime())/86400000)>0&&(
                <span style={{fontSize:'var(--fs-sm)',fontWeight:700,color:'var(--c-danger)'}}>
                  ⚠ Vencido {Math.floor((new Date().getTime()-new Date(r.data_fim+'T23:59:59').getTime())/86400000)}d
                </span>
              )}
            </div>
          ) },
        ]}
        data={contratos}
        onRowClick={row => router.push(`/contratos/${row.id}`)}
        actions={row => acoesPara(row)}
      />
    </div>
  )
}
