'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { SlidePanel, PageHeader, DataTable, Filters, Badge, ActionButtons, Btn, FormField, inputCls } from '@/components/ui'
import type { AcaoSecundaria } from '@/components/ui/ActionButtons'
import { formatarPhone } from '@/lib/validators'

// ─── Definição dos perfis ─────────────────────────────────────────────────────
const PERFIS = [
  { value:'admin',    label:'Administrador', cor:'red'    },
  { value:'gerente',  label:'Gerente',       cor:'yellow' },
  { value:'operador', label:'Operador',      cor:'blue'   },
  { value:'vendedor', label:'Vendedor',      cor:'green'  },
]

// helpers
const labelPerfil  = (v: string) => PERFIS.find(p => p.value === v)?.label ?? v
const corPerfil    = (v: string) => PERFIS.find(p => p.value === v)?.cor ?? 'gray'
const parsePerfis  = (s: string) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean)
const joinPerfis   = (arr: string[]) => arr.join(',')

// ─── Componente de tags de perfil ────────────────────────────────────────────
function PerfilTags({ perfis, size = 'md' }: { perfis: string[]; size?: 'sm' | 'md' }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      {perfis.map(p => (
        <span key={p} className={`ds-badge ds-badge-${corPerfil(p)}`}
          style={{ fontSize: size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)' }}>
          {labelPerfil(p)}
        </span>
      ))}
    </div>
  )
}

