// build: 2026-05-29 17:55:15
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userCookie  = cookieStore.get('locasystem_user')
  if (!userCookie) redirect('/login')
  const user = JSON.parse(userCookie.value)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar user={user} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        <main style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
