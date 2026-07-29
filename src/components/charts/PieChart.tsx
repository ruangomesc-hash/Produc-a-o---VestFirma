import { corFatia } from './chartColors'
import type { FatiaGrafico } from '../../boardChartsMetrics'

type Props = {
  titulo: string
  slices: FatiaGrafico[]
  unidade: string
  embedded?: boolean
}

function arcoDonut(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  inicio: number,
  fim: number,
) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const p = (r: number, deg: number) => ({
    x: cx + r * Math.cos(rad(deg)),
    y: cy + r * Math.sin(rad(deg)),
  })
  if (fim - inicio >= 359.99) {
    return [
      `M ${cx - rOut} ${cy} A ${rOut} ${rOut} 0 1 1 ${cx + rOut} ${cy}`,
      `A ${rOut} ${rOut} 0 1 1 ${cx - rOut} ${cy}`,
      `M ${cx - rIn} ${cy} A ${rIn} ${rIn} 0 1 0 ${cx + rIn} ${cy}`,
      `A ${rIn} ${rIn} 0 1 0 ${cx - rIn} ${cy}`,
    ].join(' ')
  }
  const grande = fim - inicio > 180 ? 1 : 0
  const o0 = p(rOut, inicio)
  const o1 = p(rOut, fim)
  const i1 = p(rIn, fim)
  const i0 = p(rIn, inicio)
  return `M ${o0.x} ${o0.y} A ${rOut} ${rOut} 0 ${grande} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${rIn} ${rIn} 0 ${grande} 0 ${i0.x} ${i0.y} Z`
}

export function PieChart({ titulo, slices, unidade, embedded }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const cx = 80
  const cy = 80
  const rOut = 56
  const rIn = 38

  let angulo = -90
  const partes = slices.map((slice, i) => {
    const sweep = total > 0 ? (slice.value / total) * 360 : 0
    const inicio = angulo
    const fim = angulo + sweep
    angulo = fim
    const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
    return {
      ...slice,
      path: sweep > 0 ? arcoDonut(cx, cy, rOut, rIn, inicio, fim) : '',
      color: corFatia(i),
      pct,
    }
  })

  const body =
    total === 0 ? (
      <p className="chart-empty">Sem dados.</p>
    ) : (
      <div className={`chart-donut-layout ${embedded ? 'chart-donut-layout--inline' : ''}`}>
        <div className="chart-donut-wrap">
          <svg className="chart-donut-svg" viewBox="0 0 160 160" role="img" aria-label={titulo}>
            <circle cx={cx} cy={cy} r={rOut} fill="rgba(255,255,255,0.04)" />
            {partes.map((p) =>
              p.path ? (
                <path
                  key={p.id}
                  d={p.path}
                  fill={p.color}
                  fillRule="evenodd"
                  stroke="#1a222d"
                  strokeWidth={1}
                />
              ) : null,
            )}
            <text x={cx} y={cy - 4} textAnchor="middle" className="chart-donut-center-val">
              {total}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="chart-donut-center-lbl">
              {unidade}
            </text>
          </svg>
        </div>
        <ul
          className={`chart-legend ${embedded ? 'chart-legend--side' : 'chart-legend--compact'}`}
        >
          {partes.map((p) => (
            <li key={p.id} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: p.color }} aria-hidden />
              <span className="chart-legend-text">
                <span className="chart-legend-name">{p.label}</span>
                <span className="chart-legend-val">
                  {p.value} · {p.pct}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    )

  if (embedded) {
    return (
      <div className="chart-tile" aria-labelledby={`chart-${titulo}`}>
        <h4 id={`chart-${titulo}`} className="chart-tile-title">
          {titulo}
        </h4>
        {body}
      </div>
    )
  }

  return (
    <section className="chart-card" aria-labelledby={`chart-${titulo}`}>
      <h3 id={`chart-${titulo}`} className="chart-card-title">
        {titulo}
      </h3>
      {body}
    </section>
  )
}
