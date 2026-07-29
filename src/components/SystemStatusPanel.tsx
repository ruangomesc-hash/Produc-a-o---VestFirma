import { useCallback, useEffect, useState } from 'react'
import { countByStatus, runSystemHealthChecks, type HealthCheck } from '../systemHealth'
import { BoardStorageMeter } from './BoardStorageMeter'
import type { BoardState } from '../types'

type Props = {
  board: BoardState
}

function statusLabel(status: HealthCheck['status']) {
  switch (status) {
    case 'ok':
      return 'Funcionando'
    case 'warn':
      return 'Atenção'
    case 'error':
      return 'Com problema'
    default:
      return 'Desligado'
  }
}

export function SystemStatusPanel({ board }: Props) {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await runSystemHealthChecks(board)
      setChecks(result)
      setLastRun(new Date())
    } finally {
      setLoading(false)
    }
  }, [board])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 45_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const totals = checks ? countByStatus(checks) : null

  return (
    <div className="system-status">
      <div className="system-status-inner">
        <header className="system-status-top">
          <div>
            <h1 className="system-status-title">Status do sistema</h1>
            <p className="system-status-sub">
              O que está funcionando e o que precisa de ajuste (servidor, quadro, login,
              WhatsApp).
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Verificando…' : 'Atualizar'}
          </button>
        </header>

        {totals && (
          <div className="system-status-summary">
            <span className="status-pill status-pill-ok">{totals.ok} OK</span>
            <span className="status-pill status-pill-warn">{totals.warn} atenção</span>
            <span className="status-pill status-pill-error">{totals.err} problema</span>
            {totals.off > 0 && (
              <span className="status-pill status-pill-off">{totals.off} desligado</span>
            )}
          </div>
        )}

        {lastRun && (
          <p className="system-status-meta">
            Última verificação: {lastRun.toLocaleString('pt-BR')}
          </p>
        )}

        <BoardStorageMeter board={board} />

        <ul className="system-status-list">
          {(checks ?? []).map((check) => (
            <li key={check.id} className={`system-status-item status-${check.status}`}>
              <div className="system-status-item-head">
                <span className="system-status-badge">{statusLabel(check.status)}</span>
                <h2 className="system-status-item-title">{check.title}</h2>
              </div>
              <p className="system-status-item-summary">{check.summary}</p>
              {check.detail && <p className="system-status-item-detail">{check.detail}</p>}
            </li>
          ))}
        </ul>

        {!checks?.length && !loading && (
          <p className="system-status-empty">Nenhuma verificação disponível.</p>
        )}
      </div>
    </div>
  )
}
