import { mergeOrderCardFields } from './mergeOrderCard.mjs'

function shopifyKey(card) {
  const sid = card?.shopifyOrderId ? String(card.shopifyOrderId).trim() : ''
  if (sid) return `sid:${sid}`
  const id = String(card?.id || '')
  if (id.startsWith('shopify-')) return `sid:${id.slice('shopify-'.length)}`
  return ''
}

function pickShopifyId(a, b) {
  const aid = String(a?.id || '')
  const bid = String(b?.id || '')
  if (aid.startsWith('shopify-')) return aid
  if (bid.startsWith('shopify-')) return bid
  return aid || bid
}

/** Une pedidos duplicados da mesma ordem Shopify sem apagar o pedido. */
export function dedupeBoardCards(board) {
  const cards = Array.isArray(board?.cards) ? board.cards : []
  if (cards.length < 2) return board
  const kept = []
  const indexByKey = new Map()
  for (const card of cards) {
    if (!card) continue
    const key = shopifyKey(card)
    if (key && indexByKey.has(key)) {
      const i = indexByKey.get(key)
      const prev = kept[i]
      const merged = mergeOrderCardFields(prev, card)
      kept[i] = { ...merged, id: pickShopifyId(prev, card), shopifyOrderId: merged.shopifyOrderId || prev.shopifyOrderId }
      continue
    }
    if (key) indexByKey.set(key, kept.length)
    kept.push(card)
  }
  if (kept.length === cards.length) return board
  return { ...board, cards: kept }
}
