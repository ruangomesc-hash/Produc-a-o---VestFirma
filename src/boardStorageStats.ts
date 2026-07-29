import { normalizeBoard } from './storage'
import type { BoardState, OrderCard } from './types'

/** Limite típico de body em funções Vercel (Hobby) — referência visual. */
export const VERCEL_SAVE_LIMIT_BYTES = 4.5 * 1024 * 1024

export type CardStorageRow = {
  id: string
  cliente: string
  numeroPedido: string
  totalBytes: number
  logoBytes: number
}

export type BoardStorageStats = {
  totalBytes: number
  cardCount: number
  logoBytes: number
  logoFileCount: number
  pedidosMetaBytes: number
  structureBytes: number
  topCards: CardStorageRow[]
  vercelLimitBytes: number
}

function utf8ByteLength(text: string): number {
  return new Blob([text]).size
}

function logoBytesOnCard(card: OrderCard): { bytes: number; count: number } {
  let bytes = 0
  let count = 0
  for (const field of [card.logoEnviadaCliente, card.logoProntaImpressao] as const) {
    if (field && field.length > 0) {
      if (field.startsWith('/api/logos/')) {
        bytes += 48
      } else {
        bytes += utf8ByteLength(field)
      }
      count += 1
    }
  }
  return { bytes, count }
}

function cardMetaJson(card: OrderCard): string {
  const { logoEnviadaCliente: _a, logoProntaImpressao: _b, ...rest } = card
  return JSON.stringify(rest)
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function storageUsageLevel(
  totalBytes: number,
  limitBytes: number,
): 'ok' | 'warn' | 'error' {
  const ratio = totalBytes / limitBytes
  if (ratio >= 0.9) return 'error'
  if (ratio >= 0.65) return 'warn'
  return 'ok'
}

export function measureBoardStorage(board: BoardState): BoardStorageStats {
  const normalized = normalizeBoard(board)
  const totalJson = JSON.stringify(normalized)
  const totalBytes = utf8ByteLength(totalJson)

  let logoBytes = 0
  let logoFileCount = 0
  let pedidosMetaBytes = 0
  const topCards: CardStorageRow[] = []

  for (const card of normalized.cards) {
    const logos = logoBytesOnCard(card)
    logoBytes += logos.bytes
    logoFileCount += logos.count
    const meta = utf8ByteLength(cardMetaJson(card))
    pedidosMetaBytes += meta
    topCards.push({
      id: card.id,
      cliente: card.cliente,
      numeroPedido: card.numeroPedido,
      totalBytes: meta + logos.bytes,
      logoBytes: logos.bytes,
    })
  }

  topCards.sort((a, b) => b.totalBytes - a.totalBytes)

  const structureJson = JSON.stringify({
    columns: normalized.columns,
    vendedores: normalized.vendedores,
    segmentos: normalized.segmentos ?? [],
  })
  const structureBytes = utf8ByteLength(structureJson)

  return {
    totalBytes,
    cardCount: normalized.cards.length,
    logoBytes,
    logoFileCount,
    pedidosMetaBytes,
    structureBytes,
    topCards: topCards.slice(0, 8),
    vercelLimitBytes: VERCEL_SAVE_LIMIT_BYTES,
  }
}

export function storagePercent(totalBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 0
  return Math.min(100, Math.round((totalBytes / limitBytes) * 1000) / 10)
}
