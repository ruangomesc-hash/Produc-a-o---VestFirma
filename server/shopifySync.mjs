import crypto from 'node:crypto'
import {
  COLUNA_PEDIDO_FEITO_ID,
  encontrarCardParaPedidoShopify,
  mapShopifyOrderToCard,
  mesclarCardShopify,
  mergeShopifyEtapaTags,
  parseEtapaTag,
  statusShopifyPedido,
} from '../shared/shopifyOrderMap.mjs'
import { classificarPedidosShopifyNoKanban } from '../shared/shopifyCheckup.mjs'
import { mergeBoardPreservingPedidos } from './boardPersist.mjs'

function shopifyClientId() {
  return process.env.SHOPIFY_CLIENT_ID?.trim() || process.env.SHOPIFY_API_KEY?.trim() || ''
}

function shopifyClientSecret() {
  return process.env.SHOPIFY_CLIENT_SECRET?.trim() || process.env.SHOPIFY_API_SECRET?.trim() || ''
}

export function shopifyWebhookSecret() {
  return (
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ||
    shopifyClientSecret() ||
    ''
  )
}

let cachedAdminToken = ''
let cachedAdminTokenUntil = 0

export function shopifyConfigured() {
  const hasStaticToken = Boolean(process.env.SHOPIFY_ADMIN_TOKEN?.trim())
  const hasClientGrant = Boolean(shopifyClientId() && shopifyClientSecret())
  return Boolean(shopifyShopDomain() && shopifyWebhookSecret() && (hasStaticToken || hasClientGrant))
}

export function shopifyShopDomain() {
  return String(process.env.SHOPIFY_SHOP || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}

function normalizeShopHost(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export function shopifyShopAllowed(incomingShop) {
  const got = normalizeShopHost(incomingShop)
  if (!got) return true
  const allowed = new Set()
  const main = normalizeShopHost(shopifyShopDomain())
  if (main) allowed.add(main)
  for (const part of String(process.env.SHOPIFY_SHOP_ALIASES || '').split(',')) {
    const host = normalizeShopHost(part)
    if (host) allowed.add(host)
  }
  if (main === 'vestfirma.myshopify.com' || main === 'zt3dfv-b8.myshopify.com') {
    allowed.add('vestfirma.myshopify.com')
    allowed.add('zt3dfv-b8.myshopify.com')
    allowed.add('vestfirma.com.br')
    allowed.add('www.vestfirma.com.br')
  }
  if (!main) return true
  return allowed.has(got)
}

function apiVersion() {
  return process.env.SHOPIFY_API_VERSION?.trim() || '2026-10'
}

export function verifyShopifyHmac(rawBody, hmacHeader, secret = shopifyWebhookSecret()) {
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

async function shopifyAdminAccessToken() {
  const staticToken = process.env.SHOPIFY_ADMIN_TOKEN?.trim()
  if (staticToken) return staticToken
  if (!shopifyShopDomain() || !shopifyClientId() || !shopifyClientSecret()) return ''
  if (cachedAdminToken && Date.now() < cachedAdminTokenUntil - 60_000) return cachedAdminToken
  const shop = shopifyShopDomain()
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: shopifyClientId(),
      client_secret: shopifyClientSecret(),
    }),
  })
  const data = await res.json().catch(() => ({}))
  const token = String(data?.access_token || '').trim()
  const expiresIn = Number(data?.expires_in) || 86400
  if (!res.ok || !token) {
    console.warn('[vestfirma] Shopify client_credentials:', res.status, data?.error || data)
    return ''
  }
  cachedAdminToken = token
  cachedAdminTokenUntil = Date.now() + expiresIn * 1000
  return token
}

async function shopifyFetch(path, init = {}) {
  const token = await shopifyAdminAccessToken()
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
  return { ok: res.ok, status: res.status, data, link: res.headers.get('link') }
}

