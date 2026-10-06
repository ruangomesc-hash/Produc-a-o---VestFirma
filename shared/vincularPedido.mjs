export function normalizeNumeroPedido(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  return digits || raw.toLowerCase()
}

export function shopifyOrderIdOf(card) {
  const sid = card?.shopifyOrderId ? String(card.shopifyOrderId).trim() : ''
  if (sid) return sid
  const id = String(card?.id || '')
  if (id.startsWith('shopify-')) return id.slice('shopify-'.length)
  return ''
}

function normalizeNomeCliente(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function clientesParecidosParaVinculo(a, b) {
  const na = normalizeNomeCliente(a)
  const nb = normalizeNomeCliente(b)
  if (!na || !nb) return true
  if (na === 'cliente shopify' || nb === 'cliente shopify') return true
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const ta = na.split(' ').filter((t) => t.length > 1)
  const tb = nb.split(' ').filter((t) => t.length > 1)
  const overlap = ta.filter((t) => tb.includes(t))
  return overlap.length >= 2 || (overlap.length >= 1 && ta[0] === tb[0])
}

/** Liga o card da loja ao que já está no kanban; não junta dois pedidos Shopify diferentes. */
export function podemVincularPedidos(a, b) {
  if (!a || !b) return false
  const sa = shopifyOrderIdOf(a)
  const sb = shopifyOrderIdOf(b)
  if (sa && sb) return sa === sb
  const na = normalizeNumeroPedido(a.numeroPedido)
  const nb = normalizeNumeroPedido(b.numeroPedido)
  if (!na || na !== nb) return false
  if (sa || sb) return true
  return clientesParecidosParaVinculo(a.cliente, b.cliente)
}

/** Mantém o id do card que já estava no quadro (não o recém-criado shopify-…). */
export function pickLinkedCardId(a, b) {
  const aid = String(a?.id || '')
  const bid = String(b?.id || '')
  const aShop = aid.startsWith('shopify-')
  const bShop = bid.startsWith('shopify-')
  if (aShop && !bShop) return bid
  if (bShop && !aShop) return aid
  return aid || bid
}
