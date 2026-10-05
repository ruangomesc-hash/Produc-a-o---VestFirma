import crypto from 'node:crypto'
import {
  COLUNA_PEDIDO_FEITO_ID,
  cardIdShopify,
  mapShopifyOrderToCard,
  mesclarCardShopify,
  parseEtapaTag,
} from '../shared/shopifyOrderMap.mjs'
import { mergeBoardPreservingPedidos } from './boardPersist.mjs'

export function shopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_SHOP?.trim() &&
      process.env.SHOPIFY_ADMIN_TOKEN?.trim() &&
      process.env.SHOPIFY_WEBHOOK_SECRET?.trim(),
  )
}

export function shopifyShopDomain() {
  return String(process.env.SHOPIFY_SHOP || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}

function apiVersion() {
  return process.env.SHOPIFY_API_VERSION?.trim() || '2025-01'
}

export function verifyShopifyHmac(rawBody, hmacHeader, secret = process.env.SHOPIFY_WEBHOOK_SECRET) {
  if (!secret?.trim() || !hmacHeader) return false
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  const a = Buffer.from(digest)
  const b = Buffer.from(String(hmacHeader))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function adminUrl(path) {
  return `https://${shopifyShopDomain()}/admin/api/${apiVersion()}${path}`
}

async function shopifyFetch(path, init = {}) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN?.trim()
  if (!token || !shopifyShopDomain()) {
    return { ok: false, error: 'Shopify não configurada' }
  }
  const res = await fetch(adminUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { ok: res.ok, status: res.status, data }
}

export async function pushEtapaParaShopify(card, columnTitle) {
  const orderId = card?.shopifyOrderId
  if (!orderId || !shopifyConfigured()) return { ok: false, skipped: true }
  const got = await shopifyFetch(`/orders/${orderId}.json`)
  if (!got.ok) return got
  const order = got.data?.order
  if (!order) return { ok: false, error: 'Pedido Shopify não encontrado' }
  const { mergeShopifyEtapaTags } = await import('../shared/shopifyOrderMap.mjs')
  const tags = mergeShopifyEtapaTags(order.tags, card.columnId)
  const attrs = Array.isArray(order.note_attributes) ? [...order.note_attributes] : []
  const without = attrs.filter((a) => a?.name !== 'vestfirma_etapa' && a?.name !== 'vestfirma_etapa_titulo')
  without.push({ name: 'vestfirma_etapa', value: String(card.columnId) })
  without.push({ name: 'vestfirma_etapa_titulo', value: String(columnTitle || card.columnId) })
  return shopifyFetch(`/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id: Number(orderId) || orderId,
        tags,
        note_attributes: without,
      },
    }),
  })
}

export async function syncEtapasKanbanParaShopify(prevBoard, nextBoard) {
  if (!shopifyConfigured()) return
  const before = new Map((prevBoard?.cards ?? []).filter((c) => c?.id).map((c) => [c.id, c]))
  for (const card of nextBoard?.cards ?? []) {
    if (!card?.shopifyOrderId) continue
    const old = before.get(card.id)
    if (old && old.columnId === card.columnId) continue
    const title = nextBoard.columns?.find((c) => c.id === card.columnId)?.title || card.columnId
    try {
      const result = await pushEtapaParaShopify(card, title)
      if (!result.ok) console.warn('[vestfirma] Shopify etapa:', result.status, result.error || result.data)
    } catch (err) {
      console.warn('[vestfirma] Shopify etapa:', err)
    }
  }
}

function aplicarPedidoShopifyNoQuadro(board, order) {
  const mapped = mapShopifyOrderToCard(order, COLUNA_PEDIDO_FEITO_ID)
  const etapaTag = parseEtapaTag(order.tags)
  if (etapaTag) mapped.columnId = etapaTag
  const existing = (board.cards ?? []).find(
    (c) => c.id === mapped.id || String(c.shopifyOrderId) === String(order.id),
  )
  const mergedCard = existing
    ? mesclarCardShopify(existing, mapped, order.updated_at)
    : mapped
  const incoming = {
    ...board,
    cards: existing
      ? board.cards.map((c) => (c.id === existing.id ? { ...mergedCard, id: existing.id } : c))
      : [...board.cards, mergedCard],
  }
  return mergeBoardPreservingPedidos(board, incoming)
}

export async function ingestShopifyOrder(board, payload, topic) {
  const order = payload?.order || payload
  if (!order?.id) return { board, changed: false }
  if (topic === 'orders/delete') {
    return { board, changed: false }
  }
  const next = aplicarPedidoShopifyNoQuadro(board, order)
  const beforeIds = new Set((board.cards ?? []).map((c) => c.id))
  const after = next.cards.find((c) => c.id === cardIdShopify(order.id) || String(c.shopifyOrderId) === String(order.id))
  const changed = Boolean(after) && (!beforeIds.has(after.id) || JSON.stringify(after) !== JSON.stringify(board.cards.find((c) => c.id === after.id)))
  return { board: next, changed: true, card: after, created: after ? !beforeIds.has(after.id) : false, noop: !changed }
}
