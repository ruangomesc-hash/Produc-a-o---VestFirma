import type { BoardState } from './types'
import { contagemPedidos } from './pedidosPolicy'

const SNAPSHOT_LS_KEY = 'vestfirma-board-pedidos-snapshot'

/** Cópia de segurança no navegador — nunca substituída por modo demo. */
export function snapshotBoardPedidos(board: BoardState): void {
  if (board.demo || contagemPedidos(board) === 0) return
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
