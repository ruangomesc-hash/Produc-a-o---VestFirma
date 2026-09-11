import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeBoardCheckup } from '../boardCheckup'
import {
  contagemPedidosNoSnapshot,
  previewPedidosNoSnapshot,
  clearPedidosSnapshot,
  loadBoardPedidosSnapshot,
} from '../boardPedidosSnapshot'
import { loadPedidosExcluidosIds } from '../pedidosExcluidosLocal'
import { contagemPedidos } from '../pedidosPolicy'
import {
  fetchBoardBackups,
  isRemoteSyncEnabled,
  restoreBoardFromBackup,
  type BoardBackupSummary,
} from '../boardRestoreApi'
import { recordAudit } from '../auditLog'
import { fetchAuditLog, type AuditEntry } from '../auditLog'
import { fetchRemoteBoard } from '../remoteBoard'
import type { BoardState } from '../types'

type Props = {
  board: BoardState
  onBoardRestored?: () => void
  onRestoreFromSnapshot?: () => Promise<unknown>
  onClearLocalSnapshot?: () => void
}

export function PedidosCheckupPanel({
  board,
  onBoardRestored,
  onRestoreFromSnapshot,
  onClearLocalSnapshot,
}: Props) {
  const report = useMemo(() => analyzeBoardCheckup(board), [board])
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [exclusoes, setExclusoes] = useState<AuditEntry[]>([])
  const [backupQuery, setBackupQuery] = useState('')
  const [backups, setBackups] = useState<BoardBackupSummary[]>([])
  const [backupsCurrent, setBackupsCurrent] = useState<number | null>(null)
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupsError, setBackupsError] = useState<string | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [snapshotRev, setSnapshotRev] = useState(0)

  const snapshotTotal = useMemo(
    () => contagemPedidosNoSnapshot(),
    [snapshotRev, board.cards.length],
  )
  const snapshotPreview = useMemo(
    () => previewPedidosNoSnapshot(8),
    [snapshotRev, board.cards.length],
  )
  const snapshotStale = useMemo(() => {
    const snap = loadBoardPedidosSnapshot()
    if (!snap?.cards?.length) return false
    const excluded = loadPedidosExcluidosIds()
    const boardIds = new Set(board.cards.map((c) => c.id))
    const staleCards = snap.cards.filter(
      (c) => c?.id && !boardIds.has(c.id) && !excluded.has(c.id),
    )
    return staleCards.length > 0
  }, [snapshotRev, board.cards])

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

  const loadBackups = useCallback(async () => {
    if (!isRemoteSyncEnabled()) {
      setBackupsError('API desligada — backups só no servidor Node.')
      return
    }
    setBackupsLoading(true)
    setBackupsError(null)
    setRestoreMessage(null)
    try {
      const data = await fetchBoardBackups(backupQuery.trim() || undefined)
      setBackupsCurrent(data.currentCards)
      setBackups(data.backups)
    } catch (err) {
      setBackups([])
      setBackupsError(err instanceof Error ? err.message : 'Falha ao listar backups')
    } finally {
      setBackupsLoading(false)
    }
  }, [backupQuery])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const runRestore = useCallback(
    async (opts: { autoBest?: boolean; backup?: string }) => {
      setRestoreBusy(true)
      setRestoreMessage(null)
      setBackupsError(null)
      try {
        const q = backupQuery.trim() || undefined
        const result = await restoreBoardFromBackup({ ...opts, q })
        setRestoreMessage(result.message)
        if (result.added > 0) {
          recordAudit({
            action: 'quadro.restaurado',
            summary: `Restaurou ${result.added} pedido(s) do backup do servidor${result.backupUsed ? ` (${result.backupUsed})` : ''}${q ? ` — busca “${q}”` : ''}`,
          })
          onBoardRestored?.()
          void refreshRemote()
          void loadBackups()
        }
      } catch (err) {
        setBackupsError(err instanceof Error ? err.message : 'Falha ao restaurar')
      } finally {
        setRestoreBusy(false)
      }
    },
    [backupQuery, loadBackups, onBoardRestored, refreshRemote],
  )

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
            {snapshotTotal > 0 && remoteTotal === 0 && localTotal === 0 ? (
              <span className="pedidos-checkup-diff">
                {' '}
                — cópia antiga; não está no servidor agora
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {snapshotTotal > 0 && snapshotStale && !remoteError ? (
        <div className="pedidos-checkup-alert" role="status">
          <p>
            O backup automático deste navegador ainda guarda{' '}
            <strong>{snapshotTotal}</strong> pedido(s) que <strong>não estão</strong> no quadro
            atual — resto de sessão antiga (ex.: pedido que você já apagou). Isso{' '}
            <strong>não</strong> deve voltar ao kanban após atualizar; descarte a cópia se não
            precisar mais.
          </p>
          {snapshotPreview.length > 0 ? (
            <ul className="pedidos-checkup-backup-preview">
              {snapshotPreview.map((p) => (
                <li key={`${p.numeroPedido}-${p.cliente}`}>
                  {p.numeroPedido} — {p.cliente}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="pedidos-checkup-restore-toolbar">
            {onRestoreFromSnapshot ? (
              <button
                type="button"
                className="btn primary small"
                disabled={restoreBusy}
                onClick={() => {
                  setRestoreBusy(true)
                  setRestoreMessage(null)
                  void onRestoreFromSnapshot()
                    .then(() => {
                      setSnapshotRev((n) => n + 1)
                      onBoardRestored?.()
                      void refreshRemote()
                      setRestoreMessage('Pedidos do snapshot gravados no servidor.')
                    })
                    .catch((err: unknown) => {
                      setBackupsError(
                        err instanceof Error ? err.message : 'Falha ao gravar snapshot no servidor',
                      )
                    })
                    .finally(() => setRestoreBusy(false))
                }}
              >
                Gravar estes pedidos no servidor
              </button>
            ) : null}
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                clearPedidosSnapshot()
                onClearLocalSnapshot?.()
                setSnapshotRev((n) => n + 1)
              }}
            >
              Descartar cópia local
            </button>
          </div>
        </div>
      ) : null}

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

      <div className="pedidos-checkup-restore">
        <h3 className="pedidos-checkup-subtitle">Restaurar do backup do servidor</h3>
        <p className="pedidos-checkup-hint">
          Antes de cada gravação o Render guarda cópias em <code>data/backups/</code>. Aqui você
          traz de volta só pedidos que <strong>faltam</strong> no quadro atual (não apaga nada).
        </p>
        <div className="pedidos-checkup-restore-toolbar">
          <label className="pedidos-checkup-search">
            <span>Buscar pedido / vendedor</span>
            <input
              type="search"
              value={backupQuery}
              onChange={(e) => setBackupQuery(e.target.value)}
              placeholder="Nome, número do pedido ou cliente"
            />
          </label>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => void loadBackups()}
            disabled={backupsLoading}
          >
            {backupsLoading ? 'Buscando…' : 'Buscar nos backups'}
          </button>
          <button
            type="button"
            className="btn primary small"
            disabled={restoreBusy || backupsLoading}
            onClick={() => void runRestore({ autoBest: true })}
          >
            {restoreBusy ? 'Restaurando…' : 'Restaurar pedidos ausentes (melhor backup)'}
          </button>
        </div>
        {backupsError ? (
          <p className="pedidos-checkup-alert danger-text" role="alert">
            {backupsError}
          </p>
        ) : null}
        {restoreMessage ? (
          <p className="pedidos-checkup-ok" role="status">
            {restoreMessage}
          </p>
        ) : null}
        {backupsCurrent !== null ? (
          <p className="pedidos-checkup-meta">
            Servidor agora: <strong>{backupsCurrent}</strong> pedido(s) no JSON ·{' '}
            {backups.length} backup(s) listado(s)
            {backupQuery.trim() ? ` (filtro “${backupQuery.trim()}”)` : ''}
          </p>
        ) : null}
        {backups.length > 0 ? (
          <ul className="pedidos-checkup-backups">
            {backups.map((b) => (
              <li key={b.file} className="pedidos-checkup-backup-item">
                <div className="pedidos-checkup-backup-main">
                  <strong>{b.label}</strong>
                  <span className="pedidos-checkup-meta">
                    {b.totalCards} no arquivo ·{' '}
                    {backupQuery.trim()
                      ? `${b.missingMatchingQuery} ausente(s) com filtro`
                      : `${b.missingCount} ausente(s)`}
                  </span>
                  {b.preview.length > 0 ? (
                    <ul className="pedidos-checkup-backup-preview">
                      {b.preview.map((p) => (
                        <li key={p.id}>
                          {p.numeroPedido} — {p.cliente}
                          {p.vendedor ? ` (${p.vendedor})` : ''}
                          {p.arquivado ? ' · arquivado' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {(backupQuery.trim() ? b.missingMatchingQuery : b.missingCount) > 0 ? (
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={restoreBusy}
                    onClick={() => void runRestore({ backup: b.file })}
                  >
                    Trazer deste backup
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !backupsLoading && isRemoteSyncEnabled() && !backupsError ? (
          <p className="pedidos-checkup-meta">
            Nenhum backup com pedidos ausentes
            {backupQuery.trim() ? ` para “${backupQuery.trim()}”` : ''}. Tente outro termo ou
            confira Pedidos arquivados abaixo.
          </p>
        ) : null}
      </div>

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
