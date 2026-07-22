// build: 2026-07-22
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface ContratoMapa {
  id:      number
  numero:  string
  total:   number
  lat:     number
  lng:     number
  cidade?: string | null
  bairro?: string | null
  cliente?: string | null
}

interface Props {
  contratos:   ContratoMapa[]
  mapboxToken: string | null
}

const R$ = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MapaContratos({ contratos, mapboxToken }: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || contratos.length === 0) return
    let cancelado = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = mapboxToken

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [contratos[0].lng, contratos[0].lat],
        zoom: 11,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      const bounds = new mapboxgl.LngLatBounds()

      contratos.forEach(c => {
        const el = document.createElement('div')
        Object.assign(el.style, {
          width: '26px', height: '26px', borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)', background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          border: '2px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', cursor: 'pointer',
        })

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
          <div style="font-family:Inter,system-ui,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#0f172a">${c.cliente ?? 'Cliente'}</div>
            <div style="font-size:12px;color:#475569;margin-top:2px">${[c.bairro, c.cidade].filter(Boolean).join(' — ') || 'Local não informado'}</div>
            <div style="font-size:12px;color:#6366f1;font-weight:700;margin-top:4px">Contrato ${c.numero} · ${R$(c.total)}</div>
            <div class="ver-contrato" data-id="${c.id}" style="font-size:11px;color:#6366f1;margin-top:6px;text-decoration:underline;cursor:pointer">Ver contrato →</div>
          </div>
        `)

        // Clicar no pino abre o popup (comportamento nativo do Mapbox); o link
        // "Ver contrato →" dentro do popup é quem navega — evita a corrida entre
        // o listener nativo de toggle do popup e um listener próprio no marcador.
        popup.on('open', () => {
          popup.getElement()?.querySelector('.ver-contrato')?.addEventListener('click', () => router.push(`/contratos/${c.id}`))
        })

        new mapboxgl.Marker({ element: el })
          .setLngLat([c.lng, c.lat])
          .setPopup(popup)
          .addTo(map)

        bounds.extend([c.lng, c.lat])
      })

      if (contratos.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    }).catch(() => setErro('Não foi possível carregar o mapa.'))

    return () => {
      cancelado = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [contratos, mapboxToken, router])

  if (!mapboxToken) {
    return (
      <div style={{ height:420, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'var(--t-muted)' }}>
        <span style={{ fontSize:32 }}>🗺️</span>
        <div style={{ fontSize:'var(--fs-base)' }}>Mapa não configurado</div>
        <div style={{ fontSize:'var(--fs-sm)' }}>Configure o token do Mapbox em Parâmetros → Empresa.</div>
      </div>
    )
  }

  if (erro) {
    return (
      <div style={{ height:420, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t-muted)', fontSize:'var(--fs-base)' }}>
        {erro}
      </div>
    )
  }

  if (contratos.length === 0) {
    return (
      <div style={{ height:420, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'var(--t-muted)' }}>
        <span style={{ fontSize:32 }}>📍</span>
        <div style={{ fontSize:'var(--fs-base)' }}>Nenhum contrato ativo com localização definida ainda.</div>
      </div>
    )
  }

  return <div ref={containerRef} style={{ height:420, borderRadius:'var(--r-lg)', overflow:'hidden' }} />
}
