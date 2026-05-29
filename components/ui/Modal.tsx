// build: 2026-05-29 17:55:15
'use client'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title?:     string
  subtitle?:  string
  children:   React.ReactNode
  footer?:    React.ReactNode
  width?:     'sm' | 'md' | 'lg' | 'xl'
  /** Impede fechar ao clicar no overlay */
  persistent?: boolean
}

const WIDTHS = {
  sm:  480,
  md:  640,
  lg:  800,
  xl:  1000,
}

export default function Modal({
  open, onClose, title, subtitle, children, footer,
  width = 'md', persistent = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // SSR-safe
  useEffect(() => { setMounted(true) }, [])

  // Bloquear scroll do body enquanto aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Fechar com ESC
  useEffect(() => {
    if (!open) return
    function h(e: KeyboardEvent) {
      if (e.key === 'Escape' && !persistent) onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose, persistent])

  if (!open || !mounted) return null

  return createPortal(
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          99999,
        background:      'rgba(0,0,0,0.65)',
        backdropFilter:  'blur(6px)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         20,
        // Animação de entrada
        animation:       'modalOverlayIn 200ms ease',
      }}
      onClick={() => { if (!persistent) onClose() }}
    >
      <div
        ref={contentRef}
        style={{
          background:    '#1a2235',
          border:        '1px solid rgba(255,255,255,0.12)',
          borderRadius:  'var(--r-lg)',
          width:         '100%',
          maxWidth:      WIDTHS[width],
          maxHeight:     '90vh',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '0 24px 64px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5)',
          animation:     'modalContentIn 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        {(title || subtitle) && (
          <div style={{
            padding:        '18px 24px',
            borderBottom:   '1px solid rgba(255,255,255,0.08)',
            background:     'rgba(255,255,255,0.04)',
            borderRadius:   'var(--r-lg) var(--r-lg) 0 0',
            display:        'flex',
            alignItems:     'flex-start',
            justifyContent: 'space-between',
            flexShrink:     0,
          }}>
            <div>
              {title && (
                <div style={{
                  fontWeight:    700,
                  fontSize:      16,
                  color:         'rgba(255,255,255,0.92)',
                  letterSpacing: '-0.2px',
                }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{
                  fontSize:  13,
                  color:     'rgba(255,255,255,0.4)',
                  marginTop: 2,
                }}>
                  {subtitle}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              title="Fechar"
              style={{
                width:          32,
                height:         32,
                borderRadius:   'var(--r-md)',
                background:     'rgba(255,255,255,0.07)',
                border:         '1px solid rgba(255,255,255,0.12)',
                cursor:         'pointer',
                color:          'rgba(255,255,255,0.5)',
                fontSize:       18,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                marginLeft:     12,
                transition:     'all .15s',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget
                b.style.background = 'rgba(255,255,255,0.12)'
                b.style.color      = 'rgba(255,255,255,0.8)'
              }}
              onMouseLeave={e => {
                const b = e.currentTarget
                b.style.background = 'rgba(255,255,255,0.07)'
                b.style.color      = 'rgba(255,255,255,0.5)'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── Conteúdo ─────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        {footer && (
          <div style={{
            padding:      '14px 24px',
            borderTop:    '1px solid rgba(255,255,255,0.08)',
            background:   'rgba(255,255,255,0.03)',
            borderRadius: '0 0 var(--r-lg) var(--r-lg)',
            flexShrink:   0,
          }}>
            {footer}
          </div>
        )}
      </div>

      {/* Animações via style tag inline */}
      <style>{`
        @keyframes modalOverlayIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes modalContentIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </div>,
    document.body
  )
}
