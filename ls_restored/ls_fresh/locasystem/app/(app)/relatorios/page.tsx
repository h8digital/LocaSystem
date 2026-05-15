'use client'
import { useEffect, useState } from 'react'
import { Btn } from '@/components/ui'
import { supabase, fmt } from '@/lib/supabase'

export default function RelatoriosPage() {
  const [rel, setRel] = useState('receita')
  const [de, setDe] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [ate, setAte] = useState(new Date().toISOString().split('T')[0])
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  async function gerar() {
    setLoading(true)
    let data: any[] = []

    if (rel === 'receita') {
      const { data: d } = await supabase.from('faturas').select('numero, valor_pago, data_pagamento, forma_pagamento, contratos(numero, clientes(nome))').eq('status', 'pago').gte('data_pagamento', de).lte('data_pagamento', ate).order('data_pagamento', { ascending: false })
      data = d ?? []
      setTotal(data.reduce((s, f) => s + Number(f.valor_pago), 0))
    } else if (rel === 'inadimplencia') {
      const { data: d } = await supabase.from('faturas').select('numero, valor, data_vencimento, contratos(numero, clientes(nome, celular))').in('status', ['vencido', 'pendente']).lt('data_vencimento', new Date().toISOString().split('T')[0]).order('data_vencimento')
      data = d ?? []
      setTotal(data.reduce((s, f) => s + Number(f.valor), 0))
    } else if (rel === 'contratos') {
      const { data: d } = await supabase.from('contratos').select('numero, status, data_inicio, data_fim, total, comissao_valor, clientes(nome), usuarios(nome)').gte('data_inicio', de).lte('data_inicio', ate).order('data_inicio', { ascending: false })
      data = d ?? []
      setTotal(data.reduce((s, c) => s + Number(c.total), 0))
    } else if (rel === 'manutencoes') {
      const { data: d } = await supabase.from('manutencoes').select('id, tipo, status, data_abertura, data_conclusao, custo, descricao, produtos(nome), patrimonios(numero_patrimonio)').gte('data_abertura', de).lte('data_abertura', ate).order('data_abertura', { ascending: false })
      data = d ?? []
      setTotal(data.reduce((s, m) => s + Number(m.custo), 0))
    } else if (rel === 'comissoes') {
      const { data: d } = await supabase.from('usuarios').select('nome, comissao_percentual, contratos(total, comissao_valor, status, data_inicio)').eq('ativo', 1)
      data = (d ?? []).map((u: any) => {
        const cts = (u.contratos ?? []).filter((c: any) => c.status !== 'cancelado' && c.data_inicio >= de && c.data_inicio <= ate)
        return { nome: u.nome, comissao_percentual: u.comissao_percentual, total_contratos: cts.length, volume: cts.reduce((s: number, c: any) => s + Number(c.total), 0), comissao: cts.reduce((s: number, c: any) => s + Number(c.comissao_valor), 0) }
      }).sort((a: any, b: any) => b.comissao - a.comissao)
      setTotal(data.reduce((s, r) => s + r.comissao, 0))
    }

    setDados(data)
    setLoading(false)
  }

  useEffect(() => { gerar() }, [rel, de, ate])

  const cols: Record<string, string[]> = {
    receita: ['Data','Fatura','Contrato','Cliente','Valor','Forma Pag.'],
    inadimplencia: ['Cliente','Contato','Fatura','Contrato','Valor','Vencimento','Atraso'],
    contratos: ['Nº','Cliente','Vendedor','Início','Fim','Total','Comissão','Status'],
    manutencoes: ['#','Equipamento','Patrimônio','Tipo','Abertura','Conclusão','Custo','Status'],
    comissoes: ['Vendedor','Comissão %','Contratos','Volume','Total Comissão'],
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="ds-page-title">Relatórios</h1>
        <button onClick={() => window.print()} className="border border-gray-200 text-secondary-color hover:  font-medium px-4 py-2.5 rounded-lg">🖨️ Imprimir</button>
      </div>

      <div className="ds-card p-4 mb-4 print:hidden">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block  font-semibold text-secondary-color mb-1">Relatório</label>
            <select value={rel} onChange={e => setRel(e.target.value)} className="ds-input">
              <option value="receita">Receita por Período</option>
              <option value="inadimplencia">Inadimplência</option>
              <option value="contratos">Contratos por Período</option>
              <option value="manutencoes">Manutenções</option>
              <option value="comissoes">Comissões de Vendedores</option>
            </select>
          </div>
          {rel !== 'inadimplencia' && <>
            <div><label className="block  font-semibold text-secondary-color mb-1">De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} className="ds-input" /></div>
            <div><label className="block  font-semibold text-secondary-color mb-1">Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} className="ds-input" /></div>
          </>}
          <button onClick={gerar} className="ds-btn ds-btn-primary">Gerar</button>
        </div>
      </div>

      {total > 0 && <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 mb-4 flex items-center justify-between"><span className=" font-medium text-orange-700">{dados.length} registro(s)</span><span className="font-black text-orange-700 text-lg">{fmt.money(total)}</span></div>}

      <div className="ds-card">
        <div style={{overflowX:"auto"}}>
          <table className="w-full ">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {cols[rel].map(h => <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-muted-color uppercase tracking-wide whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="text-center py-8 text-muted-color">Gerando relatório...</td></tr>
              : dados.length === 0 ? <tr><td colSpan={10} className="text-center py-8 text-muted-color">Nenhum dado encontrado.</td></tr>
              : rel === 'receita' ? dados.map((f,i) => <tr key={i} data-clickable="true"><td className="px-4 py-3 text-secondary-color">{fmt.date(f.data_pagamento)}</td><td className="px-4 py-3 font-medium">{f.numero}</td><td className="px-4 py-3 text-secondary-color">{f.contratos?.numero}</td><td className="px-4 py-3">{f.contratos?.clientes?.nome}</td><td className="px-4 py-3 font-bold text-apple-green">{fmt.money(f.valor_pago)}</td><td className="px-4 py-3 text-secondary-color">{f.forma_pagamento}</td></tr>)
              : rel === 'inadimplencia' ? dados.map((f,i) => { const dias = Math.ceil((new Date().getTime() - new Date(f.data_vencimento).getTime()) / 86400000); return <tr key={i} data-clickable="true"><td className="px-4 py-3 font-medium">{f.contratos?.clientes?.nome}</td><td className="px-4 py-3 text-secondary-color">{f.contratos?.clientes?.celular || '—'}</td><td className="px-4 py-3">{f.numero}</td><td className="px-4 py-3 text-secondary-color">{f.contratos?.numero}</td><td className="px-4 py-3 font-bold text-apple-red">{fmt.money(f.valor)}</td><td className="px-4 py-3 text-red-500">{fmt.date(f.data_vencimento)}</td><td className="px-4 py-3"><span className="bg-red-100 text-red-700  font-bold px-2 py-1 rounded-full">{dias}d</span></td></tr> })
              : rel === 'contratos' ? dados.map((c,i) => <tr key={i} data-clickable="true"><td className="px-4 py-3 font-bold">{c.numero}</td><td className="px-4 py-3">{c.clientes?.nome}</td><td className="px-4 py-3 text-secondary-color">{c.usuarios?.nome}</td><td className="px-4 py-3 text-secondary-color">{fmt.date(c.data_inicio)}</td><td className="px-4 py-3 text-secondary-color">{fmt.date(c.data_fim)}</td><td className="px-4 py-3 font-bold">{fmt.money(c.total)}</td><td className="px-4 py-3 text-orange-600">{fmt.money(c.comissao_valor)}</td><td className="px-4 py-3"><span className="  px-2 py-1 rounded-full">{c.status}</span></td></tr>)
              : rel === 'manutencoes' ? dados.map((m,i) => <tr key={i} data-clickable="true"><td className="px-4 py-3 text-muted-color">#{m.id}</td><td className="px-4 py-3 font-medium">{m.produtos?.nome}</td><td className="px-4 py-3 text-secondary-color">{m.patrimonios?.numero_patrimonio || '—'}</td><td className="px-4 py-3 text-secondary-color">{m.tipo}</td><td className="px-4 py-3 text-secondary-color">{fmt.date(m.data_abertura)}</td><td className="px-4 py-3 text-secondary-color">{fmt.date(m.data_conclusao)}</td><td className="px-4 py-3 font-medium">{fmt.money(m.custo)}</td><td className="px-4 py-3"><span className="  px-2 py-1 rounded-full">{m.status}</span></td></tr>)
              : dados.map((r,i) => <tr key={i} data-clickable="true"><td className="px-4 py-3 font-bold">{r.nome}</td><td className="px-4 py-3">{Number(r.comissao_percentual).toFixed(2)}%</td><td className="px-4 py-3">{r.total_contratos}</td><td className="px-4 py-3">{fmt.money(r.volume)}</td><td className="px-4 py-3 font-bold text-orange-600">{fmt.money(r.comissao)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  )
}
