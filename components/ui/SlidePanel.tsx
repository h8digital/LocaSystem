// build: 2026-07-22 — Renderizado via portal em document.body
'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const widths: Record<string, number> = { sm: 440, md: 560, lg: 740, xl: 960 }

interface SlidePanelProps {
  open:      boolean
  onClose:   () => void
  title:     string
  subtitle?: string
  width?:    string
  children:  React.ReactNode
  footer?:   React.ReactNode
}

export default function SlidePanel({ open, onClose, title, subtitle, width = 'md', children, footer }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // Só monta o portal no cliente (document não existe no SSR)
  useEffect(() => { setMounted(true) }, [])

  // Bloquear scroll do body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Fechar com ESC
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open || !mounted) return null

  // Renderizado via portal em document.body: escapa de qualquer ancestral com
  // backdrop-filter/transform (que vira containing block para position:fixed
  // e prendia o modal dentro dos limites de cards com esse efeito, ex: o
  // LookupField dentro de um card "glass" ou a Sidebar).
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(5,8,20,0.7)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 180ms ease',
        }}
      />

      {/* Modal */}
      <div
        ref={panelRef}
        className="ds-panel"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: widths[width] ?? 560,
          maxHeight: 'calc(100vh - 48px)',
          borderRadius: 'var(--r-xl, 14px)',
          animation: 'modalIn 220ms cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Header */}
        <div className="slide-header" style={{ borderRadius: 'var(--r-xl, 14px) var(--r-xl, 14px) 0 0', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div className="slide-title">{title}</div>
            {subtitle && <div className="slide-subtitle">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="slide-close" aria-label="Fechar">×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="slide-footer" style={{ borderRadius: '0 0 var(--r-xl, 14px) var(--r-xl, 14px)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  )
}
