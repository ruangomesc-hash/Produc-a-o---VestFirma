import { useMemo, useState } from 'react'
import { formatarDataHora, tituloColuna } from '../historicoEtapa'
import type { BoardState, OrderCard } from '../types'

type Props = {
  board: BoardState
  onRestore: (cardId: string) => void
  onDelete?: (cardId: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function PedidosArquivadosPanel({ board, onRestore, onDelete }: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState<OrderCard | null>(null)
  const [deleteNumero, setDeleteNumero] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const arquivados = useMemo(() => {
    return board.cards
      .filter((c) => c.arquivadoEm)
      .sort((a, b) => (b.arquivadoEm ?? '').localeCompare(a.arquivadoEm ?? ''))
  }, [board.cards])

  if (arquivados.length === 0) {
    return (
      <section className="pedidos-arquivados" aria-labelledby="pedidos-arquivados-title">
        <h2 id="pedidos-arquivados-title" className="pedidos-arquivados-title">
          Pedidos arquivados
        </h2>
        <p className="pedidos-arquivados-hint">
          Nenhum pedido arquivado. Ao arquivar no kanban, o pedido some das colunas mas permanece
          guardado aqui e no servidor — não vai para outra etapa.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="pedidos-arquivados" aria-labelledby="pedidos-arquivados-title">
        <h2 id="pedidos-arquivados-title" className="pedidos-arquivados-title">
          Pedidos arquivados ({arquivados.length})
        </h2>
      <p className="pedidos-arquivados-hint">
        Ocultos do kanban, mas intactos no sistema. Restaure para voltar à etapa{' '}
        <strong>em que estavam</strong> (não mudam de coluna ao arquivar). Só{' '}
        <strong>administrador</strong> arquiva ou apaga definitivamente — vendedor não tem essa ação.
        {onDelete ? (
          <>
            {' '}
            <strong>Apagar</strong> remove o pedido de forma permanente (exige confirmar o número do
            pedido).
          </>
        ) : null}
      </p>
      {deleteError ? (
        <p className="pedidos-arquivados-error" role="alert">
          {deleteError}
        </p>
      ) : null}
        <ul className="pedidos-arquivados-list">
          {arquivados.map((c) => (
            <PedidoArquivadoRow
              key={c.id}
              card={c}
              board={board}
              onRestore={onRestore}
              onRequestDelete={onDelete ? () => {
                setDeleteConfirm(c)
                setDeleteNumero('')
                setDeleteError(null)
              } : undefined}
            />
          ))}
        </ul>
      </section>

      {deleteConfirm && onDelete ? (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!deleteBusy) {
              setDeleteConfirm(null)
              setDeleteNumero('')
            }
          }}
        >
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-labelledby="delete-pedido-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="confirm-modal-brand">
              <img
                src={`${import.meta.env.BASE_URL}vestfirma-logo.png`}
                alt="VestFirma"
                className="confirm-modal-logo"
              />
            </header>
            <div className="confirm-modal-body">
              <h2 id="delete-pedido-title" className="confirm-modal-title">
                Apagar pedido definitivamente?
              </h2>
              <p className="confirm-message">
                O pedido <strong>{deleteConfirm.numeroPedido}</strong> ({deleteConfirm.cliente}) será
                removido do servidor. Esta ação não pode ser desfeita — diferente de arquivar, os
                dados deixam de existir no sistema. Para confirmar, digite o{' '}
                <strong>número do pedido</strong> abaixo.
              </p>
              <label className="usuarios-search">
                <span>Número do pedido</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deleteNumero}
                  onChange={(e) => setDeleteNumero(e.target.value)}
                  placeholder={String(deleteConfirm.numeroPedido)}
                  autoComplete="off"
                />
              </label>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn confirm-cancel"
                  disabled={deleteBusy}
                  onClick={() => {
                    setDeleteConfirm(null)
                    setDeleteNumero('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn primary confirm-danger"
                  disabled={
                    deleteBusy ||
                    deleteNumero.trim() !== String(deleteConfirm.numeroPedido).trim()
                  }
                  onClick={() => {
                    if (!deleteConfirm || deleteBusy) return
                    setDeleteBusy(true)
                    setDeleteError(null)
                    void onDelete(deleteConfirm.id).then((result) => {
                      setDeleteBusy(false)
                      if (result.ok) {
                        setDeleteConfirm(null)
                        setDeleteNumero('')
                      } else {
                        setDeleteError(result.error)
                      }
                    })
                  }}
                >
                  {deleteBusy ? 'Apagando…' : 'Sim, apagar definitivamente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function PedidoArquivadoRow({
  card,
  board,
  onRestore,
  onRequestDelete,
}: {
  card: OrderCard
  board: BoardState
  onRestore: (id: string) => void
  onRequestDelete?: () => void
}) {
  const etapa = tituloColuna(board, card.columnId)

  return (
    <li className="pedidos-arquivados-item">
      <div className="pedidos-arquivados-item-main">
        <strong>
          {card.numeroPedido} — {card.cliente}
        </strong>
        <span className="pedidos-arquivados-meta">
          Arquivado em {formatarDataHora(card.arquivadoEm ?? '')} · Etapa: {etapa}
        </span>
      </div>
      <div className="pedidos-arquivados-actions">
        <button type="button" className="btn" onClick={() => onRestore(card.id)}>
          Restaurar no kanban
        </button>
        {onRequestDelete ? (
          <button type="button" className="btn danger" onClick={onRequestDelete}>
            Apagar definitivamente
          </button>
        ) : null}
      </div>
    </li>
  )
}
