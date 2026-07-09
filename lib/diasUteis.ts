// build: 2026-07-09
import { supabase } from './supabase'

// Carrega o conjunto de feriados ativos (datas 'YYYY-MM-DD') a partir do Supabase.
export async function carregarFeriados(): Promise<Set<string>> {
  const { data } = await supabase.from('feriados').select('data').eq('ativo', 1)
  return new Set((data ?? []).map((f: any) => f.data))
}

// Anda para trás a partir de `data` até cair num dia útil (não sábado, não domingo, não feriado).
export function anteciparParaDiaUtil(data: Date, feriados: Set<string>): Date {
  const d = new Date(data)
  while (true) {
    const dow = d.getDay()
    const iso = d.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6 && !feriados.has(iso)) return d
    d.setDate(d.getDate() - 1)
  }
}
