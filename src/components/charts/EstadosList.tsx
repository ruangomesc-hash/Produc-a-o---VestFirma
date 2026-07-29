import type { EstadoResumo } from '../../pedidoLocalidade'

type Props = {
  estados: EstadoResumo[]
  totalPedidos: number
  embedded?: boolean
}

export function EstadosList({ estados, totalPedidos, embedded }: Props) {
  const body =
    estados.length === 0 ? (
      <p className="chart-empty chart-empty--left">
        Nenhum pedido com UF no endereço. Use <strong>Cidade/UF</strong> (ex.: Recife/PE).
      </p>
    ) : (
      <ol className="chart-estados-list">
        {estados.map((e, i) => {
          const pct =
            totalPedidos > 0 ? Math.round((e.pedidos / totalPedidos) * 1000) / 10 : 0
          return (
            <li key={e.uf} className="chart-estado-item">
              <span className="chart-estado-pos">{i + 1}</span>
              <span className="chart-estado-uf">{e.uf}</span>
              <span className="chart-estado-stats">
                <strong>{e.pedidos}</strong>
                <span className="chart-estado-pct">{pct}%</span>
              </span>
            </li>
          )
        })}
      </ol>
    )

  if (embedded) {
    return <div className="chart-block-body">{body}</div>
  }

  return (
    <section className="chart-card" aria-labelledby="chart-estados">
      <h3 id="chart-estados" className="chart-card-title">
        Pedidos por estado
      </h3>
      {body}
    </section>
  )
}
