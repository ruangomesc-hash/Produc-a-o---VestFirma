import { useCallback, useEffect, useState } from 'react'
import { fetchAuditLog, type AuditEntry } from '../auditLog'
import { USER_ROLE_LABELS, type UserRole } from '../userRoles'
import { formatarDataHora } from '../historicoEtapa'

function rotuloAutor(e: AuditEntry): string {
  const role = e.actorRole ? USER_ROLE_LABELS[e.actorRole as UserRole] : null
  if (role && e.actorName) return `${e.actorName} · ${role}`
  return e.actorName || e.actorEmail || '—'
}

export function HistoricoAuditoriaPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="historico-auditoria-panel">
      <header className="historico-auditoria-header">
        <div>
          <h2>Histórico de ações</h2>
          <p className="historico-auditoria-sub">
            Registro de tudo que usuários fazem no app (pedidos, quadro, login, usuários, etc.).
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={carregar} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      {error && (
        <p className="historico-auditoria-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && entries.length === 0 ? (
        <p className="historico-auditoria-empty">Nenhuma ação registrada ainda.</p>
      ) : null}

      <ol className="historico-auditoria-list">
        {entries.map((e) => (
          <li key={e.id} className="historico-auditoria-item">
            <div className="historico-auditoria-meta">
              <time dateTime={e.at}>{formatarDataHora(e.at)}</time>
              <span className="historico-auditoria-autor">{rotuloAutor(e)}</span>
              <code className="historico-auditoria-action">{e.action}</code>
            </div>
            <p className="historico-auditoria-summary">{e.summary}</p>
            {e.detail ? <p className="historico-auditoria-detail">{e.detail}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
