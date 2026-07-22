// build: 2026-07-22
import { supabase } from './supabase'

// Carrega o conjunto de feriados ativos (datas 'YYYY-MM-DD') a partir do Supabase.
export async function carregarFeriados(): Promise<Set<string>> {
  const { data } = await supabase.from('feriados').select('data').eq('ativo', 1)
  return new Set((data ?? []).map((f: any) => f.data))
}

// Lê o parâmetro global que ativa/desativa o ajuste de data para dia útil (padrão: ativado).
export async function carregarAjusteDiaUtilAtivo(): Promise<boolean> {
  const { data } = await supabase.from('parametros').select('valor').eq('chave', 'ajustar_entrega_dia_util').maybeSingle()
  return (data?.valor ?? 'sim') !== 'nao'
}

// Anda para frente a partir de `data` até cair num dia útil (não sábado, não domingo, não feriado).
export function postergarParaDiaUtil(data: Date, feriados: Set<string>): Date {
  const d = new Date(data)
  while (true) {
    const dow = d.getDay()
    const iso = d.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6 && !feriados.has(iso)) return d
    d.setDate(d.getDate() + 1)
  }
}
