import fs from 'node:fs/promises'
import path from 'node:path'
import { storeOriginalImage } from './imageUploads.mjs'

const LOGO_FIELDS = [
  ['logoEnviadaCliente', 'enviada'],
  ['logoProntaImpressao', 'impressao'],
  ['previewAprovacaoCliente', 'aprovacao'],
]

function safeCardId(cardId) {
  const s = String(cardId || '')
  return /^[a-zA-Z0-9-]+$/.test(s) ? s : ''
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function normalizeImageField(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.length > 0)
  if (typeof value === 'string' && value) return [value]
  return []
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const buf = Buffer.from(match[2], 'base64')
  return { buf }
}

/** Grava logos embutidas em arquivos e troca por URLs da API (quadro leve para milhares de pedidos). */
export async function externalizeBoardLogos(board, logoDir) {
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
    for (const [field] of LOGO_FIELDS) {
      const urls = normalizeImageField(next[field])
      if (urls.length === 0) {
        next[field] = []
        continue
      }
      const externalized = []
      for (const value of urls) {
        if (!isDataUrl(value)) {
          externalized.push(value)
          continue
        }
        const parsed = parseDataUrl(value)
        if (!parsed) {
          externalized.push(value)
          continue
        }
        const stored = await storeOriginalImage(parsed.buf, logoDir)
        externalized.push(stored.url)
      }
      next[field] = externalized
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
