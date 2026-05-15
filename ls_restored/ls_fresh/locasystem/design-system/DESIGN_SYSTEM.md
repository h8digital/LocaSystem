# LocaSystem — Design System v1.0

> **Fonte única de verdade** para todo o desenvolvimento visual do LocaSystem.  
> Inspirado em sistemas ERP brasileiros (Locamax/similares) — compacto, profissional, legível.

---

## 1. Princípios

| Princípio | Descrição |
|-----------|-----------|
| **Compacto** | Formulários e tabelas densos — máximo de informação sem scroll |
| **Legível** | Fonte 13px, contraste alto, labels descritivos |
| **Consistente** | Mesmos tokens de cor, espaço e tipografia em todo o app |
| **Profissional** | Visual de ERP maduro — sem gradientes decorativos, sem animações desnecessárias |

---

## 2. Paleta de Cores

### Primárias

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--c-primary` | `#17A2B8` | Botão principal, tabs ativas, links, foco de input |
| `--c-primary-dark` | `#138496` | Hover do botão primário |
| `--c-primary-light` | `#D1ECF1` | Fundo de badges info, hover de dropdown |
| `--c-primary-text` | `#0C5460` | Texto sobre fundo primary-light |

### Sucesso / Ação "Novo"

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--c-success` | `#28A745` | Botão "Novo" (verde outline), badge Ativo |
| `--c-success-dark` | `#218838` | Hover do botão sucesso |
| `--c-success-light` | `#D4EDDA` | Fundo de badge verde |
| `--c-success-text` | `#155724` | Texto sobre fundo success-light |

### Sidebar e Topbar

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--c-sidebar` | `#1E2A38` | Fundo da sidebar |
| `--c-sidebar-hover` | `#2A3A4A` | Hover de item nav |
| `--c-sidebar-active` | `#17A2B8` | Item ativo (borda esquerda) |
| `--c-topbar-from` | `#1E2A38` | Gradiente início topbar |
| `--c-topbar-to` | `#2C3E50` | Gradiente fim topbar |

### Backgrounds

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--bg` | `#F4F6F8` | Fundo da página |
| `--bg-card` | `#FFFFFF` | Cards e painéis |
| `--bg-input` | `#FFFFFF` | Fundo de inputs |
| `--bg-header` | `#F8F9FA` | Cabeçalho de cards, header de tabela |
| `--bg-row-even` | `#FFFFFF` | Linha par da tabela |
| `--bg-row-odd` | `#F8F9FA` | Linha ímpar da tabela (zebra) |
| `--bg-row-hover` | `#E8F4F8` | Hover da linha |
| `--bg-row-selected` | `#D1ECF1` | Linha selecionada |

### Textos

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--t-primary` | `#212529` | Texto principal |
| `--t-secondary` | `#495057` | Texto secundário, labels |
| `--t-muted` | `#6C757D` | Texto suave, hints, subtítulos |
| `--t-light` | `#ADB5BD` | Placeholders |
| `--t-link` | `#17A2B8` | Links |
| `--t-white` | `#FFFFFF` | Texto sobre fundo escuro |

### Bordas

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--border` | `#DEE2E6` | Borda padrão de cards, separadores |
| `--border-input` | `#CED4DA` | Borda de inputs e selects |
| `--border-focus` | `#17A2B8` | Borda ao focar input |
| `--border-table` | `#DEE2E6` | Borda interna de tabelas |

### Semânticas

| Token CSS | Cor | Usos |
|-----------|-----|------|
| `--c-danger` | `#DC3545` | Botão excluir, alertas de erro |
| `--c-warning` | `#FFC107` | Avisos, status pendente |
| `--c-info` | `#17A2B8` | Informações (igual primária) |

---

## 3. Tipografia

### Fontes

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--font` | `'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | **Toda a interface** |
| `--font-mono` | `'Roboto Mono', 'Courier New', monospace` | CPF, CNPJ, contratos, códigos |

### ⚠️ Regra obrigatória de font-size

**NUNCA use valores px hardcoded.** Sempre use os tokens `--fs-*`:

```tsx
// ✅ CORRETO
<span style={{ fontSize: 'var(--fs-base)' }}>Texto</span>
<div  style={{ fontSize: 'var(--fs-md)' }}>Label</div>

// ❌ ERRADO — nunca faça isso
<span style={{ fontSize: 13 }}>Texto</span>
<span style={{ fontSize: '13px' }}>Texto</span>
<span style={{ fontSize: '13pt' }}>Texto</span>
```

