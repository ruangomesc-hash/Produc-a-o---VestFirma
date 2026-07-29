import type { BoardState, OrderCard } from './types'
import { mergeVendedoresUnion } from './vendedorUserSync'

/** Pedidos arquivados permanecem no JSON — só saem do kanban. */
export function pedidoVisivelNoKanban(card: OrderCard): boolean {
  return !card.arquivadoEm
}

/** Momento da última mudança relevante no pedido (movimento, criação, etc.). */
export function pedidoRevisionMs(card: OrderCard): number {
  let max = 0
  for (const e of card.historicoEtapa ?? []) {
    if (e?.at) {
      const t = Date.parse(e.at)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  for (const iso of [card.etapaDesde, card.createdAt, card.arquivadoEm]) {
    if (iso) {
      const t = Date.parse(iso)
      if (!Number.isNaN(t)) max = Math.max(max, t)
    }
  }
  return max
}

function mergeOrderCard(existing: OrderCard, incoming: OrderCard): OrderCard {
  const tExist = pedidoRevisionMs(existing)
  const tIn = pedidoRevisionMs(incoming)
  if (tIn >= tExist) return { ...existing, ...incoming }
  return { ...incoming, ...existing }
}

function mergeBoardShell(
  existing: BoardState | null | undefined,
  incoming: BoardState,
): Pick<BoardState, 'columns' | 'vendedores' | 'segmentos'> {
  return {
    columns: incoming.columns?.length ? incoming.columns : (existing?.columns ?? incoming.columns),
    vendedores: mergeVendedoresUnion(existing?.vendedores ?? [], incoming.vendedores ?? []),
    segmentos: incoming.segmentos?.length ? incoming.segmentos : (existing?.segmentos ?? incoming.segmentos),
  }
}

/**
 * Regra máxima VestFirma: o servidor nunca perde pedidos por PUT parcial.
 * Une por id — existentes que não vieram no payload são mantidos.
 * Em conflito de etapa, vence a versão mais recente (histórico / etapaDesde).
 */
export function mergeBoardPreservingPedidos(
  existing: BoardState | null | undefined,
  incoming: BoardState,
  removeCardIds: string[] = [],
): BoardState {
  const shell = mergeBoardShell(existing, incoming)
  const removeSet = new Set(removeCardIds.filter(Boolean))
  if (!existing?.cards?.length) {
    const cards = (incoming.cards ?? []).filter((c) => !c?.id || !removeSet.has(c.id))
    return { ...incoming, ...shell, cards }
  }

  const byId = new Map<string, OrderCard>()
  const legacy: OrderCard[] = []
  for (const c of existing.cards) {
    if (c?.id) {
      if (removeSet.has(c.id)) continue
      byId.set(c.id, c)
    } else legacy.push(c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    if (removeSet.has(c.id)) {
      byId.delete(c.id)
      continue
    }
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? mergeOrderCard(prev, c) : c)
  }

  return {
    ...incoming,
    ...shell,
    cards: [...legacy, ...Array.from(byId.values())],
  }
}

/** Só inclui pedidos que faltam em `primary` — não sobrescreve dados atuais. */
export function mergeBoardAddingMissingPedidosOnly(
  primary: BoardState,
  secondary: BoardState | null | undefined,
): BoardState {
  if (!secondary?.cards?.length) return primary
  const byId = new Map(primary.cards.map((c) => [c.id, c]))
  let added = false
  for (const c of secondary.cards) {
    if (c?.id && !byId.has(c.id)) {
      byId.set(c.id, c)
      added = true
    }
  }
  if (!added) return primary
  return { ...primary, cards: [...byId.values()] }
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
