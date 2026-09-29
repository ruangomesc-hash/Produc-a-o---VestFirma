import { ensureBoardColumns, impedirRegressaoEtapaNoMerge } from './boardColumns'
import { mergeOrderCardFields } from './mergeOrderCard'
import type { BoardState, OrderCard } from './types'
import { mergeVendedoresUnion } from './vendedorUserSync'

export { pedidoRevisionMs, boardTemConteudoAlemDoServidor } from './mergeOrderCard'

/** Pedidos arquivados permanecem no JSON — só saem do kanban. */
export function pedidoVisivelNoKanban(card: OrderCard): boolean {
  return !card.arquivadoEm
}

function mergeOrderCard(
  existing: OrderCard,
  incoming: OrderCard,
  columns: BoardState['columns'],
): OrderCard {
  const merged = mergeOrderCardFields(existing, incoming)
  return impedirRegressaoEtapaNoMerge(existing, merged, columns)
}

function mergeBoardShell(
  existing: BoardState | null | undefined,
  incoming: BoardState,
): Pick<BoardState, 'columns' | 'vendedores' | 'segmentos'> {
  const mergedColumns = ensureBoardColumns(
    incoming.columns?.length ? incoming.columns : (existing?.columns ?? incoming.columns),
  )
  return {
    columns: mergedColumns,
    vendedores: mergeVendedoresUnion(existing?.vendedores ?? [], incoming.vendedores ?? []),
    segmentos: incoming.segmentos?.length ? incoming.segmentos : (existing?.segmentos ?? incoming.segmentos),
  }
}

/**
 * Regra máxima VestFirma: o servidor nunca perde pedidos por PUT parcial.
 * Une por id — existentes que não vieram no payload são mantidos.
 * Em conflito de etapa, vence a versão mais recente (histórico / etapaDesde).
 * Comentários, logos e observação são unidos — um usuário não apaga o que o outro gravou.
 */
export function mergeBoardPreservingPedidos(
  existing: BoardState | null | undefined,
  incoming: BoardState,
  removeCardIds: string[] = [],
): BoardState {
  const shell = mergeBoardShell(existing, incoming)
  const removeSet = new Set(removeCardIds.filter(Boolean))
  if (!existing?.cards?.length) {
    const cards = (incoming.cards ?? []).filter((c) => !c?.id || !removeSet.has(c.id))
    return { ...incoming, ...shell, cards }
  }

  const byId = new Map<string, OrderCard>()
  const legacy: OrderCard[] = []
  for (const c of existing.cards) {
    if (c?.id) {
      if (removeSet.has(c.id)) continue
      byId.set(c.id, c)
    } else legacy.push(c)
  }
  for (const c of incoming.cards ?? []) {
    if (!c?.id) continue
    if (removeSet.has(c.id)) {
      byId.delete(c.id)
      continue
    }
    const prev = byId.get(c.id)
    byId.set(c.id, prev ? mergeOrderCard(prev, c, shell.columns) : c)
  }

  return {
    ...incoming,
    ...shell,
    cards: [...legacy, ...Array.from(byId.values())],
  }
}

/**
 * Com sessão: ids de pedidos vêm do servidor. IDB/snapshot só atualizam pedidos que ainda existem no servidor.
 * Impede “ressuscitar” pedido apagado (ou só no navegador) ao dar F5.
 */
export function mergeBoardRemotePrimary(
  remote: BoardState,
  local: BoardState | null | undefined,
): BoardState {
  const shell = mergeBoardShell(remote, local ?? remote)
  const byId = new Map<string, OrderCard>()
  for (const c of remote.cards ?? []) {
    if (c?.id) byId.set(c.id, c)
  }
  for (const c of local?.cards ?? []) {
    if (!c?.id || !byId.has(c.id)) continue
    byId.set(c.id, mergeOrderCard(byId.get(c.id)!, c, shell.columns))
  }
  return { ...remote, ...shell, cards: [...byId.values()] }
}

/** Só inclui pedidos que faltam em `primary` — não sobrescreve dados atuais. */
export function mergeBoardAddingMissingPedidosOnly(
  primary: BoardState,
  secondary: BoardState | null | undefined,
): BoardState {
  if (!secondary?.cards?.length) return primary
  const byId = new Map(primary.cards.map((c) => [c.id, c]))
  let added = false
  for (const c of secondary.cards) {
    if (c?.id && !byId.has(c.id)) {
      byId.set(c.id, c)
      added = true
    }
  }
  if (!added) return primary
  return { ...primary, cards: [...byId.values()] }
}

export function boardTemPedidos(state: BoardState): boolean {
  return state.cards.length > 0
}

export function contagemPedidos(state: BoardState | null | undefined): number {
  return Array.isArray(state?.cards) ? state!.cards.length : 0
}

/** Une pedidos de várias fontes (servidor, IDB, snapshot) sem remover ids existentes. */
export function mergeBoardsMaxPedidos(
  ...boards: (BoardState | null | undefined)[]
): BoardState | null {
  const valid = boards.filter((b): b is BoardState => Boolean(b?.columns?.length))
  if (valid.length === 0) return null

  valid.sort((a, b) => contagemPedidos(b) - contagemPedidos(a))
  let acc: BoardState = {
    ...valid[0],
    cards: [...(valid[0].cards ?? [])],
    vendedores: [...(valid[0].vendedores ?? [])],
  }
  for (let i = 1; i < valid.length; i++) {
    acc = mergeBoardPreservingPedidos(acc, valid[i])
  }
  return acc
}
