import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBoardPreservingPedidos, countBoardCards } from '../server/boardPersist.mjs'
import { dedupeBoardCards } from '../shared/dedupeBoardCards.mjs'

function boardComCards(...cards) {
  const col = 'pedido-feito'
  return {
    columns: [{ id: col, title: 'Pedido feito' }],
    vendedores: [],
    segmentos: [],
    cards: cards.map((c, i) => ({
      id: c.id ?? `card-${i}`,
      columnId: col,
      cliente: c.cliente ?? 'Cliente',
      numeroPedido: c.numeroPedido ?? String(1000 + i),
      quantidade: 1,
      vendedorId: null,
      createdAt: '2026-10-06T12:00:00.000Z',
      etapaDesde: '2026-10-06T12:00:00.000Z',
      historicoEtapa: [],
      comentarios: c.comentarios ?? [],
      shopifyOrderId: c.shopifyOrderId,
      origem: c.origem,
    })),
  }
}

describe('sync automático — Shopify duplicado e merge', () => {
  it('une dois cards da mesma ordem Shopify em um só', () => {
    const board = boardComCards(
      { id: 'uuid-local', numeroPedido: '1052', cliente: 'Ana', shopifyOrderId: '998877', origem: 'shopify' },
      { id: 'shopify-998877', numeroPedido: '1052', cliente: 'Ana Silva', shopifyOrderId: '998877', origem: 'shopify' },
    )
    const deduped = dedupeBoardCards(board)
    assert.equal(countBoardCards(deduped), 1)
    assert.equal(deduped.cards[0].id, 'shopify-998877')
    assert.equal(deduped.cards[0].shopifyOrderId, '998877')
  })

  it('PUT com duplicata Shopify grava um único pedido', () => {
    const existing = boardComCards({
      id: 'shopify-1',
      numeroPedido: '1',
      shopifyOrderId: '111',
      origem: 'shopify',
    })
    const incoming = boardComCards(
      { id: 'shopify-1', numeroPedido: '1', shopifyOrderId: '111', origem: 'shopify' },
      { id: 'outro', numeroPedido: '1', shopifyOrderId: '111', origem: 'shopify', cliente: 'Mesmo' },
    )
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    assert.equal(countBoardCards(merged), 1)
  })

  it('não apaga pedido que só existe no servidor ao receber PUT menor', () => {
    const existing = boardComCards(
      { id: 'a', numeroPedido: '1' },
      { id: 'b', numeroPedido: '2' },
      { id: 'c', numeroPedido: '3' },
      { id: 'd', numeroPedido: '4' },
      { id: 'e', numeroPedido: '5' },
    )
    const incoming = boardComCards(
      { id: 'a', numeroPedido: '1' },
      { id: 'b', numeroPedido: '2' },
      { id: 'c', numeroPedido: '3' },
      { id: 'd', numeroPedido: '4' },
    )
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    assert.equal(countBoardCards(merged), 5)
    assert.ok(merged.cards.some((card) => card.id === 'e'))
  })
})
