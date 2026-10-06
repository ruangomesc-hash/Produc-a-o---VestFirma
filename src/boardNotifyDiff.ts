import type { BoardState, OrderCard } from './types.ts'

export type BoardNotifyItem = {
  tag: string
  title: string
  body: string
}

function tituloColuna(board: BoardState, columnId: string): string {
  return board.columns.find((c) => c.id === columnId)?.title ?? columnId
}

function visivelNoKanban(card: OrderCard): boolean {
  return !card.arquivadoEm
}

function pedidoVeioDaShopify(card: OrderCard): boolean {
  if (card.origem === 'shopify') return true
  return Boolean(String(card.shopifyOrderId || '').trim())
}

/** Pedidos Shopify que acabaram de entrar no quadro (não dispara na primeira carga). */
export function contarNovosPedidosShopify(
  prev: BoardState | null | undefined,
  next: BoardState,
): number {
  if (!prev?.cards) return 0
  const before = cardById(prev)
  let n = 0
  for (const card of next.cards ?? []) {
    if (!card?.id || before.has(card.id)) continue
    if (!visivelNoKanban(card) || !pedidoVeioDaShopify(card)) continue
    n += 1
  }
  return n
}

function rotuloPedido(card: OrderCard): string {
  const n = card.numeroPedido?.trim()
  const nome = card.cliente?.trim()
  if (n && nome) return `Pedido ${n} · ${nome}`
  if (n) return `Pedido ${n}`
  if (nome) return nome
  return 'Pedido'
}

function cardById(board: BoardState): Map<string, OrderCard> {
  const map = new Map<string, OrderCard>()
  for (const card of board.cards ?? []) {
    if (card?.id) map.set(card.id, card)
  }
  return map
}

/**
 * Compara o quadro anterior com o atual: pedido novo, mudança de etapa ou arquivamento.
 * Primeira carga (prev nulo) não gera aviso.
 */
export function diffBoardAlerts(
  prev: BoardState | null | undefined,
  next: BoardState,
): BoardNotifyItem[] {
  if (!prev?.cards?.length) return []
  const before = cardById(prev)
  const items: BoardNotifyItem[] = []

  for (const card of next.cards ?? []) {
    if (!card?.id) continue
    const old = before.get(card.id)
    if (!old) {
      if (!visivelNoKanban(card)) continue
      items.push({
        tag: `novo-${card.id}`,
        title: 'Novo pedido',
        body: rotuloPedido(card),
      })
      continue
    }

    const eraVisivel = visivelNoKanban(old)
    const eVisivel = visivelNoKanban(card)
    if (eraVisivel && !eVisivel) {
      items.push({
        tag: `arq-${card.id}`,
        title: 'Pedido arquivado',
        body: rotuloPedido(card),
      })
      continue
    }
    if (!eraVisivel && eVisivel) {
      items.push({
        tag: `rest-${card.id}`,
        title: 'Pedido restaurado',
        body: `${rotuloPedido(card)} voltou ao kanban`,
      })
      continue
    }
    if (old.columnId !== card.columnId) {
      const de = tituloColuna(prev, old.columnId)
      const para = tituloColuna(next, card.columnId)
      items.push({
        tag: `mov-${card.id}-${card.columnId}`,
        title: 'Pedido mudou de etapa',
        body: `${rotuloPedido(card)}: ${de} → ${para}`,
      })
    }
  }

  if (items.length <= 4) return items
  const novos = items.filter((i) => i.tag.startsWith('novo-')).length
  const movs = items.filter((i) => i.tag.startsWith('mov-')).length
  const outros = items.length - novos - movs
  const partes: string[] = []
  if (novos) partes.push(`${novos} novo(s)`)
  if (movs) partes.push(`${movs} movimento(s)`)
  if (outros) partes.push(`${outros} status`)
  return [
    {
      tag: 'resumo-quadro',
      title: 'Atualização no kanban',
      body: partes.join(' · '),
    },
  ]
}
