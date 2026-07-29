import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import type { BoardState, OrderCard } from '../types'
import { KanbanColumn } from './KanbanColumn'

type Props = {
  board: BoardState
  onMoveCard: (cardId: string, columnId: string) => void
  onAddCard: (columnId: string) => void
  onEditCard: (card: OrderCard) => void
  onDeleteCard: (id: string) => void
  onDeleteColumn: (columnId: string, deleteCards: boolean) => void
  onAddColumn: (title: string) => void
  dragEnabled?: boolean
}

export function KanbanBoard({
  board,
  onMoveCard,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDeleteColumn,
  onAddColumn,
  dragEnabled = true,
}: Props) {
  const [activeCard, setActiveCard] = useState<OrderCard | null>(null)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: dragEnabled ? { delay: 220, tolerance: 8 } : { delay: 999999, tolerance: 0 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: dragEnabled ? 6 : 999999 },
    }),
  )

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, OrderCard[]>()
    for (const col of board.columns) map.set(col.id, [])
    const fallback = board.columns[0]?.id
    for (const card of board.cards) {
      const columnId = map.has(card.columnId) ? card.columnId : fallback
      if (!columnId) continue
      map.get(columnId)!.push(
        columnId === card.columnId ? card : { ...card, columnId },
      )
    }
    return map
  }, [board.columns, board.cards])

  const resolveColumnId = (overId: string): string | null => {
    if (board.columns.some((c) => c.id === overId)) return overId
    const card = board.cards.find((c) => c.id === overId)
    return card?.columnId ?? null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = board.cards.find((c) => c.id === event.active.id)
    setActiveCard(card ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return
    const columnId = resolveColumnId(String(over.id))
    if (!columnId) return
    const cardId = String(active.id)
    const card = board.cards.find((c) => c.id === cardId)
    if (card && card.columnId !== columnId) {
      onMoveCard(cardId, columnId)
    }
  }

  const submitColumn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColumnTitle.trim()) return
    onAddColumn(newColumnTitle)
    setNewColumnTitle('')
    setShowAddColumn(false)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="board-scroll">
        <div className="board-columns">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              board={board}
              cards={cardsByColumn.get(column.id) ?? []}
              canDelete={board.columns.length > 1}
              onAddCard={() => onAddCard(column.id)}
              onEditCard={onEditCard}
              onDeleteCard={onDeleteCard}
              onDeleteColumn={onDeleteColumn}
            />
          ))}

          <div className="add-column">
            {showAddColumn ? (
              <form onSubmit={submitColumn} className="add-column-form">
                <input
                  autoFocus
                  placeholder="Nome da nova etapa"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                />
                <div className="add-column-actions">
                  <button type="submit" className="btn primary small">
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      setShowAddColumn(false)
                      setNewColumnTitle('')
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="add-column-btn" onClick={() => setShowAddColumn(true)}>
                + Nova coluna
              </button>
            )}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="kanban-card overlay">
            <div className="card-logo">
              {activeCard.logoEnviadaCliente ? (
                <img src={activeCard.logoEnviadaCliente} alt="" />
              ) : (
                <span>Sem logo do cliente</span>
              )}
            </div>
            <strong>{activeCard.cliente}</strong>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
