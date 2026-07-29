import fs from 'node:fs/promises'
import path from 'node:path'

const LOGO_FIELDS = [
  ['logoEnviadaCliente', 'enviada'],
  ['logoProntaImpressao', 'impressao'],
]

function safeCardId(cardId) {
  const s = String(cardId || '')
  return /^[a-zA-Z0-9-]+$/.test(s) ? s : ''
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const buf = Buffer.from(match[2], 'base64')
  return { buf, ext, mime }
}

/** Grava logos embutidas em arquivos e troca por URLs da API (quadro leve para milhares de pedidos). */
export async function externalizeBoardLogos(board, logoDir, apiPrefix = '/api/logos') {
  if (!board?.cards?.length) return board
  await fs.mkdir(logoDir, { recursive: true })

  const cards = []
  for (const card of board.cards) {
    const next = { ...card }
    const id = safeCardId(card.id)
    if (!id) {
      cards.push(next)
      continue
    }
    for (const [field, slug] of LOGO_FIELDS) {
      const value = next[field]
      if (!isDataUrl(value)) continue
      const parsed = parseDataUrl(value)
      if (!parsed) continue
      const filename = `${id}-${slug}.${parsed.ext}`
      await fs.writeFile(path.join(logoDir, filename), parsed.buf)
      next[field] = `${apiPrefix}/${id}/${slug}`
    }
    cards.push(next)
  }

  return { ...board, cards }
}

export async function resolveLogoFile(logoDir, cardId, kind) {
  const id = safeCardId(cardId)
  if (!id || (kind !== 'enviada' && kind !== 'impressao')) return null
  for (const ext of ['jpg', 'png', 'webp']) {
    const full = path.join(logoDir, `${id}-${kind}.${ext}`)
    if (!full.startsWith(path.resolve(logoDir))) return null
    try {
      await fs.access(full)
      return { full, ext }
    } catch {
      /* try next */
    }
  }
  return null
}

export const logoMime = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
