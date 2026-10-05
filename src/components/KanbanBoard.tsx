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
import { useMemo, useState, useEffect } from 'react'
import { resolveCardColumnId, COLUNA_PEDIDO_ENVIADO_ID } from '../boardColumns'
import { etapaPedidoEnviado } from '../etapas'
import { pedidoVisivelNoKanban } from '../pedidosPolicy'
import type { BoardState, OrderCard } from '../types'
import { KanbanColumn } from './KanbanColumn'

type Props = {
  board: BoardState
  onMoveCard: (cardId: string, columnId: string) => void
  onAddCard: (columnId: string) => void
  onEditCard: (card: OrderCard) => void
  onRequestArchiveCard: (card: OrderCard) => void
  canArchivePedidos?: boolean
  canManageColumns?: boolean
  onDeleteColumn: (columnId: string, deleteCards: boolean) => void
  onAddColumn: (title: string) => void
  dragEnabled?: boolean
  highlightPedidoId?: string | null
}

export function KanbanBoard({
  board,
  onMoveCard,
  onAddCard,
  onEditCard,
  onRequestArchiveCard,
  canArchivePedidos = false,
  canManageColumns = false,
  onDeleteColumn,
  onAddColumn,
  dragEnabled = true,
  highlightPedidoId = null,
}: Props) {
  const [activeCard, setActiveCard] = useState<OrderCard | null>(null)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)

  useEffect(() => {
    if (!canManageColumns) setShowAddColumn(false)
  }, [canManageColumns])

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
    for (const card of board.cards) {
      if (!pedidoVisivelNoKanban(card)) continue
      const columnId = resolveCardColumnId(board, card)
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
    if (!canManageColumns) return
    if (!newColumnTitle.trim()) return
    onAddColumn(newColumnTitle)
    setNewColumnTitle('')
    setShowAddColumn(false)
  }

  const colunasFluxo = useMemo(
    () =>
      board.columns.filter(
        (c) => c.id !== COLUNA_PEDIDO_ENVIADO_ID && !etapaPedidoEnviado(c.id, c.title),
      ),
    [board.columns],
  )
  const colunasConcluidos = useMemo(
    () =>
      board.columns.filter(
        (c) => c.id === COLUNA_PEDIDO_ENVIADO_ID || etapaPedidoEnviado(c.id, c.title),
      ),
    [board.columns],
  )

  const renderColumn = (column: (typeof board.columns)[number]) => (
    <KanbanColumn
      key={column.id}
      column={column}
      board={board}
      cards={cardsByColumn.get(column.id) ?? []}
      canDelete={canManageColumns && board.columns.length > 1}
      onAddCard={() => onAddCard(column.id)}
      onEditCard={onEditCard}
      onRequestArchiveCard={onRequestArchiveCard}
      canArchivePedidos={canArchivePedidos}
      onDeleteColumn={onDeleteColumn}
      highlightPedidoId={highlightPedidoId}
    />
  )

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-board-shell">
        <div className="board-scroll board-scroll--fluxo">
          <div className="board-columns board-columns--fluxo">
            {colunasFluxo.map(renderColumn)}
            {canManageColumns ? (
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
            ) : null}
          </div>
        </div>
        {colunasConcluidos.length > 0 ? (
          <div className="board-scroll board-scroll--concluidos" aria-label="Pedidos concluídos">
            <div className="board-columns board-columns--concluidos">{colunasConcluidos.map(renderColumn)}</div>
          </div>
        ) : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="kanban-card overlay">
            <div className="card-logo">
              {activeCard.logoEnviadaCliente[0] ? (
                <img src={activeCard.logoEnviadaCliente[0]} alt="" />
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
