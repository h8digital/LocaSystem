// build: 2026-06-02
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV: { section: string; items: { href: string; icon: string; label: string }[] }[] = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard',  icon: '⊞',  label: 'Dashboard'  },
    ],
  },
  {
    section: 'Comercial',
    items: [
      { href: '/cotacoes',   icon: '📋', label: 'Cotações'   },
      { href: '/contratos',  icon: '📄', label: 'Contratos'  },
      { href: '/clientes',   icon: '👥', label: 'Clientes'   },
      { href: '/financeiro', icon: '💰', label: 'Financeiro' },
    ],
  },
  {
    section: 'Estoque',
    items: [
      { href: '/equipamentos', icon: '🔧', label: 'Equipamentos' },
      { href: '/manutencoes',  icon: '🔩', label: 'Manutenções'  },
    ],
  },
  {
    section: 'Documentos',
    items: [
      { href: '/relatorios',              icon: '📊', label: 'Relatórios'       },
      { href: '/relatorios/equipamentos', icon: '📦', label: 'Catálogo'         },
      { href: '/templates',               icon: '🖨️', label: 'Templates de Doc' },
    ],
  },
]

const allItems = NAV.flatMap(s => s.items)

function isActive(href: string, pathname: string) {
  if (pathname === href) return true
  if (href === '/dashboard') return false
  const hasExactChild = allItems.some(o => o.href === pathname && o.href !== href)
  return pathname.startsWith(href + '/') && !hasExactChild
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="ds-sidebar">
      {/* Brand */}
      <div style={{
        height: 56,
        padding: '0 18px',
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
          <div key={s.section}>
            <div className="ds-nav-section">{s.section}</div>
            {s.items.map(item => (
              <Link key={item.href} href={item.href}
                className={`ds-nav-item${isActive(item.href, pathname) ? ' active' : ''}`}>
                <span className="ds-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
