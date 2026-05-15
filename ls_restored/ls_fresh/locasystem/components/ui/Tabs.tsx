'use client'

interface Tab {
  key: string
  label: string
  icon?: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="ds-tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`ds-tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <span style={{ fontSize: 14 }}>{t.icon}</span>}
          {t.label}
          {t.count !== undefined && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              borderRadius: 99,
              background: active === t.key ? 'var(--c-primary-light)' : 'var(--bg-header)',
              color: active === t.key ? 'var(--c-primary)' : 'var(--t-muted)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '0 5px',
            }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
