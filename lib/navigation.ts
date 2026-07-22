// build: 2026-07-22
// Fonte única de navegação — usada pela Sidebar, pelo Topbar (título da página)
// e pelo Command Palette (Ctrl/Cmd+K). Evita manter listas duplicadas.

export interface NavItem {
  href:   string
  icon:   string
  label:  string
  /** Título mais descritivo para o cabeçalho da página (Topbar). Se ausente, usa `label`. */
  titulo?: string
}

export interface NavSection {
  section: string
  items:   NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard',  icon: '⊞',  label: 'Dashboard'  },
    ],
  },
  {
    section: 'Comercial',
    items: [
      { href: '/cotacoes',   icon: '📋', label: 'Cotações'   },
      { href: '/contratos',  icon: '📄', label: 'Contratos'  },
      { href: '/clientes',   icon: '👥', label: 'Clientes'   },
      { href: '/financeiro', icon: '💰', label: 'Financeiro' },
    ],
  },
  {
    section: 'Estoque',
    items: [
      { href: '/equipamentos', icon: '🔧', label: 'Equipamentos' },
      { href: '/manutencoes',  icon: '🔩', label: 'Manutenções'  },
    ],
  },
  {
    section: 'Documentos',
    items: [
      { href: '/relatorios',              icon: '📊', label: 'Relatórios'       },
      { href: '/relatorios/equipamentos', icon: '📦', label: 'Catálogo',         titulo: 'Catálogo de Equipamentos' },
      { href: '/templates',               icon: '🖨️', label: 'Templates de Doc', titulo: 'Templates de Documento'   },
    ],
  },
]

// Destinos que não aparecem na sidebar principal (acessados pelo menu do usuário no Topbar).
export const NAV_EXTRA: NavItem[] = [
  { href: '/usuarios',   icon: '👤', label: 'Usuários'   },
  { href: '/parametros', icon: '⚙️', label: 'Parâmetros', titulo: 'Parâmetros do Sistema' },
]

export const NAV_ALL: NavItem[] = [...NAV_SECTIONS.flatMap(s => s.items), ...NAV_EXTRA]

// Ações rápidas de criação — só rotas que realmente existem como tela própria.
export const ACOES_RAPIDAS: NavItem[] = [
  { href: '/contratos/criar',  icon: '➕', label: 'Novo Contrato'   },
  { href: '/cotacoes/criar',   icon: '➕', label: 'Nova Cotação'    },
  { href: '/cotacoes/rapida',  icon: '⚡', label: 'Cotação Rápida'  },
]
