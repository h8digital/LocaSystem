// build: 2026-07-22
'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { NAV_ALL, ACOES_RAPIDAS } from '@/lib/navigation'

const ATALHOS = [
  { combo: 'Ctrl/Cmd + K', desc: 'Abrir busca rápida' },
  { combo: '↑ / ↓',        desc: 'Navegar nos resultados' },
  { combo: 'Enter',        desc: 'Ir para o item selecionado' },
  { combo: 'Esc',          desc: 'Fechar' },
  { combo: '?',            desc: 'Mostrar esta ajuda' },
]

const TODOS_DESTINOS = [...ACOES_RAPIDAS, ...NAV_ALL]

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  if (!t) return false
  if (t.isContentEditable) return true
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const q = query.trim().toLowerCase()
  const resultados = q ? TODOS_DESTINOS.filter(i => i.label.toLowerCase().includes(q)) : TODOS_DESTINOS

  // Permite abrir por um botão visível (ex: Topbar), não só pelo atalho
  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener('locasystem:abrir-busca', h)
    return () => window.removeEventListener('locasystem:abrir-busca', h)
  }, [])

  // Atalhos globais
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      if (e.key === '?' && !open && !helpOpen && !isTypingTarget(e.target)) {
        e.preventDefault()
        setHelpOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (open) setOpen(false)
        if (helpOpen) setHelpOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, helpOpen])

  useEffect(() => {
    if (open) {
      setQuery(''); setIndex(0)
      // Duplo rAF garante que o input já foi pintado antes de focar
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()))
    }
  }, [open])

  useEffect(() => { setIndex(0) }, [query])

  function ir(href: string) {
    router.push(href)
    setOpen(false)
  }

  function onKeyDownInput(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const r = resultados[index]; if (r) ir(r.href) }
  }

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'12vh' }}>
          <div onClick={() => setOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(5,8,20,0.7)', backdropFilter:'blur(4px)' }} />
          <div style={{ position:'relative', width:'100%', maxWidth:560, margin:'0 16px', background:'var(--bg-card-solid)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--t-muted)' }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDownInput}
                placeholder="Buscar página ou ação..."
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--t-primary)', fontSize:'var(--fs-base)' }}
              />
              <kbd style={{ fontSize:'var(--fs-xs)', color:'var(--t-muted)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 6px' }}>Esc</kbd>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto', padding:6 }}>
              {resultados.length === 0 && (
                <div style={{ padding:20, textAlign:'center', color:'var(--t-muted)', fontSize:'var(--fs-md)' }}>Nada encontrado.</div>
              )}
              {resultados.map((r, i) => (
                <button
                  key={r.href}
                  onClick={() => ir(r.href)}
                  onMouseEnter={() => setIndex(i)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    border:'none', borderRadius:'var(--r-md)', cursor:'pointer', textAlign:'left', fontSize:'var(--fs-base)',
                    background: i === index ? 'var(--c-primary-light)' : 'transparent',
                    color: i === index ? 'var(--c-primary-text)' : 'var(--t-secondary)',
                  }}
                >
                  <span style={{ fontSize:15, flexShrink:0 }}>{r.icon}</span>{r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={() => setHelpOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(5,8,20,0.7)', backdropFilter:'blur(4px)' }} />
          <div style={{ position:'relative', width:'100%', maxWidth:400, background:'var(--bg-card-solid)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:'var(--fs-lg)' }}>⌨️ Atalhos de Teclado</div>
              <button onClick={() => setHelpOpen(false)} className="slide-close" aria-label="Fechar">×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {ATALHOS.map(a => (
                <div key={a.combo} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <span style={{ color:'var(--t-secondary)', fontSize:'var(--fs-md)' }}>{a.desc}</span>
                  <kbd style={{ fontSize:'var(--fs-sm)', color:'var(--t-primary)', background:'var(--bg-header)', border:'1px solid var(--border)', borderRadius:4, padding:'3px 8px', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>{a.combo}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
