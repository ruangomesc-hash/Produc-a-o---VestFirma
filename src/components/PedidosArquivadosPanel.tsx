import { useMemo, useState } from 'react'
import { formatarDataHora, tituloColuna } from '../historicoEtapa'
import type { BoardState, OrderCard } from '../types'
import { ConfirmModal } from './ConfirmModal'

type Props = {
  board: BoardState
  onRestore: (cardId: string) => void
  onDelete?: (cardId: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function PedidosArquivadosPanel({ board, onRestore, onDelete }: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState<OrderCard | null>(null)
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
            <strong>Apagar</strong> remove o pedido de forma permanente.
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
              onRequestDelete={onDelete ? () => setDeleteConfirm(c) : undefined}
            />
          ))}
        </ul>
      </section>

      <ConfirmModal
        open={Boolean(deleteConfirm && onDelete)}
        title="Apagar pedido definitivamente?"
        message={
          deleteConfirm
            ? `O pedido ${deleteConfirm.numeroPedido} (${deleteConfirm.cliente}) será removido do servidor. Esta ação não pode ser desfeita — diferente de arquivar, os dados deixam de existir no sistema.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Apagando…' : 'Sim, apagar definitivamente'}
        cancelLabel="Cancelar"
        destructive
        onCancel={() => {
          if (!deleteBusy) setDeleteConfirm(null)
        }}
        onConfirm={() => {
          if (!deleteConfirm || !onDelete || deleteBusy) return
          setDeleteBusy(true)
          setDeleteError(null)
          void onDelete(deleteConfirm.id).then((result) => {
            setDeleteBusy(false)
            if (result.ok) {
              setDeleteConfirm(null)
            } else {
              setDeleteError(result.error)
            }
          })
        }}
      />
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
          Etapa: {etapa}
          {card.arquivadoEm ? (
            <>
              {' '}
              · Arquivado em {formatarDataHora(card.arquivadoEm)}
            </>
          ) : null}
        </span>
      </div>
      <div className="pedidos-arquivados-actions">
        <button type="button" className="btn ghost small" onClick={() => onRestore(card.id)}>
          Restaurar no kanban
        </button>
        {onRequestDelete ? (
          <button type="button" className="btn ghost small danger-text" onClick={onRequestDelete}>
            Apagar definitivamente
          </button>
        ) : null}
      </div>
    </li>
  )
}
