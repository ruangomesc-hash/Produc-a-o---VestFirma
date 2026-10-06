import crypto from 'node:crypto'

/**
 * Grava um comentário no pedido sem substituir o quadro inteiro.
 * Não remove pedidos.
 */
export async function handleBoardCommentApi(req, res, ctx) {
  const {
    readBody,
    requireSession,
    corsHeaders,
    requireLogin,
    boardFilePath,
    backupBoardBeforeWrite,
    mergeBoardPreservingPedidos,
    readExistingBoard,
    countBoardCards,
    withBoardWriteLock,
    writeBoardAtomic,
  } = ctx

  const json = (status, body) => {
    if (res.headersSent) return
    res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }

    if (req.method !== 'POST') {
      json(405, { error: 'Method Not Allowed' })
      return
    }

    let session = null
    if (requireLogin) {
      session = await requireSession(req, res)
      if (!session) return
    }

    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch {
      json(400, { error: 'JSON inválido' })
      return
    }

    const cardId = typeof payload?.cardId === 'string' ? payload.cardId.trim() : ''
    const incoming = payload?.comentario && typeof payload.comentario === 'object' ? payload.comentario : null
    const texto = typeof incoming?.texto === 'string' ? incoming.texto.trim() : ''
    if (!cardId || !texto || texto.length > 4000) {
      json(400, { error: 'Informe o pedido e o texto do comentário.' })
      return
    }

    const DATA_FILE = boardFilePath()

    const result = await withBoardWriteLock(async () => {
      const existing = await readExistingBoard(DATA_FILE)
      const existingCount = countBoardCards(existing)
      const card = existing?.cards?.find((c) => c?.id === cardId)
      if (!card) {
        return { status: 404, body: { error: 'Pedido não encontrado.' } }
      }

      const entry = {
        id: typeof incoming.id === 'string' && incoming.id ? incoming.id : crypto.randomUUID(),
        texto,
        autorNome: session?.user || (typeof incoming.autorNome === 'string' ? incoming.autorNome : 'Equipe'),
        autorEmail: session?.email || (typeof incoming.autorEmail === 'string' ? incoming.autorEmail : ''),
        autorRole: session?.role || incoming.autorRole,
        at: typeof incoming.at === 'string' && incoming.at ? incoming.at : new Date().toISOString(),
      }

      const prevComments = Array.isArray(card.comentarios) ? card.comentarios : []
      const byId = new Map(prevComments.filter((c) => c?.id).map((c) => [c.id, c]))
      byId.set(entry.id, entry)
      const comentarios = [...byId.values()].sort((a, b) =>
        String(a.at ?? '').localeCompare(String(b.at ?? '')),
      )

      const incomingBoard = {
        ...existing,
        cards: existing.cards.map((c) => (c.id === cardId ? { ...c, comentarios } : c)),
      }
      const board = mergeBoardPreservingPedidos(existing, incomingBoard)
      const mergedCount = countBoardCards(board)
      if (existingCount > 0 && mergedCount < existingCount) {
        const { boardPreservouPedidos } = await import('./dataProtection.mjs')
        if (!boardPreservouPedidos(existing, board)) {
          return {
            status: 409,
            body: { error: 'Recusado: este save removeria pedidos já gravados.' },
          }
        }
      }

      await backupBoardBeforeWrite(DATA_FILE)
      await writeBoardAtomic(DATA_FILE, board)
      const saved = board.cards.find((c) => c.id === cardId)
      return {
        status: 200,
        body: {
          ok: true,
          cardId,
          comentarios: saved?.comentarios ?? comentarios,
        },
      }
    })

    json(result.status, result.body)
  } catch (err) {
    console.error('[vestfirma] comentário:', err)
    json(500, { error: 'Não foi possível gravar o comentário. Tente de novo.' })
  }
}
