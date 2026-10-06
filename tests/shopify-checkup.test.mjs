import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classificarPedidosShopifyNoKanban } from '../shared/shopifyCheckup.mjs'
import { importarPedidosShopifyFaltantes } from '../server/shopifySync.mjs'
import { COLUNA_PEDIDO_FEITO_ID } from '../shared/shopifyOrderMap.mjs'

const shopifyOrders = [
  {
    id: 10,
    name: '#1021',
    order_number: 1021,
    created_at: '2026-09-15T18:00:00Z',
    updated_at: '2026-09-15T18:00:00Z',
    shipping_address: { first_name: 'Cauê', last_name: 'Henrique' },
    line_items: [{ title: 'Camisa', quantity: 2 }],
  },
  {
    id: 11,
    name: '#1088',
    order_number: 1088,
    created_at: '2026-10-01T14:30:00Z',
    updated_at: '2026-10-01T14:30:00Z',
    shipping_address: { first_name: 'Ana', last_name: 'Costa' },
    line_items: [{ title: 'Polo', quantity: 3 }],
  },
]

describe('checkup Shopify × kanban', () => {
  it('lista só o que ainda não está no quadro', () => {
    const board = {
      columns: [{ id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' }],
      cards: [
        {
          id: 'manual-1021',
          numeroPedido: '1021',
          cliente: 'Cauê Henrique',
          columnId: 'em-aplicacao',
        },
      ],
    }
    const report = classificarPedidosShopifyNoKanban(board, shopifyOrders)
    assert.equal(report.shopifyTotal, 2)
    assert.equal(report.jaNoKanban, 1)
    assert.equal(report.noKanban.length, 1)
    assert.equal(report.noKanban[0].numeroPedido, '1088')
    assert.equal(report.noKanban[0].dataPedido, '2026-10-01')
  })

  it('extrai o faltante com a data da Shopify e não duplica o que já existe', async () => {
    const board = {
      columns: [{ id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' }],
      vendedores: [],
      cards: [
        {
          id: 'manual-1021',
          numeroPedido: '1021',
          cliente: 'Cauê Henrique',
          columnId: 'em-aplicacao',
          createdAt: '2026-09-15T18:00:00.000Z',
          etapaDesde: '2026-09-20T12:00:00.000Z',
          historicoEtapa: [],
          comentarios: [],
        },
      ],
    }
    const result = await importarPedidosShopifyFaltantes(board, shopifyOrders)
    assert.equal(result.imported, 1)
    assert.equal(result.board.cards.length, 2)
    const extraido = result.board.cards.find((c) => c.numeroPedido === '1088')
    assert.equal(extraido.dataPedido, '2026-10-01')
    assert.equal(extraido.createdAt, '2026-10-01T14:30:00.000Z')
    assert.equal(extraido.columnId, COLUNA_PEDIDO_FEITO_ID)
    const caue = result.board.cards.find((c) => c.numeroPedido === '1021')
    assert.equal(caue.id, 'manual-1021')
    assert.equal(caue.columnId, 'em-aplicacao')
  })

  it('traz de volta ao kanban o pedido Shopify que estava só arquivado', async () => {
    const board = {
      columns: [{ id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' }],
      vendedores: [],
      cards: [
        {
          id: 'shopify-11',
          numeroPedido: '1088',
          cliente: 'Ana Costa',
          columnId: COLUNA_PEDIDO_FEITO_ID,
          shopifyOrderId: '11',
          origem: 'shopify',
          arquivadoEm: '2026-10-02T00:00:00.000Z',
          createdAt: '2026-10-01T14:30:00.000Z',
          etapaDesde: '2026-10-01T14:30:00.000Z',
          historicoEtapa: [],
          comentarios: [],
        },
      ],
    }
    const result = await importarPedidosShopifyFaltantes(board, shopifyOrders)
    assert.equal(result.imported, 1)
    assert.equal(result.restaurados, 1)
    const ana = result.board.cards.find((c) => c.numeroPedido === '1088')
    assert.equal(ana.arquivadoEm, null)
  })

  it('não desarquiva pedido cancelado na Shopify (admin decide arquivar)', async () => {
    const board = {
      columns: [{ id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' }],
      vendedores: [],
      cards: [
        {
          id: 'shopify-99',
          numeroPedido: '1099',
          cliente: 'Pedido Cancelado',
          columnId: COLUNA_PEDIDO_FEITO_ID,
          shopifyOrderId: '99',
          origem: 'shopify',
          arquivadoEm: '2026-10-02T00:00:00.000Z',
          createdAt: '2026-10-01T14:30:00.000Z',
          etapaDesde: '2026-10-01T14:30:00.000Z',
          historicoEtapa: [],
          comentarios: [],
        },
      ],
    }
    const result = await importarPedidosShopifyFaltantes(board, [
      {
        id: 99,
        name: '#1099',
        order_number: 1099,
        cancelled_at: '2026-10-03T10:00:00Z',
        financial_status: 'voided',
        created_at: '2026-10-01T14:30:00Z',
        updated_at: '2026-10-03T10:00:00Z',
        shipping_address: { first_name: 'Pedido', last_name: 'Cancelado' },
        line_items: [{ title: 'Polo', quantity: 1 }],
      },
    ])
    assert.equal(result.restaurados, 0)
    const card = result.board.cards.find((c) => c.numeroPedido === '1099')
    assert.equal(card.arquivadoEm, '2026-10-02T00:00:00.000Z')
    assert.equal(card.columnId, 'cancelados-expirados')
  })
})
