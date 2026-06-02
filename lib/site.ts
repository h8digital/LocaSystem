// URL pública do site Kanoff — onde o cliente acessa as cotações
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_KANOFF_URL ?? 'https://www.kanoffsolucoes.com.br'

export function linkCotacao(token: string) {
  return `${SITE_URL}/minha-cotacao/${token}`
}
