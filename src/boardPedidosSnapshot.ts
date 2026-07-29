import type { BoardState } from './types'
import { contagemPedidos } from './pedidosPolicy'
import { filterBoardRemovendoExcluidos } from './pedidosExcluidosLocal'

const SNAPSHOT_LS_KEY = 'vestfirma-board-pedidos-snapshot'

export function snapshotBoardPedidos(board: BoardState): void {
  try {
    if (contagemPedidos(board) === 0) {
      localStorage.removeItem(SNAPSHOT_LS_KEY)
      return
    }
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

/** Lista curta para o checkup (snapshot antigo no navegador). */
export function previewPedidosNoSnapshot(limit = 5): { numeroPedido: string; cliente: string }[] {
  const snap = loadBoardPedidosSnapshot()
  if (!snap?.cards?.length) return []
  return snap.cards.slice(0, limit).map((c) => ({
    numeroPedido: c.numeroPedido,
    cliente: c.cliente,
  }))
}

/** Remove do snapshot pedidos já apagados definitivamente neste navegador. */
export function purgeSnapshotPedidosExcluidos(): void {
  const snap = loadBoardPedidosSnapshot()
  if (!snap?.cards?.length) return
  const filtered = filterBoardRemovendoExcluidos(snap)
  if (contagemPedidos(filtered) === 0) {
    clearPedidosSnapshot()
    return
  }
  if (filtered.cards.length !== snap.cards.length) {
    snapshotBoardPedidos(filtered)
  }
}

export function clearPedidosSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_LS_KEY)
  } catch {
    /* ignore */
  }
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
