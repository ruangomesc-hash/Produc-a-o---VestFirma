import { formatarDataHora, rotuloAutorHistorico, textoHistorico } from '../historicoEtapa'
import type { HistoricoEtapaEntry } from '../types'

type Props = {
  entries: HistoricoEtapaEntry[]
  defaultOpen?: boolean
}

export function CardHistoricoTimeline({ entries, defaultOpen = false }: Props) {
  if (!entries.length) return null

  const ordered = [...entries].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )

  return (
    <details className="card-historico" open={defaultOpen}>
      <summary>Histórico de etapas ({ordered.length})</summary>
      <ol className="card-historico-list">
        {ordered.map((entry) => {
          const autor = rotuloAutorHistorico(entry)
          return (
          <li
            key={entry.id}
            className={`card-historico-item historico-${entry.tipo}`}
          >
            <span className="card-historico-texto">{textoHistorico(entry)}</span>
            {autor ? (
              <span className="card-historico-autor">{autor}</span>
            ) : entry.tipo !== 'criado' ? (
              <span className="card-historico-autor card-historico-autor--legado">
                (antes do registro de usuário)
              </span>
            ) : null}
            <time className="card-historico-data" dateTime={entry.at}>
              {formatarDataHora(entry.at)}
            </time>
          </li>
          )
        })}
      </ol>
    </details>
  )
}
