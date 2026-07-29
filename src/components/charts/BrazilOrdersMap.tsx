import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import brazilMap from '@svg-maps/brazil'
import type { EstadoResumo } from '../../pedidoLocalidade'

type Props = {
  estados: EstadoResumo[]
  embedded?: boolean
}

type Centroid = { x: number; y: number; fontSize: number }

function corEstado(pedidos: number, max: number): string {
  if (pedidos <= 0 || max <= 0) return 'rgba(255,255,255,0.08)'
  const t = pedidos / max
  const r = Math.round(26 + t * 200)
  const g = Math.round(34 + t * 150)
  const b = Math.round(45 + t * 40)
  return `rgb(${r},${g},${b})`
}

export function BrazilOrdersMap({ estados, embedded }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [centroids, setCentroids] = useState<Record<string, Centroid>>({})

  const porUf = useMemo(() => {
    const m = new Map<string, EstadoResumo>()
    for (const e of estados) m.set(e.uf, e)
    return m
  }, [estados])

  const max = estados.reduce((m, e) => Math.max(m, e.pedidos), 0)
  const totalComUf = estados.reduce((s, e) => s + e.pedidos, 0)

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const next: Record<string, Centroid> = {}
    for (const loc of brazilMap.locations) {
      const el = svg.querySelector<SVGGraphicsElement>(`#map-uf-${loc.id}`)
      if (!el) continue
      try {
        const box = el.getBBox()
        const size = Math.min(box.width, box.height)
        const fontSize = Math.max(8, Math.min(14, size * 0.38))
        next[loc.id.toUpperCase()] = {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          fontSize,
        }
      } catch {
        /* getBBox can fail if not rendered */
      }
    }
    setCentroids(next)
  }, [estados.length, totalComUf])

  const hint =
    totalComUf === 0 ? (
      <p className="chart-map-hint">
        Use <strong>Cidade/UF</strong> no endereço (ex.: São Paulo/SP).
      </p>
    ) : null

  const mapSvg = (
    <div className="chart-map-wrap">
      <svg
        ref={svgRef}
        className="chart-map-svg"
        viewBox={brazilMap.viewBox}
        role="img"
        aria-label="Mapa do Brasil com quantidade de pedidos por estado"
      >
        {brazilMap.locations.map((loc) => {
          const uf = loc.id.toUpperCase()
          const stats = porUf.get(uf)
          const pedidos = stats?.pedidos ?? 0
          const center = centroids[uf]
          const label =
            pedidos > 0 && center ? (
              <text
                x={center.x}
                y={center.y}
                className="chart-map-label"
                style={{ fontSize: center.fontSize }}
                aria-hidden="true"
              >
                {pedidos}
              </text>
            ) : null

          return (
            <g key={loc.id}>
              <path
                id={`map-uf-${loc.id}`}
                d={loc.path}
                fill={corEstado(pedidos, max)}
                stroke="rgba(232,185,35,0.35)"
                strokeWidth={0.6}
                tabIndex={0}
                aria-label={`${loc.name}: ${pedidos} pedidos`}
              />
              {label}
            </g>
          )
        })}
      </svg>
    </div>
  )

  const body = (
    <>
      {hint}
      {mapSvg}
    </>
  )

  if (embedded) {
    return <div className="chart-block-body chart-block-body--map">{body}</div>
  }

  return (
    <section className="chart-card" aria-labelledby="chart-brazil-map">
      <h3 id="chart-brazil-map" className="chart-card-title">
        Pedidos por estado
      </h3>
      {body}
    </section>
  )
}