### Escala tipográfica — tokens `--fs-*`

| Token | Valor px | Peso típico | Onde usar |
|-------|----------|-------------|-----------|
| `--fs-xs`   | 10px | 700 | Seção de nav da sidebar (uppercase) |
| `--fs-sm`   | 11px | 400–600 | Badges, hints, subtítulos, `.ds-page-subtitle`, `.ds-label` |
| `--fs-md`   | 12px | 700 | Cabeçalhos de tabela (`th`), labels de campo |
| `--fs-base` | 13px | 400–600 | **Texto base do sistema** — corpo de tabela, inputs, botões, dropdowns |
| `--fs-lg`   | 15px | 700 | Títulos de página (`.ds-page-title`), títulos de card |
| `--fs-xl`   | 20px | 700 | Heading de seção maior (raros) |
| `--fs-kpi`  | 24px | 700 | Valores numéricos nos cards de KPI |
| `--fs-icon` | 16px | — | Ícones em botões, sidebar, emojis decorativos |

### Uso nos componentes

```tsx
// Título de página
<div className="ds-page-title">Contratos</div>      // --fs-lg 700

// Subtítulo / contador
<div className="ds-page-subtitle">42 registros</div> // --fs-sm 400

// Label de campo (obrigatório via FormField)
<label className="ds-label">Nome *</label>           // --fs-md 500

// Texto de tabela (herda do ds-table)
<td>Eduardo Henrich</td>                             // --fs-base 400

// E-mail ou dado secundário na célula
<div style={{ fontSize: 'var(--fs-md)', color: 'var(--t-muted)' }}>
  email@exemplo.com
</div>                                               // --fs-md

// CPF / CNPJ / código mono
<span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-base)' }}>
  939.939.270-87
</span>

// Badge
<span className="ds-badge ds-badge-blue">PF</span>  // --fs-sm 700

// Hint / mensagem de erro
<p className="ds-hint">Formato: dd/mm/aaaa</p>       // --fs-sm 400
```

---

## 4. Espaçamento

| Token | Valor | Uso principal |
|-------|-------|---------------|
| Gap entre campos de formulário | `10px` | `form-row` |
| Padding interno de card | `16px` | `.panel-body` |
| Padding de cabeçalho de card | `10px 16px` | `.panel-header` |
| Padding de célula de tabela | `7px 12px` | `.tbl td` |
| Padding de cabeçalho de tabela | `8px 12px` | `.tbl th` |
| Padding de botão | `5px 14px` | `.btn` (h=30px) |
| Padding de input | `5px 9px` | `.ds-input` (h=30px) |
| Padding de item de nav | `7px 14px` | `.ds-nav-item` |
| Padding de filtros | `10px 14px` | `.ds-filters` |
| Gap entre KPI cards | `10px` | Dashboard grid |
| Margem entre seções | `12px` | `margin-bottom` geral |

---

## 5. Bordas e Sombras

### Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--r-xs` | `2px` | Badges, botões de ação na tabela |
| `--r-sm` | `4px` | Inputs, botões, dropdowns |
| `--r-md` | `6px` | Cards, painéis, filtros |
| `--r-lg` | `8px` | Modais, slide panels |

### Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.08)` | Cards normais |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,.10)` | Dropdowns, hover de card |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,.12)` | Slide panels, modais |
| `--shadow-panel` | `2px 0 12px rgba(0,0,0,.15)` | Slide panel lateral |

---

## 6. Componentes

### 6.1 Botões

```html
<!-- Primário — azul (ação principal / Pesquisar) -->
<button class="ds-btn ds-btn-primary">Pesquisar</button>

<!-- Sucesso — verde outline (ação "Novo") -->
<button class="ds-btn ds-btn-success">+ Novo</button>

<!-- Secundário — cinza outline -->
<button class="ds-btn ds-btn-secondary">Cancelar</button>

<!-- Ghost — transparente azul -->
<button class="ds-btn ds-btn-ghost">Ver detalhes</button>

<!-- Danger — vermelho sólido -->
<button class="ds-btn ds-btn-danger">Excluir</button>

<!-- Salvar — azul sólido, bold, maior -->
<button class="ds-btn btn-save">✓ Salvar</button>

<!-- Tamanhos -->
<button class="ds-btn ds-btn-primary ds-btn-sm">Pequeno</button>
<button class="ds-btn ds-btn-primary ds-btn-lg">Grande</button>
```

