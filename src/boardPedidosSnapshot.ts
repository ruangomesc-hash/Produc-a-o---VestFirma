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
