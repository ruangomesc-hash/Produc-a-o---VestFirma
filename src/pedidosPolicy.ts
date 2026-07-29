import type { BoardState, OrderCard } from './types'

/** Pedidos arquivados permanecem no JSON — só saem do kanban. */
export function pedidoVisivelNoKanban(card: OrderCard): boolean {
  return !card.arquivadoEm
}

/**
 * Regra máxima VestFirma: o servidor nunca perde pedidos por PUT parcial.
 * Une por id — existentes que não vieram no payload são mantidos.
 */
export function mergeBoardPreservingPedidos(
  existing: BoardState | null | undefined,
  incoming: BoardState,
): BoardState {
  if (!existing?.cards?.length) return incoming

  const byId = new Map<string, OrderCard>()
  for (const c of existing.cards) {
    if (c?.id) byId.set(c.id, c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? { ...prev, ...c } : c)
  }

  return {
    ...incoming,
    cards: Array.from(byId.values()),
  }
}

export function boardTemPedidos(state: BoardState): boolean {
  return state.cards.some((c) => pedidoVisivelNoKanban(c) || !c.arquivadoEm)
}
