// build: 2026-07-22
// Adicione uma entrada no topo desta lista a cada lançamento com mudanças visíveis ao usuário.

export type ChangelogTipo = 'feat' | 'fix' | 'security'

export interface ChangelogVersao {
  versao: string
  data:   string // YYYY-MM-DD
  itens:  { tipo: ChangelogTipo; texto: string }[]
}

export const APP_VERSION = '1.6.0'

export const CHANGELOG: ChangelogVersao[] = [
  { versao: '1.6.0', data: '2026-07-22', itens: [
    { tipo: 'fix',  texto: 'Busca de equipamentos/clientes não fica mais escondida atrás de tabelas em Contratos e Cotações' },
    { tipo: 'fix',  texto: 'Devolução prevista em fim de semana ou feriado agora é adiada para o próximo dia útil (antes era antecipada)' },
    { tipo: 'feat', texto: 'Aviso ao selecionar o período "Final de Semana" com início fora de uma sexta-feira' },
    { tipo: 'fix',  texto: 'Parâmetros do Sistema agora salva corretamente os campos das abas Financeiro e Contratos' },
  ]},
  { versao: '1.5.0', data: '2026-07-09', itens: [
    { tipo: 'feat', texto: 'Previsão de devolução passa a considerar dias úteis e feriados' },
    { tipo: 'fix',  texto: 'Contrato mensal calculava devolução errada e perdia a recorrência' },
  ]},
  { versao: '1.4.0', data: '2026-06-12', itens: [
    { tipo: 'feat', texto: 'Horário de funcionamento do site é recalculado automaticamente ao salvar parâmetros' },
    { tipo: 'fix',  texto: 'Inventário de equipamentos não mostrava contrato/cliente/devolução para itens já devolvidos' },
  ]},
  { versao: '1.3.0', data: '2026-06-08', itens: [
    { tipo: 'security', texto: 'Autenticação obrigatória em todas as rotas de API' },
    { tipo: 'fix',       texto: 'Máscaras de CNPJ, telefone, CEP e WhatsApp (com DDI) corrigidas' },
    { tipo: 'fix',       texto: 'Dados da empresa (CNPJ e demais campos) agora salvam corretamente em Parâmetros' },
  ]},
]
