'use client'
import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AcaoSecundaria {
  /** Texto exibido no item do menu */
  label: string
  /** Ícone (ReactNode — use Ico.Print, Ico.Mail, etc.) */
  icon?: ReactNode
  /** Handler ao clicar */
  onClick: () => void
  /** Número do grupo — grupos diferentes são separados por divisor */
  grupo?: number
  /** Exibe o item em vermelho (ação destrutiva) */
  destrutivo?: boolean
  /** Desabilita o item */
  desabilitado?: boolean
}

interface ActionButtonsProps {
  /** Abre formulário/drawer de edição */
  onEdit?: () => void
  /** Exclui / inativa o registro (com confirmação automática) */
  onDelete?: () => void
  /** Mensagem do confirm() antes de chamar onDelete */
  deleteConfirm?: string
  /** Abre visualização detalhada */
  onView?: () => void
  /** Ações extras sempre visíveis (botões avulsos — legado) */
  extra?: ReactNode
  /** Ações que ficam dentro do menu dropdown ⋯ */
  acoesSec?: AcaoSecundaria[]
}

// ─── Ícones inline ────────────────────────────────────────────────────────────

const IcoEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IcoView = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IcoTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IcoMore = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5"  cy="12" r="2"/>
    <circle cx="12" cy="12" r="2"/>
    <circle cx="19" cy="12" r="2"/>
  </svg>
)

// ─── Ícones prontos para uso em acoesSec ─────────────────────────────────────
// Exemplo: acoesSec={[{ icon: <Ico.Print />, label: 'Imprimir', ... }]}

export const Ico = {
  Print: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  ),
  Mail: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  WhatsApp: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Archive: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  Download: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Convert: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  Key: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  Ban: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ),
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ActionButtons({
  onEdit,
  onDelete,
  deleteConfirm,
  onView,
  extra,
  acoesSec = [],
}: ActionButtonsProps) {
  const [aberto, setAberto] = useState(false)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; right: number } | null>(null)
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const viewW = window.innerWidth
    // abrir para esquerda se estiver muito perto da borda direita
    setDropPos({
      top:   rect.bottom + 4,
      left:  rect.right - 180, // largura aprox do dropdown
      right: viewW - rect.right,
    })
  }, [])

  useEffect(() => {
    const clickFora = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        ref.current   && !ref.current.contains(t) &&
        dropRef.current && !dropRef.current.contains(t)
      ) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', clickFora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', clickFora)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  useEffect(() => {
    if (!aberto) return
    calcPos()
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [aberto, calcPos])

  const grupos = acoesSec.reduce<Record<number, AcaoSecundaria[]>>((acc, acao) => {
    const g = acao.grupo ?? 0
    if (!acc[g]) acc[g] = []
    acc[g].push(acao)
    return acc
  }, {})
  const gruposOrdenados = Object.keys(grupos).map(Number).sort((a, b) => a - b)

  const handleDelete = () => {
    if (confirm(deleteConfirm ?? 'Remover este registro?')) onDelete?.()
  }

  return (
    <div className="tbl-actions" ref={ref}>
      {extra}

      {onView && (
        <button className="tbl-btn view" onClick={onView} title="Visualizar">
          <IcoView />
        </button>
      )}

      {onEdit && (
        <button className="tbl-btn edit" onClick={onEdit} title="Editar">
          <IcoEdit />
        </button>
      )}

      {onDelete && (
        <button className="tbl-btn del" onClick={handleDelete} title="Excluir">
          <IcoTrash />
        </button>
      )}

      {acoesSec.length > 0 && (
        <div ref={ref}>
          <button
            ref={btnRef}
            className={`tbl-btn more${aberto ? ' more-open' : ''}`}
            onClick={() => setAberto(v => !v)}
            title="Mais ações"
          >
            <IcoMore />
          </button>

          {aberto && dropPos && (
            <div
              ref={dropRef}
              className="tbl-dropdown"
              style={{
                position: 'fixed',
                top:      dropPos.top,
                right:    dropPos.right,
                left:     'auto',
                zIndex:   9999,
                minWidth: 180,
              }}
            >
              {gruposOrdenados.map((g, idx) => (
                <div key={g}>
                  {idx > 0 && <div className="tbl-dropdown-divider" />}
                  {grupos[g].map((acao, i) => (
                    <button
                      key={i}
                      className={`tbl-dropdown-item${acao.destrutivo ? ' item-danger' : ''}${acao.desabilitado ? ' item-disabled' : ''}`}
                      disabled={acao.desabilitado}
                      onClick={() => {
                        if (acao.desabilitado) return
                        setAberto(false)
                        acao.onClick()
                      }}
                    >
                      {acao.icon && <span className="tbl-dropdown-ico">{acao.icon}</span>}
                      {acao.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
