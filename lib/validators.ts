/* ═══════════════════════════════════════════════════════════════
   Validadores de CPF e CNPJ — Algoritmo oficial da Receita Federal
   ═══════════════════════════════════════════════════════════════ */

export function validarCPF(cpf: string): boolean {
  const s = cpf.replace(/\D/g, '')
  if (s.length !== 11) return false
  if (/^(\d)\1{10}$/.test(s)) return false // todos iguais

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(s[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(s[10])
}

export function validarCNPJ(cnpj: string): boolean {
  const s = cnpj.replace(/\D/g, '')
  if (s.length !== 14) return false
  if (/^(\d)\1{13}$/.test(s)) return false

  const calc = (str: string, pesos: number[]) =>
    pesos.reduce((acc, p, i) => acc + parseInt(str[i]) * p, 0)

  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  let r = calc(s, p1) % 11
  if ((r < 2 ? 0 : 11 - r) !== parseInt(s[12])) return false

  const p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  r = calc(s, p2) % 11
  return (r < 2 ? 0 : 11 - r) === parseInt(s[13])
}

export function validarDoc(doc: string, tipo: 'PF' | 'PJ'): boolean {
  return tipo === 'PJ' ? validarCNPJ(doc) : validarCPF(doc)
}

export function formatarCPF(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 11)
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '')
}

export function formatarCNPJ(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 14)
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').replace(/-$/, '')
}

export function formatarDoc(v: string, tipo: 'PF' | 'PJ'): string {
  return tipo === 'PJ' ? formatarCNPJ(v) : formatarCPF(v)
}

export function formatarPhone(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 11)
  return v.length <= 10
    ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
    : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export function formatarCEP(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 8)
  return v.replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '')
}
