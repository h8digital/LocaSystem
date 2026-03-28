import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userCookie  = cookieStore.get('locasystem_user')
  if (!userCookie) redirect('/login')
  const user = JSON.parse(userCookie.value)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar user={user} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Topbar minimalista */}
        <header style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 12,
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--t-primary)', letterSpacing: '-0.01em' }}>
            LocaSystem
          </span>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          <span style={{ fontSize: 'var(--fs-md)', color: 'var(--t-muted)' }}>{user.nome}</span>
          {user.perfil && (
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'var(--c-primary-light)',
              color: 'var(--c-primary-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {user.perfil}
            </span>
          )}
        </header>
        {/* Conteúdo principal */}
        <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
