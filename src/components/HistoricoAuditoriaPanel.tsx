import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  describeAuditAction,
  groupAuditByActor,
  rotuloAutor,
  sortEntriesNewestFirst,
  type ActorColumn,
} from '../auditDisplay'
import { fetchAuditLog, type AuditEntry } from '../auditLog'
import { formatarDataHora } from '../historicoEtapa'

type ViewMode = 'por-usuario' | 'todos'

function AuditHistoryCard({
  entry,
  showAuthor,
}: {
  entry: AuditEntry
  showAuthor?: boolean
}) {
  const { label, tone } = describeAuditAction(entry.action)

  return (
    <article className={`historico-card historico-card--${tone}`}>
      <div className="historico-card-top">
        <time className="historico-card-time" dateTime={entry.at}>
          {formatarDataHora(entry.at)}
        </time>
        <span className="historico-card-badge">{label}</span>
      </div>
      {showAuthor ? (
        <p className="historico-card-autor">{rotuloAutor(entry)}</p>
      ) : null}
      <p className="historico-card-summary">{entry.summary}</p>
      {entry.detail ? <p className="historico-card-detail">{entry.detail}</p> : null}
    </article>
  )
}

function HistoricoColumn({
  title,
  subtitle,
  countLabel,
  entries,
  showAuthorInCards,
}: {
  title: string
  subtitle?: string | null
  countLabel: string
  entries: AuditEntry[]
  showAuthorInCards?: boolean
}) {
  return (
    <section className="kanban-column historico-column">
      <header className="column-header historico-column-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <span className="historico-column-sub">{subtitle}</span> : null}
          <span className="column-count">{countLabel}</span>
        </div>
      </header>
      <div className="column-cards historico-column-cards">
        {entries.map((e) => (
          <AuditHistoryCard key={e.id} entry={e} showAuthor={showAuthorInCards} />
        ))}
      </div>
    </section>
  )
}

export function HistoricoAuditoriaPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('por-usuario')

  const carregar = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchAuditLog(400)
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const sortedAll = useMemo(() => sortEntriesNewestFirst(entries), [entries])
  const byUser = useMemo(() => groupAuditByActor(entries), [entries])

  const totalLabel =
    entries.length === 1 ? '1 ação registrada' : `${entries.length} ações registradas`

  return (
    <div className="historico-auditoria">
      <div className="historico-auditoria-top">
        <header className="historico-auditoria-header">
          <div>
            <h1 className="historico-auditoria-title">Histórico de ações</h1>
            <p className="historico-auditoria-sub">
              Pedidos, quadro, login e usuários — como no kanban, por pessoa ou tudo na mesma
              linha do tempo.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>

        <div className="historico-auditoria-toolbar">
          <div className="historico-view-tabs" role="tablist" aria-label="Modo de visualização">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'por-usuario'}
              className={`historico-view-tab ${view === 'por-usuario' ? 'is-active' : ''}`}
              onClick={() => setView('por-usuario')}
            >
              Por usuário
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'todos'}
              className={`historico-view-tab ${view === 'todos' ? 'is-active' : ''}`}
              onClick={() => setView('todos')}
            >
              Todos juntos
            </button>
          </div>
          {!loading && !error && entries.length > 0 ? (
            <span className="historico-auditoria-meta">{totalLabel}</span>
          ) : null}
        </div>

        {error ? (
          <p className="historico-auditoria-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="historico-auditoria-board board-scroll">
        {loading && entries.length === 0 ? (
          <p className="historico-auditoria-empty historico-auditoria-empty--board">
            Carregando histórico…
          </p>
        ) : null}

        {!loading && !error && entries.length === 0 ? (
          <p className="historico-auditoria-empty historico-auditoria-empty--board">
            Nenhuma ação registrada ainda.
          </p>
        ) : null}

        {!error && entries.length > 0 ? (
          <div className="board-columns historico-columns">
            {view === 'por-usuario' ? (
              byUser.map((col: ActorColumn) => (
                <HistoricoColumn
                  key={col.key}
                  title={col.title}
                  subtitle={col.subtitle !== col.title ? col.subtitle : null}
                  countLabel={
                    col.entries.length === 1
                      ? '1 ação'
                      : `${col.entries.length} ações`
                  }
                  entries={col.entries}
                />
              ))
            ) : (
              <HistoricoColumn
                title="Linha do tempo"
                countLabel={totalLabel}
                entries={sortedAll}
                showAuthorInCards
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
