type Item = { nome: string; pedidos: number }

type Props = {
  titulo?: string
  itens: Item[]
  embedded?: boolean
}

export function HorizontalBarChart({ titulo, itens, embedded }: Props) {
  const max = itens.reduce((m, i) => Math.max(m, i.pedidos), 0)

  const body =
    itens.length === 0 ? (
      <p className="chart-empty">Nenhum segmento nos pedidos.</p>
    ) : (
      <ul className="chart-bars">
        {itens.map((item) => {
          const pct = max > 0 ? (item.pedidos / max) * 100 : 0
          return (
            <li key={item.nome} className="chart-bar-row">
              <span className="chart-bar-label" title={item.nome}>
                {item.nome}
              </span>
              <div className="chart-bar-track">
                <div className="chart-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="chart-bar-value">{item.pedidos}</span>
            </li>
          )
        })}
      </ul>
    )

  if (embedded) {
    return <div className="chart-block-body">{body}</div>
  }

  return (
    <section className="chart-card" aria-labelledby={titulo ? `chart-bar-${titulo}` : undefined}>
      {titulo ? (
        <h3 id={`chart-bar-${titulo}`} className="chart-card-title">
          {titulo}
        </h3>
      ) : null}
      {body}
    </section>
  )
}
