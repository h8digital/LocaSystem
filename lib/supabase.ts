import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client com service role
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Formatadores
export const fmt = {
  money: (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
  date: (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—',
  datetime: (d: string) => d ? new Date(d).toLocaleString('pt-BR') : '—',
}
