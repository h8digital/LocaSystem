'use client'
import React from 'react'
import Btn from './Btn'

interface PageShellProps {
  title: string
  subtitle?: string
  icon?: string
  // Botão principal de ação (ex: "+ Novo Cliente")
  primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode }
  // Filtros livres
  filters?: React.ReactNode
  // Busca rápida
  searchValue?: string
  searchPlaceholder?: string
  onSearchChange?: (v: string) => void
  // Conteúdo (tabela, cards etc)
  children: React.ReactNode
  // KPIs opcionais acima da tabela
  kpis?: React.ReactNode
  // Ações extras no header
  headerActions?: React.ReactNode
}

export default function PageShell({
  title, subtitle, icon,
  primaryAction,
  filters,
  searchValue, searchPlaceholder = 'Buscar...', onSearchChange,
  children, kpis, headerActions,
}: PageShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--t-primary)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--t-muted)', marginTop: 3 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {headerActions}
          {primaryAction && (
            <Btn variant="primary" onClick={primaryAction.onClick}>
              {primaryAction.icon ?? <span style={{ fontSize: 16, lineHeight: 1, marginRight: 2 }}>+</span>}
              {primaryAction.label}
            </Btn>
          )}
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────── */}
      {kpis && (
        <div style={{ marginBottom: 16 }}>{kpis}</div>
      )}

      {/* ── Filtros ────────────────────────────────────────── */}
      {(filters || onSearchChange) && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '12px 16px',
          marginBottom: 14,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 10,
          boxShadow: 'var(--shadow-sm)',
        }}>
          {onSearchChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--bg-header)', border: '1px solid var(--border-input)',
              borderRadius: 'var(--r-md)', padding: '0 10px', height: 32,
              transition: 'border-color 150ms',
            }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-input)')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--t-primary)', fontSize: 'var(--fs-base)',
                  fontFamily: 'var(--font)', minWidth: 180,
                }}
              />
              {searchValue && (
                <button onClick={() => onSearchChange('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          )}
          {filters}
        </div>
      )}

      {/* ── Conteúdo ───────────────────────────────────────── */}
      {children}
    </div>
  )
}
