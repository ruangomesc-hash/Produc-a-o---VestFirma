import {
  shopifyConfigured,
  listAllShopifyOrders,
  checkupShopifyVsKanban,
  importarPedidosShopifyFaltantes,
  syncEtapasKanbanParaShopify,
} from './shopifySync.mjs'
import { ensureBoardColumns } from '../shared/boardVendedoresMerge.mjs'

function json(res, corsHeaders, status, body) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export async function handleShopifyCheckupApi(req, res, ctx) {
  const {
    corsHeaders,
    readBody,
    requireSession,
    requireLogin,
    boardFilePath,
    readExistingBoard,
    backupBoardBeforeWrite,
    writeBoardAtomic,
    withBoardWriteLock,
  } = ctx

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  if (requireLogin) {
    const session = await requireSession(req, res)
    if (!session) return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, corsHeaders())
    res.end('Method Not Allowed')
    return
  }

  if (!shopifyConfigured()) {
    json(res, corsHeaders, 503, { ok: false, error: 'Shopify não configurada neste servidor.' })
    return
  }

  const listed = await listAllShopifyOrders()
  if (!listed.ok) {
    json(res, corsHeaders, 502, {
      ok: false,
      error: listed.error || 'Não foi possível listar os pedidos da Shopify.',
    })
    return
  }

  const DATA_FILE = boardFilePath()
  const importMissing = req.method === 'POST'
  let importBody = {}
  if (importMissing && typeof readBody === 'function') {
    try {
      const raw = await readBody(req)
      importBody = raw ? JSON.parse(raw) : {}
    } catch {
      importBody = {}
    }
  }

  if (!importMissing || importBody.importMissing === false) {
    const board = (await readExistingBoard(DATA_FILE)) || { columns: [], cards: [], vendedores: [] }
    const report = checkupShopifyVsKanban(board, listed.orders)
    json(res, corsHeaders, 200, {
      ok: true,
      imported: 0,
      shopifyTotal: report.shopifyTotal,
      shopifyCountApi: listed.expected || report.shopifyTotal,
      kanbanTotal: report.kanbanTotal,
      jaNoKanban: report.jaNoKanban,
      faltando: report.noKanban.length,
      noKanban: report.noKanban,
    })
    return
  }

  let imported = 0
  let restaurados = 0
  let reportAfter = null
  let reportBefore = null
  let prevBoard = null
  let nextBoard = null
  await withBoardWriteLock(async () => {
    const existing = (await readExistingBoard(DATA_FILE)) || { columns: [], cards: [], vendedores: [] }
    existing.columns = ensureBoardColumns(existing.columns)
    reportBefore = checkupShopifyVsKanban(existing, listed.orders)
    prevBoard = { columns: existing.columns, cards: (existing.cards ?? []).map((card) => ({
      id: card?.id,
      columnId: card?.columnId,
      shopifyOrderId: card?.shopifyOrderId,
    })) }
    const result = await importarPedidosShopifyFaltantes(existing, listed.orders)
    nextBoard = result.board
    reportAfter = checkupShopifyVsKanban(result.board, listed.orders)
    imported = result.imported
    restaurados = result.restaurados || 0
    if (imported > 0 || restaurados > 0) {
      await backupBoardBeforeWrite(DATA_FILE)
      await writeBoardAtomic(DATA_FILE, result.board)
    }
  })
  if ((imported > 0 || restaurados > 0) && prevBoard && nextBoard) {
    void syncEtapasKanbanParaShopify(prevBoard, nextBoard).catch((err) => {
      console.warn('[vestfirma] Shopify sync:', err)
    })
  }

  json(res, corsHeaders, 200, {
    ok: true,
    imported,
    restaurados,
    shopifyTotal: reportAfter?.shopifyTotal ?? listed.orders.length,
    kanbanTotal: reportAfter?.kanbanTotal ?? 0,
    jaNoKanban: reportAfter?.jaNoKanban ?? 0,
    faltando: reportAfter?.noKanban.length ?? 0,
    noKanban: reportAfter?.noKanban ?? [],
    extraidos: reportBefore?.noKanban ?? [],
  })
}
