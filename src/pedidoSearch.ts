import { resolveCardColumnId } from './boardColumns'
import { tituloColuna } from './historicoEtapa'
import { pedidoVisivelNoKanban } from './pedidosPolicy'
import type { BoardState, OrderCard } from './types'
import { nomeSegmento } from './types'

export function normalizePedidoSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '')
}

function haystackFor(card: OrderCard, board: BoardState): string {
  const segmento = nomeSegmento(board, card.segmentoId) ?? ''
  const whats = onlyDigits(card.whatsappCliente)
  return normalizePedidoSearchText(
    `${card.numeroPedido} ${card.cliente} ${segmento} ${whats}`,
  )
}

function scoreMatch(card: OrderCard, board: BoardState, queryNorm: string, tokens: string[]): number {
  const numero = normalizePedidoSearchText(card.numeroPedido)
  const cliente = normalizePedidoSearchText(card.cliente)
  const segmento = normalizePedidoSearchText(nomeSegmento(board, card.segmentoId) ?? '')
  const hay = haystackFor(card, board)

  if (!tokens.every((t) => hay.includes(t))) return -1

  let score = tokens.length * 10
  if (numero === queryNorm) score += 100
  else if (numero.includes(queryNorm)) score += 60
  if (cliente === queryNorm) score += 80
  else if (cliente.startsWith(queryNorm)) score += 40
  else if (cliente.includes(queryNorm)) score += 25
  if (segmento.includes(queryNorm)) score += 30
  if (onlyDigits(card.whatsappCliente).includes(onlyDigits(queryNorm)) && onlyDigits(queryNorm).length >= 4) {
    score += 35
  }
  return score
}

export type PedidoSearchResult = {
  card: OrderCard
  etapa: string
  segmento: string
  score: number
}

export function buscarPedidosNoQuadro(
  board: BoardState,
  query: string,
  limit = 20,
): PedidoSearchResult[] {
  const queryNorm = normalizePedidoSearchText(query)
  if (!queryNorm) return []

  const tokens = queryNorm.split(/\s+/).filter(Boolean)
  const out: PedidoSearchResult[] = []

  for (const card of board.cards) {
    if (!pedidoVisivelNoKanban(card)) continue
    const score = scoreMatch(card, board, queryNorm, tokens)
    if (score < 0) continue
    const columnId = resolveCardColumnId(board, card)
    out.push({
      card,
      etapa: tituloColuna(board, columnId),
      segmento: nomeSegmento(board, card.segmentoId) ?? '—',
      score,
    })
  }

  out.sort((a, b) => b.score - a.score || a.card.cliente.localeCompare(b.card.cliente, 'pt-BR'))
  return out.slice(0, limit)
}
