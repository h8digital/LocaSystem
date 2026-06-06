// build: 2026-06-06
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userCookie  = cookieStore.get('locasystem_user')
  if (!userCookie) redirect('/login')
  const user = JSON.parse(userCookie.value)

  // Verificar modo de teste
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: params } = await sb.from('parametros').select('chave,valor')
    .in('chave', ['modo_teste','modo_teste_inicio','modo_teste_usuario'])
  const p: Record<string,string> = {}
  ;(params ?? []).forEach((r: any) => { p[r.chave] = r.valor })
  const modoTeste  = p['modo_teste'] === 'true'
  const inicio     = p['modo_teste_inicio']
    ? new Date(p['modo_teste_inicio']).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' })
    : null
  const usuario    = p['modo_teste_usuario'] || null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Topbar user={user} />

        {modoTeste && (
          <div style={{
            background: 'repeating-linear-gradient(45deg, #78350f, #78350f 10px, #92400e 10px, #92400e 20px)',
            borderBottom: '2px solid #fbbf24',
            padding: '6px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:16 }}>⚠️</span>
              <div style={{ fontWeight:800, color:'#fef3c7', fontSize:13, letterSpacing:'0.05em', textTransform:'uppercase' }}>
                AMBIENTE DE TESTE — dados não são reais
              </div>
            </div>
            <div style={{ fontSize:11, color:'rgba(254,243,199,0.8)', textAlign:'right' }}>
              {inicio && <span>Iniciado em {inicio}</span>}
              {usuario && <span style={{ marginLeft:12 }}>por {usuario}</span>}
              <span style={{ marginLeft:12, background:'rgba(0,0,0,0.3)', padding:'2px 8px', borderRadius:4, color:'#fbbf24', fontWeight:700 }}>
                Asaas: SANDBOX
              </span>
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