// ─── Seletor multi-perfil ────────────────────────────────────────────────────
function PerfilSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(valor: string) {
    if (selected.includes(valor)) {
      onChange(selected.filter(v => v !== valor))
    } else {
      onChange([...selected, valor])
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {PERFIS.map(p => {
        const ativo = selected.includes(p.value)
        return (
          <label key={p.value} onClick={() => toggle(p.value)} style={{
            display:'flex', alignItems:'center', gap:10, cursor:'pointer',
            border:`2px solid ${ativo ? 'var(--c-primary)' : 'var(--border)'}`,
            borderRadius:'var(--r-md)', padding:'8px 12px',
            background: ativo ? 'var(--c-primary-light)' : 'var(--bg-card)',
            transition:'all 150ms',
          }}>
            <div style={{
              width:18, height:18, borderRadius:4, flexShrink:0,
              border:`2px solid ${ativo ? 'var(--c-primary)' : 'var(--border)'}`,
              background: ativo ? 'var(--c-primary)' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {ativo && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:'var(--fs-base)', color:'var(--t-primary)' }}>{p.label}</div>
            </div>
            <span className={`ds-badge ds-badge-${p.cor}`} style={{ fontSize:'var(--fs-xs)' }}>
              {p.value}
            </span>
          </label>
        )
      })}
      {selected.length === 0 && (
        <div style={{ fontSize:'var(--fs-md)', color:'var(--c-danger)', marginTop:2 }}>
          Selecione pelo menos um perfil.
        </div>
      )}
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const [lista,    setLista]   = useState<any[]>([])
  const [loading,  setLoading] = useState(true)
  const [filters,  setFilters] = useState<Record<string,string>>({ busca:'', perfil:'' })
  const [panel,    setPanel]   = useState(false)
  const [editId,   setEditId]  = useState<number|null>(null)
  const [saving,   setSaving]  = useState(false)
  const [erro,     setErro]    = useState('')

  const [form, setForm] = useState<any>({
    nome:'', email:'', perfis:['operador'], comissao_percentual:0,
    telefone:'', ativo:1, senha:''
  })

  async function load() {
    setLoading(true)
    let q = supabase.from('usuarios').select('*').order('nome')
    if (filters.busca)  q = q.ilike('nome', `%${filters.busca}%`)
    if (filters.perfil) q = q.ilike('perfil', `%${filters.perfil}%`)
    const { data } = await q
    setLista(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filters])

  function abrir(u?: any) {
    setErro('')
    if (u) {
      setForm({ ...u, perfis: parsePerfis(u.perfil), senha: '' })
    } else {
      setForm({ nome:'', email:'', perfis:['operador'], comissao_percentual:0, telefone:'', ativo:1, senha:'' })
    }
    setEditId(u?.id ?? null)
    setPanel(true)
  }

  async function salvar() {
    if (!form.nome)            { setErro('Nome é obrigatório.'); return }
    if (!form.email)           { setErro('E-mail é obrigatório.'); return }
    if (form.perfis.length===0){ setErro('Selecione pelo menos um perfil.'); return }
    if (!editId && !form.senha){ setErro('Senha obrigatória para novo usuário.'); return }
    if (form.senha && form.senha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres.'); return }
    setSaving(true); setErro('')

    const payload: any = {
      nome:               form.nome,
      email:              form.email,
      perfil:             joinPerfis(form.perfis),   // salva como "admin,vendedor"
      comissao_percentual:Number(form.comissao_percentual) || 0,
      telefone:           form.telefone || null,
      ativo:              Number(form.ativo),
    }
    if (form.senha) {
      const res = await fetch('/api/auth/hash', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ senha: form.senha }) })
      const { hash } = await res.json()
      payload.senha = hash
    }
    const { error } = editId
      ? await supabase.from('usuarios').update(payload).eq('id', editId)
      : await supabase.from('usuarios').insert(payload)
    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    setSaving(false); setPanel(false); load()
  }

  async function toggleAtivo(u: any) {
    await supabase.from('usuarios').update({ ativo: u.ativo ? 0 : 1 }).eq('id', u.id)
    load()
  }

  const ativos   = lista.filter(u => u.ativo).length
  const inativos = lista.filter(u => !u.ativo).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <PageHeader
        title="Usuários"
        subtitle={`${ativos} ativo(s)${inativos ? ` · ${inativos} inativo(s)` : ''}`}
        actions={<Btn onClick={() => abrir()}>+ Novo Usuário</Btn>}
      />

      <Filters
        fields={[
          { type:'text',   key:'busca',  placeholder:'Buscar por nome ou e-mail...', width:'280px' },
          { type:'select', key:'perfil', placeholder:'Todos os perfis',
            options: PERFIS.map(p => ({ value: p.value, label: p.label })) },
        ]}
        values={filters}
        onChange={(k,v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca:'', perfil:'' })}
      />

      <DataTable
        loading={loading}
        emptyMessage="Nenhum usuário cadastrado."
        columns={[
          { key:'nome', label:'Usuário', render: r => (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:32, height:32, borderRadius:'50%',
                background:'var(--c-primary)', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'var(--fs-base)', fontWeight:700, flexShrink:0
              }}>{r.nome.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight:600 }}>{r.nome}</div>
                <div style={{ fontSize:'var(--fs-md)', color:'var(--t-muted)' }}>{r.email}</div>
              </div>
            </div>
          )},
          { key:'perfil', label:'Perfis', render: r => (
            <PerfilTags perfis={parsePerfis(r.perfil)} size="sm" />
          )},
          { key:'comissao', label:'Comissão', align:'right', render: r => (
            <span style={{ fontWeight:700, color: Number(r.comissao_percentual) > 0 ? 'var(--c-primary)' : 'var(--t-muted)' }}>
              {Number(r.comissao_percentual).toFixed(1)}%
            </span>
          )},
          { key:'telefone',    label:'Telefone',      render: r => r.telefone || '—' },
          { key:'ultimo_login',label:'Último Acesso', render: r => r.ultimo_login ? fmt.datetime(r.ultimo_login) : <span style={{color:'var(--t-muted)'}}>Nunca</span> },
          { key:'ativo',       label:'Status',        render: r => <Badge value={r.ativo ? 'ativo' : 'inativo'} dot /> },
        ]}
        data={lista}
        onRowClick={row => abrir(row)}
        actions={row => {
          const sec: AcaoSecundaria[] = [
            row.ativo
              ? { label:'Desativar Usuário', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>, onClick:()=>toggleAtivo(row), grupo:1, destrutivo:false }
              : { label:'Ativar Usuário',    icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>, onClick:()=>toggleAtivo(row), grupo:1 },
          ]
          return <ActionButtons onEdit={() => abrir(row)} acoesSec={sec} />
        }}
      />

      <SlidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title={editId ? 'Editar Usuário' : 'Novo Usuário'}
        subtitle={editId ? form.email : 'Preencha os dados do usuário'}
        width="sm"
        footer={
          <div style={{ display:'flex', gap:10, width:'100%' }}>
            <Btn variant="secondary" style={{ flex:1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex:2 }} loading={saving} onClick={salvar}>
              {editId ? 'Atualizar' : 'Criar Usuário'}
            </Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom:14 }}>{erro}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <FormField label="Nome Completo" required>
            <input value={form.nome} onChange={e => setForm({...form, nome:e.target.value})}
              className={inputCls} autoFocus />
          </FormField>

          <FormField label="E-mail" required>
            <input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})}
              className={inputCls} placeholder="usuario@empresa.com" />
          </FormField>

          <FormField label="Telefone">
            <input value={form.telefone || ''}
              onChange={e => setForm({...form, telefone: formatarPhone(e.target.value)})}
              className={inputCls} placeholder="(00) 00000-0000" />
          </FormField>

          {/* Perfis — seleção múltipla */}
          <div>
            <div className="ds-label" style={{ marginBottom:8 }}>Perfis de Acesso</div>
            <PerfilSelector
              selected={form.perfis ?? []}
              onChange={perfis => setForm({...form, perfis})}
            />
          </div>

          <FormField label="Comissão (%)" hint="Percentual sobre vendas">
            <input type="number" step="0.01" min="0" max="100"
              value={form.comissao_percentual}
              onChange={e => setForm({...form, comissao_percentual:e.target.value})}
              className={inputCls} />
          </FormField>

          <FormField
            label={editId ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
            required={!editId}
            hint="Mínimo 6 caracteres"
          >
            <input type="password" value={form.senha}
              onChange={e => setForm({...form, senha:e.target.value})}
              className={inputCls} placeholder="••••••••" minLength={6} />
          </FormField>

          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'var(--fs-base)' }}>
            <input type="checkbox" checked={!!form.ativo}
              onChange={e => setForm({...form, ativo: e.target.checked ? 1 : 0})}
              style={{ accentColor:'var(--c-primary)', width:14, height:14 }} />
            <span style={{ fontWeight:500, color:'var(--t-secondary)' }}>Usuário ativo no sistema</span>
          </label>
        </div>
      </SlidePanel>
    </div>
  )
}
