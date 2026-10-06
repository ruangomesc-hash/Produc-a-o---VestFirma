import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState, useEffect, useRef } from 'react'
import { resolveCardColumnId, ensureBoardColumns, COLUNA_PEDIDO_ENVIADO_ID, COLUNA_CANCELADOS_EXPIRADOS_ID } from '../boardColumns'
import { etapaCanceladosExpirados, etapaPedidoEnviado } from '../etapas'
import { pedidoVisivelNoKanban } from '../pedidosPolicy'
import { ordenarCardsPorNumeroPedido } from '../ordenarCardsKanban'
import type { BoardState, OrderCard } from '../types'
import { KanbanColumn } from './KanbanColumn'

type Props = {
  board: BoardState
  onMoveCard: (cardId: string, columnId: string, opts?: { silent?: boolean }) => void
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

type MoveToast = {
  cardId: string
  fromColumnId: string
  toColumnId: string
  cliente: string
  numero: string
  fromTitle: string
  toTitle: string
}

const HOLD_MS = 650

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
  const [moveToast, setMoveToast] = useState<MoveToast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!canManageColumns) setShowAddColumn(false)
  }, [canManageColumns])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const onWheel = (event: WheelEvent) => {
      if (shell.scrollWidth <= shell.clientWidth + 1) return

      const cards = (event.target as HTMLElement | null)?.closest?.('.column-cards')
      const cardsEl = cards instanceof HTMLElement ? cards : null
      const verticalNaLista =
        Boolean(cardsEl) &&
        cardsEl!.scrollHeight > cardsEl!.clientHeight + 1 &&
        Math.abs(event.deltaY) >= Math.abs(event.deltaX) &&
        !event.shiftKey

      if (verticalNaLista) return

      const dx = event.shiftKey || Math.abs(event.deltaX) < 1 ? event.deltaY : event.deltaX
      if (!dx) return
      event.preventDefault()
      shell.scrollLeft += dx
    }

    shell.addEventListener('wheel', onWheel, { passive: false })
    return () => shell.removeEventListener('wheel', onWheel)
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: dragEnabled ? { distance: 6 } : { distance: 999999 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: dragEnabled
        ? { delay: HOLD_MS, tolerance: 18 }
        : { delay: 999999, tolerance: 0 },
    }),
  )

  const columns = useMemo(() => ensureBoardColumns(board.columns), [board.columns])
  const boardComColunas = useMemo(() => ({ ...board, columns }), [board, columns])

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, OrderCard[]>()
    for (const col of columns) map.set(col.id, [])
    for (const card of board.cards) {
      if (!pedidoVisivelNoKanban(card)) continue
      const columnId = resolveCardColumnId(boardComColunas, card)
      if (!columnId) continue
      const bucket = map.get(columnId)
      if (!bucket) continue
      bucket.push(columnId === card.columnId ? card : { ...card, columnId })
    }
    for (const [id, list] of map) {
      map.set(id, ordenarCardsPorNumeroPedido(list))
    }
    return map
  }, [columns, board.cards, boardComColunas])

  const resolveColumnId = (overId: string): string | null => {
    if (columns.some((c) => c.id === overId)) return overId
    const card = board.cards.find((c) => c.id === overId)
    return card?.columnId ?? null
  }

  const tituloColuna = (columnId: string) =>
    columns.find((c) => c.id === columnId)?.title ?? columnId

  const showMoveToast = (toast: MoveToast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setMoveToast(toast)
    toastTimer.current = setTimeout(() => setMoveToast(null), 8000)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = board.cards.find((c) => c.id === event.active.id)
    setActiveCard(card ?? null)
    try {
      navigator.vibrate?.(25)
    } catch {
      /* ignore */
    }
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
      const fromColumnId = card.columnId
      onMoveCard(cardId, columnId)
      showMoveToast({
        cardId,
        fromColumnId,
        toColumnId: columnId,
        cliente: card.cliente,
        numero: String(card.numeroPedido || ''),
        fromTitle: tituloColuna(fromColumnId),
        toTitle: tituloColuna(columnId),
      })
    }
  }

  const undoMove = () => {
    if (!moveToast) return
    onMoveCard(moveToast.cardId, moveToast.fromColumnId, { silent: true })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setMoveToast(null)
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
      columns.filter(
        (c) =>
          c.id !== COLUNA_PEDIDO_ENVIADO_ID &&
          c.id !== COLUNA_CANCELADOS_EXPIRADOS_ID &&
          !etapaPedidoEnviado(c.id, c.title) &&
          !etapaCanceladosExpirados(c.id, c.title),
      ),
    [columns],
  )
  const colunasConcluidos = useMemo(
    () =>
      columns.filter(
        (c) => c.id === COLUNA_PEDIDO_ENVIADO_ID || etapaPedidoEnviado(c.id, c.title),
      ),
    [columns],
  )
  const colunasCancelados = useMemo(
    () =>
      columns.filter(
        (c) => c.id === COLUNA_CANCELADOS_EXPIRADOS_ID || etapaCanceladosExpirados(c.id, c.title),
      ),
    [columns],
  )

  const renderColumn = (column: (typeof columns)[number]) => (
    <KanbanColumn
      key={column.id}
      column={column}
      board={boardComColunas}
      cards={cardsByColumn.get(column.id) ?? []}
      canDelete={canManageColumns && columns.length > 1}
      onAddCard={() => onAddCard(column.id)}
      onEditCard={onEditCard}
      onRequestArchiveCard={onRequestArchiveCard}
      canArchivePedidos={canArchivePedidos}
      onDeleteColumn={onDeleteColumn}
      highlightPedidoId={highlightPedidoId}
    />
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <div
        className="kanban-board-shell"
        ref={shellRef}
        style={{ ['--fluxo-colunas' as string]: String(Math.max(colunasFluxo.length, 1)) }}
      >
        <div className="board-scroll board-scroll--fluxo">
          <div className="board-columns board-columns--fluxo">{colunasFluxo.map(renderColumn)}</div>
        </div>
        {(colunasConcluidos.length > 0 || colunasCancelados.length > 0) ? (
          <div className="board-scroll board-scroll--laterais" aria-label="Pedidos enviados e cancelados">
            <div className="board-columns board-columns--laterais">
              {colunasConcluidos.map(renderColumn)}
              {colunasCancelados.map(renderColumn)}
            </div>
          </div>
        ) : null}
        {canManageColumns ? (
          <div className="add-column add-column--depois-concluidos">
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

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="kanban-card overlay kanban-card--lifting">
            <span className="card-lift-fold" aria-hidden />
            <p className="card-lift-hint">Pedido selecionado — solte na etapa</p>
            <div className="card-logo">
              {activeCard.logoEnviadaCliente[0] ? (
                <img src={activeCard.logoEnviadaCliente[0]} alt="" />
              ) : (
                <span>Sem logo do cliente</span>
              )}
            </div>
            <strong>{activeCard.cliente}</strong>
            {activeCard.numeroPedido ? <span>Pedido {activeCard.numeroPedido}</span> : null}
          </div>
        ) : null}
      </DragOverlay>
      {moveToast ? (
        <div className="move-undo-toast" role="status" aria-live="polite">
          <p>
            Você moveu o pedido <strong>{moveToast.numero}</strong> ({moveToast.cliente}) de{' '}
            <strong>{moveToast.fromTitle}</strong> para <strong>{moveToast.toTitle}</strong>.
          </p>
          <div className="move-undo-toast-actions">
            <button type="button" className="btn primary small" onClick={undoMove}>
              Desfazer
            </button>
            <button type="button" className="btn ghost small" onClick={() => setMoveToast(null)}>
              Ok
            </button>
          </div>
        </div>
      ) : null}
    </DndContext>
  )
}
