'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import SlidePanel from './SlidePanel'

interface LookupFieldProps {
  label?:string; required?:boolean; placeholder?:string
  value:number|string|null; displayValue?:string
  onChange:(id:number|string|null,record:any|null)=>void
  table:string; searchColumn:string; displayColumn?:string
  extraColumns?:string; filter?:Record<string,any>; orderBy?:string
  renderOption?:(row:any)=>React.ReactNode
  createPanel?:React.ReactNode|((props:{onClose:()=>void;onCreated:(r:any)=>void})=>React.ReactNode)
  createPanelTitle?:string; createPanelWidth?:string
  disabled?:boolean; error?:string; hint?:string; className?:string
}

// ─── Posição calculada para o dropdown ───────────────────────────────────────
interface DropPos { top:number; left:number; width:number; above:boolean }

export default function LookupField({
  label, required, placeholder='Pesquisar...', value, displayValue,
  onChange, table, searchColumn, displayColumn, extraColumns, filter={}, orderBy,
  renderOption, createPanel, createPanelTitle, createPanelWidth,
  disabled, error, hint, className=''
}: LookupFieldProps) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<any[]>([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [panelOpen,setPanelOpen]= useState(false)
  const [focused,  setFocused]  = useState(false)
  const [dropPos,  setDropPos]  = useState<DropPos|null>(null)

  const inputRef   = useRef<HTMLInputElement>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)   // wraps the whole field
  const dropRef    = useRef<HTMLDivElement>(null)   // the dropdown itself
  const display    = displayColumn || searchColumn

  // ── Calcular posição fixed do dropdown ──────────────────────────────────
  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const viewH = window.innerHeight
    const dropH = 260  // max expected dropdown height
    const below = rect.bottom + dropH < viewH
    setDropPos({
      top:   below ? rect.bottom + 4 : rect.top - dropH - 4,
      left:  rect.left,
      width: rect.width,
      above: !below,
    })
  }, [])

  // ── Fechar ao clicar fora ────────────────────────────────────────────────
  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node
      if (
        wrapRef.current  && !wrapRef.current.contains(t) &&
        dropRef.current  && !dropRef.current.contains(t)
      ) {
        setOpen(false); setFocused(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Recalcular posição ao rolar / redimensionar ─────────────────────────
  useEffect(() => {
    if (!open) return
    calcPos()
    window.addEventListener('scroll',  calcPos, true)
    window.addEventListener('resize',  calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open, calcPos])

  // ── Fechar com ESC ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setFocused(false) } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  async function search(q: string) {
    setLoading(true)
    const extraCols = extraColumns ? extraColumns.split(',').map(s => s.trim()).filter(Boolean) : []
    const cols = ['id', searchColumn, ...extraCols, ...(display !== searchColumn ? [display] : [])].join(',')
    let qb = supabase.from(table).select(cols)
    Object.entries(filter).forEach(([k, v]) => { qb = qb.eq(k, v) })
    if (q.trim()) qb = qb.ilike(searchColumn, `%${q}%`)
    qb = qb.order(orderBy ?? searchColumn).limit(10)
    const { data } = await qb
    setResults(data ?? [])
    setLoading(false)
  }

  function openDropdown() {
    calcPos()
    setFocused(true)
    setOpen(true)
    if (!query && results.length === 0) search('')
  }

  function handleFocus()  { openDropdown() }
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value); setOpen(true); calcPos(); search(e.target.value)
  }
  function handleSelect(row: any) { onChange(row.id, row); setQuery(''); setOpen(false); setFocused(false) }
  function handleClear(e: React.MouseEvent) {
    e.stopPropagation(); onChange(null, null); setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const hasValue = !!value
  const showText = hasValue ? (displayValue || String(value)) : ''

  return (
    <div className={className} style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {label && (
        <label className="ds-label">
          {label}{required && <span style={{ color:'var(--c-danger)', marginLeft:2 }}>*</span>}
        </label>
      )}

      {/* Campo de entrada */}
      <div ref={wrapRef} style={{ position:'relative' }}>
        <div
          className="ds-lookup"
          style={{ opacity:disabled?0.6:1, borderColor:error?'var(--c-danger)':undefined }}
        >
          <div
            style={{ flex:1, display:'flex', alignItems:'center', minWidth:0, cursor:'text', overflow:'hidden' }}
            onClick={() => { if (!disabled) { inputRef.current?.focus(); openDropdown() } }}
          >
            {hasValue && !focused
              ? <span style={{ padding:'0 11px', fontSize:'var(--fs-base)', color:'var(--t-primary)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
                  lineHeight:'28px', display:'block' }}>
                  {showText}
                </span>
              : <input
                  ref={inputRef}
                  className="ds-lookup-input"
                  type="text"
                  value={query}
                  onChange={handleInput}
                  onFocus={handleFocus}
                  placeholder={hasValue ? showText : placeholder}
                  disabled={!!disabled}
                />
            }
          </div>

          {hasValue && (
            <button type="button" onClick={handleClear}
              style={{ padding:'0 8px', background:'transparent', border:'none', color:'var(--t-muted)',
                cursor:'pointer', display:'flex', alignItems:'center', alignSelf:'stretch', flexShrink:0 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.5 1.5L1.5 10.5M1.5 1.5L10.5 10.5"/>
              </svg>
            </button>
          )}

          <button type="button" className="ds-lookup-btn" disabled={!!disabled}
            onClick={() => { if (!disabled) { inputRef.current?.focus(); openDropdown() } }}
            title="Pesquisar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>

          {createPanel && (
            <button type="button" className="ds-lookup-btn" disabled={!!disabled}
              onClick={() => setPanelOpen(true)} title="Incluir novo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown — renderizado via portal com position:fixed */}
      {open && dropPos && (
        <div
          ref={dropRef}
          className="ds-dropdown"
          style={{
            position: 'fixed',
            top:    dropPos.above ? 'auto' : dropPos.top,
            bottom: dropPos.above ? `${window.innerHeight - dropPos.top}px` : 'auto',
            left:   dropPos.left,
            width:  dropPos.width,
            zIndex: 9999,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
              color:'var(--t-muted)', fontSize:'var(--fs-sm)' }}>
              <div className="ds-spinner" style={{ width:13, height:13 }}/>Buscando...
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding:'10px 14px', color:'var(--t-muted)', fontSize:'var(--fs-sm)' }}>
              {query ? `Nenhum resultado para "${query}"` : 'Nenhum registro.'}
              {createPanel && (
                <button type="button"
                  onClick={() => { setPanelOpen(true); setOpen(false) }}
                  style={{ display:'block', marginTop:6, color:'var(--c-primary)', fontWeight:600,
                    background:'none', border:'none', cursor:'pointer', fontSize:'var(--fs-sm)' }}>
                  + Criar novo registro
                </button>
              )}
            </div>
          ) : (
            <ul style={{ listStyle:'none', margin:0, padding:0 }}>
              {results.map(row => (
                <li key={row.id}>
                  <button type="button"
                    onClick={() => handleSelect(row)}
                    className={`ds-dropdown-item ${row.id === value ? 'selected' : ''}`}>
                    {row.id === value && (
                      <span style={{ marginRight:6, color:'var(--c-primary)' }}>✓</span>
                    )}
                    {renderOption ? renderOption(row) : <span>{row[display]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hint  && !error && <p className="ds-hint">{hint}</p>}
      {error && <p className="ds-error">{error}</p>}

      {createPanel && (
        <SlidePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          title={createPanelTitle ?? 'Novo Registro'}
          subtitle="Preencha os dados para criar um novo registro"
          width={createPanelWidth ?? 'md'}
        >
          {typeof createPanel === 'function'
            ? (createPanel as any)({
                onClose:   () => setPanelOpen(false),
                onCreated: (row: any) => { handleSelect(row); setPanelOpen(false) },
              })
            : createPanel
          }
        </SlidePanel>
      )}
    </div>
  )
}
