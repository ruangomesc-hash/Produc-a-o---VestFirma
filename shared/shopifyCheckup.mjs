import { encontrarCardParaPedidoShopify, mapShopifyOrderToCard } from './shopifyOrderMap.mjs'

export function resumoPedidoShopify(order) {
  const mapped = mapShopifyOrderToCard(order)
  return {
    shopifyOrderId: String(order?.id || mapped.shopifyOrderId || ''),
    numeroPedido: mapped.numeroPedido,
    cliente: mapped.cliente,
    dataPedido: mapped.dataPedido,
    dataPagamento: mapped.dataPagamento || '',
    createdAt: mapped.createdAt,
    quantidade: mapped.quantidade,
    cancelado: Boolean(order?.cancelled_at),
    financialStatus: String(order?.financial_status || ''),
  }
}

/** Pedidos da Shopify que ainda não têm card no kanban (nem pelo ID nem pelo número). */
export function classificarPedidosShopifyNoKanban(board, orders) {
  const list = Array.isArray(orders) ? orders : []
  const cards = board?.cards ?? []
  const noKanban = []
  const noKanbanJa = []
  for (const order of list) {
    if (!order?.id) continue
    const resumo = resumoPedidoShopify(order)
    const found = encontrarCardParaPedidoShopify(cards, order)
    if (found) noKanbanJa.push({ ...resumo, cardId: found.id, columnId: found.columnId })
    else noKanban.push(resumo)
  }
  return {
    shopifyTotal: list.filter((o) => o?.id).length,
    kanbanTotal: Array.isArray(cards) ? cards.length : 0,
    noKanban,
    jaNoKanban: noKanbanJa.length,
  }
}
