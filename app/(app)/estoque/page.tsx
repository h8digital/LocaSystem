// build: 2026-05-26 12:49:03
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function EstoqueRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/equipamentos') }, [router])
  return <div style={{padding:40,textAlign:'center',color:'var(--t-muted)'}}>Redirecionando para Equipamentos…</div>
}
