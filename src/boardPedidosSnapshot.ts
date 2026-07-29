import type { BoardState } from './types'
import { contagemPedidos } from './pedidosPolicy'

const SNAPSHOT_LS_KEY = 'vestfirma-board-pedidos-snapshot'

export function snapshotBoardPedidos(board: BoardState): void {
  if (contagemPedidos(board) === 0) return
  try {
    localStorage.setItem(SNAPSHOT_LS_KEY, JSON.stringify(board))
  } catch {
    /* quota */
  }
}

export function loadBoardPedidosSnapshot(): BoardState | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BoardState
  } catch {
    return null
  }
}

export function contagemPedidosNoSnapshot(): number {
  const snap = loadBoardPedidosSnapshot()
  return snap ? contagemPedidos(snap) : 0
}

/** Remove um pedido do snapshot local (após exclusão definitiva no servidor). */
export function removeCardFromPedidosSnapshot(cardId: string): void {
  const snap = loadBoardPedidosSnapshot()
  if (!snap?.cards?.length) return
  const next = { ...snap, cards: snap.cards.filter((c) => c.id !== cardId) }
  if (contagemPedidos(next) === 0) {
    try {
      localStorage.removeItem(SNAPSHOT_LS_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  try {
    localStorage.setItem(SNAPSHOT_LS_KEY, JSON.stringify(next))
  } catch {
    /* quota */
  }
}
