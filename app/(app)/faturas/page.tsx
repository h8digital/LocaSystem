'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function FaturasRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/financeiro') }, [router])
  return <div style={{padding:40,textAlign:'center',color:'var(--t-muted)'}}>Redirecionando para Financeiro…</div>
}
