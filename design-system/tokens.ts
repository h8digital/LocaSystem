/**
 * LocaSystem Design System — Tokens TypeScript
 * Use estes valores ao criar estilos inline (style={{}})
 * Fonte canônica: /app/globals.css
 * 
 * REGRA DE OURO: NUNCA use valores px hardcoded.
 * Sempre use 'var(--fs-*)' para tamanhos de fonte
 * e 'var(--token)' para cores, espaçamentos e bordas.
 */

// ── Cores ──────────────────────────────────────────────────────
export const colors = {
  primary:       '#17A2B8',
  primaryDark:   '#138496',
  primaryLight:  '#D1ECF1',
  primaryText:   '#0C5460',
  success:       '#28A745',
  successLight:  '#D4EDDA',
  successText:   '#155724',
  danger:        '#DC3545',
  dangerLight:   '#F8D7DA',
  dangerText:    '#721C24',
  warning:       '#FFC107',
  warningLight:  '#FFF3CD',
  warningText:   '#856404',
  sidebar:       '#1E2A38',
  topbarFrom:    '#1E2A38',
  topbarTo:      '#2C3E50',
  bg:            '#F4F6F8',
  bgCard:        '#FFFFFF',
  bgHeader:      '#F8F9FA',
  bgRowOdd:      '#F8F9FA',
  bgRowHover:    '#E8F4F8',
  textPrimary:   '#212529',
  textSecondary: '#495057',
  textMuted:     '#6C757D',
  textLight:     '#ADB5BD',
  border:        '#DEE2E6',
  borderInput:   '#CED4DA',
} as const

// ── Escala Tipográfica ─────────────────────────────────────────
// IMPORTANTE: use sempre as variáveis CSS, nunca os valores px diretamente
export const fontSize = {
  xs:   'var(--fs-xs)',    // 10px — seções de nav, rótulos menores
  sm:   'var(--fs-sm)',    // 11px — hints, badges, subtítulos, labels
  md:   'var(--fs-md)',    // 12px — cabeçalhos de tabela, labels de campo
  base: 'var(--fs-base)',  // 13px — texto base, corpo de tabela, inputs, botões
  lg:   'var(--fs-lg)',    // 15px — títulos de página, card headers
  xl:   'var(--fs-xl)',    // 20px — heading de seção maior
  kpi:  'var(--fs-kpi)',   // 24px — valores KPI no dashboard
  icon: 'var(--fs-icon)',  // 16px — ícones em botões e sidebar
} as const

// ── Famílias de fonte ──────────────────────────────────────────
export const fontFamily = {
  base: 'var(--font)',      // Roboto — toda interface
  mono: 'var(--font-mono)', // Roboto Mono — CPF, CNPJ, códigos, contratos
} as const

// ── Espaçamento ────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  6,
  md:  10,
  lg:  12,
  xl:  16,
  xxl: 20,
} as const

// ── Bordas ─────────────────────────────────────────────────────
export const radius = {
  xs: 'var(--r-xs)',  // 2px — badges, tbl-btn
  sm: 'var(--r-sm)',  // 4px — inputs, botões padrão
  md: 'var(--r-md)',  // 6px — cards, filtros
  lg: 'var(--r-lg)',  // 8px — modais, slide panels
} as const

// ── Sombras ────────────────────────────────────────────────────
export const shadows = {
  sm:    'var(--shadow-sm)',
  md:    'var(--shadow-md)',
  lg:    'var(--shadow-lg)',
  panel: 'var(--shadow-panel)',
} as const

// ── Classes CSS prontas ────────────────────────────────────────
export const cls = {
  input:        'ds-input',
  select:       'ds-select',
  textarea:     'ds-textarea',
  label:        'ds-label',
  card:         'ds-card',
  btnPrimary:   'ds-btn ds-btn-primary',
  btnSuccess:   'ds-btn ds-btn-success',
  btnSecondary: 'ds-btn ds-btn-secondary',
  btnDanger:    'ds-btn ds-btn-danger',
  btnGhost:     'ds-btn ds-btn-ghost',
  btnSave:      'ds-btn btn-save',
  btnSm:        'ds-btn-sm',
  btnLg:        'ds-btn-lg',
  badgeGreen:   'ds-badge ds-badge-green',
  badgeBlue:    'ds-badge ds-badge-blue',
  badgeYellow:  'ds-badge ds-badge-yellow',
  badgeRed:     'ds-badge ds-badge-red',
  badgeGray:    'ds-badge ds-badge-gray',
  badgeOrange:  'ds-badge ds-badge-orange',
  alertError:   'ds-alert-error',
  alertWarning: 'ds-alert-warning',
  alertInfo:    'ds-alert-info',
  alertSuccess: 'ds-alert-success',
  inset:        'ds-inset',
  addDashed:    'ds-add-dashed',
  spinner:      'ds-spinner',
  pageTitle:    'ds-page-title',
  pageSubtitle: 'ds-page-subtitle',
} as const

// ── Mapa de status → badge ─────────────────────────────────────
export const statusBadge: Record<string, string> = {
  ativo:          'ds-badge ds-badge-green',
  inativo:        'ds-badge ds-badge-gray',
  rascunho:       'ds-badge ds-badge-gray',
  encerrado:      'ds-badge ds-badge-gray',
  cancelado:      'ds-badge ds-badge-red',
  inadimplente:   'ds-badge ds-badge-yellow',
  pendente:       'ds-badge ds-badge-yellow',
  pago:           'ds-badge ds-badge-green',
  vencido:        'ds-badge ds-badge-red',
  parcial:        'ds-badge ds-badge-blue',
  disponivel:     'ds-badge ds-badge-green',
  locado:         'ds-badge ds-badge-blue',
  manutencao:     'ds-badge ds-badge-yellow',
  reservado:      'ds-badge ds-badge-orange',
  descartado:     'ds-badge ds-badge-gray',
  aberto:         'ds-badge ds-badge-yellow',
  em_andamento:   'ds-badge ds-badge-blue',
  concluido:      'ds-badge ds-badge-green',
  limpo:          'ds-badge ds-badge-green',
  restrito:       'ds-badge ds-badge-yellow',
  negativado:     'ds-badge ds-badge-red',
  nao_consultado: 'ds-badge ds-badge-gray',
  PF:             'ds-badge ds-badge-blue',
  PJ:             'ds-badge ds-badge-orange',
}

// ── Alturas padronizadas de componentes ────────────────────────
export const heights = {
  input:   '30px',
  btn:     '30px',
  btnSm:   '26px',
  btnLg:   '36px',
  btnSave: '34px',
  topbar:  '42px',
  sidebar: '100vh',
} as const

// ── Larguras de Slide Panel ────────────────────────────────────
export const panelWidths = {
  sm: 440,
  md: 560,
  lg: 740,
  xl: 920,
} as const
