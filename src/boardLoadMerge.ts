import type { BoardState } from './types'
import { contagemPedidos, mergeBoardAddingMissingPedidosOnly, mergeBoardRemotePrimary } from './pedidosPolicy'

/**
 * Servidor manda, mas pedidos criados neste navegador e ainda não gravados no servidor são mantidos.
 */
export function mergeBoardLoggedInFromServer(
  remote: BoardState,
  local: BoardState | null | undefined,
): BoardState {
  let board = mergeBoardRemotePrimary(remote, local)
  if (local?.cards?.length) {
    board = mergeBoardAddingMissingPedidosOnly(board, local)
  }
  return board
}

export function boardTemPedidosAlemDoServidor(board: BoardState, remote: BoardState): boolean {
  return contagemPedidos(board) > contagemPedidos(remote)
}
