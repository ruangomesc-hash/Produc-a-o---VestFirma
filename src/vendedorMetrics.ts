import type { BoardState } from './types'
import { nomeVendedor } from './types'

export type VendedorResumo = {
  vendedorId: string | null
  nome: string
  pedidos: number
  pecas: number
  whatsapp?: string
  grupoWhatsapp?: string
}

export type TotaisVendedores = {
  pedidos: number
  pecas: number
  vendedoresComPedido: number
}

export function agregarPorVendedor(board: BoardState): {
  linhas: VendedorResumo[]
  totais: TotaisVendedores
} {
  const porId = new Map<string, { pedidos: number; pecas: number }>()

  for (const card of board.cards) {
    const key = card.vendedorId ?? '__sem__'
    const cur = porId.get(key) ?? { pedidos: 0, pecas: 0 }
    cur.pedidos += 1
    cur.pecas += card.quantidade
    porId.set(key, cur)
  }

  const linhas: VendedorResumo[] = []

  for (const v of board.vendedores) {
    const stats = porId.get(v.id) ?? { pedidos: 0, pecas: 0 }
    porId.delete(v.id)
    linhas.push({
      vendedorId: v.id,
      nome: v.nome,
      pedidos: stats.pedidos,
      pecas: stats.pecas,
      whatsapp: v.whatsapp,
      grupoWhatsapp: v.grupoWhatsapp,
    })
  }

  for (const [key, stats] of porId) {
    if (key === '__sem__') {
      linhas.push({
        vendedorId: null,
        nome: 'Sem vendedor',
        pedidos: stats.pedidos,
        pecas: stats.pecas,
      })
    } else {
      linhas.push({
        vendedorId: key,
        nome: nomeVendedor(board, key) ?? 'Vendedor removido',
        pedidos: stats.pedidos,
        pecas: stats.pecas,
      })
    }
  }

  const totais: TotaisVendedores = {
    pedidos: board.cards.length,
    pecas: board.cards.reduce((s, c) => s + c.quantidade, 0),
    vendedoresComPedido: linhas.filter((l) => l.pedidos > 0 && l.vendedorId).length,
  }

  return { linhas, totais }
}

export function rankingPorPedidos(linhas: VendedorResumo[]): VendedorResumo[] {
  return [...linhas].sort(
    (a, b) => b.pedidos - a.pedidos || b.pecas - a.pecas || a.nome.localeCompare(b.nome),
  )
}

export function rankingPorPecas(linhas: VendedorResumo[]): VendedorResumo[] {
  return [...linhas].sort(
    (a, b) => b.pecas - a.pecas || b.pedidos - a.pedidos || a.nome.localeCompare(b.nome),
  )
}
