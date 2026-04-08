'use client'
import Notificacoes from '@/components/ui/Notificacoes'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  {href:'/dashboard',    icon:'⊞',  label:'Dashboard',     section:'PRINCIPAL'},
  {href:'/cotacoes',     icon:'📋', label:'Cotações',      section:'COMERCIAL'},
  {href:'/contratos',    icon:'📄', label:'Contratos',     section:null},
  {href:'/financeiro',   icon:'💰', label:'Financeiro',    section:null},
  {href:'/clientes',     icon:'👥', label:'Clientes',      section:null},
  {href:'/equipamentos', icon:'🔧', label:'Equipamentos',  section:'ESTOQUE'},
  {href:'/manutencoes',  icon:'🔩', label:'Manutenções',   section:null},
  {href:'/relatorios',   icon:'📊', label:'Relatórios',    section:'RELATÓRIOS'},
  {href:'/templates',    icon:'📋', label:'Templates',     section:'DOCUMENTOS'},
  {href:'/usuarios',     icon:'👤', label:'Usuários',      section:'SISTEMA'},
  {href:'/parametros',   icon:'⚙️', label:'Parâmetros',    section:null},
]

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router   = useRouter()
  async function logout() { await fetch('/api/auth/logout',{method:'POST'}); router.push('/login') }

  return (
    <aside className="ds-sidebar">
      {/* Brand */}
      <div style={{padding:'16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:'6px',background:'#0EA5E9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,fontWeight:700,color:'#fff'}}>L</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:14,lineHeight:1.2,letterSpacing:'-0.01em'}}>LocaSystem</div>
            <div style={{color:'rgba(255,255,255,0.35)',fontSize:10,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:1}}>Gestão de Locações</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {nav.map(item => {
          const active = pathname===item.href||(item.href!=='/dashboard'&&pathname.startsWith(item.href))
          return (
            <div key={item.href}>
              {item.section && <div className="ds-nav-section">{item.section}</div>}
              <Link href={item.href} className={`ds-nav-item${active?' active':''}`}>
                <span style={{width:16,textAlign:'center',fontSize:'var(--fs-base)',flexShrink:0}}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:'#17A2B8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-md)',fontWeight:700,flexShrink:0}}>{user.nome.charAt(0).toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:'var(--fs-md)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.nome}</div>
          <div style={{color:'rgba(255,255,255,0.35)',fontSize:'var(--fs-xs)'}}>{(user.perfil??'').split(',').map((p:string)=>p.trim()).filter(Boolean).join(' · ')}</div>
        </div>
        <Notificacoes />
        <button onClick={logout} title="Sair" style={{background:'transparent',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:'var(--fs-lg)',padding:3,borderRadius:'3px',transition:'color 150ms'}}
          onMouseEnter={e=>(e.currentTarget.style.color='#ff6b6b')}
          onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.3)')}>⇥</button>
      </div>
    </aside>
  )
}
