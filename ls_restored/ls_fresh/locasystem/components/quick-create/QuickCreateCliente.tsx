'use client'
import { validarDoc } from '@/lib/validators'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FormField, inputCls, selectCls, textareaCls, Btn, Tabs } from '@/components/ui'

// ── Máscaras ─────────────────────────────────────────────────
function maskPhone(v: string) { v=v.replace(/\D/g,'').slice(0,11); return v.length<=10?v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').replace(/-$/,''):v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'') }
function maskCPF(v: string)  { v=v.replace(/\D/g,'').slice(0,11); return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4').replace(/-$/,'') }
function maskCNPJ(v: string) { v=v.replace(/\D/g,'').slice(0,14); return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,'$1.$2.$3/$4-$5').replace(/-$/,'') }
function maskCEP(v: string)  { v=v.replace(/\D/g,'').slice(0,8); return v.replace(/(\d{5})(\d{0,3})/,'$1-$2').replace(/-$/,'') }
function maskDoc(v: string, tipo: string) { return tipo==='PJ'?maskCNPJ(v):maskCPF(v) }
function toTitle(str: string) { if(!str)return''; const m=new Set(['de','da','do','das','dos','e','a','o','em','com','por','para']); return str.toLowerCase().split(' ').map((w,i)=>(!m.has(w)||i===0)?w.charAt(0).toUpperCase()+w.slice(1):w).join(' ') }

const emptyEndereco = () => ({ tipo:'Comercial', cep:'', logradouro:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', ibge:'', principal:false, observacoes:'' })
const emptyContato  = () => ({ nome:'', cargo:'', telefone:'', celular:'', email:'', autorizado_retirada:false, principal:false, observacoes:'' })

interface Props {
  onClose: () => void
  onCreated: (row: any) => void
}

export default function QuickCreateCliente({ onClose, onCreated }: Props) {
  const [tab, setTab]           = useState('dados')
  const [saving, setSaving]     = useState(false)
  const [erro, setErro]         = useState('')
  const [loadingCNPJ, setLoadingCNPJ] = useState(false)
  const [loadingCEP, setLoadingCEP]   = useState<string|null>(null)
  const [tiposEnd, setTiposEnd] = useState<string[]>(['Comercial','Residencial','Entrega','Cobrança','Obra','Outro'])

  const [form, setForm] = useState<any>({
    tipo:'PF', nome:'', cpf_cnpj:'', rg_ie:'', email:'',
    telefone:'', celular:'', limite_credito:0, observacoes:'',
    endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', cep:'',
  })
  const [enderecos, setEnderecos] = useState<any[]>([emptyEndereco()])
  const [contatos, setContatos]   = useState<any[]>([emptyContato()])

  useEffect(() => {
    supabase.from('tipos_endereco').select('nome').eq('ativo',1).order('ordem')
      .then(({data}) => { if(data?.length) setTiposEnd(data.map(t=>t.nome)) })
  }, [])

  const F = (k: string) => ({ value: form[k]??'', onChange: (e:any) => setForm((f:any)=>({...f,[k]:e.target.value})) })

  // ── Busca CNPJ ─────────────────────────────────────────────
  async function buscarCNPJ(cnpj: string) {
    const d = cnpj.replace(/\D/g,''); if(d.length!==14)return
    setLoadingCNPJ(true); setErro('')
    try {
      const r = await fetch(`https://publica.cnpj.ws/cnpj/${d}`)
      if(!r.ok) throw new Error()
      const data = await r.json(); const est = data.estabelecimento
      const cepL = (est?.cep??'').replace(/\D/g,'')
      setForm((f:any)=>({...f,
        nome:toTitle(data.razao_social??''),
        email:(est?.email??'').toLowerCase(),
        telefone:est?.ddd1&&est?.telefone1?maskPhone(`${est.ddd1}${est.telefone1}`):f.telefone,
        cep:maskCEP(cepL), endereco:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),
        numero:est?.numero??'', complemento:toTitle(est?.complemento??''),
        bairro:toTitle(est?.bairro??''), cidade:toTitle(est?.cidade?.nome??''), estado:est?.estado?.sigla??'',
      }))
      setEnderecos([{tipo:'Comercial',cep:maskCEP(cepL),logradouro:toTitle(`${est?.tipo_logradouro??''} ${est?.logradouro??''}`.trim()),numero:est?.numero??'',complemento:toTitle(est?.complemento??''),bairro:toTitle(est?.bairro??''),cidade:toTitle(est?.cidade?.nome??''),estado:est?.estado?.sigla??'',ibge:est?.cidade?.ibge_id??'',principal:true,observacoes:''}])
    } catch { setErro('CNPJ não encontrado.') }
    setLoadingCNPJ(false)
  }

  // ── Busca CEP ───────────────────────────────────────────────
  async function buscarCEP(cep: string, target: 'main'|number) {
    const d = cep.replace(/\D/g,''); if(d.length!==8)return
    setLoadingCEP(String(target))
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const data = await r.json()
      if(data.erro) throw new Error()
      const logr=toTitle(data.logradouro??''), bai=toTitle(data.bairro??''), cid=toTitle(data.localidade??''), uf=data.uf??''
      if(target==='main') setForm((f:any)=>({...f,endereco:logr,bairro:bai,cidade:cid,estado:uf}))
      else setEnderecos(prev=>{ const a=[...prev]; a[target as number]={...a[target as number],logradouro:logr,bairro:bai,cidade:cid,estado:uf,ibge:data.ibge??''}; return a })
    } catch { setErro('CEP não encontrado.') }
    setLoadingCEP(null)
  }

  // ── Salvar ──────────────────────────────────────────────────
  async function salvar() {
    if(!form.nome?.trim()){ setErro('Nome é obrigatório!'); setTab('dados'); return }
    setSaving(true); setErro('')
    try {
      // Salvar cliente
      const payload = {
        tipo:form.tipo, nome:form.nome.trim(), cpf_cnpj:form.cpf_cnpj||null, rg_ie:form.rg_ie||null,
        email:form.email||null, telefone:form.telefone||null, celular:form.celular||null,
        limite_credito:Number(form.limite_credito)||0, observacoes:form.observacoes||null,
        endereco:form.endereco||null, numero:form.numero||null, complemento:form.complemento||null,
        bairro:form.bairro||null, cidade:form.cidade||null, estado:form.estado||null, cep:form.cep||null, ativo:1,
      }
      const { data, error } = await supabase.from('clientes').insert(payload).select('*').single()
      if(error) throw new Error(error.message)
      const clienteId = data.id

      // Salvar endereços auxiliares
      for(const end of enderecos) {
        if(!end.cep && !end.logradouro && !end.cidade) continue
        const { id: _, ...endData } = end
        await supabase.from('cliente_enderecos').insert({ ...endData, cliente_id:clienteId })
      }

      // Salvar contatos
      for(const ct of contatos) {
        if(!ct.nome?.trim()) continue
        const { id: _, ...ctData } = ct
        await supabase.from('cliente_contatos').insert({ ...ctData, cliente_id:clienteId })
      }

      setSaving(false)
      onCreated(data)
    } catch(e:any) {
      setErro('Erro: ' + e.message)
      setSaving(false)
    }
  }

  const panelTabs = [
    {key:'dados',     label:'Dados',     icon:'👤'},
    {key:'enderecos', label:'Endereços', icon:'📍'},
    {key:'contatos',  label:'Contatos',  icon:'📞'},
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="mb-4 border-b border-gray-100 -mx-6 px-6">
        <Tabs tabs={panelTabs} active={tab} onChange={setTab} />
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">
          {erro}
        </div>
      )}

      {/* ── DADOS ────────────────────────────────────────── */}
      {tab==='dados' && (
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tipo">
              <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,cpf_cnpj:''})} className={selectCls}>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </FormField>
            <FormField label={form.tipo==='PJ'?'CNPJ':'CPF'} className="col-span-2">
              <div className="flex gap-2">
                <input value={form.cpf_cnpj||''} onChange={e=>setForm({...form,cpf_cnpj:maskDoc(e.target.value,form.tipo)})} onBlur={e=>{if(form.tipo==='PJ')buscarCNPJ(e.target.value)}} className={`${inputCls} font-mono flex-1`} placeholder={form.tipo==='PJ'?'00.000.000/0001-00':'000.000.000-00'} />
                {form.tipo==='PJ'&&<Btn size="sm" variant="secondary" onClick={()=>buscarCNPJ(form.cpf_cnpj)} loading={loadingCNPJ}>🔍</Btn>}
              </div>
            </FormField>
          </div>

          <FormField label="Nome / Razão Social" required>
            <input {...F('nome')} className={inputCls} autoFocus placeholder="Nome completo ou razão social" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={form.tipo==='PJ'?'Insc. Estadual':'RG'}>
              <input {...F('rg_ie')} className={inputCls} />
            </FormField>
            <FormField label="Email">
              <input type="email" {...F('email')} onChange={e=>setForm({...form,email:e.target.value.toLowerCase()})} className={inputCls} />
            </FormField>
            <FormField label="Telefone">
              <input value={form.telefone||''} onChange={e=>setForm({...form,telefone:maskPhone(e.target.value)})} className={inputCls} placeholder="(00) 0000-0000" />
            </FormField>
            <FormField label="Celular">
              <input value={form.celular||''} onChange={e=>setForm({...form,celular:maskPhone(e.target.value)})} className={inputCls} placeholder="(00) 00000-0000" />
            </FormField>
            <FormField label="Limite de Crédito (R$)" className="col-span-2">
              <input type="number" step="0.01" min="0" {...F('limite_credito')} className={inputCls} />
            </FormField>
          </div>

          {/* Endereço principal */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">📍 Endereço Principal</p>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="CEP">
                <input value={form.cep||''} onChange={e=>setForm({...form,cep:maskCEP(e.target.value)})} onBlur={e=>buscarCEP(e.target.value,'main')} className={inputCls} placeholder="00000-000" />
                {loadingCEP==='main'&&<p className="text-xs text-blue-500 mt-0.5">🔍 Buscando...</p>}
              </FormField>
              <FormField label="Endereço" className="col-span-2">
                <input {...F('endereco')} className={inputCls} />
              </FormField>
              <FormField label="Número"><input {...F('numero')} className={inputCls} /></FormField>
              <FormField label="Complemento"><input {...F('complemento')} className={inputCls} /></FormField>
              <FormField label="Bairro"><input {...F('bairro')} className={inputCls} /></FormField>
              <FormField label="Cidade" className="col-span-2"><input {...F('cidade')} className={inputCls} /></FormField>
              <FormField label="UF">
                <input value={form.estado||''} onChange={e=>setForm({...form,estado:e.target.value.toUpperCase().slice(0,2)})} className={inputCls} maxLength={2} placeholder="SP" />
              </FormField>
            </div>
          </div>

          <FormField label="Observações">
            <textarea {...F('observacoes')} rows={2} className={textareaCls} />
          </FormField>
        </div>
      )}

      {/* ── ENDEREÇOS ────────────────────────────────────── */}
      {tab==='enderecos' && (
        <div className="space-y-3 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-400">Endereços adicionais — entrega, obra, cobrança, etc.</p>
          {enderecos.map((end, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <select value={end.tipo} onChange={e=>{const a=[...enderecos];a[i].tipo=e.target.value;setEnderecos(a)}}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#FF6B35]">
                    {tiposEnd.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input type="checkbox" checked={!!end.principal}
                      onChange={e=>{const a=enderecos.map((x,j)=>({...x,principal:j===i?e.target.checked:false}));setEnderecos(a)}}
                      className="accent-[#FF6B35]" /> Principal
                  </label>
                </div>
                {enderecos.length>1&&(
                  <button onClick={()=>setEnderecos(prev=>prev.filter((_,j)=>j!==i))}
                    className="text-red-400 hover:text-red-600 text-sm">× Remover</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CEP</label>
                  <input value={end.cep||''} onChange={e=>{const a=[...enderecos];a[i].cep=maskCEP(e.target.value);setEnderecos(a)}} onBlur={e=>buscarCEP(e.target.value,i)} className={inputCls} placeholder="00000-000" />
                  {loadingCEP===String(i)&&<p className="text-xs text-blue-500 mt-0.5">🔍 Buscando...</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Logradouro</label>
                  <input value={end.logradouro||''} onChange={e=>{const a=[...enderecos];a[i].logradouro=e.target.value;setEnderecos(a)}} className={inputCls} />
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Número</label><input value={end.numero||''} onChange={e=>{const a=[...enderecos];a[i].numero=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Complemento</label><input value={end.complemento||''} onChange={e=>{const a=[...enderecos];a[i].complemento=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Bairro</label><input value={end.bairro||''} onChange={e=>{const a=[...enderecos];a[i].bairro=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label><input value={end.cidade||''} onChange={e=>{const a=[...enderecos];a[i].cidade=e.target.value;setEnderecos(a)}} className={inputCls} /></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">UF</label>
                  <input value={end.estado||''} onChange={e=>{const a=[...enderecos];a[i].estado=e.target.value.toUpperCase().slice(0,2);setEnderecos(a)}} className={inputCls} maxLength={2} placeholder="SP" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>setEnderecos(prev=>[...prev,emptyEndereco()])}
            className="w-full border-2 border-dashed border-gray-200 hover:border-[#FF6B35] text-gray-400 hover:text-[#FF6B35] py-3 rounded-xl text-sm font-medium transition-colors">
            + Adicionar Endereço
          </button>
        </div>
      )}

      {/* ── CONTATOS ─────────────────────────────────────── */}
      {tab==='contatos' && (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {contatos.map((ct, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input type="checkbox" checked={!!ct.principal}
                      onChange={e=>{const a=contatos.map((x,j)=>({...x,principal:j===i?e.target.checked:false}));setContatos(a)}}
                      className="accent-[#FF6B35]" /> Principal
                  </label>
                  <label className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${ct.autorizado_retirada?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <input type="checkbox" checked={!!ct.autorizado_retirada}
                      onChange={e=>{const a=[...contatos];a[i].autorizado_retirada=e.target.checked;setContatos(a)}}
                      className="accent-green-500" />
                    {ct.autorizado_retirada?'✅':'⬜'} Autorizado a Retirar
                  </label>
                </div>
                {contatos.length>1&&(
                  <button onClick={()=>setContatos(prev=>prev.filter((_,j)=>j!==i))}
                    className="text-red-400 hover:text-red-600 text-sm">× Remover</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label><input value={ct.nome||''} onChange={e=>{const a=[...contatos];a[i].nome=e.target.value;setContatos(a)}} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Cargo / Função</label><input value={ct.cargo||''} onChange={e=>{const a=[...contatos];a[i].cargo=e.target.value;setContatos(a)}} className={inputCls} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Celular</label><input value={ct.celular||''} onChange={e=>{const a=[...contatos];a[i].celular=maskPhone(e.target.value);setContatos(a)}} className={inputCls} placeholder="(00) 00000-0000" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label><input value={ct.telefone||''} onChange={e=>{const a=[...contatos];a[i].telefone=maskPhone(e.target.value);setContatos(a)}} className={inputCls} placeholder="(00) 0000-0000" /></div>
                <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={ct.email||''} onChange={e=>{const a=[...contatos];a[i].email=e.target.value.toLowerCase();setContatos(a)}} className={inputCls} /></div>
                <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label><input value={ct.observacoes||''} onChange={e=>{const a=[...contatos];a[i].observacoes=e.target.value;setContatos(a)}} className={inputCls} /></div>
              </div>
            </div>
          ))}
          <button onClick={()=>setContatos(prev=>[...prev,emptyContato()])}
            className="w-full border-2 border-dashed border-gray-200 hover:border-[#FF6B35] text-gray-400 hover:text-[#FF6B35] py-3 rounded-xl text-sm font-medium transition-colors">
            + Adicionar Contato
          </button>
        </div>
      )}

      {/* Footer fixo */}
      <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100 flex-shrink-0">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Btn>
        <Btn className="flex-1" loading={saving} onClick={salvar}>✓ Criar Cliente</Btn>
      </div>
    </div>
  )
}
