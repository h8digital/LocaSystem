'use client'
import { useState } from 'react'
import { Btn, Badge, FormField, inputCls, selectCls, textareaCls, Tabs } from '@/components/ui'

const COLORS = [
  {name:'Primary',      bg:'#17A2B8',text:'#fff',token:'--c-primary'},
  {name:'Primary Light',bg:'#D1ECF1',text:'#0C5460',token:'--c-primary-light'},
  {name:'Success',      bg:'#28A745',text:'#fff',token:'--c-success'},
  {name:'Danger',       bg:'#DC3545',text:'#fff',token:'--c-danger'},
  {name:'Warning',      bg:'#FFC107',text:'#212529',token:'--c-warning'},
  {name:'Sidebar',      bg:'#1E2A38',text:'#fff',token:'--c-sidebar'},
  {name:'BG Page',      bg:'#F4F6F8',text:'#212529',token:'--bg'},
  {name:'BG Card',      bg:'#FFFFFF',text:'#212529',token:'--bg-card',border:true},
  {name:'BG Header',    bg:'#F8F9FA',text:'#495057',token:'--bg-header',border:true},
  {name:'Row Hover',    bg:'#E8F4F8',text:'#212529',token:'--bg-row-hover',border:true},
  {name:'T Primary',    bg:'#212529',text:'#fff',token:'--t-primary'},
  {name:'T Muted',      bg:'#6C757D',text:'#fff',token:'--t-muted'},
]

const BADGES = [
  {value:'ativo'},{value:'inativo'},{value:'rascunho'},
  {value:'pendente'},{value:'pago'},{value:'vencido'},
  {value:'cancelado'},{value:'parcial'},{value:'locado'},
  {value:'manutencao'},{value:'reservado'},{value:'concluido'},
  {value:'disponivel'},{value:'negativo',label:'negativado'},{value:'PF'},{value:'PJ'},
]