**Regra de uso:**
- Toda tela tem no máximo **1 botão primário** (azul) — a ação principal
- "Novo" / "Incluir" sempre usa **`ds-btn-success`** (verde outline)
- "Salvar" dentro de formulários usa **`btn-save`**
- "Cancelar" / "Voltar" usa **`ds-btn-secondary`**

---

### 6.2 Inputs, Selects e Textareas

```html
<!-- Input -->
<div>
  <label class="ds-label">Nome do Campo</label>
  <input class="ds-input" type="text" placeholder="Digite aqui..." />
</div>

<!-- Select -->
<div>
  <label class="ds-label">Tipo</label>
  <select class="ds-select">
    <option value="">Selecione</option>
    <option>Opção 1</option>
  </select>
</div>

<!-- Textarea -->
<div>
  <label class="ds-label">Observações</label>
  <textarea class="ds-textarea" rows="3"></textarea>
</div>
```

**Classes disponíveis:** `ds-input`, `ds-select`, `ds-textarea` (também: `.inp`, `.sel`, `.tex`)

**Altura padrão:** 30px para inputs e selects.  
**Focus:** borda `#17A2B8` + ring `rgba(23,162,184,0.2)`.

---

### 6.3 LookupField (campo de busca + incluir)

```html
<div class="ds-lookup">
  <input class="ds-lookup-input" placeholder="Pesquisar cliente..." />
  <!-- Botão busca -->
  <button class="ds-lookup-btn" title="Pesquisar">🔍</button>
  <!-- Botão incluir novo -->
  <button class="ds-lookup-btn" title="Incluir novo">➕</button>
</div>
```

O componente React `<LookupField>` já implementa esse padrão.

---

### 6.4 Tabelas

```html
<table class="ds-table">
  <thead>
    <tr>
      <th>Coluna A</th>
      <th>Coluna B</th>
      <th>Ações</th>
    </tr>
  </thead>
  <tbody>
    <tr> <!-- linhas ímpares: branco -->
      <td>Valor A</td>
      <td>Valor B</td>
      <td>
        <!-- Botões de ação na tabela -->
        <div class="tbl-actions">
          <button class="tbl-btn edit" title="Editar">✏️</button>
          <button class="tbl-btn view" title="Ver">👁</button>
          <button class="tbl-btn del" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
    <tr> <!-- linhas pares: #F8F9FA -->
      ...
    </tr>
  </tbody>
</table>
```

**Regras:**
- Tabelas são sempre **zebradas** (linhas alternadas)
- Hover de linha: `#E8F4F8`
- Clicável: adicionar `data-clickable="true"` no `<tr>`
- Cabeçalhos: 12px, 700, `var(--t-secondary)`, uppercase não obrigatório
- Ações ficam na **última coluna**, alinhadas à direita

---

### 6.5 Badges / Status

```html
<!-- Verde — Ativo, Pago, Limpo, Disponível -->
<span class="ds-badge ds-badge-green">Ativo</span>

<!-- Azul — Locado, Parcial, Em andamento -->
<span class="ds-badge ds-badge-blue">Locado</span>

<!-- Amarelo — Pendente, Manutenção, Restrito -->
<span class="ds-badge ds-badge-yellow">Pendente</span>

<!-- Vermelho — Cancelado, Vencido, Negativado -->
<span class="ds-badge ds-badge-red">Cancelado</span>

<!-- Cinza — Rascunho, Inativo, Não consultado -->
<span class="ds-badge ds-badge-gray">Rascunho</span>

<!-- Laranja — Reservado, Atenção -->
<span class="ds-badge ds-badge-orange">Reservado</span>

<!-- Com dot (indicador colorido) -->
<span class="ds-badge ds-badge-green">
  <span class="ds-badge-dot"></span>Ativo
</span>
```

---

### 6.6 Cards / Painéis

```html
<!-- Card simples -->
<div class="ds-card">
  <div class="panel-header">
    <span class="panel-title">📄 Título do Painel</span>
    <button class="ds-btn ds-btn-success ds-btn-sm">+ Novo</button>
  </div>
  <div style="padding:16px">
    <!-- conteúdo -->
  </div>
</div>

<!-- Card KPI (Dashboard) -->
<div class="kpi-card" style="border-left:3px solid #17A2B8">
  <div class="kpi-label">Contratos Ativos</div>
  <div class="kpi-value">42</div>
  <div class="kpi-sub">↑ 3 este mês</div>
</div>

<!-- Seção interna (dentro de formulário) -->
<div class="form-section">
  <div class="form-section-title">📞 Telefones</div>
  <div class="form-section-body">
    <!-- campos -->
  </div>
</div>
```

