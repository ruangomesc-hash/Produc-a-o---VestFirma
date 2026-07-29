import type { BoardState } from './types'

const TOMBSTONE_LS_KEY = 'vestfirma-pedidos-excluidos-ids'

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(TOMBSTONE_LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

function writeIds(ids: string[]): void {
  try {
    const uniq = [...new Set(ids.filter(Boolean))]
    if (uniq.length === 0) {
      localStorage.removeItem(TOMBSTONE_LS_KEY)
      return
    }
    localStorage.setItem(TOMBSTONE_LS_KEY, JSON.stringify(uniq))
  } catch {
    /* quota */
  }
}

export function loadPedidosExcluidosIds(): Set<string> {
  return new Set(readIds())
}

/** Marca pedido apagado definitivamente — impede ressuscitar do snapshot/IDB. */
export function recordPedidoExcluidoPermanente(cardId: string): void {
  if (!cardId) return
  const ids = readIds()
  if (!ids.includes(cardId)) ids.push(cardId)
  writeIds(ids)
}

export function filterBoardRemovendoExcluidos(board: BoardState): BoardState {
  const excluded = loadPedidosExcluidosIds()
  if (excluded.size === 0) return board
  const cards = board.cards.filter((c) => !c?.id || !excluded.has(c.id))
  if (cards.length === board.cards.length) return board
  return { ...board, cards }
}

export function boardTemPedidoExcluidoLocalmente(board: BoardState): boolean {
  const excluded = loadPedidosExcluidosIds()
  if (excluded.size === 0) return false
  return board.cards.some((c) => c?.id && excluded.has(c.id))
}
