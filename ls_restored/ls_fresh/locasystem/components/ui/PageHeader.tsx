'use client'
import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  icon?: string
}

export default function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div className="ds-page-header">
      <div>
        <h1 className="ds-page-title">
          {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="ds-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