---

### 6.7 Tabs

```html
<div class="ds-tabs">
  <button class="ds-tab active">📋 Dados Básicos</button>
  <button class="ds-tab">📍 Endereços</button>
  <button class="ds-tab">📞 Contatos</button>
  <button class="ds-tab">🔍 SPC</button>
</div>
```

**Regra:** tab ativa tem `color: #17A2B8` e `border-bottom: 2px solid #17A2B8`.

---

### 6.8 Filtros / Barra de busca

```html
<div class="ds-filters">
  <!-- Campo de busca -->
  <div class="search-field">
    <label class="ds-label">Nome/Descrição</label>
    <div class="ds-search">
      <svg class="ds-search-icon">...</svg>
      <input placeholder="Pesquisar..." />
    </div>
  </div>

  <!-- Select de filtro -->
  <div class="search-field">
    <label class="ds-label">Situação</label>
    <select class="ds-select" style="width:auto;min-width:130px">
      <option value="">Todos</option>
      <option>Ativo</option>
    </select>
  </div>

  <!-- Ações -->
  <div style="display:flex;gap:6px;align-items:flex-end">
    <button class="ds-btn ds-btn-primary">🔍 Pesquisar</button>
    <button class="ds-btn ds-btn-success">+ Novo</button>
  </div>
</div>
```

---

### 6.9 Slide Panel (drawer lateral)

Usar o componente React `<SlidePanel>`. Estrutura interna:

```
┌─────────────────────────────────────────┐
│ CABEÇALHO  (bg: #F8F9FA, border-bottom) │
│  Título · Subtítulo              [×]    │
├─────────────────────────────────────────┤
│ CONTEÚDO   (overflow-y: auto)           │
│  Tabs + Formulário                      │
├─────────────────────────────────────────┤
│ RODAPÉ     (bg: #F8F9FA, border-top)    │
│  [Cancelar]              [✓ Salvar]     │
└─────────────────────────────────────────┘
```

**Larguras disponíveis:** `sm=440px`, `md=560px`, `lg=740px`, `xl=920px`

---

### 6.10 Page Header

```html
<div class="ds-page-header">
  <div>
    <div class="ds-page-title">📄 Contratos</div>
    <div class="ds-page-subtitle">42 contrato(s) — 38 ativo(s)</div>
  </div>
  <div style="display:flex;gap:6px">
    <a href="/contratos/criar">
      <button class="ds-btn ds-btn-success">+ Novo Contrato</button>
    </a>
  </div>
</div>
```

---

### 6.11 Alertas

```html
<div class="ds-alert-error">Mensagem de erro</div>
<div class="ds-alert-warning">Aviso importante</div>
<div class="ds-alert-info">Informação</div>
<div class="ds-alert-success">Operação realizada com sucesso</div>
```

---

### 6.12 Estados especiais

```html
<!-- Loading -->
<div style="display:flex;align-items:center;gap:10px;padding:40px;justify-content:center">
  <div class="ds-spinner" style="width:20px;height:20px"></div>
  <span style="color:var(--t-muted);font-size:13px">Carregando...</span>
</div>

<!-- Empty state -->
<div class="ds-empty">
  <div class="ds-empty-icon">📋</div>
  <div class="ds-empty-title">Nenhum registro encontrado</div>
</div>

<!-- Add dashed (adicionar item) -->
<button class="ds-add-dashed">+ Adicionar Endereço</button>
```

---