async function shopifyGraphql(query, variables) {
  const token = await shopifyAdminAccessToken()
  if (!token || !shopifyShopDomain()) return { ok: false, error: 'Shopify não configurada' }
  const res = await fetch(`https://${shopifyShopDomain()}/admin/api/${apiVersion()}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && !data?.errors?.length, status: res.status, data }
}

async function gravarStatusProducaoShopify(orderId, status) {
  const { SHOPIFY_STATUS_PRODUCAO_KEY, SHOPIFY_STATUS_PRODUCAO_NS } = await import(
    '../shared/shopifyOrderMap.mjs'
  )
  const numeric = String(orderId).replace(/\D/g, '') || String(orderId)
  const got = await shopifyGraphql(
    `mutation VestfirmaStatusSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key namespace value }
        userErrors { field message code }
      }
    }`,
    {
      metafields: [
        {
          ownerId: `gid://shopify/Order/${numeric}`,
          namespace: SHOPIFY_STATUS_PRODUCAO_NS,
          key: SHOPIFY_STATUS_PRODUCAO_KEY,
          type: 'single_line_text_field',
          value: status,
        },
      ],
    },
  )
  const errors = got.data?.data?.metafieldsSet?.userErrors || []
  if (!got.ok || errors.length) {
    return { ok: false, status: got.status, error: errors[0]?.message || 'Falha ao gravar status', data: got.data }
  }
  return { ok: true, value: got.data?.data?.metafieldsSet?.metafields?.[0]?.value || status }
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
  const saved = await shopifyFetch(`/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id: Number(orderId) || orderId,
        tags,
        note_attributes: without,
      },
    }),
  })
  const { statusProducaoShopify } = await import('../shared/shopifyOrderMap.mjs')
  const status = statusProducaoShopify(card.columnId)
  const metafield = status
    ? await gravarStatusProducaoShopify(orderId, status)
    : { ok: false, skipped: true }
  if (!metafield.ok && !metafield.skipped) {
    console.warn('[vestfirma] Shopify status de produção:', metafield.error || metafield.data)
  }
  return { ...saved, statusProducao: metafield.ok ? status : null, statusProducaoOk: Boolean(metafield.ok) }
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
  if (etapaTag && !mapped.shopifyPedidoStatus) mapped.columnId = etapaTag
  const existing = encontrarCardParaPedidoShopify(board.cards, order)
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

function nextApiPathFromLink(linkHeader) {
  const raw = String(linkHeader || '')
  for (const part of raw.split(',')) {
    if (!/rel="next"/i.test(part)) continue
    const m = part.match(/<([^>]+)>/)
    if (!m) continue
    try {
      const u = new URL(m[1])
      const api = u.pathname.replace(/^\/admin\/api\/[^/]+/, '') || '/orders.json'
      return `${api}${u.search}`
    } catch {
      return ''
    }
  }
  return ''
}

/** Lista todos os pedidos da loja (abertos, fechados, cancelados, arquivados, de qualquer data). */
export async function listAllShopifyOrders() {
  if (!shopifyConfigured()) {
    return { ok: false, error: 'Shopify não configurada', orders: [] }
  }
  const countGot = await shopifyFetch('/orders/count.json?status=any')
  const expected = Number(countGot.data?.count) || 0
  const orders = []
  const seen = new Set()
  const startPaths = [
    '/orders.json?status=any&limit=250&created_at_min=2010-01-01T00:00:00-03:00',
    '/orders.json?status=any&limit=250',
  ]
  let pages = 0
  for (const start of startPaths) {
    let path = start
    while (path && pages < 80) {
      pages += 1
      const got = await shopifyFetch(path)
      if (!got.ok) {
        return {
          ok: false,
          error: got.error || `Shopify ${got.status}`,
          status: got.status,
          data: got.data,
          orders,
          expected,
        }
      }
      const batch = Array.isArray(got.data?.orders) ? got.data.orders : []
      for (const order of batch) {
        const id = String(order?.id || '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        orders.push(order)
      }
      path = nextApiPathFromLink(got.link)
    }
    if (expected && orders.length >= expected) break
  }
  if (expected && orders.length < expected) {
    const extra = await listShopifyOrdersGraphql(seen)
    for (const order of extra) {
      const id = String(order?.id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      orders.push(order)
    }
  }
  return { ok: true, orders, pages, expected }
}

function gidNumerico(gid) {
  const m = String(gid || '').match(/(\d+)\s*$/)
  return m ? m[1] : String(gid || '')
}

function enderecoGraphql(addr) {
  if (!addr) return null
  return {
    first_name: addr.firstName,
    last_name: addr.lastName,
    phone: addr.phone,
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    province: addr.province,
    zip: addr.zip,
    country: addr.country,
  }
}

async function listShopifyOrdersGraphql(seen) {
  const token = await shopifyAdminAccessToken()
  if (!token || !shopifyShopDomain()) return []
  const query = `query VestfirmaOrders($cursor: String) {
    orders(first: 100, after: $cursor, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name createdAt updatedAt processedAt cancelledAt displayFinancialStatus tags note phone
        shippingAddress { firstName lastName phone address1 address2 city province zip country }
        billingAddress { firstName lastName phone address1 address2 city province zip country }
        customer { firstName lastName phone email }
        lineItems(first: 80) { nodes { name title quantity variantTitle } }
      }
    }
  }`
  const out = []
  let cursor = null
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`https://${shopifyShopDomain()}/admin/api/${apiVersion()}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    })
    const data = await res.json().catch(() => ({}))
    const conn = data?.data?.orders
    const nodes = Array.isArray(conn?.nodes) ? conn.nodes : []
    for (const node of nodes) {
      const id = gidNumerico(node?.id)
      if (!id || seen.has(id)) continue
      out.push({
        id,
        name: node.name,
        order_number: String(node.name || '').replace(/^#/, ''),
        created_at: node.createdAt,
        updated_at: node.updatedAt,
        processed_at: node.processedAt,
        cancelled_at: node.cancelledAt,
        financial_status: String(node.displayFinancialStatus || '').toLowerCase(),
        tags: Array.isArray(node.tags) ? node.tags.join(', ') : node.tags,
        note: node.note,
        phone: node.phone,
        shipping_address: enderecoGraphql(node.shippingAddress),
        billing_address: enderecoGraphql(node.billingAddress),
        customer: node.customer
          ? {
              first_name: node.customer.firstName,
              last_name: node.customer.lastName,
              phone: node.customer.phone,
              email: node.customer.email,
            }
          : null,
        line_items: (node.lineItems?.nodes || []).map((li) => ({
          name: li.name,
          title: li.title,
          quantity: li.quantity,
          variant_title: li.variantTitle,
        })),
      })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

export function checkupShopifyVsKanban(board, orders) {
  return classificarPedidosShopifyNoKanban(board, orders)
}

/** Cria no kanban só o que ainda não existe; datas vêm do pedido Shopify. */
export async function importarPedidosShopifyFaltantes(board, orders) {
  let next = board
  let imported = 0
  let restaurados = 0
  const ids = []
  for (const order of orders || []) {
    if (!order?.id) continue
    const existing = encontrarCardParaPedidoShopify(next.cards, order)
    if (existing) {
      const status = statusShopifyPedido(order)
      if (existing.arquivadoEm && !status) {
        next = {
          ...next,
          cards: next.cards.map((c) =>
            c.id === existing.id ? { ...c, arquivadoEm: null } : c,
          ),
        }
        restaurados += 1
        ids.push(String(order.id))
      }
      const result = await ingestShopifyOrder(next, order, 'orders/updated')
      next = result.board
      continue
    }
    const result = await ingestShopifyOrder(next, order, 'orders/create')
    next = result.board
    if (result.created) {
      imported += 1
      ids.push(String(order.id))
    }
  }
  return { board: next, imported, restaurados, importedIds: ids }
}

export function startShopifyKanbanBackfill(ctx) {
  const run = async () => {
    try {
      if (!shopifyConfigured()) return
      const listed = await listAllShopifyOrders()
      if (!listed.ok) {
        console.warn('[vestfirma] Shopify backfill:', listed.error)
        return
      }
      const { ensureBoardColumns } = await import('../shared/boardVendedoresMerge.mjs')
      await ctx.withBoardWriteLock(async () => {
        const existing =
          (await ctx.readExistingBoard(ctx.boardFile)) || { columns: [], cards: [], vendedores: [] }
        existing.columns = ensureBoardColumns(existing.columns)
        const result = await importarPedidosShopifyFaltantes(existing, listed.orders)
        const mudou = (result.imported || 0) + (result.restaurados || 0)
        if (mudou > 0) {
          await ctx.backupBoardBeforeWrite(ctx.boardFile)
          await ctx.writeBoardAtomic(ctx.boardFile, result.board)
          console.log(
            `[vestfirma] Shopify backfill: +${result.imported} novos, ${result.restaurados || 0} de volta ao kanban (${listed.orders.length} na loja)`,
          )
        }
      })
    } catch (err) {
      console.warn('[vestfirma] Shopify backfill:', err)
    }
  }
  setTimeout(() => void run(), 8000)
  setInterval(() => void run(), 10 * 60 * 1000)
}

export async function ingestShopifyOrder(board, payload, topic) {
  const order = payload?.order || payload
  if (!order?.id) return { board, changed: false }
  if (topic === 'orders/delete') {
    return { board, changed: false }
  }
  const next = aplicarPedidoShopifyNoQuadro(board, order)
  const beforeIds = new Set((board.cards ?? []).map((c) => c.id))
  const after = encontrarCardParaPedidoShopify(next.cards, order)
  const changed =
    Boolean(after) &&
    (!beforeIds.has(after.id) || JSON.stringify(after) !== JSON.stringify(board.cards.find((c) => c.id === after.id)))
  return { board: next, changed: true, card: after, created: after ? !beforeIds.has(after.id) : false, noop: !changed }
}

