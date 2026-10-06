import { mergeOrderCardFields } from './mergeOrderCard'
import type { BoardState, OrderCard } from './types'

function shopifyKey(card: OrderCard | undefined): string {
  const sid = card?.shopifyOrderId ? String(card.shopifyOrderId).trim() : ''
  if (sid) return `sid:${sid}`
  const id = String(card?.id || '')
  if (id.startsWith('shopify-')) return `sid:${id.slice('shopify-'.length)}`
  return ''
}

function pickShopifyId(a: OrderCard, b: OrderCard): string {
  const aid = String(a.id || '')
  const bid = String(b.id || '')
  if (aid.startsWith('shopify-')) return aid
  if (bid.startsWith('shopify-')) return bid
  return aid || bid
}

/** Une pedidos duplicados da mesma ordem Shopify sem apagar o pedido. */
export function dedupeBoardCards(board: BoardState): BoardState {
  const cards = board.cards ?? []
  if (cards.length < 2) return board
  const kept: OrderCard[] = []
  const indexByKey = new Map<string, number>()
  for (const card of cards) {
    if (!card) continue
    const key = shopifyKey(card)
    if (key && indexByKey.has(key)) {
      const i = indexByKey.get(key)!
      const prev = kept[i]
      const merged = mergeOrderCardFields(prev, card)
      kept[i] = {
        ...merged,
        id: pickShopifyId(prev, card),
        shopifyOrderId: merged.shopifyOrderId || prev.shopifyOrderId,
      }
      continue
    }
    if (key) indexByKey.set(key, kept.length)
    kept.push(card)
  }
  if (kept.length === cards.length) return board
  return { ...board, cards: kept }
}
