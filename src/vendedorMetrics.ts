import type { BoardState } from './types'
import { nomeVendedor } from './types'
import type { ManagedUser } from './userRoles'
import { pedidoVisivelNoKanban } from './pedidosPolicy'

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

function canonicalVendedorKey(board: BoardState, vendedorId: string | null): string {
  if (!vendedorId) return '__sem__'
  const row = board.vendedores.find((v) => v.id === vendedorId)
  if (!row) return `orphan:${vendedorId}`
  const em = row.email?.trim().toLowerCase()
  if (em) return `em:${em}`
  if (row.userId && row.userId !== 'admin-seed') return `uid:${row.userId}`
  return `id:${row.id}`
}

function nomeParaChave(board: BoardState, key: string, sampleVendedorId: string | null): string {
  if (key === '__sem__') return 'Sem vendedor'
  for (const v of board.vendedores) {
    if (canonicalVendedorKey(board, v.id) === key) return v.nome
  }
  if (sampleVendedorId) {
    return nomeVendedor(board, sampleVendedorId) ?? 'Vendedor (legado)'
  }
  return 'Vendedor'
}

function vendedorIdPreferido(board: BoardState, key: string): string | null {
  if (key === '__sem__') return null
  let chosen: string | null = null
  let best = -1
  for (const v of board.vendedores) {
    if (canonicalVendedorKey(board, v.id) !== key) continue
    const n = board.cards.filter((c) => c.vendedorId === v.id && pedidoVisivelNoKanban(c)).length
    if (n > best) {
      best = n
      chosen = v.id
    }
  }
  if (chosen) return chosen
  if (key.startsWith('orphan:')) return key.slice('orphan:'.length) || null
  return null
}

/** Agrega pedidos ativos no kanban (sem arquivados), unindo ids duplicados do mesmo vendedor. */
export function agregarPorVendedor(
  board: BoardState,
  opts?: { managedVendedores?: ManagedUser[] },
): {
  linhas: VendedorResumo[]
  totais: TotaisVendedores
} {
  const cardsAtivos = board.cards.filter(pedidoVisivelNoKanban)
  const porChave = new Map<string, { pedidos: number; pecas: number; sampleId: string | null }>()

  for (const card of cardsAtivos) {
    const key = canonicalVendedorKey(board, card.vendedorId)
    const cur = porChave.get(key) ?? { pedidos: 0, pecas: 0, sampleId: card.vendedorId }
    cur.pedidos += 1
    cur.pecas += card.quantidade
    if (!cur.sampleId && card.vendedorId) cur.sampleId = card.vendedorId
    porChave.set(key, cur)
  }

  const linhas: VendedorResumo[] = []
  const chavesVistas = new Set<string>()

  for (const v of board.vendedores) {
    if (v.userId === 'admin-seed' || v.managedRole === 'admin') continue
    const key = canonicalVendedorKey(board, v.id)
    if (chavesVistas.has(key)) continue
    chavesVistas.add(key)
    const stats = porChave.get(key) ?? { pedidos: 0, pecas: 0, sampleId: v.id }
    porChave.delete(key)
    linhas.push({
      vendedorId: vendedorIdPreferido(board, key) ?? v.id,
      nome: v.nome,
      pedidos: stats.pedidos,
      pecas: stats.pecas,
      whatsapp: v.whatsapp,
      grupoWhatsapp: v.grupoWhatsapp,
    })
  }

  for (const user of opts?.managedVendedores ?? []) {
    if (user.role !== 'vendedor') continue
    const em = user.email.trim().toLowerCase()
    const key = `em:${em}`
    if (chavesVistas.has(key)) continue
    chavesVistas.add(key)
    const stats = porChave.get(key) ?? { pedidos: 0, pecas: 0, sampleId: null }
    porChave.delete(key)
    const row = board.vendedores.find(
      (v) => v.email?.trim().toLowerCase() === em || v.userId === user.id,
    )
    linhas.push({
      vendedorId: row?.id ?? vendedorIdPreferido(board, key),
      nome: user.name?.trim() || user.email,
      pedidos: stats.pedidos,
      pecas: stats.pecas,
      whatsapp: row?.whatsapp,
      grupoWhatsapp: row?.grupoWhatsapp,
    })
  }

  for (const [key, stats] of porChave) {
    linhas.push({
      vendedorId: vendedorIdPreferido(board, key) ?? stats.sampleId,
      nome: nomeParaChave(board, key, stats.sampleId),
      pedidos: stats.pedidos,
      pecas: stats.pecas,
    })
  }

  const totais: TotaisVendedores = {
    pedidos: cardsAtivos.length,
    pecas: cardsAtivos.reduce((s, c) => s + c.quantidade, 0),
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
