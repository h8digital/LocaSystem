// build: 2026-06-02
'use client'
import Notificacoes from '@/components/ui/Notificacoes'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// Seções com seus itens — separação clara entre módulos operacionais e sistema
const NAV: { section: string; items: { href: string; icon: string; label: string }[] }[] = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard',   icon: '⊞',  label: 'Dashboard'   },
    ],
  },
  {
    section: 'Comercial',
    items: [
      { href: '/cotacoes',    icon: '📋', label: 'Cotações'    },
      { href: '/contratos',   icon: '📄', label: 'Contratos'   },
      { href: '/clientes',    icon: '👥', label: 'Clientes'    },
      { href: '/financeiro',  icon: '💰', label: 'Financeiro'  },
    ],
  },
  {
    section: 'Estoque',
    items: [
      { href: '/equipamentos',  icon: '🔧', label: 'Equipamentos' },
      { href: '/manutencoes',   icon: '🔩', label: 'Manutenções'  },
    ],
  },
  {
    section: 'Documentos',
    items: [
      { href: '/relatorios',              icon: '📊', label: 'Relatórios'         },
      { href: '/relatorios/equipamentos', icon: '📦', label: 'Catálogo'           },
      { href: '/templates',               icon: '🖨️', label: 'Templates de Doc'   },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/usuarios',    icon: '👤', label: 'Usuários'    },
      { href: '/parametros',  icon: '⚙️', label: 'Parâmetros'  },
    ],
  },
]

function NavSection({ section, items, pathname }: {
  section: string
  items: { href: string; icon: string; label: string }[]
  pathname: string
}) {
  return (
    <div>
      <div className="ds-nav-section">{section}</div>
      {items.map(item => {
        const isExact      = pathname === item.href
        const hasExactChild = NAV.flatMap(s => s.items).some(
          o => o.href === pathname && o.href !== item.href
        )
        const isActive = isExact || (
          item.href !== '/dashboard' &&
          pathname.startsWith(item.href + '/') &&
          !hasExactChild
        )
        return (
          <Link key={item.href} href={item.href}
            className={`ds-nav-item${isActive ? ' active' : ''}`}>
            <span className="ds-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

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
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg,#6366f1,#818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 12px rgba(99,102,241,0.5)', flexShrink: 0,
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
        {NAV.map(s => (
          <NavSection key={s.section} section={s.section} items={s.items} pathname={pathname} />
        ))}
      </nav>

      {/* Footer: notificações + usuário + logout */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
      }}>
        <Notificacoes />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
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
          <button onClick={logout} title="Sair"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 15, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}>
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}
