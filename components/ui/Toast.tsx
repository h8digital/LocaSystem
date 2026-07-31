'use client'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
  title?: string
  duration?: number
}

interface ToastItem {
  id: number
  type: ToastType
  title: string
  message: string
  duration: number
}

interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void
  error:   (message: string, opts?: ToastOptions) => void
  info:    (message: string, opts?: ToastOptions) => void
  warning: (message: string, opts?: ToastOptions) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Sucesso',
  error:   'Erro',
  warning: 'Atenção',
  info:    'Aviso',
}

// Erros ficam mais tempo na tela — o usuário costuma precisar ler com calma.
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info:    4000,
  warning: 5000,
  error:   6500,
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  error:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L14.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 17h.01" /></svg>,
  info:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
}

let uid = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string, opts?: ToastOptions) => {
    const id = ++uid
    setItems(prev => [
      { id, type, title: opts?.title ?? DEFAULT_TITLES[type], message, duration: opts?.duration ?? DEFAULT_DURATIONS[type] },
      ...prev,
    ].slice(0, 6))
  }, [])

  const api = useRef<ToastApi>({
    success: (m, o) => push('success', m, o),
    error:   (m, o) => push('error', m, o),
    info:    (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
    dismiss,
  })

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() precisa estar dentro de <ToastProvider>')
  return ctx
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  if (items.length === 0) return null
  return (
    <div className="ds-toast-viewport" aria-live="polite">
      {items.map(item => <ToastCard key={item.id} item={item} onDismiss={onDismiss} />)}
    </div>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false)
  const remaining  = useRef(item.duration)
  const startedAt  = useRef(Date.now())
  const timer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onDismiss(item.id), 200)
  }, [item.id, onDismiss])

  const schedule = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(close, remaining.current)
  }, [close])

  useEffect(() => {
    schedule()
    return () => clearTimeout(timer.current)
  }, [schedule])

  function handleEnter() {
    clearTimeout(timer.current)
    remaining.current -= Date.now() - startedAt.current
  }

  return (
    <div
      className={`ds-toast ds-toast-${item.type}${leaving ? ' ds-toast-leave' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={schedule}
      onClick={close}
      role="status"
    >
      <div className="ds-toast-icon">{ICONS[item.type]}</div>
      <div className="ds-toast-body">
        <div className="ds-toast-title">{item.title}</div>
        <div className="ds-toast-message">{item.message}</div>
      </div>
      <button
        type="button"
        className="ds-toast-close"
        onClick={e => { e.stopPropagation(); close() }}
        aria-label="Fechar"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  )
}
