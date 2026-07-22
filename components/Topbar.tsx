// build: 2026-06-02
'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Notificacoes from '@/components/ui/Notificacoes'
import { NAV_ALL } from '@/lib/navigation'

// Mapa de rotas → título da página, derivado da fonte única de navegação
const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ALL.map(n => [n.href, n.titulo ?? n.label])
)

function getTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // match parcial (ex: /contratos/123 → Contratos)
  const match = Object.entries(PAGE_TITLES)
    .filter(([k]) => k !== '/dashboard')
    .find(([k]) => pathname.startsWith(k + '/'))
  return match ? match[1] : ''
}

interface Props { user: any }

export default function Topbar({ user }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initial = user?.nome?.charAt(0)?.toUpperCase() ?? 'U'
  const title   = getTitle(pathname)

  // Fechar ao clicar fora
  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function logout() {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const menuItems = [
    {
      group: 'Minha conta',
      items: [
        { icon: '👤', label: 'Meu perfil',    action: () => { setMenuOpen(false); router.push('/usuarios') } },
      ],
    },
    {
      group: 'Sistema',
      items: [
        { icon: '⚙️', label: 'Parâmetros',    action: () => { setMenuOpen(false); router.push('/parametros') } },
        { icon: '👥', label: 'Usuários',      action: () => { setMenuOpen(false); router.push('/usuarios') } },
      ],
    },
  ]

  return (
    <header style={{
      height: 56,
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-header)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Título da página — lado esquerdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <span style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--t-primary)',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </span>
        )}
      </div>

      {/* Lado direito: busca + notificações + usuário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* Busca rápida (Command Palette) */}
        <button
          onClick={() => window.dispatchEvent(new Event('locasystem:abrir-busca'))}
          title="Busca rápida"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--t-muted)', cursor: 'pointer', fontSize: 'var(--fs-md)',
          }}
        >
          <span>🔍</span>
          <span>Buscar</span>
          <kbd style={{ fontSize: 'var(--fs-xs)', color: 'var(--t-muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>Ctrl K</kbd>
        </button>

        {/* Divisor */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 6px' }} />

        {/* Notificações */}
        <Notificacoes />

        {/* Divisor */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 6px' }} />

        {/* Botão do usuário / admin */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px 5px 6px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: menuOpen ? 'rgba(99,102,241,0.12)' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initial}
            </div>
            {/* Nome + perfil */}
            <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-primary)', whiteSpace: 'nowrap' }}>
                {user?.nome?.split(' ')[0] ?? 'Usuário'}
              </div>
              {user?.perfil && (
                <div style={{ fontSize: 10, color: 'var(--t-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {user.perfil}
                </div>
              )}
            </div>
            {/* Chevron */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t-muted)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 220,
              background: '#1e293b',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              zIndex: 9999,
            }}>

              {/* Cabeçalho do menu */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(99,102,241,0.1)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-primary)' }}>
                  {user?.nome ?? 'Usuário'}
                </div>
                {user?.email && (
                  <div style={{ fontSize: 11, color: 'var(--t-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                )}
                {user?.perfil && (
                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', fontSize: 10, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {user.perfil}
                  </div>
                )}
              </div>

              {/* Grupos de itens */}
              {menuItems.map(group => (
                <div key={group.group}>
                  <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--t-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {group.group}
                  </div>
                  {group.items.map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: 13, color: 'var(--t-secondary)',
                        textAlign: 'left', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-header)'; (e.currentTarget as HTMLElement).style.color = 'var(--t-primary)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--t-secondary)' }}
                    >
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}

              {/* Separador + Sair */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                <button onClick={logout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: 13, color: '#f87171',
                    textAlign: 'left', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sair do sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
