import { verifyShopifyHmac, shopifyConfigured, ingestShopifyOrder, shopifyShopDomain, shopifyShopAllowed, shopifyWebhookSecret } from './shopifySync.mjs'
import { ensureBoardColumns } from '../shared/boardVendedoresMerge.mjs'

export async function handleShopifyWebhookApi(req, res, ctx) {
  const { readRawBody, corsHeaders, boardFilePath, readExistingBoard, backupBoardBeforeWrite, writeBoardAtomic, withBoardWriteLock } =
    ctx

  if (req.method === 'GET' || req.method === 'HEAD') {
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        ok: true,
        shopifyConfigured: shopifyConfigured(),
        shop: shopifyShopDomain() || null,
        webhook: '/api/shopify/webhook',
      }),
    )
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return
  }

  const raw = await readRawBody(req)
  const hmac = req.headers['x-shopify-hmac-sha256']
  const topic = String(req.headers['x-shopify-topic'] || '')
  const shop = String(req.headers['x-shopify-shop-domain'] || '')

  if (!shopifyWebhookSecret()) {
    res.writeHead(503, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'SHOPIFY_WEBHOOK_SECRET não configurada' }))
    return
  }

  if (!verifyShopifyHmac(raw, hmac)) {
    res.writeHead(401, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'HMAC Shopify inválido' }))
    return
  }

  const expected = shopifyShopDomain()
  if (expected && shop && !shopifyShopAllowed(shop)) {
    res.writeHead(401, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'Loja Shopify não reconhecida' }))
    return
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }))
    return
  }

  if (!topic.startsWith('orders/')) {
    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, ignored: topic }))
    return
  }

  const DATA_FILE = boardFilePath()
  let created = false
  await withBoardWriteLock(async () => {
    const existing = (await readExistingBoard(DATA_FILE)) || { columns: [], cards: [], vendedores: [] }
    existing.columns = ensureBoardColumns(existing.columns)
    const result = await ingestShopifyOrder(existing, payload, topic)
    await backupBoardBeforeWrite(DATA_FILE)
    await writeBoardAtomic(DATA_FILE, result.board)
    created = Boolean(result.created)
  })

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: true, topic, created }))
}
