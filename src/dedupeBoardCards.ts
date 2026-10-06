import { mergeOrderCardFields } from './mergeOrderCard'
import type { BoardState, OrderCard } from './types'
import {
  normalizeNumeroPedido,
  podemVincularPedidos,
  pickLinkedCardId,
  shopifyOrderIdOf,
} from './vincularPedido'

function shopifyKey(card: OrderCard | undefined): string {
  const sid = shopifyOrderIdOf(card)
  return sid ? `sid:${sid}` : ''
}

function numeroKey(card: OrderCard | undefined): string {
  const n = normalizeNumeroPedido(card?.numeroPedido)
  return n ? `num:${n}` : ''
}

function mergeVinculados(prev: OrderCard, card: OrderCard): OrderCard {
  const merged = mergeOrderCardFields(prev, card)
  const sid = shopifyOrderIdOf(merged) || shopifyOrderIdOf(prev) || shopifyOrderIdOf(card)
  const origem =
    prev.origem === 'shopify' || card.origem === 'shopify' || sid ? 'shopify' : merged.origem
  return {
    ...merged,
    id: pickLinkedCardId(prev, card),
    shopifyOrderId: sid || merged.shopifyOrderId,
    origem,
  }
}

function indiceParaVincular(
  kept: OrderCard[],
  card: OrderCard,
  indexBySid: Map<string, number>,
  indexByNumero: Map<string, number>,
): number {
  const sid = shopifyKey(card)
  if (sid && indexBySid.has(sid)) return indexBySid.get(sid)!
  const num = numeroKey(card)
  if (!num) return -1
  if (indexByNumero.has(num)) {
    const i = indexByNumero.get(num)!
    if (podemVincularPedidos(kept[i], card)) return i
  }
  for (let i = 0; i < kept.length; i++) {
    if (numeroKey(kept[i]) === num && podemVincularPedidos(kept[i], card)) return i
  }
  return -1
}

/** Une duplicatas da mesma ordem (Shopify ou mesmo número já no kanban) sem apagar o pedido. */
export function dedupeBoardCards(board: BoardState): BoardState {
  const cards = board.cards ?? []
  if (cards.length < 2) return board
  const kept: OrderCard[] = []
  const indexBySid = new Map<string, number>()
  const indexByNumero = new Map<string, number>()
  for (const card of cards) {
    if (!card) continue
    const i = indiceParaVincular(kept, card, indexBySid, indexByNumero)
    if (i >= 0) {
      kept[i] = mergeVinculados(kept[i], card)
      const sid = shopifyKey(kept[i])
      const num = numeroKey(kept[i])
      if (sid) indexBySid.set(sid, i)
      if (num) indexByNumero.set(num, i)
      continue
    }
    const idx = kept.length
    kept.push(card)
    const sid = shopifyKey(card)
    const num = numeroKey(card)
    if (sid) indexBySid.set(sid, idx)
    if (num && !indexByNumero.has(num)) indexByNumero.set(num, idx)
  }
  if (kept.length === cards.length) return board
  return { ...board, cards: kept }
}