export default function DesignSystemPage() {
  const [tab, setTab] = useState('cores')

  return (
    <div>
      <div className="ds-page-header">
        <div>
          <div className="ds-page-title">🎨 Design System — LocaSystem v1.0</div>
          <div className="ds-page-subtitle">Referência visual e componentes — acesse em /design-system</div>
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        {key:'cores',label:'Cores',icon:'🎨'},
        {key:'tipografia',label:'Tipografia',icon:'🔤'},
        {key:'botoes',label:'Botões',icon:'🖱️'},
        {key:'inputs',label:'Inputs',icon:'✏️'},
        {key:'badges',label:'Badges',icon:'🏷️'},
        {key:'tabela',label:'Tabela',icon:'📊'},
        {key:'alertas',label:'Alertas',icon:'⚠️'},
      ]} />

      <div style={{marginTop:16,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:20,boxShadow:'var(--shadow-sm)'}}>

        {tab==='cores' && (
          <div>
            <div style={{fontSize:'var(--fs-sm)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--t-muted)',marginBottom:12}}>Paleta de Cores</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
              {COLORS.map(c=>(
                <div key={c.token} style={{border:`1px solid ${c.border?'var(--border)':'transparent'}`,borderRadius:'var(--r-sm)',overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
                  <div style={{background:c.bg,height:48,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:c.text,fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--font-mono)'}}>{c.bg}</span>
                  </div>
                  <div style={{background:'var(--bg-header)',padding:'5px 8px',borderTop:'1px solid var(--border)'}}>
                    <div style={{fontSize:'var(--fs-sm)',fontWeight:600,color:'var(--t-primary)'}}>{c.name}</div>
                    <div style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',fontFamily:'var(--font-mono)'}}>{c.token}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='tipografia' && (
          <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:700}}>
            {[
              {size:'28px',w:700,uso:'Heading grande'},
              {size:'20px',w:700,uso:'Heading médio'},
              {size:'15px',w:700,uso:'Page title (.ds-page-title)'},
              {size:'13px',w:700,uso:'Card title / label bold'},
              {size:'13px',w:500,uso:'Texto base do sistema / botões'},
              {size:'13px',w:400,uso:'Texto de tabela / conteúdo'},
              {size:'12px',w:700,uso:'Header de tabela'},
              {size:'12px',w:400,uso:'Label de campo (.ds-label)'},
              {size:'11px',w:700,uso:'Badges / hints label'},
              {size:'11px',w:400,uso:'Subtítulo / .ds-page-subtitle'},
              {size:'10px',w:700,uso:'Nav section label (uppercase)'},
            ].map(t=>(
              <div key={t.uso} style={{display:'flex',alignItems:'baseline',gap:16,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:t.size,fontWeight:t.w,color:'var(--t-primary)',minWidth:260}}>{t.uso}</span>
                <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',fontFamily:'var(--font-mono)'}}>{t.size} / weight {t.w}</span>
              </div>
            ))}
            <div style={{marginTop:8,padding:10,background:'var(--bg-header)',borderRadius:'var(--r-sm)',border:'1px solid var(--border)',fontFamily:'var(--font-mono)',fontSize:'var(--fs-base)',color:'var(--t-primary)'}}>
              Mono: 123.456.789-00 · LOC2024000001 · 12.345.678/0001-90
            </div>
          </div>
        )}

        {tab==='botoes' && (
          <div>
            {[
              {label:'Ações principais', items:[
                <Btn key="p">🔍 Pesquisar</Btn>,
                <Btn key="s" variant="success">+ Novo</Btn>,
                <Btn key="sec" variant="secondary">Cancelar</Btn>,
                <Btn key="g" variant="ghost">Ver detalhes</Btn>,
                <Btn key="d" variant="danger">Excluir</Btn>,
              ]},
              {label:'Tamanho pequeno (sm)', items:[
                <Btn key="p" size="sm">Pesquisar</Btn>,
                <Btn key="s" variant="success" size="sm">+ Incluir</Btn>,
                <Btn key="sec" variant="secondary" size="sm">Voltar</Btn>,
                <Btn key="d" variant="danger" size="sm">Remover</Btn>,
              ]},
              {label:'Estados especiais', items:[
                <Btn key="l" loading>Salvando...</Btn>,
                <Btn key="dis" disabled>Desabilitado</Btn>,
                <button key="save" className="ds-btn btn-save">✓ Salvar</button>,
              ]},
            ].map(group=>(
              <div key={group.label} style={{marginBottom:16}}>
                <div style={{fontSize:'var(--fs-sm)',fontWeight:600,color:'var(--t-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>{group.label}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>{group.items}</div>
              </div>
            ))}
          </div>
        )}

        {tab==='inputs' && (
          <div style={{maxWidth:640}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <FormField label="Input padrão"><input className={inputCls} placeholder="Texto aqui..." /></FormField>
              <FormField label="Select"><select className={selectCls}><option>Opção 1</option><option>Opção 2</option></select></FormField>
              <FormField label="Input com erro" error="Campo obrigatório"><input className={inputCls} style={{borderColor:'var(--c-danger)'}}/></FormField>
              <FormField label="Input desabilitado"><input className={inputCls} disabled value="Readonly" /></FormField>
              <FormField label="Textarea" style={{gridColumn:'span 2'}}><textarea className={textareaCls} rows={2} placeholder="Observações..." /></FormField>
              <FormField label="Mono (CPF/CNPJ)"><input className={inputCls} style={{fontFamily:'var(--font-mono)'}} placeholder="000.000.000-00" /></FormField>
              <FormField label="Data"><input type="date" className={inputCls} /></FormField>
            </div>
            <div style={{fontSize:'var(--fs-sm)',fontWeight:600,color:'var(--t-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>LookupField (busca + incluir)</div>
            <div className="ds-lookup" style={{maxWidth:380}}>
              <input className="ds-lookup-input" placeholder="Pesquisar cliente..." />
              <button className="ds-lookup-btn" title="Pesquisar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </button>
              <button className="ds-lookup-btn" title="Novo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        )}

        {tab==='badges' && (
          <div>
            <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
              {BADGES.map(b=>(
                <div key={b.value} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <Badge value={b.value} label={b.label} dot />
                  <span style={{fontSize:'var(--fs-xs)',color:'var(--t-muted)',fontFamily:'var(--font-mono)'}}>{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='tabela' && (
          <table className="ds-table">
            <thead><tr>{['Nº','Nome','Status','Valor','Ações'].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                {id:'001',nome:'Contrato Alpha',status:'ativo',valor:'R$ 2.500,00'},
                {id:'002',nome:'Contrato Beta',status:'pendente',valor:'R$ 1.200,00'},
                {id:'003',nome:'Contrato Gamma',status:'vencido',valor:'R$ 800,00'},
                {id:'004',nome:'Contrato Delta',status:'cancelado',valor:'R$ 3.100,00'},
              ].map(r=>(
                <tr key={r.id}>
                  <td style={{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--c-primary)'}}>{r.id}</td>
                  <td style={{fontWeight:500}}>{r.nome}</td>
                  <td><Badge value={r.status} dot /></td>
                  <td style={{fontWeight:700}}>{r.valor}</td>
                  <td>
                    <div className="tbl-actions">
                      <button className="tbl-btn edit" title="Editar">✏️</button>
                      <button className="tbl-btn view" title="Ver">👁</button>
                      <button className="tbl-btn del"  title="Excluir">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab==='alertas' && (
          <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:520}}>
            <div className="ds-alert-success">✅ Operação realizada com sucesso!</div>
            <div className="ds-alert-error">❌ Erro ao salvar — campo obrigatório não preenchido.</div>
            <div className="ds-alert-warning">⚠️ Atenção: consulta SPC vencida há 35 dias.</div>
            <div className="ds-alert-info">ℹ️ Contrato vence em 3 dias.</div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:16,background:'var(--bg-header)',borderRadius:'var(--r-sm)',border:'1px solid var(--border)'}}>
              <div className="ds-spinner" style={{width:18,height:18}}/> <span style={{fontSize:'var(--fs-base)',color:'var(--t-muted)'}}>Carregando dados...</span>
            </div>
            <div className="ds-empty" style={{border:'1px dashed var(--border)',borderRadius:'var(--r-sm)'}}>
              <div className="ds-empty-icon">📋</div>
              <div className="ds-empty-title">Nenhum registro encontrado</div>
            </div>
            <button className="ds-add-dashed">+ Adicionar novo item</button>
          </div>
        )}
      </div>
    </div>
  )
}