## 7. Layout do App

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR  gradient(#1E2A38 → #2C3E50) h=42px                  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                  │
│  SIDEBAR   │  MAIN CONTENT                                    │
│  w=220px   │  padding: 16px 20px                             │
│  bg=#1E2A38│  background: #F4F6F8                            │
│            │                                                  │
│  sticky    │  ┌─ Page Header ─────────────────────────────┐  │
│  top=0     │  │ Título | Botão ação                        │  │
│  h=100vh   │  └───────────────────────────────────────────┘  │
│            │  ┌─ Filtros ──────────────────────────────────┐ │
│            │  └───────────────────────────────────────────┘  │
│            │  ┌─ Tabela / Conteúdo ────────────────────────┐ │
│            │  └───────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────┘
```

---

## 8. Componentes React (UI Library)

Todos em `/components/ui/` — importar via `@/components/ui`:

| Componente | Props principais | Uso |
|------------|-----------------|-----|
| `<PageHeader>` | `title`, `subtitle`, `actions` | Cabeçalho de toda tela |
| `<DataTable>` | `columns`, `data`, `loading`, `onRowClick`, `actions` | Tabela padrão |
| `<Filters>` | `fields`, `values`, `onChange`, `onClear` | Barra de filtros |
| `<Badge>` | `value`, `label`, `dot` | Status colorido |
| `<Btn>` | `variant`, `size`, `loading`, `icon` | Botão padronizado |
| `<SlidePanel>` | `open`, `onClose`, `title`, `width`, `footer` | Drawer lateral |
| `<Tabs>` | `tabs`, `active`, `onChange` | Abas |
| `<FormField>` | `label`, `required`, `hint`, `error` | Wrapper de campo |
| `<LookupField>` | `table`, `searchColumn`, `value`, `onChange`, `createPanel` | Campo de busca |
| `<ActionButtons>` | `onEdit`, `onDelete`, `onView`, `extra` | Ações de tabela |
| `<EmptyState>` | `icon`, `title`, `description` | Estado vazio |

### Classes de estilo para formulários

```tsx
import { inputCls, selectCls, textareaCls } from '@/components/ui'
// inputCls    = 'ds-input'
// selectCls   = 'ds-select'
// textareaCls = 'ds-textarea'

<input className={inputCls} />
<select className={selectCls} />
<textarea className={textareaCls} />
```

---

## 9. Padrão de Telas (Template)

Toda nova página deve seguir este padrão:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { PageHeader, DataTable, Filters, Badge, ActionButtons, Btn, SlidePanel, FormField, inputCls, selectCls } from '@/components/ui'

export default function MinhaPage() {
  const [lista, setLista]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string,string>>({ busca: '' })
  const [panel, setPanel]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')
  const [form, setForm]     = useState<any>({})

  async function load() { /* busca os dados */ }
  useEffect(() => { load() }, [filters])

  async function salvar() { /* salva o formulário */ }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Cabeçalho */}
      <PageHeader
        title="Nome da Tela"
        subtitle={`${lista.length} registro(s)`}
        actions={<Btn variant="success" onClick={() => setPanel(true)}>+ Novo</Btn>}
      />

      {/* 2. Filtros */}
      <Filters
        fields={[{ type: 'text', key: 'busca', placeholder: 'Pesquisar...', width: '260px' }]}
        values={filters}
        onChange={(k, v) => setFilters(f => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ busca: '' })}
      />

      {/* 3. Tabela */}
      <DataTable
        loading={loading}
        emptyMessage="Nenhum registro encontrado."
        columns={[
          { key: 'nome', label: 'Nome', render: r => r.nome },
        ]}
        data={lista}
        onRowClick={row => { setForm(row); setPanel(true) }}
        actions={row => <ActionButtons onEdit={() => { setForm(row); setPanel(true) }} />}
      />

      {/* 4. SlidePanel */}
      <SlidePanel
        open={panel}
        onClose={() => { setPanel(false); setErro('') }}
        title="Novo / Editar"
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setPanel(false)}>Cancelar</Btn>
            <Btn style={{ flex: 1 }} loading={saving} onClick={salvar}>✓ Salvar</Btn>
          </div>
        }
      >
        {erro && <div className="ds-alert-error" style={{ marginBottom: 12 }}>{erro}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Nome" required>
            <input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} className={inputCls} />
          </FormField>
        </div>
      </SlidePanel>
    </div>
  )
}
```

---

## 10. Convenções de Código

### Espaçamento inline
Use sempre `style={{}}` inline com valores CSS diretos — **não use classes Tailwind** para layout:

```tsx
// ✅ Correto
<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>

// ❌ Evitar
<div className="flex gap-2.5 items-center">
```

### Gap padrão entre elementos
```
Elementos de formulário: gap: 12px
Sections maiores:        gap: 16px
KPI cards / grid:        gap: 10px
Botões lado a lado:      gap: 6px–8px
```

### Referência a tokens
```tsx
// ✅ Correto — via var()
style={{ color: 'var(--t-primary)', background: 'var(--bg-card)' }}
style={{ borderColor: 'var(--border)', padding: '8px 12px' }}

// ❌ Evitar — hardcoded
style={{ color: '#212529', background: '#ffffff' }}
```

### Overflow e altura de campos
```
Inputs / Selects: height: 30px
Botões padrão:   height: 30px
Botão salvar:    height: 34px
Botão grande:    height: 36px
```

---

## 11. Mapa de Status → Badge

| Valor | Badge | Cor |
|-------|-------|-----|
| `ativo` | `ds-badge-green` | Verde |
| `inativo` | `ds-badge-gray` | Cinza |
| `rascunho` | `ds-badge-gray` | Cinza |
| `ativo` (contrato) | `ds-badge-green` | Verde |
| `encerrado` | `ds-badge-gray` | Cinza |
| `cancelado` | `ds-badge-red` | Vermelho |
| `inadimplente` | `ds-badge-yellow` | Amarelo |
| `pendente` (fatura) | `ds-badge-yellow` | Amarelo |
| `pago` | `ds-badge-green` | Verde |
| `vencido` | `ds-badge-red` | Vermelho |
| `parcial` | `ds-badge-blue` | Azul |
| `disponivel` | `ds-badge-green` | Verde |
| `locado` | `ds-badge-blue` | Azul |
| `manutencao` | `ds-badge-yellow` | Amarelo |
| `reservado` | `ds-badge-orange` | Laranja |
| `descartado` | `ds-badge-gray` | Cinza |
| `aberto` | `ds-badge-yellow` | Amarelo |
| `em_andamento` | `ds-badge-blue` | Azul |
| `concluido` | `ds-badge-green` | Verde |
| `limpo` (SPC) | `ds-badge-green` | Verde |
| `restrito` | `ds-badge-yellow` | Amarelo |
| `negativado` | `ds-badge-red` | Vermelho |
| `PF` | `ds-badge-blue` | Azul |
| `PJ` | `ds-badge-orange` | Laranja |

---

## 12. Responsividade

O sistema é primariamente **desktop-first** (ERP). Breakpoints:

| Breakpoint | Descrição |
|------------|-----------|
| `< 1024px` | Sidebar colapsa |
| `< 768px` | Layout mobile — tabelas viram cards |

---

## 13. Arquivo de tokens (CSS)

Todo o Design System está definido em:
```
/app/globals.css
```

As classes `ds-*` e `ap-*` são aliases mantidos para compatibilidade com o histórico de desenvolvimento do projeto. **Novas features devem usar `ds-*`.**

---

*Versão 1.0 — Março 2026 — LocaSystem / Kanoff Soluções*

---

## 🔘 Botões — Regra de Uso (atualizado)

### Hierarquia padrão

| Variante | Classe CSS | Quando usar |
|----------|-----------|-------------|
| `primary` (padrão) | `ds-btn ds-btn-primary` | Ação principal da tela: "Novo X", "Salvar", "Gerar" |
| `secondary` | `ds-btn ds-btn-secondary` | Ações secundárias: "Cancelar", "Voltar", "Gerar Documento" |
| `danger` | `ds-btn ds-btn-danger` | Ações destrutivas: "Cancelar Contrato", "Excluir" |
| `ghost` | `ds-btn ds-btn-ghost` | Links/ações discretas dentro de cards |

### ❌ Regras proibidas
- **Nunca usar `variant="success"`** para botões de "Novo X" — use sempre `primary`
- **Nunca usar cores hardcoded** (`bg-[#FF6B35]`, `text-[#FF6B35]`) — use variáveis CSS do sistema
- **Nunca usar emojis** em labels de `<Btn>` — use texto limpo
- **Nunca usar `<button>` raw** com Tailwind customizado — sempre usar o componente `<Btn>`

### ✅ Exemplo correto
```tsx
// ✅ Botão de criar — sempre primary
<Btn onClick={() => abrir()}>+ Novo Cliente</Btn>

// ✅ Ação secundária
<Btn variant="secondary" onClick={() => setPanel(false)}>Cancelar</Btn>

// ✅ Ação destrutiva
<Btn variant="danger" onClick={excluir}>Excluir</Btn>
```

---

## 🎨 Cores de destaque (valores monetários, totais)

Para valores monetários em destaque, use sempre a variável primária:
```tsx
<span style={{ color: 'var(--c-primary)', fontWeight: 700 }}>
  {fmt.money(total)}
</span>
```

Nunca use `text-[#FF6B35]` ou qualquer cor hardcoded.
