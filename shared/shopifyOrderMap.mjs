import {
  clientesParecidosParaVinculo,
  normalizeNumeroPedido,
  shopifyOrderIdOf,
} from './vincularPedido.mjs'

/** Coluna inicial de pedidos da Shopify (antes de Logos recebidas). */
export const COLUNA_PEDIDO_FEITO_ID = 'pedido-feito'
export const COLUNA_PEDIDO_FEITO_TITLE = 'Pedido feito'
export const SHOPIFY_ETAPA_TAG_PREFIX = 'vestfirma-etapa:'

export function cardIdShopify(orderId) {
  return `shopify-${String(orderId)}`
}

/** Card já no kanban para esta ordem — por ID Shopify ou pelo número do pedido. */
export function encontrarCardParaPedidoShopify(cards, order) {
  const list = Array.isArray(cards) ? cards : []
  const oid = String(order?.id || '')
  if (!oid) return null
  const mappedId = cardIdShopify(oid)
  const bySid = list.find((c) => c && (c.id === mappedId || String(c.shopifyOrderId || '') === oid))
  if (bySid) return bySid
  const numero = normalizeNumeroPedido(order?.order_number || order?.name || '')
  if (!numero) return null
  const nome = nomeCliente(order)
  const candidates = list.filter((c) => {
    if (!c) return false
    if (normalizeNumeroPedido(c.numeroPedido) !== numero) return false
    const sid = shopifyOrderIdOf(c)
    if (sid && sid !== oid) return false
    return true
  })
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  const named = candidates.filter((c) => clientesParecidosParaVinculo(c.cliente, nome))
  const pool = named.length ? named : candidates
  pool.sort((a, b) => {
    const arq = Number(Boolean(a.arquivadoEm)) - Number(Boolean(b.arquivadoEm))
    if (arq) return arq
    return (b.historicoEtapa?.length || 0) - (a.historicoEtapa?.length || 0)
  })
  return pool[0]
}

export function parseEtapaTag(tags) {
  const list = String(tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const found = list.find((t) => t.toLowerCase().startsWith(SHOPIFY_ETAPA_TAG_PREFIX))
  if (!found) return null
  return found.slice(SHOPIFY_ETAPA_TAG_PREFIX.length).trim() || null
}

export function mergeShopifyEtapaTags(existingTags, columnId) {
  const list = String(existingTags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !t.toLowerCase().startsWith(SHOPIFY_ETAPA_TAG_PREFIX))
  if (columnId) list.push(`${SHOPIFY_ETAPA_TAG_PREFIX}${columnId}`)
  return list.join(', ')
}

function telefoneDe(order) {
  const raw =
    order?.shipping_address?.phone ||
    order?.billing_address?.phone ||
    order?.customer?.phone ||
    order?.phone ||
    ''
  return String(raw).replace(/\D/g, '')
}

function nomeCliente(order) {
  const ship = order?.shipping_address
  const cust = order?.customer
  const nome = [ship?.first_name, ship?.last_name].filter(Boolean).join(' ').trim()
  if (nome) return nome
  const cn = [cust?.first_name, cust?.last_name].filter(Boolean).join(' ').trim()
  if (cn) return cn
  if (cust?.email) return String(cust.email)
  return 'Cliente Shopify'
}

function enderecoDe(order) {
  const a = order?.shipping_address || order?.billing_address
  if (!a) return ''
  return [a.address1, a.address2, a.city, a.province, a.zip, a.country]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ')
}

function dataIso(value) {
  if (!value) return ''
  const t = Date.parse(value)
  if (Number.isNaN(t)) return String(value).slice(0, 10)
  return new Date(t).toISOString()
}

/** Data que a loja mostra (Brasil), não o dia UTC. */
export function dataPedidoNaLoja(value, timeZone = 'America/Sao_Paulo') {
  if (!value) return ''
  const t = Date.parse(value)
  if (Number.isNaN(t)) return String(value).slice(0, 10)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(t))
  } catch {
    return new Date(t).toISOString().slice(0, 10)
  }
}

function quantidadeTotal(order) {
  const items = linhasPedidoDe(order)
  const n = items.reduce((sum, item) => sum + item.quantidade, 0)
  return Math.max(1, n)
}

export function linhasPedidoDe(order) {
  const items = Array.isArray(order?.line_items) ? order.line_items : []
  const out = []
  for (const item of items) {
    const quantidade = Math.max(0, Math.floor(Number(item?.quantity) || 0))
    const titulo = String(item?.name || item?.title || '').trim()
    if (!titulo || quantidade <= 0) continue
    const variante = String(item?.variant_title || '').trim()
    const detalhe =
      variante && variante.toLowerCase() !== titulo.toLowerCase() && !titulo.includes(variante)
        ? variante
        : ''
    out.push(detalhe ? { titulo, quantidade, detalhe } : { titulo, quantidade })
  }
  return out
}

function observacaoDe(order) {
  const linhas = []
  if (order?.note?.trim()) linhas.push(String(order.note).trim())
  if (order?.cancelled_at) linhas.push('Shopify: pedido cancelado na loja (mantido no kanban).')
  return linhas.join('\n')
}

