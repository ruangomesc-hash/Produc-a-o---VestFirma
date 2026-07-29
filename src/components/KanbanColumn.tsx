import { useDroppable } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { COLUNA_NOVO_PEDIDO_ID } from '../defaultBoard'
import { etapaDevePiscar, resumirPrazosColuna } from '../etapas'
import type { BoardState, Column as ColumnType, OrderCard } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { KanbanCard } from './KanbanCard'

type Props = {
  column: ColumnType
  board: BoardState
  cards: OrderCard[]
  canDelete: boolean
  onAddCard: () => void
  onEditCard: (card: OrderCard) => void
  onRequestArchiveCard: (card: OrderCard) => void
  canArchivePedidos?: boolean
  onDeleteColumn: (columnId: string, deleteCards: boolean) => void
}

export function KanbanColumn({
  column,
  board,
  cards,
  canDelete,
  onAddCard,
  onEditCard,
  onRequestArchiveCard,
  canArchivePedidos = false,
  onDeleteColumn,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const handleConfirmDeleteColumn = () => {
    onDeleteColumn(column.id, false)
    setConfirmDeleteOpen(false)
  }

  const colunaLogistica = etapaDevePiscar(column.id, column.title)
  const resumoPrazos = resumirPrazosColuna(column.id, column.title, cards, agora)

  const destinoTitulo = board.columns.find((c) => c.id !== column.id)?.title ?? 'a primeira etapa'
  const deleteMessage =
    cards.length > 0
      ? `A etapa “${column.title}” será removida. ${cards.length} pedido${cards.length === 1 ? '' : 's'} será${cards.length === 1 ? '' : 'ão'} movido${cards.length === 1 ? '' : 's'} para “${destinoTitulo}”.`
      : `A etapa “${column.title}” será removida do quadro.`

  return (
    <section
      className={`kanban-column ${isOver ? 'over' : ''} ${colunaLogistica ? 'column-logistica' : ''}`}
    >
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Excluir coluna?"
        message={`${deleteMessage} Tem certeza de que deseja continuar?`}
        confirmLabel="Sim, excluir coluna"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteColumn}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <header className="column-header">
        <div>
          {colunaLogistica && <span className="column-logistica-badge">Prioridade logística</span>}
          <h2>{column.title}</h2>
          {colunaLogistica ? (
            <span className="column-count">{cards.length} pedidos aguardando</span>
          ) : resumoPrazos.temContagemPrazo ? (
            <div className="column-prazo-resumo" aria-label="Resumo de prazos na coluna">
              <span className="column-prazo-stat no-prazo">
                {resumoPrazos.noPrazo} no prazo
              </span>
              <span className="column-prazo-stat atrasado">
                {resumoPrazos.atrasado} atrasado{resumoPrazos.atrasado === 1 ? '' : 's'}
              </span>
            </div>
          ) : (
            <span className="column-count">{cards.length}</span>
          )}
        </div>
        <div className="column-header-actions">
          {canDelete ? (
            <button
              type="button"
              className="icon-btn small column-delete-btn"
              title="Excluir coluna"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Excluir
            </button>
          ) : null}
        </div>
      </header>

      <div ref={setNodeRef} className="column-cards">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            board={board}
            columnTitle={column.title}
            onEdit={() => onEditCard(card)}
            onArchive={
              canArchivePedidos ? () => onRequestArchiveCard(card) : undefined
            }
          />
        ))}
      </div>

      {column.id === COLUNA_NOVO_PEDIDO_ID && (
        <button type="button" className="add-card-btn" onClick={onAddCard}>
          + Novo pedido
        </button>
      )}
    </section>
  )
}
