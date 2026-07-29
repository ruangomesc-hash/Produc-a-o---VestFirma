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

/** Une pedidos de várias fontes (servidor, IDB, snapshot) sem remover ids existentes. */
export function mergeBoardsMaxPedidos(
  ...boards: (BoardState | null | undefined)[]
): BoardState | null {
  const valid = boards.filter((b): b is BoardState => Boolean(b?.columns?.length))
  if (valid.length === 0) return null

  valid.sort((a, b) => contagemPedidos(b) - contagemPedidos(a))
  let acc: BoardState = {
    ...valid[0],
    cards: [...(valid[0].cards ?? [])],
    vendedores: [...(valid[0].vendedores ?? [])],
  }
  for (let i = 1; i < valid.length; i++) {
    acc = mergeBoardPreservingPedidos(acc, valid[i])
  }
  return acc
}
