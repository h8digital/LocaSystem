// build: 2026-07-22
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SlidePanel } from '@/components/ui'
import { fmt } from '@/lib/supabase'
import { APP_VERSION, CHANGELOG } from '@/lib/changelog'
import { NAV_SECTIONS as NAV } from '@/lib/navigation'

const allItems = NAV.flatMap(s => s.items)

function isActive(href: string, pathname: string) {
  if (pathname === href) return true
  if (href === '/dashboard') return false
  const hasExactChild = allItems.some(o => o.href === pathname && o.href !== href)
  return pathname.startsWith(href + '/') && !hasExactChild
}

const COLLAPSE_KEY = 'locasystem_sidebar_collapsed'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  const ultimaAtualizacao = CHANGELOG[0]?.data

  return (
    <>
    <aside className={`ds-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Botão de colapsar */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="ds-sidebar-toggle"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      {/* Brand */}
      <div style={{
        height: 56,
        padding: collapsed ? '0' : '0 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg,#6366f1,#818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 12px rgba(99,102,241,0.5)', flexShrink: 0,
        }}>L</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Loca<span style={{ color: '#818cf8' }}>System</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 1 }}>
              Gestão de Locação
            </div>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {NAV.map(s => (
          <div key={s.section}>
            {!collapsed && <div className="ds-nav-section">{s.section}</div>}
            {s.items.map(item => (
              <Link key={item.href} href={item.href}
                title={collapsed ? item.label : undefined}
                className={`ds-nav-item${isActive(item.href, pathname) ? ' active' : ''}`}>
                <span className="ds-nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Versão / novidades */}
      <button
        onClick={() => setChangelogOpen(true)}
        className="ds-sidebar-version"
        title={collapsed ? `v${APP_VERSION} — Novidades e correções` : undefined}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>🏷️</span>
        {!collapsed && (
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
              v{APP_VERSION} <span style={{ fontWeight: 400, color: 'var(--t-muted)' }}>· {fmt.date(ultimaAtualizacao)}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--c-primary)', marginTop: 1 }}>
              Ver novidades →
            </div>
          </div>
        )}
      </button>
    </aside>

    <SlidePanel
      open={changelogOpen}
      onClose={() => setChangelogOpen(false)}
      title="Novidades e Correções"
      subtitle={`Versão atual: v${APP_VERSION}`}
      width="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {CHANGELOG.map(v => (
          <div key={v.versao}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t-primary)' }}>v{v.versao}</span>
              <span style={{ fontSize: 12, color: 'var(--t-muted)' }}>{fmt.date(v.data)}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {v.itens.map((it, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--t-secondary)', lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0 }}>{it.tipo === 'feat' ? '✨' : it.tipo === 'security' ? '🔒' : '🐛'}</span>
                  <span>{it.texto}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SlidePanel>
    </>
  )
}
