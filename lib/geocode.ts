// build: 2026-07-22
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EnderecoParaGeocodificar {
  logradouro?: string | null
  numero?:     string | null
  bairro?:     string | null
  cidade?:     string | null
  estado?:     string | null
}

// Geocodifica um endereço via Mapbox. Nunca lança erro — se o token não
// estiver configurado, a busca falhar ou nada for encontrado, retorna null
// e quem chamou segue em frente sem coordenada (não pode travar a criação
// do contrato por causa disso).
export async function geocodeEndereco(sb: SupabaseClient, end: EnderecoParaGeocodificar): Promise<{ lat: number; lng: number } | null> {
  try {
    if (!end.cidade) return null

    const { data } = await sb.from('parametros').select('valor').eq('chave', 'mapbox_token').maybeSingle()
    const token = data?.valor
    if (!token) return null

    const query = [end.logradouro, end.numero, end.bairro, end.cidade, end.estado, 'Brasil']
      .filter(Boolean).join(', ')
    if (!query) return null

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
      + `?access_token=${encodeURIComponent(token)}&country=BR&limit=1`
    const r = await fetch(url)
    if (!r.ok) return null

    const j = await r.json()
    const feat = j?.features?.[0]
    const center = feat?.center
    if (!Array.isArray(center) || center.length !== 2) return null

    const [lng, lat] = center
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return { lat, lng }
  } catch {
    return null
  }
}
