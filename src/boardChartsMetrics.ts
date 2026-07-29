import type { BoardState } from './types'
import { nomeSegmento } from './types'
import type { VendedorResumo } from './vendedorMetrics'

export type FatiaGrafico = {
  id: string
  label: string
  value: number
}

export function fatiasVendedorPedidos(linhas: VendedorResumo[]): FatiaGrafico[] {
  return linhas
    .filter((l) => l.pedidos > 0)
    .map((l) => ({
      id: l.vendedorId ?? 'sem',
      label: l.nome,
      value: l.pedidos,
    }))
}

export function fatiasVendedorPecas(linhas: VendedorResumo[]): FatiaGrafico[] {
  return linhas
    .filter((l) => l.pecas > 0)
    .map((l) => ({
      id: l.vendedorId ?? 'sem',
      label: l.nome,
      value: l.pecas,
    }))
}

export function topSegmentosPorPedido(board: BoardState, limit = 8) {
  const map = new Map<string, number>()
  for (const card of board.cards) {
    const nome = nomeSegmento(board, card.segmentoId) ?? 'Sem segmento'
    map.set(nome, (map.get(nome) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([nome, pedidos]) => ({ nome, pedidos }))
    .sort((a, b) => b.pedidos - a.pedidos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limit)
}
