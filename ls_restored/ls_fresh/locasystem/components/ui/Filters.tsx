'use client'
import React from 'react'

interface FilterField {
  type: 'text' | 'select'
  key: string
  placeholder?: string
  options?: { value: string; label: string }[]
  width?: string
  flex?: string
}

interface FiltersProps {
  fields: FilterField[]
  values: Record<string, string>
  onChange: (k: string, v: string) => void
  onClear?: () => void
  extra?: React.ReactNode
}

export default function Filters({ fields, values, onChange, onClear, extra }: FiltersProps) {
  const hasFilter = Object.values(values).some(v => v !== '')
  return (
    <div className="filter-row">
      {fields.map(f => (
        <div key={f.key} style={{ flex: f.flex, width: f.width }}>
          {f.type === 'text' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--bg-input)', border: '1px solid var(--border-input)',
              borderRadius: 'var(--r-md)', padding: '0 10px', height: 32,
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
              onFocus={e => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--border-focus)'
                el.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.15)'
              }}
              onBlur={e => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--border-input)'
                el.style.boxShadow = 'none'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="var(--t-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder ?? 'Pesquisar...'}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--t-primary)', fontSize: 'var(--fs-base)',
                  fontFamily: 'var(--font)', flex: 1, minWidth: 140,
                }}
              />
              {values[f.key] && (
                <button
                  onClick={() => onChange(f.key, '')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t-light)', padding: 0, lineHeight: 1,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <select
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="ds-select"
              style={{ width: f.width ?? 'auto', minWidth: 130 }}
            >
              <option value="">{f.placeholder ?? 'Todos'}</option>
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      {extra}
      {hasFilter && onClear && (
        <button onClick={onClear} className="btn-clear-filter">
          ✕ Limpar
        </button>
      )}
    </div>
  )
}
