import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeBoardCheckup } from '../boardCheckup'
import { contagemPedidosNoSnapshot } from '../boardPedidosSnapshot'
import { contagemPedidos } from '../pedidosPolicy'
import { fetchRemoteBoard, isRemoteSyncEnabled } from '../remoteBoard'
import { fetchAuditLog, type AuditEntry } from '../auditLog'
import type { BoardState } from '../types'

type Props = {
  board: BoardState
}

export function PedidosCheckupPanel({ board }: Props) {
  const report = useMemo(() => analyzeBoardCheckup(board), [board])
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [exclusoes, setExclusoes] = useState<AuditEntry[]>([])

  const snapshotTotal = contagemPedidosNoSnapshot()

  const refreshRemote = useCallback(async () => {
    if (!isRemoteSyncEnabled()) {
      setRemoteTotal(null)
      setRemoteError('API desligada neste ambiente')
      return
    }
    setLoadingRemote(true)
    setRemoteError(null)
    try {
      const remote = await fetchRemoteBoard()
      setRemoteTotal(remote ? contagemPedidos(remote) : 0)
    } catch (err) {
      setRemoteTotal(null)
      setRemoteError(err instanceof Error ? err.message : 'Falha ao ler servidor')
    } finally {
      setLoadingRemote(false)
    }
  }, [])

  useEffect(() => {
    void refreshRemote()
  }, [refreshRemote, board.cards.length])

  useEffect(() => {
    let cancelled = false
    void fetchAuditLog(80).then((entries) => {
      if (cancelled) return
      setExclusoes(entries.filter((e) => e.action === 'pedido.excluido').slice(0, 8))
    })
    return () => {
      cancelled = true
    }
  }, [board.cards.length])

  const localTotal = report.total
  const diff =
    remoteTotal !== null && !remoteError ? localTotal - remoteTotal : null

  return (
    <section className="pedidos-checkup" aria-labelledby="pedidos-checkup-title">
      <header className="pedidos-checkup-head">
        <div>
          <h2 id="pedidos-checkup-title" className="pedidos-checkup-title">
            Checkup de pedidos
          </h2>
          <p className="pedidos-checkup-hint">
            Confere se pedidos sumiram do kanban (arquivados, vendedor ou servidor) ou foram
            apagados de forma definitiva (só admin, só arquivados).
          </p>
        </div>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => void refreshRemote()}
          disabled={loadingRemote}
        >
          {loadingRemote ? 'Lendo servidor…' : 'Atualizar servidor'}
        </button>
      </header>

      <dl className="pedidos-checkup-stats">
        <div>
          <dt>Neste navegador (quadro atual)</dt>
          <dd>
            <strong>{localTotal}</strong> total · {report.ativos} no kanban · {report.arquivados}{' '}
            arquivados
          </dd>
        </div>
        <div>
          <dt>Servidor (GET /board)</dt>
          <dd>
            {remoteError ? (
              <span className="danger-text">{remoteError}</span>
            ) : remoteTotal !== null ? (
              <>
                <strong>{remoteTotal}</strong> pedidos no JSON
                {diff !== null && diff !== 0 ? (
                  <span className="pedidos-checkup-diff">
                    {' '}
                    — diferença de {diff > 0 ? '+' : ''}
                    {diff} vs navegador
                  </span>
                ) : diff === 0 ? (
                  <span> — igual ao navegador</span>
                ) : null}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Backup automático (navegador)</dt>
          <dd>
            <strong>{snapshotTotal}</strong> pedido(s) no snapshot local
          </dd>
        </div>
      </dl>

      {diff !== null && diff > 0 ? (
        <p className="pedidos-checkup-alert" role="alert">
          O navegador tem <strong>mais</strong> pedidos que o servidor. Use{' '}
          <strong>Restaurar pedidos no servidor</strong> no kanban (banner amarelo) para gravar de
          volta — nada foi apagado automaticamente.
        </p>
      ) : null}
      {diff !== null && diff < 0 ? (
        <p className="pedidos-checkup-alert" role="alert">
          O servidor tem <strong>mais</strong> pedidos que o quadro carregado aqui. Recarregue a
          página ou abra o kanban de novo para sincronizar.
        </p>
      ) : null}

      {report.avisos.length > 0 ? (
        <ul className="pedidos-checkup-warns">
          {report.avisos.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : (
        <p className="pedidos-checkup-ok">Nenhum aviso de órfão, sem vendedor ou arquivado.</p>
      )}

      {report.linhas.length > 0 ? (
        <table className="pedidos-checkup-table">
          <thead>
            <tr>
              <th scope="col">Vendedor / grupo</th>
              <th scope="col">No kanban</th>
              <th scope="col">Arquivados</th>
            </tr>
          </thead>
          <tbody>
            {report.linhas.map((l) => (
              <tr key={l.nome + String(l.vendedorId)}>
                <td>
                  {l.nome}
                  {l.orphanVendedorId ? (
                    <span className="pedidos-checkup-tag">id órfão</span>
                  ) : null}
                  {l.semVendedorId > 0 ? (
                    <span className="pedidos-checkup-tag">sem vendedor</span>
                  ) : null}
                </td>
                <td>{l.pedidosAtivos}</td>
                <td>{l.pedidosArquivados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {exclusoes.length > 0 ? (
        <div className="pedidos-checkup-exclusoes">
          <h3 className="pedidos-checkup-subtitle">Apagados definitivamente (auditoria)</h3>
          <ul>
            {exclusoes.map((e) => (
              <li key={e.id}>
                {new Date(e.at).toLocaleString('pt-BR')} — {e.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pedidos-checkup-meta">
          Nenhum registro recente de pedido excluído no histórico (últimas ações).
        </p>
      )}
    </section>
  )
}
