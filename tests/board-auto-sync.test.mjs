import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBoardPreservingPedidos, countBoardCards } from '../server/boardPersist.mjs'
import { dedupeBoardCards } from '../shared/dedupeBoardCards.mjs'
import { mergeOrderCardFields } from '../shared/mergeOrderCard.mjs'

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

  it('arraste manual vence comentário mais novo na outra cópia', () => {
    const noServidor = {
      id: 'p1',
      columnId: 'logos-recebidas',
      etapaDesde: '2026-10-06T14:00:00.000Z',
      createdAt: '2026-10-06T10:00:00.000Z',
      historicoEtapa: [
        { id: 'h1', tipo: 'avancou', columnId: 'logos-recebidas', at: '2026-10-06T14:00:00.000Z' },
      ],
      comentarios: [],
      cliente: 'Manual',
      numeroPedido: '7',
    }
    const noTablet = {
      ...noServidor,
      columnId: 'pedido-feito',
      etapaDesde: '2026-10-06T10:00:00.000Z',
      historicoEtapa: [],
      comentarios: [{ id: 'c1', texto: 'oi', at: '2026-10-06T15:00:00.000Z' }],
    }
    const merged = mergeOrderCardFields(noServidor, noTablet)
    assert.equal(merged.columnId, 'logos-recebidas')
    assert.equal(merged.comentarios.length, 1)
  })

  it('PUT com pedido manual novo não some no servidor', () => {
    const existing = boardComCards(
      { id: 'shopify-1', numeroPedido: '1049', shopifyOrderId: '1', origem: 'shopify' },
    )
    const incoming = boardComCards(
      { id: 'shopify-1', numeroPedido: '1049', shopifyOrderId: '1', origem: 'shopify' },
      { id: 'manual-uuid', numeroPedido: '6', cliente: 'Gustavo' },
    )
    const merged = mergeBoardPreservingPedidos(existing, incoming)
    assert.equal(countBoardCards(merged), 2)
    assert.ok(merged.cards.some((card) => card.id === 'manual-uuid'))
  })
})
