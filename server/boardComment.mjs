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
  } = ctx

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
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
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'JSON inválido' }))
    return
  }

  const cardId = typeof payload?.cardId === 'string' ? payload.cardId.trim() : ''
  const incoming = payload?.comentario && typeof payload.comentario === 'object' ? payload.comentario : null
  const texto = typeof incoming?.texto === 'string' ? incoming.texto.trim() : ''
  if (!cardId || !texto || texto.length > 4000) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Informe o pedido e o texto do comentário.' }))
    return
  }

  const DATA_FILE = boardFilePath()
  const existing = await readExistingBoard(DATA_FILE)
  const existingCount = countBoardCards(existing)
  const card = existing?.cards?.find((c) => c?.id === cardId)
  if (!card) {
    res.writeHead(404, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Pedido não encontrado.' }))
    return
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
  const comentarios = [...byId.values()].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')))

  const incomingBoard = {
    ...existing,
    cards: existing.cards.map((c) => (c.id === cardId ? { ...c, comentarios } : c)),
  }
  const board = mergeBoardPreservingPedidos(existing, incomingBoard)
  const mergedCount = countBoardCards(board)
  if (existingCount > 0 && mergedCount < existingCount) {
    res.writeHead(409, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Recusado: este save removeria pedidos já gravados.' }))
    return
  }

  await backupBoardBeforeWrite(DATA_FILE)
  const out = JSON.stringify(board)
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  await fs.writeFile(tmp, out, 'utf8')
  await fs.rename(tmp, DATA_FILE)

  const saved = board.cards.find((c) => c.id === cardId)

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      ok: true,
      cardId,
      comentarios: saved?.comentarios ?? comentarios,
    }),
  )
}
