import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userCookie  = cookieStore.get('locasystem_user')
  if (!userCookie) redirect('/login')
  const user = JSON.parse(userCookie.value)
  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F6F8'}}>
      <Sidebar user={user} />
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
        {/* Topbar */}
        <header style={{background:'linear-gradient(135deg,#1E2A38,#2C3E50)',color:'#fff',height:'42px',display:'flex',alignItems:'center',padding:'0 20px',gap:12,borderBottom:'1px solid rgba(0,0,0,0.2)',flexShrink:0,boxShadow:'0 2px 6px rgba(0,0,0,0.15)'}}>
          <span style={{fontSize:'var(--fs-base)',fontWeight:500,color:'rgba(255,255,255,0.8)'}}>LocaSystem</span>
          <span style={{color:'rgba(255,255,255,0.2)',fontSize:'var(--fs-sm)'}}>—</span>
          <span style={{fontSize:'var(--fs-md)',color:'rgba(255,255,255,0.5)'}}>{user.nome}</span>
        </header>
        <main style={{flex:1,overflow:'auto',padding:'16px 20px'}}>{children}</main>
      </div>
    </div>
  )
}
