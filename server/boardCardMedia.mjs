import { mergePedidoImagens, mergeObservacaoPedido, pedidoRevisionMs, mergeOrderCardFields } from '../shared/mergeOrderCard.mjs'
import { anexarHistoricoLogo } from '../shared/logoHistorico.mjs'

/**
 * Une logos/observação no pedido sem PUT do quadro inteiro.
 * Não remove pedidos.
 */
export async function handleBoardCardMediaApi(req, res, ctx) {
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
    if (!cardId) {
      json(400, { error: 'Informe o pedido.' })
      return
    }

    const DATA_FILE = boardFilePath()
    const result = await withBoardWriteLock(async () => {
      const existing = await readExistingBoard(DATA_FILE)
      const existingCount = countBoardCards(existing)
      const card = existing?.cards?.find((c) => c?.id === cardId)
      if (!card) return { status: 404, body: { error: 'Pedido não encontrado.' } }

      const listasLogo = {}
      for (const key of ['logoEnviadaCliente', 'logoProntaImpressao', 'previewAprovacaoCliente']) {
        if (Array.isArray(payload[key])) listasLogo[key] = mergePedidoImagens(payload[key], [])
      }
      const trocouLogo = Object.keys(listasLogo).length > 0
      const patched = anexarHistoricoLogo(
        card,
        mergeOrderCardFields(card, {
          ...card,
          ...listasLogo,
          ...(trocouLogo
            ? { midiaAtualizadaEm: payload.midiaAtualizadaEm || new Date().toISOString() }
            : {}),
          observacao:
            payload.observacao !== undefined
              ? mergeObservacaoPedido(card.observacao, payload.observacao, pedidoRevisionMs(card), Date.now())
              : card.observacao,
        }),
        {
          autorNome: session?.user || '',
          autorEmail: session?.email || '',
          autorRole: session?.role || '',
        },
      )

      const incomingBoard = {
        ...existing,
        cards: existing.cards.map((c) => (c.id === cardId ? patched : c)),
      }
      const board = mergeBoardPreservingPedidos(existing, incomingBoard)
      if (existingCount > 0 && countBoardCards(board) < existingCount) {
        const { boardPreservouPedidos } = await import('./dataProtection.mjs')
        if (!boardPreservouPedidos(existing, board)) {
          return { status: 409, body: { error: 'Recusado: este save removeria pedidos já gravados.' } }
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
          logoEnviadaCliente: saved?.logoEnviadaCliente ?? patched.logoEnviadaCliente,
          logoProntaImpressao: saved?.logoProntaImpressao ?? patched.logoProntaImpressao,
          previewAprovacaoCliente: saved?.previewAprovacaoCliente ?? patched.previewAprovacaoCliente,
          observacao: saved?.observacao ?? patched.observacao,
          midiaAtualizadaEm: saved?.midiaAtualizadaEm ?? patched.midiaAtualizadaEm,
          historicoEtapa: saved?.historicoEtapa ?? patched.historicoEtapa ?? [],
        },
      }
    })
    json(result.status, result.body)
  } catch (err) {
    console.error('[vestfirma] mídia do pedido:', err)
    json(500, { error: 'Não foi possível gravar as imagens. Tente de novo.' })
  }
}
