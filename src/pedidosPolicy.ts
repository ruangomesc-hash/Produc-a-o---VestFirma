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
  const legacy: OrderCard[] = []
  for (const c of existing.cards) {
    if (c?.id) byId.set(c.id, c)
    else legacy.push(c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? { ...prev, ...c } : c)
  }

  return {
    ...incoming,
    cards: [...legacy, ...Array.from(byId.values())],
  }
}

export function boardTemPedidos(state: BoardState): boolean {
  return state.cards.length > 0
}

export function contagemPedidos(state: BoardState | null | undefined): number {
  return Array.isArray(state?.cards) ? state!.cards.length : 0
}

/** Une pedidos de duas fontes (servidor, IDB, etc.) sem remover ids existentes. */
export function mergeBoardsMaxPedidos(
  ...boards: (BoardState | null | undefined)[]
): BoardState | null {
  let acc: BoardState | null = null
  for (const b of boards) {
    if (!b?.columns?.length) continue
    const norm = b
    if (!acc) {
      acc = { ...norm, cards: [...(norm.cards ?? [])] }
      continue
    }
    acc = mergeBoardPreservingPedidos(acc, norm)
  }
  return acc
}
