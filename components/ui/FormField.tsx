'use client'
import React from 'react'

interface FormFieldProps {
  label?: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export default function FormField({ label, required, hint, error, children, style, className }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }} className={className}>
      {label && (
        <label className="ds-label">
          {label}
          {required && <span style={{ color: 'var(--c-danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="ds-hint">{hint}</p>}
      {error && <p className="ds-error">{error}</p>}
    </div>
  )
}
