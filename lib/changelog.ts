// build: 2026-07-22
// Adicione uma entrada no topo desta lista a cada lançamento com mudanças visíveis ao usuário.

export type ChangelogTipo = 'feat' | 'fix' | 'security'

export interface ChangelogVersao {
  versao: string
  data:   string // YYYY-MM-DD
  itens:  { tipo: ChangelogTipo; texto: string }[]
}

export const APP_VERSION = '1.8.0'

export const CHANGELOG: ChangelogVersao[] = [
  { versao: '1.8.0', data: '2026-08-04', itens: [
    { tipo: 'feat', texto: 'Ordem de Locação impressa agora mostra a data/hora em que a locação foi feita e o prazo de entrega do equipamento (até 12:00 ou até 18:00, conforme o horário do pedido)' },
    { tipo: 'feat', texto: 'Tela do contrato e listagem de contratos passam a exibir o horário de entrega previsto do equipamento' },
  ]},
  { versao: '1.7.0', data: '2026-07-31', itens: [
    { tipo: 'feat', texto: 'Notificações do sistema agora aparecem em um card no canto superior direito (estilo macOS), no lugar dos alertas do navegador' },
    { tipo: 'fix',  texto: 'CNPJ da empresa não ficava salvo em Parâmetros e por isso sumia da promissória e do comprovante de locação' },
    { tipo: 'feat', texto: 'Mapa de contratos ativos no Dashboard (Mapbox)' },
    { tipo: 'fix',  texto: 'Clique no pino do mapa do Dashboard não navegava para o contrato' },
    { tipo: 'feat', texto: 'Command Palette (Ctrl/Cmd+K) com atalhos de teclado para navegação rápida' },
  ]},
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
