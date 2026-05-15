'use client'
import React from 'react'

const variants: Record<string, string> = {
  primary:   'ds-btn ds-btn-primary',
  accent:    'ds-btn ds-btn-primary',
  success:   'ds-btn ds-btn-success',
  secondary: 'ds-btn ds-btn-secondary',
  ghost:     'ds-btn ds-btn-ghost',
  danger:    'ds-btn ds-btn-danger',
}
const sizes: Record<string, string> = { sm: 'ds-btn-sm', md: '', lg: 'ds-btn-lg' }

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string
  size?: string
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

export default function Btn({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }: BtnProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${variants[variant] ?? variants.primary} ${sizes[size] ?? ''} ${className}`}
    >
      {loading && (
        <span className="ds-spinner" style={{ width: 13, height: 13, display: 'inline-block' }} />
      )}
      {icon && !loading && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  )
}
