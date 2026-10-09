import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  COLUNA_PEDIDO_FEITO_ID,
  cardIdShopify,
  encontrarCardParaPedidoShopify,
  mapShopifyOrderToCard,
  mesclarCardShopify,
  mergeShopifyEtapaTags,
  parseEtapaTag,
  pedidoFaltaLogo,
} from '../shared/shopifyOrderMap.mjs'

const order = {
  id: 998877,
  name: '#1042',
  order_number: 1042,
  created_at: '2026-10-05T12:00:00Z',
  updated_at: '2026-10-05T12:05:00Z',
  financial_status: 'paid',
  processed_at: '2026-10-05T12:01:00Z',
  tags: '',
  note: 'Uniforme empresa X',
  shipping_address: {
    first_name: 'Maria',
    last_name: 'Silva',
    phone: '11988887777',
    address1: 'Rua A, 10',
    city: 'São Paulo',
    province: 'SP',
    zip: '01000-000',
    country: 'Brazil',
  },
  line_items: [
    { title: 'Polo', quantity: 5 },
    { title: 'Corta-vento', quantity: 2 },
  ],
}

describe('Shopify → kanban', () => {
  it('mapeia pedido novo para Pedido feito', () => {
    const card = mapShopifyOrderToCard(order)
    assert.equal(card.id, cardIdShopify(998877))
    assert.equal(card.columnId, COLUNA_PEDIDO_FEITO_ID)
    assert.equal(card.cliente, 'Maria Silva')
    assert.equal(card.numeroPedido, '1042')
    assert.equal(card.canal, 'ecommerce')
    assert.equal(card.quantidade, 7)
    assert.equal(card.linhasPedido.length, 2)
    assert.equal(card.linhasPedido[0].quantidade, 5)
    assert.equal(card.linhasPedido[0].titulo, 'Polo')
    assert.equal(card.origem, 'shopify')
    assert.equal(card.dataPedido, '2026-10-05')
    assert.equal(pedidoFaltaLogo(card), true)
  })

  it('usa a data da loja no fuso do Brasil, não o dia UTC', async () => {
    const { dataPedidoNaLoja } = await import('../shared/shopifyOrderMap.mjs')
    assert.equal(dataPedidoNaLoja('2026-10-06T02:00:00Z'), '2026-10-05')
  })

  it('não apaga nem regride etapa local sem tag mais nova', () => {
    const mapped = mapShopifyOrderToCard(order)
    const existing = {
      ...mapped,
      columnId: 'logos-producao',
      etapaDesde: '2026-10-05T13:00:00Z',
      logoEnviadaCliente: ['https://img/logo.png'],
      comentarios: [{ id: 'c1', texto: 'ok', autorNome: 'A', autorEmail: 'a@a', at: '2026-10-05T13:00:00Z' }],
    }
    const out = mesclarCardShopify(existing, mapped, '2026-10-05T12:05:00Z')
    assert.equal(out.columnId, 'logos-producao')
    assert.equal(out.logoEnviadaCliente.length, 1)
    assert.equal(out.comentarios.length, 1)
  })

  it('lê e grava tag de etapa', () => {
    assert.equal(parseEtapaTag('vip, vestfirma-etapa:logos-prontas'), 'logos-prontas')
    assert.equal(mergeShopifyEtapaTags('vip, vestfirma-etapa:pedido-feito', 'em-aplicacao'), 'vip, vestfirma-etapa:em-aplicacao')
  })

  it('vincula ordem Shopify ao card que já está no kanban pelo número', () => {
    const found = encontrarCardParaPedidoShopify(
      [
        {
          id: 'manual-1021',
          numeroPedido: '1021',
          cliente: 'Cauê Henrique Gonçalves de Lima',
          columnId: 'em-aplicacao',
        },
      ],
      {
        id: 999001,
        order_number: 1021,
        name: '#1021',
        shipping_address: { first_name: 'Cauê', last_name: 'Henrique Gonçalves de Lima' },
      },
    )
    assert.equal(found.id, 'manual-1021')
  })

  it('ingest Shopify não cria segundo card quando o número já existe', async () => {
    const { ingestShopifyOrder } = await import('../server/shopifySync.mjs')
    const board = {
      columns: [
        { id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' },
        { id: 'em-aplicacao', title: 'Em aplicação' },
      ],
      vendedores: [],
      cards: [
        {
          id: 'manual-1021',
          columnId: 'em-aplicacao',
          cliente: 'Cauê Henrique Gonçalves de Lima',
          numeroPedido: '1021',
          quantidade: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          etapaDesde: '2026-10-01T00:00:00.000Z',
          historicoEtapa: [
            { id: 'h1', tipo: 'avancou', columnId: 'em-aplicacao', at: '2026-10-01T00:00:00.000Z' },
          ],
          comentarios: [],
        },
      ],
    }
    const result = await ingestShopifyOrder(
      board,
      {
        id: 555,
        order_number: 1021,
        name: '#1021',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
        shipping_address: { first_name: 'Cauê', last_name: 'Henrique Gonçalves de Lima' },
        line_items: [{ title: 'Camisa', quantity: 2 }],
      },
      'orders/updated',
    )
    assert.equal(result.created, false)
    assert.equal(result.board.cards.length, 1)
    assert.equal(result.board.cards[0].id, 'manual-1021')
    assert.equal(result.board.cards[0].shopifyOrderId, '555')
    assert.equal(result.board.cards[0].columnId, 'em-aplicacao')
  })

  it('cruza pelo número mesmo com nome diferente e não cria segundo card', async () => {
    const { ingestShopifyOrder } = await import('../server/shopifySync.mjs')
    const board = {
      columns: [
        { id: COLUNA_PEDIDO_FEITO_ID, title: 'Pedido feito' },
        { id: 'pedido-enviado', title: 'Pedido enviado' },
      ],
      vendedores: [],
      cards: [
        {
          id: 'manual-6',
          columnId: 'pedido-enviado',
          cliente: 'Gustavo',
          numeroPedido: '6',
          quantidade: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          etapaDesde: '2026-09-20T00:00:00.000Z',
          historicoEtapa: [{ id: 'h1', tipo: 'avancou', columnId: 'pedido-enviado', at: '2026-09-20T00:00:00.000Z' }],
          comentarios: [],
        },
      ],
    }
    const result = await ingestShopifyOrder(
      board,
      {
        id: 777001,
        order_number: 6,
        name: '#6',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
        financial_status: 'paid',
        shipping_address: { first_name: 'Gustavo', last_name: 'Filipe joias' },
        line_items: [{ title: 'Polo', quantity: 1 }],
      },
      'orders/create',
    )
    assert.equal(result.created, false)
    assert.equal(result.board.cards.length, 1)
    assert.equal(result.board.cards[0].id, 'manual-6')
    assert.equal(result.board.cards[0].columnId, 'pedido-enviado')
    assert.equal(result.board.cards[0].shopifyOrderId, '777001')
  })

  it('manda cancelado da Shopify para Cancelados / expirados sem arquivar', () => {
    const mapped = mapShopifyOrderToCard({
      ...order,
      cancelled_at: '2026-10-06T15:00:00Z',
      financial_status: 'voided',
    })
    assert.equal(mapped.columnId, 'cancelados-expirados')
    assert.equal(mapped.shopifyPedidoStatus, 'cancelado')
    assert.equal(mapped.arquivadoEm, null)

    const existing = {
      ...mapShopifyOrderToCard(order),
      columnId: 'em-aplicacao',
      etapaDesde: '2026-10-05T13:00:00Z',
    }
    const out = mesclarCardShopify(existing, mapped, '2026-10-06T15:00:00Z')
    assert.equal(out.columnId, 'cancelados-expirados')
    assert.equal(out.shopifyPedidoStatus, 'cancelado')
    assert.equal(out.arquivadoEm, null)
  })

  it('manda não pago antigo para Cancelados / expirados como expirado', () => {
    const mapped = mapShopifyOrderToCard({
      ...order,
      financial_status: 'pending',
      created_at: '2026-09-01T12:00:00Z',
      cancelled_at: null,
    })
    assert.equal(mapped.columnId, 'cancelados-expirados')
    assert.equal(mapped.shopifyPedidoStatus, 'expirado')
  })

  it('não trata pedido pago recente como expirado', () => {
    const mapped = mapShopifyOrderToCard(order)
    assert.equal(mapped.columnId, COLUNA_PEDIDO_FEITO_ID)
    assert.equal(mapped.shopifyPedidoStatus, null)
  })
})

describe('status de produção na Shopify', () => {
  it('grava só um texto que já existe na lista da loja', async () => {
    const { statusProducaoShopify } = await import('../shared/shopifyOrderMap.mjs')
    assert.equal(statusProducaoShopify('pedido-feito'), 'Pedido recebido')
    assert.equal(statusProducaoShopify('preview-em-andamento'), 'Preview em andamento')
    assert.equal(statusProducaoShopify('logos-recebidas'), 'Logos em produção')
    assert.equal(statusProducaoShopify('logos-producao'), 'Logos em produção')
    assert.equal(statusProducaoShopify('logos-prontas'), 'Logos Prontas')
    assert.equal(statusProducaoShopify('disponiveis-aplicacao'), 'Disponível para aplicação')
    assert.equal(statusProducaoShopify('em-aplicacao'), 'Processo de estamparia')
    assert.equal(statusProducaoShopify('liberado-logistica'), 'Liberado para envio')
    assert.equal(statusProducaoShopify('pedido-enviado'), 'Enviado')
    assert.equal(statusProducaoShopify('cancelados-expirados'), 'Pedido cancelado / expirado')
  })
})
