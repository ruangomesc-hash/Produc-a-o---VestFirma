/** Política VestFirma: usuários e pedidos não somem sem ação explícita do admin. */

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

export function assertBoardCardsNotLost(existingCount, mergedCount, removeArchivedIds, adminRole) {
  if (existingCount === 0 || mergedCount >= existingCount) return true
  const removed = existingCount - mergedCount
  return (
    Array.isArray(removeArchivedIds) &&
    removeArchivedIds.length > 0 &&
    removed === removeArchivedIds.length &&
    adminRole === 'admin'
  )
}
