import type { CidadeResumo } from '../../pedidoLocalidade'

type Props = {
  cidades: CidadeResumo[]
  embedded?: boolean
}

export function CidadesList({ cidades, embedded }: Props) {
  const body =
    cidades.length === 0 ? (
      <p className="chart-empty chart-empty--left">Nenhuma cidade identificada no endereço.</p>
    ) : (
      <ol className="chart-cidades-list">
        {cidades.map((c, i) => (
          <li key={c.chave} className="chart-cidade-item">
            <span className="chart-cidade-pos">{i + 1}</span>
            <span className="chart-cidade-nome">
              {c.cidade}
              {c.uf ? ` · ${c.uf}` : ''}
            </span>
            <span className="chart-cidade-stats">
              {c.pedidos} ped.
            </span>
          </li>
        ))}
      </ol>
    )

  if (embedded) {
    return <div className="chart-block-body">{body}</div>
  }

  return (
    <section className="chart-card" aria-labelledby="chart-cidades">
      <h3 id="chart-cidades" className="chart-card-title">
        Cidades nos pedidos
      </h3>
      {body}
    </section>
  )
}
