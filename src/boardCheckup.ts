import { contagemPedidos, pedidoVisivelNoKanban } from './pedidosPolicy'
import { nomeVendedor } from './types'
import type { BoardState } from './types'

export type BoardCheckupLine = {
  vendedorId: string | null
  nome: string
  pedidosAtivos: number
  pedidosArquivados: number
  orphanVendedorId: boolean
  semVendedorId: number
}

export type BoardCheckupReport = {
  total: number
  ativos: number
  arquivados: number
  semVendedorId: number
  orphanVendedorId: number
  linhas: BoardCheckupLine[]
  avisos: string[]
}

function knownVendedorIds(board: BoardState): Set<string> {
  return new Set(board.vendedores.map((v) => v.id))
}

/** Diagnóstico do quadro em memória — admin (não altera dados). */
export function analyzeBoardCheckup(board: BoardState): BoardCheckupReport {
  const known = knownVendedorIds(board)
  const avisos: string[] = []
  const semVendedorId = board.cards.filter((c) => !c.vendedorId).length
  const orphanCards = board.cards.filter((c) => c.vendedorId && !known.has(c.vendedorId))
  const orphanVendedorId = orphanCards.length

  if (orphanVendedorId > 0) {
    avisos.push(
      `${orphanVendedorId} pedido(s) com vendedorId que não existe mais no quadro — o admin vê no kanban; o vendedor pode não ver até reatribuir o vendedor no pedido.`,
    )
  }
  if (semVendedorId > 0) {
    avisos.push(
      `${semVendedorId} pedido(s) sem vendedor atribuído — visíveis para admin/gerente; vendedor logado não enxerga.`,
    )
  }

  const arquivados = board.cards.filter((c) => c.arquivadoEm).length
  const ativos = board.cards.filter(pedidoVisivelNoKanban).length
  if (arquivados > 0) {
    avisos.push(
      `${arquivados} pedido(s) arquivados (ocultos do kanban). Restaure em Status → Pedidos arquivados ou apague só se foi você quem arquivou.`,
    )
  }

  const byKey = new Map<string, BoardCheckupLine>()

  for (const card of board.cards) {
    const orphan = Boolean(card.vendedorId && !known.has(card.vendedorId))
    const key = orphan
      ? `orphan:${card.vendedorId}`
      : card.vendedorId ?? '__sem__'
    const nome = orphan
      ? `Id órfão (${card.vendedorId!.slice(0, 8)}…)`
      : card.vendedorId
        ? (nomeVendedor(board, card.vendedorId) ?? 'Vendedor')
        : 'Sem vendedor'
    const line =
      byKey.get(key) ??
      ({
        vendedorId: card.vendedorId,
        nome,
        pedidosAtivos: 0,
        pedidosArquivados: 0,
        orphanVendedorId: orphan,
        semVendedorId: 0,
      } satisfies BoardCheckupLine)
    if (!card.vendedorId) line.semVendedorId += 1
    if (card.arquivadoEm) line.pedidosArquivados += 1
    else line.pedidosAtivos += 1
    byKey.set(key, line)
  }

  const linhas = [...byKey.values()].sort(
    (a, b) =>
      b.pedidosAtivos + b.pedidosArquivados - (a.pedidosAtivos + a.pedidosArquivados) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )

  return {
    total: contagemPedidos(board),
    ativos,
    arquivados,
    semVendedorId,
    orphanVendedorId,
    linhas,
    avisos,
  }
}

export type RemoteLocalCompare = {
  localTotal: number
  remoteTotal: number | null
  remoteError?: string
  snapshotTotal: number
  diff: number | null
  hint: string
}
