'use client'
import { useEffect } from 'react'

const widths: Record<string, number> = { sm: 440, md: 560, lg: 740, xl: 920 }

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function SlidePanel({ open, onClose, title, subtitle, width = 'md', children, footer }: SlidePanelProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 200ms ease',
        }}
      />
      {/* Panel */}
      <div
        className="ds-panel"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: widths[width] ?? 560,
          height: '100%',
          animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div className="slide-header">
          <div>
            <div className="slide-title">{title}</div>
            {subtitle && <div className="slide-subtitle">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="slide-close"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>
        {/* Footer */}
        {footer && <div className="slide-footer">{footer}</div>}
      </div>
    </div>
  )
}
