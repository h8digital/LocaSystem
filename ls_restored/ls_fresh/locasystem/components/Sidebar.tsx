'use client'
import Notificacoes from '@/components/ui/Notificacoes'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  { href:'/dashboard',               icon:'⊞',  label:'Dashboard',              section:'PRINCIPAL' },
  { href:'/cotacoes',                icon:'📋', label:'Cotações',               section:'COMERCIAL' },
  { href:'/contratos',               icon:'📄', label:'Contratos',              section:null },
  { href:'/financeiro',              icon:'💰', label:'Financeiro',             section:null },
  { href:'/clientes',                icon:'👥', label:'Clientes',               section:null },
  { href:'/equipamentos',            icon:'🔧', label:'Equipamentos',           section:'ESTOQUE' },
  { href:'/manutencoes',             icon:'🔩', label:'Manutenções',            section:null },
  { href:'/relatorios',              icon:'📊', label:'Relatórios',             section:'RELATÓRIOS' },
  { href:'/relatorios/equipamentos', icon:'📦', label:'Catálogo de Equipamentos', section:null },
  { href:'/templates',               icon:'📋', label:'Templates',              section:'DOCUMENTOS' },
  { href:'/usuarios',                icon:'👤', label:'Usuários',               section:'SISTEMA' },
  { href:'/parametros',              icon:'⚙️', label:'Parâmetros',             section:null },
  { href:'/system/logs', icon:'🪵', label:'Logs do Sistema', section:null },
]

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="ds-sidebar">
      {/* Brand */}
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30,
          borderRadius: 8,
          background: 'linear-gradient(135deg,#6366f1,#818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 12px rgba(99,102,241,0.5)',
          flexShrink: 0,
        }}>L</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Loca<span style={{ color: '#818cf8' }}>System</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 1 }}>
            Gestão de Locação
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {nav.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

          return (
            <div key={item.href}>
              {item.section && (
                <div className="ds-nav-section">{item.section}</div>
              )}
              <Link
                href={item.href}
                className={`ds-nav-item${isActive ? ' active' : ''}`}
              >
                <span className="ds-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer do sidebar: usuário + notificações + logout */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        <Notificacoes />

        {/* Info do usuário */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}>
            {user?.nome?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nome ?? 'Usuário'}
            </div>
            {user?.perfil && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {user.perfil}
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sair"
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.25)',
              cursor: 'pointer', fontSize: 15,
              padding: '2px 4px',
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}
