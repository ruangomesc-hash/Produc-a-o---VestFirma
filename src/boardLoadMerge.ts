import type { BoardState } from './types'
import { dedupeBoardCards } from './dedupeBoardCards'
import { contagemPedidos, mergeBoardAddingMissingPedidosOnly, mergeBoardRemotePrimary } from './pedidosPolicy'
import { loadPedidosExcluidosIds } from './pedidosExcluidosLocal'

/**
 * Servidor manda. Pedidos só neste navegador entram para serem enviados.
 * Tombstone local NÃO esconde pedido que já está no servidor (senão tablet/celular ficam com menos cards).
 */
export function mergeBoardLoggedInFromServer(
  remote: BoardState,
  local: BoardState | null | undefined,
): BoardState {
  let board = mergeBoardRemotePrimary(remote, local)
  if (local?.cards?.length) {
    const remoteIds = new Set((remote.cards ?? []).map((c) => c.id).filter(Boolean))
    const excluded = loadPedidosExcluidosIds()
    const extrasOnly = {
      ...local,
      cards: local.cards.filter((c) => c?.id && !remoteIds.has(c.id) && !excluded.has(c.id)),
    }
    board = mergeBoardAddingMissingPedidosOnly(board, extrasOnly)
  }
  return dedupeBoardCards(board)
}

export function boardTemPedidosAlemDoServidor(board: BoardState, remote: BoardState): boolean {
  return contagemPedidos(board) > contagemPedidos(remote)
}
