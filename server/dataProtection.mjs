/** Política VestFirma: usuários e pedidos não somem sem ação explícita do admin. */

import { podemVincularPedidos } from '../shared/vincularPedido.mjs'

export function assertUserDeleteAllowed(currentUsers, nextUsers, explicitUserDeleteId) {
  if (!Array.isArray(currentUsers) || !Array.isArray(nextUsers)) {
    throw new Error('Lista de usuários inválida')
  }
  if (nextUsers.length >= currentUsers.length) return
  const removed = currentUsers.filter((u) => u?.id && !nextUsers.some((n) => n.id === u.id))
  if (removed.length === 0) return
  if (
    explicitUserDeleteId &&
    removed.length === 1 &&
    removed[0].id === explicitUserDeleteId
  ) {
    return
  }
  throw new Error(
    'PROTEÇÃO: recusado gravar users.json com menos usuários. Exclusão só via DELETE confirmado pelo administrador.',
  )
}

export function pedidoAbsorvidoNoQuadro(card, keptCards) {
  if (!card) return true
  const kept = Array.isArray(keptCards) ? keptCards : []
  if (card.id && kept.some((k) => k?.id === card.id)) return true
  return kept.some((k) => podemVincularPedidos(k, card))
}

/** Queda de contagem só por vincular duplicata (mesmo número / Shopify), não por apagar pedido. */
export function boardPreservouPedidos(existing, merged) {
  const kept = merged?.cards ?? []
  for (const c of existing?.cards ?? []) {
    if (!pedidoAbsorvidoNoQuadro(c, kept)) return false
  }
  return true
}

export function assertBoardCardsNotLost(
  existingCount,
  mergedCount,
  removeArchivedIds,
  adminRole,
  existingBoard,
  mergedBoard,
) {
  if (existingCount === 0 || mergedCount >= existingCount) return true
  if (existingBoard && mergedBoard && boardPreservouPedidos(existingBoard, mergedBoard)) return true
  const removed = existingCount - mergedCount
  return (
    Array.isArray(removeArchivedIds) &&
    removeArchivedIds.length > 0 &&
    removed === removeArchivedIds.length &&
    adminRole === 'admin'
  )
}
