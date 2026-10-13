import type { BoardState, OrderCard } from './types'
import { dedupeBoardCards } from './dedupeBoardCards'
import { contagemPedidos, mergeBoardAddingMissingPedidosOnly } from './pedidosPolicy'
import { loadPedidosExcluidosIds } from './pedidosExcluidosLocal'

function midiaMs(card: { midiaAtualizadaEm?: string | null } | null | undefined): number {
  const t = Date.parse(card?.midiaAtualizadaEm || '')
  return Number.isNaN(t) ? 0 : t
}

/** A logo gravada no servidor vale para todo mundo quando ela é a mais nova. */
function logosDoQuadroGravado(local: OrderCard, gravado: OrderCard): Partial<OrderCard> {
  const servidor = midiaMs(gravado)
  const copia = midiaMs(local)
  if (!gravado.midiaAtualizadaEm && !local.midiaAtualizadaEm) return {}
  if (copia > servidor) return {}
  return {
    logoEnviadaCliente: gravado.logoEnviadaCliente,
    logoProntaImpressao: gravado.logoProntaImpressao,
    previewAprovacaoCliente: gravado.previewAprovacaoCliente,
    midiaAtualizadaEm: gravado.midiaAtualizadaEm,
  }
}

/**
 * Servidor manda na coluna, no arquivamento e na lista de pedidos.
 * Cópia local não troca a etapa de um pedido que já está no servidor.
 * Pedido que só existe neste navegador entra para ser enviado.
 */
export function mergeBoardLoggedInFromServer(
  remote: BoardState,
  local: BoardState | null | undefined,
): BoardState {
  const excluded = loadPedidosExcluidosIds()
  const remoteIds = new Set((remote.cards ?? []).map((c) => c.id).filter(Boolean))
  const extrasOnly = local?.cards?.length
    ? {
        ...local,
        cards: local.cards.filter((c) => c?.id && !remoteIds.has(c.id) && !excluded.has(c.id)),
      }
    : null
  const withExtras = extrasOnly
    ? mergeBoardAddingMissingPedidosOnly(remote, extrasOnly)
    : remote
  const deduped = dedupeBoardCards(withExtras)
  const colunas = new Map(
    (remote.cards ?? [])
      .filter((c) => c?.id)
      .map((c) => [c.id, c]),
  )
  return {
    ...deduped,
    cards: deduped.cards.map((c) => {
      const gravado = colunas.get(c.id)
      if (!gravado) return c
      return {
        ...c,
        columnId: gravado.columnId,
        etapaDesde: gravado.etapaDesde,
        historicoEtapa: gravado.historicoEtapa,
        arquivadoEm: gravado.arquivadoEm ?? null,
        ...logosDoQuadroGravado(c, gravado),
      }
    }),
  }
}

export function boardTemPedidosAlemDoServidor(board: BoardState, remote: BoardState): boolean {
  return contagemPedidos(board) > contagemPedidos(remote)
}