function mesclarObservacaoShopify(existingObs, mappedObs) {
  const existing = String(existingObs || '')
    .replace(/(^|\n)Itens Shopify:.*$/s, '')
    .trim()
  const mapped = String(mappedObs || '').trim()
  if (!existing) return mapped
  if (!mapped) return existing
  if (existing.includes(mapped)) return existing
  if (mapped.includes(existing)) return mapped
  return existing
}

export function mapShopifyOrderToCard(order, columnId = COLUNA_PEDIDO_FEITO_ID) {
  const id = cardIdShopify(order.id)
  const now = new Date().toISOString()
  const created = dataIso(order.created_at) || now
  const paid =
    String(order.financial_status || '').toLowerCase() === 'paid' ? dataIso(order.processed_at || order.created_at) : ''
  const numero = String(order.order_number || order.name || order.id).replace(/^#/, '')
  const etapaTag = parseEtapaTag(order.tags)
  const col = etapaTag || columnId
  return {
    id,
    columnId: col,
    shopifyEtapaTag: etapaTag || undefined,
    cliente: nomeCliente(order),
    whatsappCliente: telefoneDe(order),
    vendedorId: null,
    segmentoId: null,
    quantidade: quantidadeTotal(order),
    numeroPedido: numero,
    canal: 'ecommerce',
    endereco: enderecoDe(order),
    observacao: observacaoDe(order),
    itensProduto: [],
    linhasPedido: linhasPedidoDe(order),
    dataPedido: dataPedidoNaLoja(order.created_at) || created.slice(0, 10),
    dataPagamento: paid ? dataPedidoNaLoja(order.processed_at || order.created_at) : '',
    logoEnviadaCliente: [],
    logoProntaImpressao: [],
    previewAprovacaoCliente: [],
    localLogo: null,
    etapaDesde: created,
    createdAt: created,
    historicoEtapa: [
      {
        id: `shopify-criado-${order.id}`,
        tipo: 'criado',
        columnId: COLUNA_PEDIDO_FEITO_ID,
        columnTitle: COLUNA_PEDIDO_FEITO_TITLE,
        at: created,
      },
    ],
    comentarios: [],
    arquivadoEm: null,
    origem: 'shopify',
    shopifyOrderId: String(order.id),
    shopifyOrderName: String(order.name || `#${numero}`),
  }
}

/**
 * Atualiza dados da loja sem apagar o pedido nem regredir etapa
 * (salvo se a Shopify mandar tag vestfirma-etapa diferente e mais recente).
 */
export function mesclarCardShopify(existing, mapped, shopifyUpdatedAt) {
  if (!existing) return mapped
  const tagCol = mapped.shopifyEtapaTag || null
  const keepCol = existing.columnId
  let columnId = keepCol
  const shopMs = Date.parse(shopifyUpdatedAt || '') || 0
  const localMs = Date.parse(existing.etapaDesde || existing.createdAt || '') || 0
  if (tagCol && tagCol !== keepCol && shopMs > localMs) {
    columnId = tagCol
  }
  const { shopifyEtapaTag: _tagHint, ...mappedSemHint } = mapped
  return {
    ...existing,
    ...mappedSemHint,
    id: existing.id,
    columnId,
    etapaDesde: columnId === keepCol ? existing.etapaDesde : mapped.etapaDesde,
    createdAt: existing.createdAt || mapped.createdAt,
    historicoEtapa: existing.historicoEtapa?.length ? existing.historicoEtapa : mapped.historicoEtapa,
    comentarios: existing.comentarios?.length ? existing.comentarios : mapped.comentarios,
    logoEnviadaCliente: existing.logoEnviadaCliente?.length
      ? existing.logoEnviadaCliente
      : mapped.logoEnviadaCliente,
    logoProntaImpressao: existing.logoProntaImpressao?.length
      ? existing.logoProntaImpressao
      : mapped.logoProntaImpressao,
    previewAprovacaoCliente: existing.previewAprovacaoCliente?.length
      ? existing.previewAprovacaoCliente
      : mapped.previewAprovacaoCliente,
    vendedorId: existing.vendedorId ?? mapped.vendedorId,
    segmentoId: existing.segmentoId ?? mapped.segmentoId,
    localLogo: existing.localLogo ?? mapped.localLogo,
    arquivadoEm: existing.arquivadoEm ?? null,
    origem: 'shopify',
    shopifyOrderId: mapped.shopifyOrderId || existing.shopifyOrderId,
    shopifyOrderName: mapped.shopifyOrderName || existing.shopifyOrderName,
    linhasPedido:
      Array.isArray(mapped.linhasPedido) && mapped.linhasPedido.length
        ? mapped.linhasPedido
        : existing.linhasPedido,
    observacao: mesclarObservacaoShopify(existing.observacao, mapped.observacao),
  }
}

export function pedidoFaltaLogo(card) {
  if (!card) return false
  if (card.columnId !== COLUNA_PEDIDO_FEITO_ID) return false
  return !Array.isArray(card.logoEnviadaCliente) || card.logoEnviadaCliente.length === 0
}
