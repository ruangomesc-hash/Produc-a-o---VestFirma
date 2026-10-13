import crypto from 'node:crypto'
import { mergePedidoImagens, mergeObservacaoPedido, pedidoRevisionMs, mergeOrderCardFields } from '../shared/mergeOrderCard.mjs'

function json(res, corsHeaders, status, body) {
  if (res.headersSent) return
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** POST /api/board com action vestfirma-card-patch — une comentário/logos num pedido. Não apaga cards. */
export async function applyBoardCardPatch(payload, session, ctx) {
  const {
    boardFilePath,
    backupBoardBeforeWrite,
    mergeBoardPreservingPedidos,
    readExistingBoard,
    countBoardCards,
    withBoardWriteLock,
    writeBoardAtomic,
    externalizeBoardLogos,
    logoDirPath,
  } = ctx

  const cardId = typeof payload?.cardId === 'string' ? payload.cardId.trim() : ''
  if (!cardId) return { status: 400, body: { error: 'Informe o pedido.' } }

  return withBoardWriteLock(async () => {
    const DATA_FILE = boardFilePath()
    const existing = await readExistingBoard(DATA_FILE)
    const existingCount = countBoardCards(existing)
    const card = existing?.cards?.find((c) => c?.id === cardId)
    if (!card) return { status: 404, body: { error: 'Pedido não encontrado.' } }

    let next = { ...card }

    if (payload.comentario && typeof payload.comentario === 'object') {
      const texto = typeof payload.comentario.texto === 'string' ? payload.comentario.texto.trim() : ''
      if (texto) {
        const entry = {
          id:
            typeof payload.comentario.id === 'string' && payload.comentario.id
              ? payload.comentario.id
              : crypto.randomUUID(),
          texto,
          autorNome:
            session?.user ||
            (typeof payload.comentario.autorNome === 'string' ? payload.comentario.autorNome : 'Equipe'),
          autorEmail:
            session?.email ||
            (typeof payload.comentario.autorEmail === 'string' ? payload.comentario.autorEmail : ''),
          autorRole: session?.role || payload.comentario.autorRole,
          at:
            typeof payload.comentario.at === 'string' && payload.comentario.at
              ? payload.comentario.at
              : new Date().toISOString(),
        }
        const incoming = {
          ...next,
          comentarios: [...(next.comentarios ?? []), entry],
        }
        next = mergeOrderCardFields(next, incoming)
      }
    }

    if (Array.isArray(payload.comentarios) && payload.comentarios.length > 0) {
      next = mergeOrderCardFields(next, { ...next, comentarios: payload.comentarios })
    }

    const listasLogo = {}
    for (const key of ['logoEnviadaCliente', 'logoProntaImpressao', 'previewAprovacaoCliente']) {
      if (Array.isArray(payload[key])) listasLogo[key] = mergePedidoImagens(payload[key], [])
    }
    const trocouLogo = Object.keys(listasLogo).length > 0
    const incomingMidia = {
      ...next,
      ...listasLogo,
      ...(trocouLogo
        ? { midiaAtualizadaEm: payload.midiaAtualizadaEm || new Date().toISOString() }
        : {}),
      observacao:
        payload.observacao !== undefined
          ? mergeObservacaoPedido(next.observacao, payload.observacao, pedidoRevisionMs(next), Date.now())
          : next.observacao,
    }
    next = mergeOrderCardFields(next, incomingMidia)

    let board = mergeBoardPreservingPedidos(existing, {
      ...existing,
      cards: existing.cards.map((c) => (c.id === cardId ? next : c)),
    })
    if (existingCount > 0 && countBoardCards(board) < existingCount) {
      const { boardPreservouPedidos } = await import('./dataProtection.mjs')
      if (!boardPreservouPedidos(existing, board)) {
        return { status: 409, body: { error: 'Recusado: este save removeria pedidos já gravados.' } }
      }
    }

    if (process.env.EXTERNALIZE_BOARD_LOGOS !== '0' && typeof externalizeBoardLogos === 'function') {
      board = await externalizeBoardLogos(board, logoDirPath())
    }

    await backupBoardBeforeWrite(DATA_FILE)
    await writeBoardAtomic(DATA_FILE, board)
    const { syncEtapasKanbanParaShopify } = await import('./shopifySync.mjs')
    void syncEtapasKanbanParaShopify(existing, board).catch((err) => {
      console.warn('[vestfirma] Shopify sync:', err)
    })
    const saved = board.cards.find((c) => c.id === cardId)
    return {
      status: 200,
      body: {
        ok: true,
        cardId,
        comentarios: saved?.comentarios ?? next.comentarios ?? [],
        logoEnviadaCliente: saved?.logoEnviadaCliente ?? next.logoEnviadaCliente,
        logoProntaImpressao: saved?.logoProntaImpressao ?? next.logoProntaImpressao,
        previewAprovacaoCliente: saved?.previewAprovacaoCliente ?? next.previewAprovacaoCliente,
        observacao: saved?.observacao ?? next.observacao,
      },
    }
  })
}

/** POST action vestfirma-card-move — muda só a coluna deste pedido e avisa a Shopify. */
export async function applyBoardCardMove(payload, session, ctx) {
  const {
    boardFilePath,
    backupBoardBeforeWrite,
    readExistingBoard,
    withBoardWriteLock,
    writeBoardAtomic,
  } = ctx

  const cardId = typeof payload?.cardId === 'string' ? payload.cardId.trim() : ''
  const columnId = typeof payload?.columnId === 'string' ? payload.columnId.trim() : ''
  if (!cardId || !columnId) return { status: 400, body: { error: 'Informe o pedido e a etapa.' } }

  return withBoardWriteLock(async () => {
    const DATA_FILE = boardFilePath()
    const existing = await readExistingBoard(DATA_FILE)
    const card = existing?.cards?.find((c) => c?.id === cardId)
    if (!card) return { status: 404, body: { error: 'Pedido não encontrado.' } }
    const columns = existing.columns ?? []
    const destino = columns.find((c) => c?.id === columnId)
    if (!destino) return { status: 400, body: { error: 'Etapa não existe no quadro.' } }
    if (card.columnId === columnId) {
      return { status: 200, body: { ok: true, cardId, columnId, unchanged: true } }
    }

    const now = new Date().toISOString()
    const fromIdx = columns.findIndex((c) => c?.id === card.columnId)
    const toIdx = columns.findIndex((c) => c?.id === columnId)
    const tipo = fromIdx < 0 || toIdx < 0 || fromIdx === toIdx ? 'movido' : toIdx > fromIdx ? 'avancou' : 'voltou'
    const fromTitle = columns.find((c) => c?.id === card.columnId)?.title || card.columnId
    const entry = {
      id: crypto.randomUUID(),
      tipo,
      columnId,
      columnTitle: destino.title || columnId,
      at: now,
      fromColumnId: card.columnId,
      fromColumnTitle: fromTitle,
      autorNome: session?.user || '',
      autorEmail: session?.email || '',
      autorRole: session?.role || '',
    }
    const next = {
      ...card,
      columnId,
      etapaDesde: now,
      historicoEtapa: [...(card.historicoEtapa ?? []), entry],
    }
    const board = {
      ...existing,
      cards: existing.cards.map((c) => (c.id === cardId ? next : c)),
    }
    await backupBoardBeforeWrite(DATA_FILE)
    await writeBoardAtomic(DATA_FILE, board)
    const { syncEtapasKanbanParaShopify } = await import('./shopifySync.mjs')
    void syncEtapasKanbanParaShopify(existing, board).catch((err) => {
      console.warn('[vestfirma] Shopify sync:', err)
    })
    return {
      status: 200,
      body: { ok: true, cardId, columnId, etapaDesde: now },
    }
  })
}

export async function tryHandleBoardCardPatch(req, res, body, session, corsHeaders, ctx) {
  if (req.method !== 'POST' && req.method !== 'PUT') return false
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return false
  }
  if (payload?.action === 'vestfirma-card-move') {
    try {
      const result = await applyBoardCardMove(payload, session, ctx)
      json(res, corsHeaders, result.status, result.body)
    } catch (err) {
      console.error('[vestfirma] mover pedido:', err)
      json(res, corsHeaders, 500, { error: 'Não foi possível mudar a etapa. Tente de novo.' })
    }
    return true
  }
  if (!payload || payload.action !== 'vestfirma-card-patch') return false

  try {
    const result = await applyBoardCardPatch(payload, session, ctx)
    json(res, corsHeaders, result.status, result.body)
  } catch (err) {
    console.error('[vestfirma] patch do pedido:', err)
    json(res, corsHeaders, 500, { error: 'Não foi possível gravar no pedido. Tente de novo.' })
  }
  return true
}
