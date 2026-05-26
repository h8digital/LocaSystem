// build: 2026-05-26 12:49:03
'use client'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface AcaoSecundaria {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  destrutivo?: boolean
  grupo?: number
}

interface ActionButtonsProps {
  onView?:        () => void
  onEdit?:        () => void
  onDelete?:      () => void
  deleteConfirm?: string
  acoesSec?:      AcaoSecundaria[]
}

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
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)
const IconMore = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
)

export { IconEye, IconEdit, IconTrash }

const MENU_WIDTH  = 210
const MENU_HEIGHT = 300

export default function ActionButtons({ onView, onEdit, onDelete, deleteConfirm, acoesSec }: ActionButtonsProps) {
  const [dropOpen,  setDropOpen]  = useState(false)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const [mounted,   setMounted]   = useState(false)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)   // ref para o menu no portal

  useEffect(() => { setMounted(true) }, [])

  // ── Fechar ao clicar FORA do botão E fora do menu ───────────────────────
  // CRÍTICO: verificar tanto o btnRef quanto o menuRef
  // Se verificar só o btnRef, o clique num item do menu fecha o menu
  // antes do onClick do item executar (mousedown antes de click)
  useEffect(() => {
    if (!dropOpen) return
    function h(e: MouseEvent) {
      const target = e.target as Node
      const dentroBtn  = btnRef.current?.contains(target)
      const dentroMenu = menuRef.current?.contains(target)
      if (!dentroBtn && !dentroMenu) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [dropOpen])

  // Fechar com ESC
  useEffect(() => {
    if (!dropOpen) return
    function h(e: KeyboardEvent) { if (e.key === 'Escape') setDropOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [dropOpen])

  // Fechar ao fazer scroll (botão se move, menu fixed não)
  useEffect(() => {
    if (!dropOpen) return
    function h() { setDropOpen(false) }
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [dropOpen])

  function toggleDrop() {
    if (dropOpen) { setDropOpen(false); return }
    if (!btnRef.current) return

    const r     = btnRef.current.getBoundingClientRect()
    const viewH = window.innerHeight
    const viewW = window.innerWidth

    const openAbove = (viewH - r.bottom) < MENU_HEIGHT && r.top > MENU_HEIGHT

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex:   99999,
      minWidth: MENU_WIDTH,
    }

    if (openAbove) {
      style.bottom = viewH - r.top + 4
    } else {
      style.top = r.bottom + 4
    }

    // Alinhar borda direita do menu com borda direita do botão
    // Se não couber, alinhar borda esquerda
    if (r.right >= MENU_WIDTH) {
      style.right = viewW - r.right
    } else {
      style.left = r.left
    }

    setDropStyle(style)
    setDropOpen(true)
  }

  const hasMore = acoesSec && acoesSec.length > 0

  const dropdown = dropOpen && mounted && hasMore && createPortal(
    <div
      ref={menuRef}
      className="tbl-dropdown"
      style={dropStyle}
    >
      {acoesSec!.map((a, i) => (
        <React.Fragment key={i}>
          {i > 0 && acoesSec![i - 1].grupo !== a.grupo && (
            <div className="tbl-dropdown-divider" />
          )}
          <button
            className={`tbl-dropdown-item ${(a.danger || a.destrutivo) ? 'item-danger' : ''}`}
            onMouseDown={e => e.stopPropagation()} // impede que o mousedown feche o menu
            onClick={() => { setDropOpen(false); a.onClick() }} // fecha DEPOIS de chamar o onClick
          >
            {a.icon && <span style={{ display:'inline-flex', width:16 }}>{a.icon}</span>}
            {a.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body
  )

  return (
    <>
      {dropdown}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
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
          <button
            ref={btnRef}
            className={`tbl-btn ${dropOpen ? 'tbl-btn-open' : ''}`}
            onClick={toggleDrop}
            title="Mais ações"
            style={{ color: dropOpen ? 'var(--c-primary)' : undefined }}
          >
            <IconMore />
          </button>
        )}
      </div>
    </>
  )
}
