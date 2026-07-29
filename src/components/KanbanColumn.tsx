import { useDroppable } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { COLUNA_NOVO_PEDIDO_ID } from '../defaultBoard'
import { etapaDevePiscar, resumirPrazosColuna } from '../etapas'
import type { BoardState, Column as ColumnType, OrderCard } from '../types'
import { KanbanCard } from './KanbanCard'

type Props = {
  column: ColumnType
  board: BoardState
  cards: OrderCard[]
  canDelete: boolean
  onAddCard: () => void
  onEditCard: (card: OrderCard) => void
  onArchiveCard: (id: string) => void
  onDeleteColumn: (columnId: string, deleteCards: boolean) => void
}

export function KanbanColumn({
  column,
  board,
  cards,
  canDelete,
  onAddCard,
  onEditCard,
  onArchiveCard,
  onDeleteColumn,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const handleDeleteColumn = (deleteCards: boolean) => {
    onDeleteColumn(column.id, deleteCards)
    setConfirmDelete(false)
  }

  const colunaLogistica = etapaDevePiscar(column.id, column.title)
  const resumoPrazos = resumirPrazosColuna(column.id, column.title, cards, agora)

  return (
    <section
      className={`kanban-column ${isOver ? 'over' : ''} ${colunaLogistica ? 'column-logistica' : ''}`}
    >
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
          {canDelete && (
            <>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="icon-btn small column-delete-btn"
                  title="Excluir coluna"
                  onClick={() => setConfirmDelete(true)}
                >
                  Excluir
                </button>
              ) : (
                <div className="column-delete-confirm">
                  <span>Excluir coluna?</span>
                  <button type="button" className="btn-text" onClick={() => handleDeleteColumn(false)}>
                    Mover pedidos e excluir coluna
                  </button>
                  <button type="button" className="btn-text" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}
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
            onArchive={() => {
              if (
                window.confirm(
                  `Arquivar pedido ${card.numeroPedido} (${card.cliente})? Ele sai do quadro, mas permanece guardado no sistema.`,
                )
              ) {
                onArchiveCard(card.id)
              }
            }}
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
