'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FormField, inputCls, selectCls, Btn } from '@/components/ui'

interface Props { onClose: () => void; onCreated: (row: any) => void }

export default function QuickCreateProduto({ onClose, onCreated }: Props) {
  const [form, setForm]   = useState({ nome:'', categoria_id:'', marca:'', controla_patrimonio:1, unidade:'un', preco_locacao_diario:0, custo_reposicao:0 })
  const [cats, setCats]   = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro]   = useState('')

  useEffect(()=>{supabase.from('categorias').select('id,nome').eq('ativo',1).order('nome').then(({data})=>setCats(data??[]))},[])

  async function salvar() {
    if(!form.nome.trim()){setErro('Nome é obrigatório!');return}
    setSaving(true); setErro('')
    const {data,error} = await supabase.from('produtos').insert({
      nome:form.nome, categoria_id:form.categoria_id||null, marca:form.marca||null,
      controla_patrimonio:Number(form.controla_patrimonio), unidade:form.unidade,
      preco_locacao_diario:Number(form.preco_locacao_diario)||0,
      custo_reposicao:Number(form.custo_reposicao)||0, ativo:1
    }).select('*').single()
    if(error){setErro(error.message);setSaving(false);return}
    onCreated(data)
  }

  return (
    <div className="space-y-4">
      {erro&&<div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">{erro}</div>}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Nome do Produto" required className="col-span-2">
          <input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className={inputCls} autoFocus />
        </FormField>
        <FormField label="Categoria">
          <select value={form.categoria_id} onChange={e=>setForm({...form,categoria_id:e.target.value})} className={selectCls}>
            <option value="">Sem categoria</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </FormField>
        <FormField label="Marca"><input value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} className={inputCls} /></FormField>
        <FormField label="Controle de Estoque">
          <select value={form.controla_patrimonio} onChange={e=>setForm({...form,controla_patrimonio:Number(e.target.value)})} className={selectCls}>
            <option value={1}>Por Patrimônio</option>
            <option value={0}>Por Quantidade</option>
          </select>
        </FormField>
        <FormField label="Preço Diário (R$)">
          <input type="number" step="0.01" min="0" value={form.preco_locacao_diario} onChange={e=>setForm({...form,preco_locacao_diario:Number(e.target.value)})} className={inputCls} />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Btn>
        <Btn className="flex-1" loading={saving} onClick={salvar}>✓ Criar Produto</Btn>
      </div>
      <p className="text-xs text-gray-400 text-center mt-1">Complete o cadastro depois em <strong>Equipamentos</strong>.</p>
    </div>
  )
}
