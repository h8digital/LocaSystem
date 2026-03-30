'use client'
import React, { useState, useRef, useEffect } from 'react'

export interface AcaoSecundaria {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  destrutivo?: boolean
  grupo?: number
}

interface ActionButtonsProps {
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteConfirm?: string
  acoesSec?: AcaoSecundaria[]
}

// SVG icons inline para não depender de biblioteca
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const IconMore = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
)

export { IconEye, IconEdit, IconTrash }

export default function ActionButtons({ onView, onEdit, onDelete, deleteConfirm, acoesSec }: ActionButtonsProps) {
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos,  setDropPos]  = useState({ top: 0, right: 0 })
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggleDrop() {
    if (!dropOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setDropOpen(o => !o)
  }

  const hasMore = acoesSec && acoesSec.length > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {onView && (
        <button className="tbl-btn view" onClick={onView} title="Visualizar">
          <IconEye />
        </button>
      )}
      {onEdit && (
        <button className="tbl-btn edit" onClick={onEdit} title="Editar">
          <IconEdit />
        </button>
      )}
      {onDelete && (
        <button
          className="tbl-btn del"
          title="Excluir"
          onClick={() => {
            const msg = deleteConfirm ?? 'Tem certeza que deseja excluir?'
            if (confirm(msg)) onDelete()
          }}
        >
          <IconTrash />
        </button>
      )}
      {hasMore && (
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            ref={btnRef}
            className={`tbl-btn ${dropOpen ? 'tbl-btn-open' : ''}`}
            onClick={toggleDrop}
            title="Mais ações"
            style={{ color: dropOpen ? 'var(--c-primary)' : undefined }}
          >
            <IconMore />
          </button>
          {dropOpen && (
            <div className="tbl-dropdown" style={{
              position: 'fixed',
              top: dropPos.top,
              right: dropPos.right,
              zIndex: 9999,
            }}>
              {acoesSec!.map((a, i) => (
                <React.Fragment key={i}>
                  {i > 0 && acoesSec![i - 1].grupo !== a.grupo && (
                    <div className="tbl-dropdown-divider" />
                  )}
                  <button
                    className={`tbl-dropdown-item ${a.danger ? 'item-danger' : ''}`}
                    onClick={() => { a.onClick(); setDropOpen(false) }}
                  >
                    {a.icon && <span style={{ display: 'inline-flex', width: 16 }}>{a.icon}</span>}
                    {a.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
